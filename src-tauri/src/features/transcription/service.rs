use std::path::PathBuf;
use std::thread;

use sqlx::SqlitePool;
use tauri::{AppHandle, Emitter, Manager};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

use crate::features::transcription::audio_prep;
use crate::features::transcription::model;

pub struct TranscriptSegment {
    segment_index: u64,
    start_ms: u64,
    end_ms: u64,
    text: String,
}

#[derive(Clone, serde::Serialize)]
pub struct TranscriptionProgress {
    pub entry_id: String,
    pub progress: i32,
}

#[derive(Clone, serde::Serialize)]
pub struct TranscriptionComplete {
    pub entry_id: String,
}

#[derive(Clone, serde::Serialize)]
pub struct TranscriptionFailed {
    pub entry_id: String,
    pub error: String,
}

pub fn spawn_transcription_thread(file_path: PathBuf, entry_id: String, app: AppHandle) {
    thread::spawn(move || match transcribe(file_path, &entry_id, &app) {
        Ok(()) => {
            let _ = app.emit(
                "transcription-complete",
                TranscriptionComplete {
                    entry_id: entry_id.clone(),
                },
            );
        }
        Err(error) => {
            eprintln!("Transcription failed for {}: {}", entry_id, error);
            let _ = app.emit(
                "transcription-failed",
                TranscriptionFailed {
                    entry_id: entry_id.clone(),
                    error,
                },
            );
        }
    });
}

fn transcribe(file_path: PathBuf, entry_id: &str, app: &AppHandle) -> Result<(), String> {
    let model_path = model::ensure_model_available(app)
        .map_err(|err| format!("Failed to prepare transcription model: {err}"))?;

    let samples = audio_prep::convert_audio(&file_path)
        .map_err(|err| format!("Error loading audio file '{}': {err}", file_path.display()))?;

    let ctx = WhisperContext::new_with_params(
        model_path.to_string_lossy().as_ref(),
        WhisperContextParameters::default(),
    )
    .map_err(|err| format!("Failed to load transcription model: {err}"))?;

    let mut state = ctx
        .create_state()
        .map_err(|err| format!("Failed to create transcription state: {err}"))?;

    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    let thread_count = std::thread::available_parallelism()
        .map(|count| count.get().clamp(1, 8) as i32)
        .unwrap_or(4);
    params.set_n_threads(thread_count);

    params.set_language(Some("en"));

    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_token_timestamps(false);

    let app_for_callback = app.clone();
    let entry_id_for_callback = entry_id.to_string();

    params.set_progress_callback_safe(move |progress: i32| {
        let _ = app_for_callback.emit(
            "transcription-progress",
            TranscriptionProgress {
                entry_id: entry_id_for_callback.clone(),
                progress: progress.min(99),
            },
        );
    });

    state
        .full(params, &samples[..])
        .map_err(|err| format!("Failed to run transcription model: {err}"))?;

    let db = app.state::<SqlitePool>();

    let mut segments: Vec<TranscriptSegment> = Vec::new();
    for (i, segment) in state.as_iter().enumerate() {
        let start_ms = (segment.start_timestamp() * 10) as u64;
        let end_ms = (segment.end_timestamp() * 10) as u64;
        let text = segment.to_str().unwrap_or_default().to_owned();

        segments.push(TranscriptSegment {
            segment_index: i as u64,
            start_ms,
            end_ms,
            text,
        });
    }

    tauri::async_runtime::block_on(async {
        let mut tx = db.begin().await.map_err(|e| e.to_string())?;

        sqlx::query("DELETE FROM transcript_segments WHERE entry_id = ?")
            .bind(entry_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

        sqlx::query("DELETE FROM transcript_overrides WHERE entry_id = ?")
            .bind(entry_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

        for segment in &segments {
            sqlx::query(
                    "INSERT INTO transcript_segments (entry_id, segment_index, start_ms, end_ms, text) VALUES (?, ?, ?, ?, ?)",
                )
                .bind(entry_id)
                .bind(segment.segment_index as i64)
                .bind(segment.start_ms as i64)
                .bind(segment.end_ms as i64)
                .bind(&segment.text)
                .execute(&mut *tx)
                .await
                .map_err(|e| e.to_string())?;
        }

        tx.commit().await.map_err(|e| e.to_string())?;

        println!(
            "Saved {} transcript segments for entry: {}",
            segments.len(),
            entry_id
        );

        Ok(())
    })
}
