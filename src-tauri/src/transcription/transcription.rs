use std::path::PathBuf;
use std::thread;

use crate::transcription::audio_prep;
use sqlx::SqlitePool;
use tauri::{AppHandle, Emitter, Manager};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

use std::sync::Arc;

pub struct TranscriptSegment {
    segment_index: u64,
    start_ms: u64,
    end_ms: u64,
    text: String,
}

#[derive(Clone, serde::Serialize)]
pub struct TranscriptionProgress {
    pub entry_id: String,
    pub progress: i32, // 0-100
}
pub struct TranscriptionResult {
    full_text: String,
    segments: Vec<TranscriptSegment>,
}

pub fn spawn_transcription_thread(file_path: PathBuf, entry_id: String, app: AppHandle) {
    thread::spawn(move || {
        let model_path = "resources/ggml-base.en.bin";

        let samples = match audio_prep::convert_audio(&file_path) {
            Ok(samples) => samples,
            Err(err) => {
                eprintln!(
                    "Error loading audio file '{}': {}",
                    file_path.display(),
                    err
                );
                return;
            }
        };

        let ctx = WhisperContext::new_with_params(&model_path, WhisperContextParameters::default())
            .expect("failed to load model");

        let mut state = ctx.create_state().expect("failed to create state");

        let mut params = FullParams::new(SamplingStrategy::BeamSearch {
            beam_size: 5,
            patience: -1.0,
        });

        params.set_language(Some("en"));

        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);
        params.set_token_timestamps(true);
        params.set_max_len(1);

        let app_for_callback = app.clone();
        let entry_id_for_callback = entry_id.clone();

        params.set_progress_callback_safe(move |progress| {
            let _ = app_for_callback.emit(
                "transcription-progress",
                TranscriptionProgress {
                    entry_id: entry_id_for_callback.clone(),
                    progress,
                },
            );
        });

        state
            .full(params, &samples[..])
            .expect("failed to run model");

        let db = app.state::<SqlitePool>();

        let mut segments: Vec<TranscriptSegment> = Vec::new();
        let mut full_text_parts: Vec<String> = Vec::new();

        for (i, segment) in state.as_iter().enumerate() {
            let start_ms = (segment.start_timestamp() * 10) as u64;
            let end_ms = (segment.end_timestamp() * 10) as u64;
            let text = segment.to_str().unwrap_or_default().to_owned();

            full_text_parts.push(text.clone());
            segments.push(TranscriptSegment {
                segment_index: i as u64,
                start_ms,
                end_ms,
                text,
            });
        }

        let full_text = full_text_parts.join(" ");

        println!("Transcript for entry {}: {}", entry_id, full_text);

        tauri::async_runtime::block_on(async {
            if let Err(e) = sqlx::query("UPDATE entries SET transcript = ? WHERE id = ?")
                .bind(&full_text)
                .bind(&entry_id)
                .execute(db.inner())
                .await
            {
                eprintln!("Failed to save transcript: {}", e);
                return;
            }

            for segment in &segments {
                if let Err(e) = sqlx::query(
                    "INSERT INTO transcript_segments (entry_id, segment_index, start_ms, end_ms, text) VALUES (?, ?, ?, ?, ?)"
                )
                    .bind(&entry_id)
                    .bind(segment.segment_index as i64)
                    .bind(segment.start_ms as i64)
                    .bind(segment.end_ms as i64)
                    .bind(&segment.text)
                    .execute(db.inner())
                    .await
                {
                    eprintln!("Failed to save segment {}: {}", segment.segment_index, e);
                }
            }

            println!(
                "Saved transcript and {} segments for entry: {}",
                segments.len(),
                entry_id
            );
        });
    });
}
