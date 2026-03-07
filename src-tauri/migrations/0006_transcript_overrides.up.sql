CREATE TABLE IF NOT EXISTS transcript_overrides (
  entry_id TEXT PRIMARY KEY REFERENCES entries(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

DROP TRIGGER IF EXISTS entries_ai;
DROP TRIGGER IF EXISTS entries_ad;
DROP TRIGGER IF EXISTS entries_au;
DROP TABLE IF EXISTS entries_fts;

ALTER TABLE entries DROP COLUMN transcript;

CREATE VIRTUAL TABLE entries_fts USING fts5(
  title,
  filename,
  content='entries',
  content_rowid='rowid'
);

CREATE TRIGGER entries_ai AFTER INSERT ON entries BEGIN
  INSERT INTO entries_fts(rowid, title, filename)
  VALUES (NEW.rowid, NEW.title, NEW.filename);
END;

CREATE TRIGGER entries_ad AFTER DELETE ON entries BEGIN
  INSERT INTO entries_fts(entries_fts, rowid, title, filename)
  VALUES ('delete', OLD.rowid, OLD.title, OLD.filename);
END;

CREATE TRIGGER entries_au AFTER UPDATE ON entries BEGIN
  INSERT INTO entries_fts(entries_fts, rowid, title, filename)
  VALUES ('delete', OLD.rowid, OLD.title, OLD.filename);
  INSERT INTO entries_fts(rowid, title, filename)
  VALUES (NEW.rowid, NEW.title, NEW.filename);
END;

INSERT INTO entries_fts(entries_fts) VALUES ('rebuild');
