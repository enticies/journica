use sqlx::{migrate::MigrateDatabase, sqlite::SqlitePoolOptions, SqlitePool};
use tauri::{AppHandle, Manager};

pub async fn init(app: &AppHandle) -> Result<SqlitePool, Box<dyn std::error::Error>> {
    let app_data_dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&app_data_dir)?;

    let db_path = app_data_dir.join("journal.db");
    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());

    if !std::path::Path::new(&db_path).exists() {
        sqlx::Sqlite::create_database(&db_url).await?;
    }

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await?;

    sqlx::migrate!("./migrations").run(&pool).await?;

    Ok(pool)
}
