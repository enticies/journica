CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  duration_seconds REAL,
  transcript TEXT,
  title TEXT
);

CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
  title,
  transcript,
  content='entries',
  content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS entries_ai AFTER INSERT ON entries BEGIN
  INSERT INTO entries_fts(rowid, title, transcript)
  VALUES (NEW.rowid, NEW.title, NEW.transcript);
END;

CREATE TRIGGER IF NOT EXISTS entries_ad AFTER DELETE ON entries BEGIN
  INSERT INTO entries_fts(entries_fts, rowid, title, transcript)
  VALUES ('delete', OLD.rowid, OLD.title, OLD.transcript);
END;

CREATE TRIGGER IF NOT EXISTS entries_au AFTER UPDATE ON entries BEGIN
  INSERT INTO entries_fts(entries_fts, rowid, title, transcript)
  VALUES ('delete', OLD.rowid, OLD.title, OLD.transcript);
  INSERT INTO entries_fts(rowid, title, transcript)
  VALUES (NEW.rowid, NEW.title, NEW.transcript);
END;
