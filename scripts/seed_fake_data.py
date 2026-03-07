#!/usr/bin/env python3
import argparse
import math
import os
import random
import sqlite3
import struct
import uuid
import wave
from datetime import datetime, timedelta, timezone
from pathlib import Path


TOPICS = [
    "Project planning and next milestones",
    "Customer interview insights and follow ups",
    "Daily reflection on focus and energy",
    "Bug triage notes and reproduction steps",
    "Architecture tradeoffs for offline sync",
    "Marketing ideas for launch week",
    "Retrospective notes from today's sprint",
    "Thoughts on product direction and scope",
]

SNIPPETS = [
    "Today I reviewed priorities and identified the highest risk to delivery.",
    "I captured action items that need to happen before the end of the week.",
    "The main blocker is dependency alignment across frontend and backend.",
    "I want to test this workflow with several realistic examples.",
    "Overall progress feels steady and the direction still makes sense.",
    "The next step is to validate assumptions with a small user test.",
    "I should simplify this flow so onboarding is easier to understand.",
    "I noticed a pattern in the feedback and it is worth exploring.",
]


def default_app_dir() -> Path:
    xdg_data_home = os.environ.get("XDG_DATA_HOME")
    if xdg_data_home:
        return Path(xdg_data_home) / "com.enticies.offline-audio-journal"
    return Path.home() / ".local/share/com.enticies.offline-audio-journal"


def ensure_schema(cursor: sqlite3.Cursor) -> None:
    cursor.executescript(
        """
        CREATE TABLE IF NOT EXISTS entries (
          id TEXT PRIMARY KEY,
          filename TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          duration_seconds REAL,
          title TEXT
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
          title,
          filename,
          content='entries',
          content_rowid='rowid'
        );

        CREATE TRIGGER IF NOT EXISTS entries_ai AFTER INSERT ON entries BEGIN
          INSERT INTO entries_fts(rowid, title, filename)
          VALUES (NEW.rowid, NEW.title, NEW.filename);
        END;

        CREATE TRIGGER IF NOT EXISTS entries_ad AFTER DELETE ON entries BEGIN
          INSERT INTO entries_fts(entries_fts, rowid, title, filename)
          VALUES ('delete', OLD.rowid, OLD.title, OLD.filename);
        END;

        CREATE TRIGGER IF NOT EXISTS entries_au AFTER UPDATE ON entries BEGIN
          INSERT INTO entries_fts(entries_fts, rowid, title, filename)
          VALUES ('delete', OLD.rowid, OLD.title, OLD.filename);
          INSERT INTO entries_fts(rowid, title, filename)
          VALUES (NEW.rowid, NEW.title, NEW.filename);
        END;

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

        CREATE TABLE IF NOT EXISTS transcript_overrides (
          entry_id TEXT PRIMARY KEY REFERENCES entries(id) ON DELETE CASCADE,
          text TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tags (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          normalized_name TEXT NOT NULL UNIQUE,
          created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS entry_tags (
          entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
          tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
          PRIMARY KEY (entry_id, tag_id)
        );

        CREATE INDEX IF NOT EXISTS idx_entry_tags_entry_id ON entry_tags(entry_id);
        CREATE INDEX IF NOT EXISTS idx_entry_tags_tag_id ON entry_tags(tag_id);
        """
    )


def make_wav(path: Path, seconds: float, seed: int) -> None:
    rnd = random.Random(seed)
    sample_rate = 16000
    sample_count = int(seconds * sample_rate)

    with wave.open(str(path), "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)

        frames = bytearray()
        base_freq = rnd.uniform(150.0, 260.0)

        for i in range(sample_count):
            t = i / sample_rate
            freq = base_freq + 30.0 * math.sin(2.0 * math.pi * 0.2 * t)
            sample = 0.22 * math.sin(2.0 * math.pi * freq * t)
            sample += 0.04 * math.sin(2.0 * math.pi * (freq * 2.0) * t)
            sample = max(-1.0, min(1.0, sample))
            frames += struct.pack("<h", int(sample * 32767))

        wav_file.writeframes(frames)


def transcript_parts(rnd: random.Random, count: int) -> list[str]:
    selection_count = max(2, min(6, count))
    return rnd.sample(SNIPPETS, k=selection_count)


def seed_fake_entries(app_dir: Path, count: int, append: bool, seed: int) -> None:
    recordings_dir = app_dir / "recordings"
    db_path = app_dir / "journal.db"

    app_dir.mkdir(parents=True, exist_ok=True)
    recordings_dir.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(db_path)
    cursor = connection.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")
    ensure_schema(cursor)

    if not append:
        cursor.execute("SELECT filename FROM entries WHERE title LIKE 'FAKE:%'")
        stale_files = [row[0] for row in cursor.fetchall()]

        cursor.execute("DELETE FROM entries WHERE title LIKE 'FAKE:%'")

        for filename in stale_files:
            fake_file = recordings_dir / filename
            if fake_file.exists() and fake_file.is_file():
                fake_file.unlink()

    base_now = datetime.now(timezone.utc)
    rnd = random.Random(seed)

    for i in range(count):
        entry_id = str(uuid.uuid4())
        created_at_dt = base_now - timedelta(hours=i * 6)
        created_at = int(created_at_dt.timestamp())

        duration_seconds = round(rnd.uniform(18.0, 140.0), 2)
        filename = f"fake_{created_at}_{i:03d}.wav"

        make_wav(recordings_dir / filename, duration_seconds, seed + i)

        title = f"FAKE: {rnd.choice(TOPICS)}"
        segments = transcript_parts(rnd, rnd.randint(3, 5))
        cursor.execute(
            "INSERT INTO entries (id, filename, created_at, duration_seconds, title) VALUES (?, ?, ?, ?, ?)",
            (entry_id, filename, created_at, duration_seconds, title),
        )

        total_ms = int(duration_seconds * 1000)
        for segment_index, text in enumerate(segments):
            start_ms = int(segment_index * total_ms / len(segments))
            end_ms = int((segment_index + 1) * total_ms / len(segments))

            cursor.execute(
                "INSERT INTO transcript_segments (entry_id, segment_index, start_ms, end_ms, text) VALUES (?, ?, ?, ?, ?)",
                (entry_id, segment_index, start_ms, end_ms, text),
            )

    connection.commit()
    connection.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed fake audio recordings and transcripts for offline-audio-journal."
    )
    parser.add_argument(
        "--count",
        type=int,
        default=200,
        help="Number of fake entries to create (default: 200).",
    )
    parser.add_argument(
        "--append",
        action="store_true",
        help="Append fake data instead of replacing existing FAKE: entries.",
    )
    parser.add_argument("--seed", type=int, default=42, help="Random seed for repeatable data.")
    parser.add_argument(
        "--app-dir",
        type=Path,
        default=default_app_dir(),
        help="Override app data directory.",
    )

    args = parser.parse_args()
    count = args.count

    if count < 1:
        raise SystemExit("count must be at least 1")

    seed_fake_entries(args.app_dir, count, args.append, args.seed)

    mode = "appended" if args.append else "replaced"
    print(
        f"Fake data {mode}: {count} entries in {args.app_dir / 'journal.db'} at {datetime.now().isoformat(timespec='seconds')}"
    )


if __name__ == "__main__":
    main()
