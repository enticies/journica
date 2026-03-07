use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use std::collections::HashSet;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;
use uuid::Uuid;

fn tokenize_query(query: &str) -> Vec<String> {
    query
        .split(|c: char| !c.is_alphanumeric())
        .map(|token| token.to_lowercase())
        .filter(|token| !token.is_empty())
        .collect()
}

fn normalize_tag_name(name: &str) -> String {
    name.trim().to_lowercase()
}

fn effective_transcript_expr(entry_alias: &str, override_alias: &str) -> String {
    format!(
        "COALESCE({}.text, (SELECT group_concat(text, ' ') FROM (SELECT text FROM transcript_segments WHERE entry_id = {}.id ORDER BY segment_index)))",
        override_alias, entry_alias
    )
}

async fn ensure_tags_schema(pool: &SqlitePool) -> Result<(), String> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS tags (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            normalized_name TEXT NOT NULL UNIQUE,
            created_at INTEGER NOT NULL
        )",
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS entry_tags (
            entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
            tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
            PRIMARY KEY (entry_id, tag_id)
        )",
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_entry_tags_entry_id ON entry_tags(entry_id)")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_entry_tags_tag_id ON entry_tags(tag_id)")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_recording_path(filename: String, app: tauri::AppHandle) -> Result<String, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("recordings")
        .join(&filename);

    path.to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Invalid path".to_string())
}

#[derive(Clone, Serialize, Deserialize, FromRow)]
pub struct Entry {
    pub id: String,
    pub filename: String,
    pub created_at: i64,
    pub duration_seconds: Option<f64>,
    pub transcript: Option<String>,
    pub title: Option<String>,
}

#[derive(Clone, Serialize, Deserialize, FromRow)]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub created_at: i64,
}

#[derive(Clone, Serialize, Deserialize, FromRow)]
pub struct EntryTagRecord {
    pub entry_id: String,
    pub tag_id: String,
    pub tag_name: String,
    pub tag_created_at: i64,
}

#[derive(Clone, Serialize, Deserialize, FromRow)]
pub struct TranscriptSegment {}

#[tauri::command]
pub async fn get_transcript_segments(entry_id: String) {}

#[tauri::command]
pub async fn get_segment_at_time(entry_id: String, time_ms: i64) {}

