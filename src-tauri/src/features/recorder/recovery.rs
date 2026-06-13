use sqlx::SqlitePool;
use std::path::Path;
use tauri::AppHandle;

use super::audio_engine::RecordingManifest;
use super::audio_engine::{merge_manifest_chunks, read_manifest};
use crate::features::recordings::commands::ensure_today_folder;
use crate::features::transcription;
use crate::shared::paths;

async fn entry_exists(pool: &SqlitePool, entry_id: &str) -> Result<bool, String> {
    let existing: Option<(String,)> = sqlx::query_as("SELECT id FROM entries WHERE id = ? LIMIT 1")
        .bind(entry_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(existing.is_some())
}

async fn entry_has_transcript(pool: &SqlitePool, entry_id: &str) -> Result<bool, String> {
    let segment_count: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM transcript_segments WHERE entry_id = ?")
            .bind(entry_id)
            .fetch_one(pool)
            .await
            .map_err(|e| e.to_string())?;
    let override_count: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM transcript_overrides WHERE entry_id = ?")
            .bind(entry_id)
            .fetch_one(pool)
            .await
            .map_err(|e| e.to_string())?;

    Ok(segment_count.0 > 0 || override_count.0 > 0)
}

async fn recover_session(
    app: &AppHandle,
    pool: &SqlitePool,
    session_dir: &Path,
) -> Result<bool, String> {
    let mut manifest = read_manifest(session_dir)?;
    reconcile_chunks(session_dir, &mut manifest)?;

    if manifest.chunks.is_empty() {
        eprintln!(
            "Skipping recording recovery for {} because it has no finalized chunks.",
            manifest.id
        );
        return Ok(false);
    }

    let recordings_dir = paths::recordings_dir(app)?;
    let final_file_path = recordings_dir.join(&manifest.storage_path);

    if entry_exists(pool, &manifest.id).await? {
        if !final_file_path.exists() {
            merge_manifest_chunks(session_dir, &manifest, &final_file_path)?;
        }
        if !entry_has_transcript(pool, &manifest.id).await? {
            transcription::spawn_transcription_thread(
                final_file_path,
                manifest.id.clone(),
                app.clone(),
            );
        }
        std::fs::remove_dir_all(session_dir).ok();
        return Ok(false);
    }

    let duration_seconds = merge_manifest_chunks(session_dir, &manifest, &final_file_path)?;
    let folder_id = ensure_today_folder(manifest.created_at, pool).await?;

    sqlx::query(
        "INSERT INTO entries (id, folder_id, storage_path, display_name, created_at, duration_seconds) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&manifest.id)
    .bind(&folder_id)
    .bind(&manifest.storage_path)
    .bind(&manifest.display_name)
    .bind(manifest.created_at)
    .bind(duration_seconds)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    transcription::spawn_transcription_thread(final_file_path, manifest.id.clone(), app.clone());
    std::fs::remove_dir_all(session_dir).ok();

    Ok(true)
}

fn reconcile_chunks(session_dir: &Path, manifest: &mut RecordingManifest) -> Result<(), String> {
    let mut chunks = Vec::new();
    for entry in std::fs::read_dir(session_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_name = entry.file_name().to_string_lossy().to_string();
        if file_name.starts_with("chunk_")
            && file_name.ends_with(".wav")
            && !file_name.contains(".tmp")
        {
            chunks.push(file_name);
        }
    }

    chunks.sort();
    if !chunks.is_empty() {
        manifest.chunks = chunks;
    }

    Ok(())
}

pub async fn recover_incomplete_recordings(
    app: &AppHandle,
    pool: &SqlitePool,
) -> Result<usize, String> {
    let in_progress_dir = paths::recordings_dir(app)?.join("in-progress");
    if !in_progress_dir.exists() {
        return Ok(0);
    }

    let mut recovered_count = 0;
    let sessions = std::fs::read_dir(&in_progress_dir).map_err(|e| e.to_string())?;

    for session in sessions {
        let session = session.map_err(|e| e.to_string())?;
        let session_dir = session.path();
        if !session_dir.is_dir() {
            continue;
        }

        match recover_session(app, pool, &session_dir).await {
            Ok(true) => recovered_count += 1,
            Ok(false) => {}
            Err(error) => eprintln!(
                "Failed to recover recording from {:?}: {error}",
                session_dir
            ),
        }
    }

    Ok(recovered_count)
}
