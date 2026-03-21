use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use std::collections::HashSet;
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

use crate::shared::paths;

fn tokenize_query(query: &str) -> Vec<String> {
    query
        .split(|c: char| !c.is_alphanumeric())
        .map(|token| token.to_lowercase())
        .filter(|token| !token.is_empty())
        .collect()
}

fn normalize_name(name: &str) -> String {
    name.trim().to_lowercase()
}

fn effective_transcript_expr(entry_alias: &str, override_alias: &str) -> String {
    format!(
        "COALESCE({}.text, (SELECT group_concat(text, ' ') FROM (SELECT text FROM transcript_segments WHERE entry_id = {}.id ORDER BY segment_index)))",
        override_alias, entry_alias
    )
}

fn now_unix() -> Result<i64, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .map_err(|e| e.to_string())
}

fn date_parts_from_unix(secs: i64) -> (i32, u32, u32) {
    let days_since_epoch = (secs as u64) / 86400;

    let mut year: i32 = 1970;
    let mut remaining_days = days_since_epoch as i32;

    loop {
        let days_in_year = if year % 4 == 0 && (year % 100 != 0 || year % 400 == 0) {
            366
        } else {
            365
        };
        if remaining_days < days_in_year {
            break;
        }
        remaining_days -= days_in_year;
        year += 1;
    }

    let is_leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let days_in_months: [i32; 12] = [
        31,
        if is_leap { 29 } else { 28 },
        31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
    ];

    let mut month: u32 = 0;
    for (i, &days) in days_in_months.iter().enumerate() {
        if remaining_days < days {
            month = (i + 1) as u32;
            break;
        }
        remaining_days -= days;
    }
    let day = (remaining_days + 1) as u32;

    (year, month, day)
}

async fn find_or_create_child_folder(
    parent_id: &str,
    name: &str,
    pool: &SqlitePool,
) -> Result<String, String> {
    let normalized = normalize_name(name);

    let existing: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM folders WHERE parent_id = ? AND normalized_name = ? LIMIT 1",
    )
    .bind(parent_id)
    .bind(&normalized)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    if let Some((id,)) = existing {
        return Ok(id);
    }

    let id = Uuid::new_v4().to_string();
    let now = now_unix()?;

    sqlx::query(
        "INSERT INTO folders (id, parent_id, name, normalized_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(parent_id)
    .bind(name)
    .bind(&normalized)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(id)
}

pub async fn ensure_today_folder(created_at: i64, pool: &SqlitePool) -> Result<String, String> {
    let (year, month, day) = date_parts_from_unix(created_at);

    let year_name = format!("{:04}", year);
    let month_name = format!("{:02}", month);
    let day_name = format!("{:02}", day);

    let year_id = find_or_create_child_folder("root", &year_name, pool).await?;
    let month_id = find_or_create_child_folder(&year_id, &month_name, pool).await?;
    let day_id = find_or_create_child_folder(&month_id, &day_name, pool).await?;

    Ok(day_id)
}

#[tauri::command]
pub fn get_recording_path(storage_path: String, app: tauri::AppHandle) -> Result<String, String> {
    let path = paths::recordings_dir(&app)?.join(&storage_path);

    path.to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Invalid path".to_string())
}

#[derive(Clone, Serialize, Deserialize, FromRow)]
pub struct Entry {
    pub id: String,
    pub folder_id: String,
    pub storage_path: String,
    pub display_name: String,
    pub created_at: i64,
    pub duration_seconds: Option<f64>,
    pub transcript: Option<String>,
    pub title: Option<String>,
}

