CREATE TABLE IF NOT EXISTS transcript_segments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  segment_index INTEGER NOT NULL,
  start_ms INTEGER NOT NULL,
  end_ms INTEGER NOT NULL,
  text TEXT NOT NULL,
  UNIQUE(entry_id, segment_index)
);

CREATE INDEX IF NOT EXISTS idx_segments_entry_id ON transcript_segments(entry_id);
CREATE INDEX IF NOT EXISTS idx_segments_timestamps ON transcript_segments(entry_id, start_ms, end_ms);