DROP TRIGGER IF EXISTS entries_ai;
DROP TRIGGER IF EXISTS entries_ad;
DROP TRIGGER IF EXISTS entries_au;
DROP TABLE IF EXISTS entries_fts;

ALTER TABLE entries ADD COLUMN transcript TEXT;

CREATE VIRTUAL TABLE entries_fts USING fts5(
  title,
  filename,
  transcript,
  content='entries',
  content_rowid='rowid'
);

CREATE TRIGGER entries_ai AFTER INSERT ON entries BEGIN
  INSERT INTO entries_fts(rowid, title, filename, transcript)
  VALUES (NEW.rowid, NEW.title, NEW.filename, NEW.transcript);
END;

CREATE TRIGGER entries_ad AFTER DELETE ON entries BEGIN
  INSERT INTO entries_fts(entries_fts, rowid, title, filename, transcript)
  VALUES ('delete', OLD.rowid, OLD.title, OLD.filename, OLD.transcript);
END;

CREATE TRIGGER entries_au AFTER UPDATE ON entries BEGIN
  INSERT INTO entries_fts(entries_fts, rowid, title, filename, transcript)
  VALUES ('delete', OLD.rowid, OLD.title, OLD.filename, OLD.transcript);
  INSERT INTO entries_fts(rowid, title, filename, transcript)
  VALUES (NEW.rowid, NEW.title, NEW.filename, NEW.transcript);
END;

INSERT INTO entries_fts(entries_fts) VALUES ('rebuild');

DROP TABLE IF EXISTS transcript_overrides;