#[derive(Clone, Serialize, Deserialize, FromRow)]
pub struct Folder {
    pub id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub created_at: i64,
    pub updated_at: i64,
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

#[tauri::command]
pub async fn get_entries(pool: tauri::State<'_, SqlitePool>) -> Result<Vec<Entry>, String> {
    let entries = sqlx::query_as::<_, Entry>(
        "SELECT e.id, e.folder_id, e.storage_path, e.display_name, e.created_at, e.duration_seconds,
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
    folder_id: Option<String>,
) -> Result<Vec<Entry>, String> {
    let safe_limit = limit.clamp(1, 500);
    let safe_offset = offset.max(0);
    let trimmed_query = query.unwrap_or_default().trim().to_string();

    if trimmed_query.is_empty() {
        let sql = if folder_id.is_some() {
            "WITH RECURSIVE folder_scope(id) AS (
                 SELECT ?
                 UNION ALL
                 SELECT f.id
                 FROM folders f
                 JOIN folder_scope fs ON f.parent_id = fs.id
             )
             SELECT e.id, e.folder_id, e.storage_path, e.display_name, e.created_at, e.duration_seconds,
                    COALESCE(o.text, (SELECT group_concat(text, ' ') FROM (SELECT text FROM transcript_segments WHERE entry_id = e.id ORDER BY segment_index))) AS transcript,
                    e.title
             FROM entries e
             LEFT JOIN transcript_overrides o ON o.entry_id = e.id
             WHERE e.folder_id IN (SELECT id FROM folder_scope)
             ORDER BY e.created_at DESC
             LIMIT ? OFFSET ?"
        } else {
            "SELECT e.id, e.folder_id, e.storage_path, e.display_name, e.created_at, e.duration_seconds,
                    COALESCE(o.text, (SELECT group_concat(text, ' ') FROM (SELECT text FROM transcript_segments WHERE entry_id = e.id ORDER BY segment_index))) AS transcript,
                    e.title
             FROM entries e
             LEFT JOIN transcript_overrides o ON o.entry_id = e.id
             ORDER BY e.created_at DESC
             LIMIT ? OFFSET ?"
        };

        let mut q = sqlx::query_as::<_, Entry>(sql);
        if let Some(ref fid) = folder_id {
            q = q.bind(fid);
        }
        q = q.bind(safe_limit).bind(safe_offset);

        let entries = q.fetch_all(pool.inner()).await.map_err(|e| e.to_string())?;
        return Ok(entries);
    }

    let terms = tokenize_query(&trimmed_query);

    if terms.is_empty() {
        return Ok(Vec::new());
    }

    let effective_transcript = effective_transcript_expr("e", "o");

    let mut sql = format!(
        "SELECT e.id, e.folder_id, e.storage_path, e.display_name, e.created_at, e.duration_seconds, {} AS transcript, e.title
         FROM entries e
         LEFT JOIN transcript_overrides o ON o.entry_id = e.id
         WHERE ",
        effective_transcript
    );

    if folder_id.is_some() {
        sql.push_str(
            "e.folder_id IN (
                WITH RECURSIVE folder_scope(id) AS (
                    SELECT ?
                    UNION ALL
                    SELECT f.id
                    FROM folders f
                    JOIN folder_scope fs ON f.parent_id = fs.id
                )
                SELECT id FROM folder_scope
            ) AND ",
        );
    }

    for (index, _) in terms.iter().enumerate() {
        if index > 0 {
            sql.push_str(" AND ");
        }

        let tag_clause = "EXISTS (SELECT 1 FROM entry_tags et JOIN tags t ON t.id = et.tag_id WHERE et.entry_id = e.id AND LOWER(t.name) LIKE LOWER(?))";
        sql.push_str(&format!(
            "(LOWER(COALESCE(e.title, '')) LIKE LOWER(?) OR LOWER(e.display_name) LIKE LOWER(?) OR LOWER(COALESCE({}, '')) LIKE LOWER(?) OR {})",
            effective_transcript, tag_clause
        ));
    }

    sql.push_str(" ORDER BY e.created_at DESC LIMIT ? OFFSET ?");

    let mut q = sqlx::query_as::<_, Entry>(&sql);

    if let Some(ref fid) = folder_id {
        q = q.bind(fid);
    }

    for term in &terms {
        let like_pattern = format!("%{}%", term);
        q = q
            .bind(like_pattern.clone())
            .bind(like_pattern.clone())
            .bind(like_pattern.clone())
            .bind(like_pattern);
    }

    let entries = q
        .bind(safe_limit)
        .bind(safe_offset)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(entries)
}