#[tauri::command]
pub async fn get_entries(pool: tauri::State<'_, SqlitePool>) -> Result<Vec<Entry>, String> {
    let entries = sqlx::query_as::<_, Entry>(
        "SELECT e.id, e.filename, e.created_at, e.duration_seconds,
                COALESCE(o.text, (SELECT group_concat(text, ' ') FROM (SELECT text FROM transcript_segments WHERE entry_id = e.id ORDER BY segment_index))) AS transcript,
                e.title
         FROM entries e
         LEFT JOIN transcript_overrides o ON o.entry_id = e.id
         ORDER BY e.created_at DESC",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(entries)
}

#[tauri::command]
pub async fn query_entries(
    pool: tauri::State<'_, SqlitePool>,
    query: Option<String>,
    limit: i64,
    offset: i64,
) -> Result<Vec<Entry>, String> {
    ensure_tags_schema(pool.inner()).await?;

    let safe_limit = limit.clamp(1, 500);
    let safe_offset = offset.max(0);
    let trimmed_query = query.unwrap_or_default().trim().to_string();

    if trimmed_query.is_empty() {
        let entries = sqlx::query_as::<_, Entry>(
            "SELECT e.id, e.filename, e.created_at, e.duration_seconds,
                    COALESCE(o.text, (SELECT group_concat(text, ' ') FROM (SELECT text FROM transcript_segments WHERE entry_id = e.id ORDER BY segment_index))) AS transcript,
                    e.title
             FROM entries e
             LEFT JOIN transcript_overrides o ON o.entry_id = e.id
             ORDER BY e.created_at DESC
             LIMIT ? OFFSET ?",
        )
        .bind(safe_limit)
        .bind(safe_offset)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

        return Ok(entries);
    }

    let terms = tokenize_query(&trimmed_query);

    if terms.is_empty() {
        return Ok(Vec::new());
    }

    let effective_transcript = effective_transcript_expr("e", "o");

    let mut fallback_sql = format!(
        "SELECT e.id, e.filename, e.created_at, e.duration_seconds, {} AS transcript, e.title
         FROM entries e
         LEFT JOIN transcript_overrides o ON o.entry_id = e.id
         WHERE ",
        effective_transcript
    );

    for (index, _) in terms.iter().enumerate() {
        if index > 0 {
            fallback_sql.push_str(" AND ");
        }

        let tag_clause = "EXISTS (SELECT 1 FROM entry_tags et JOIN tags t ON t.id = et.tag_id WHERE et.entry_id = e.id AND LOWER(t.name) LIKE LOWER(?))";
        fallback_sql.push_str(&format!(
            "(LOWER(COALESCE(e.title, '')) LIKE LOWER(?) OR LOWER(e.filename) LIKE LOWER(?) OR LOWER(COALESCE({}, '')) LIKE LOWER(?) OR {})",
            effective_transcript, tag_clause
        ));
    }

    fallback_sql.push_str(" ORDER BY e.created_at DESC LIMIT ? OFFSET ?");

    let mut fallback_query = sqlx::query_as::<_, Entry>(&fallback_sql);

    for term in &terms {
        let like_pattern = format!("%{}%", term);
        fallback_query = fallback_query
            .bind(like_pattern.clone())
            .bind(like_pattern.clone())
            .bind(like_pattern.clone())
            .bind(like_pattern);
    }

    let fallback_entries = fallback_query
        .bind(safe_limit)
        .bind(safe_offset)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(fallback_entries)
}

#[tauri::command]
pub async fn list_tags(pool: tauri::State<'_, SqlitePool>) -> Result<Vec<Tag>, String> {
    ensure_tags_schema(pool.inner()).await?;

    let tags = sqlx::query_as::<_, Tag>(
        "SELECT id, name, created_at FROM tags ORDER BY name COLLATE NOCASE ASC",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(tags)
}

#[tauri::command]
pub async fn create_tag(name: String, pool: tauri::State<'_, SqlitePool>) -> Result<Tag, String> {
    ensure_tags_schema(pool.inner()).await?;

    let trimmed_name = name.trim();
    if trimmed_name.is_empty() {
        return Err("Tag name cannot be empty".to_string());
    }

    let normalized_name = normalize_tag_name(trimmed_name);

    if let Some(existing) = sqlx::query_as::<_, Tag>(
        "SELECT id, name, created_at FROM tags WHERE normalized_name = ? LIMIT 1",
    )
    .bind(&normalized_name)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?
    {
        return Ok(existing);
    }

    let id = Uuid::new_v4().to_string();
    let created_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs() as i64;

    sqlx::query("INSERT INTO tags (id, name, normalized_name, created_at) VALUES (?, ?, ?, ?)")
        .bind(&id)
        .bind(trimmed_name)
        .bind(&normalized_name)
        .bind(created_at)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(Tag {
        id,
        name: trimmed_name.to_string(),
        created_at,
    })
}

#[tauri::command]
pub async fn delete_tag(tag_id: String, pool: tauri::State<'_, SqlitePool>) -> Result<(), String> {
    ensure_tags_schema(pool.inner()).await?;

    sqlx::query("DELETE FROM tags WHERE id = ?")
        .bind(tag_id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn set_entry_tags(
    entry_id: String,
    tag_ids: Vec<String>,
    pool: tauri::State<'_, SqlitePool>,
) -> Result<(), String> {
    ensure_tags_schema(pool.inner()).await?;

    let mut seen = HashSet::new();
    let unique_tag_ids = tag_ids
        .into_iter()
        .filter(|tag_id| seen.insert(tag_id.clone()))
        .collect::<Vec<_>>();

    let mut transaction = pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM entry_tags WHERE entry_id = ?")
        .bind(&entry_id)
        .execute(&mut *transaction)
        .await
        .map_err(|e| e.to_string())?;

    for tag_id in &unique_tag_ids {
        sqlx::query("INSERT INTO entry_tags (entry_id, tag_id) VALUES (?, ?)")
            .bind(&entry_id)
            .bind(tag_id)
            .execute(&mut *transaction)
            .await
            .map_err(|e| e.to_string())?;
    }

    transaction.commit().await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_entry_tags(
    entry_ids: Vec<String>,
    pool: tauri::State<'_, SqlitePool>,
) -> Result<Vec<EntryTagRecord>, String> {
    ensure_tags_schema(pool.inner()).await?;

    if entry_ids.is_empty() {
        return Ok(Vec::new());
    }

    let placeholders = std::iter::repeat("?")
        .take(entry_ids.len())
        .collect::<Vec<_>>()
        .join(", ");
    let sql = format!(
        "SELECT et.entry_id, t.id AS tag_id, t.name AS tag_name, t.created_at AS tag_created_at
         FROM entry_tags et
         JOIN tags t ON t.id = et.tag_id
         WHERE et.entry_id IN ({})
         ORDER BY t.name COLLATE NOCASE ASC",
        placeholders
    );

    let mut query = sqlx::query_as::<_, EntryTagRecord>(&sql);
    for entry_id in &entry_ids {
        query = query.bind(entry_id);
    }

    let result = query
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(result)
}

#[tauri::command]
pub async fn delete_entry(
    id: String,
    app: tauri::AppHandle,
    pool: tauri::State<'_, SqlitePool>,
) -> Result<(), String> {
    #[derive(FromRow)]
    struct EntryFile {
        filename: String,
    }

    let entry = sqlx::query_as::<_, EntryFile>("SELECT filename FROM entries WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    if let Some(entry) = entry {
        let file_path = app
            .path()
            .app_data_dir()
            .map_err(|e| e.to_string())?
            .join("recordings")
            .join(&entry.filename);

        if file_path.exists() {
            std::fs::remove_file(&file_path).map_err(|e| e.to_string())?;
        }

        sqlx::query("DELETE FROM entries WHERE id = ?")
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;

        println!("Deleted entry: {}", id);
    }

    Ok(())
}