#[tauri::command]
pub async fn list_tags(pool: tauri::State<'_, SqlitePool>) -> Result<Vec<Tag>, String> {
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
    let trimmed_name = name.trim();
    if trimmed_name.is_empty() {
        return Err("Tag name cannot be empty".to_string());
    }

    let normalized = normalize_name(trimmed_name);

    if let Some(existing) = sqlx::query_as::<_, Tag>(
        "SELECT id, name, created_at FROM tags WHERE normalized_name = ? LIMIT 1",
    )
    .bind(&normalized)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?
    {
        return Ok(existing);
    }

    let id = Uuid::new_v4().to_string();
    let created_at = now_unix()?;

    sqlx::query("INSERT INTO tags (id, name, normalized_name, created_at) VALUES (?, ?, ?, ?)")
        .bind(&id)
        .bind(trimmed_name)
        .bind(&normalized)
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
    struct EntryStorage {
        storage_path: String,
    }

    let entry = sqlx::query_as::<_, EntryStorage>("SELECT storage_path FROM entries WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    if let Some(entry) = entry {
        let file_path = paths::recordings_dir(&app)?.join(&entry.storage_path);

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

#[tauri::command]
pub async fn list_folders(pool: tauri::State<'_, SqlitePool>) -> Result<Vec<Folder>, String> {
    let folders = sqlx::query_as::<_, Folder>(
        "WITH RECURSIVE folders_with_entries(id, parent_id, name, created_at, updated_at) AS (
            SELECT f.id, f.parent_id, f.name, f.created_at, f.updated_at
            FROM folders f
            JOIN (SELECT DISTINCT folder_id FROM entries) e ON e.folder_id = f.id

            UNION

            SELECT p.id, p.parent_id, p.name, p.created_at, p.updated_at
            FROM folders p
            JOIN folders_with_entries c ON c.parent_id = p.id
        )
        SELECT DISTINCT id, parent_id, name, created_at, updated_at
        FROM folders_with_entries
        ORDER BY name COLLATE NOCASE ASC",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(folders)
}

#[tauri::command]
pub async fn create_folder(
    parent_id: String,
    name: String,
    pool: tauri::State<'_, SqlitePool>,
) -> Result<Folder, String> {
    let trimmed_name = name.trim().to_string();
    if trimmed_name.is_empty() {
        return Err("Folder name cannot be empty".to_string());
    }

    let normalized = normalize_name(&trimmed_name);
    let id = Uuid::new_v4().to_string();
    let now = now_unix()?;

    sqlx::query(
        "INSERT INTO folders (id, parent_id, name, normalized_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&parent_id)
    .bind(&trimmed_name)
    .bind(&normalized)
    .bind(now)
    .bind(now)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(Folder {
        id,
        parent_id: Some(parent_id),
        name: trimmed_name,
        created_at: now,
        updated_at: now,
    })
}

#[tauri::command]
pub async fn rename_folder(
    folder_id: String,
    name: String,
    pool: tauri::State<'_, SqlitePool>,
) -> Result<(), String> {
    if folder_id == "root" {
        return Err("Cannot rename root folder".to_string());
    }

    let trimmed_name = name.trim().to_string();
    if trimmed_name.is_empty() {
        return Err("Folder name cannot be empty".to_string());
    }

    let normalized = normalize_name(&trimmed_name);
    let now = now_unix()?;

    sqlx::query("UPDATE folders SET name = ?, normalized_name = ?, updated_at = ? WHERE id = ?")
        .bind(&trimmed_name)
        .bind(&normalized)
        .bind(now)
        .bind(&folder_id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn move_folder(
    folder_id: String,
    new_parent_id: String,
    pool: tauri::State<'_, SqlitePool>,
) -> Result<(), String> {
    if folder_id == "root" {
        return Err("Cannot move root folder".to_string());
    }

    if folder_id == new_parent_id {
        return Err("Cannot move folder into itself".to_string());
    }

    let mut current = Some(new_parent_id.clone());
    while let Some(ref pid) = current {
        if pid == &folder_id {
            return Err("Cannot move folder into its own descendant".to_string());
        }
        let row: Option<(Option<String>,)> =
            sqlx::query_as("SELECT parent_id FROM folders WHERE id = ?")
                .bind(pid)
                .fetch_optional(pool.inner())
                .await
                .map_err(|e| e.to_string())?;
        current = row.and_then(|r| r.0);
    }

    let now = now_unix()?;

    sqlx::query("UPDATE folders SET parent_id = ?, updated_at = ? WHERE id = ?")
        .bind(&new_parent_id)
        .bind(now)
        .bind(&folder_id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn delete_folder(
    folder_id: String,
    pool: tauri::State<'_, SqlitePool>,
) -> Result<(), String> {
    if folder_id == "root" {
        return Err("Cannot delete root folder".to_string());
    }

    let has_children: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM folders WHERE parent_id = ?")
            .bind(&folder_id)
            .fetch_one(pool.inner())
            .await
            .map_err(|e| e.to_string())?;

    if has_children.0 > 0 {
        return Err("Cannot delete folder with subfolders".to_string());
    }

    let has_entries: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM entries WHERE folder_id = ?")
            .bind(&folder_id)
            .fetch_one(pool.inner())
            .await
            .map_err(|e| e.to_string())?;

    if has_entries.0 > 0 {
        return Err("Cannot delete folder with entries".to_string());
    }

    sqlx::query("DELETE FROM folders WHERE id = ?")
        .bind(&folder_id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn move_entry(
    entry_id: String,
    folder_id: String,
    pool: tauri::State<'_, SqlitePool>,
) -> Result<(), String> {
    sqlx::query("UPDATE entries SET folder_id = ? WHERE id = ?")
        .bind(&folder_id)
        .bind(&entry_id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn rename_entry(
    entry_id: String,
    display_name: String,
    pool: tauri::State<'_, SqlitePool>,
) -> Result<(), String> {
    let trimmed = display_name.trim().to_string();
    if trimmed.is_empty() {
        return Err("Display name cannot be empty".to_string());
    }

    sqlx::query("UPDATE entries SET display_name = ? WHERE id = ?")
        .bind(&trimmed)
        .bind(&entry_id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
