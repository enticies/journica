#!/usr/bin/env python3
import argparse
import os
import random
import shutil
import sqlite3
import uuid
import wave
from datetime import datetime, timedelta, timezone
from pathlib import Path


TAGS = [
    "Reflection",
    "Work",
    "Ideas",
    "Health",
    "Learning",
    "Family",
    "Decisions",
]

ENTRY_TEMPLATES = [
    {
        "title": "Morning clarity before the product review",
        "tags": ["Reflection", "Work"],
        "transcript": [
            "I started the morning by writing down the three things that would make today's review successful.",
            "The main point is to keep the discussion grounded in what users actually need, not what feels impressive to build.",
            "I want to leave the meeting with a smaller scope, clearer ownership, and one decision that removes ambiguity for the rest of the week.",
        ],
    },
    {
        "title": "Follow up notes from customer interviews",
        "tags": ["Work", "Learning"],
        "transcript": [
            "The strongest signal from the interviews was that people want capture to feel effortless and private.",
            "Several users described journaling as something they do between tasks, so the interface needs to stay quiet and fast.",
            "A useful next step is to test the first minute experience and remove anything that feels like setup friction.",
        ],
    },
    {
        "title": "Walk home thoughts about focus",
        "tags": ["Reflection", "Health"],
        "transcript": [
            "The walk helped me notice how much better I think after leaving the desk for a while.",
            "I kept coming back to the idea that focus is easier when the day has fewer open loops.",
            "Tomorrow I want to start by closing two small tasks before opening anything new.",
        ],
    },
    {
        "title": "Small product ideas worth saving",
        "tags": ["Ideas"],
        "transcript": [
            "A few product ideas came up while reviewing the latest build.",
            "The most useful one is a gentle summary at the top of each recording, almost like a personal memory card.",
            "Another idea is to show recurring themes over time without making the app feel analytical or clinical.",
        ],
    },
    {
        "title": "Decision log for the release plan",
        "tags": ["Work", "Decisions"],
        "transcript": [
            "I decided to keep the next release focused on reliability instead of adding more visible features.",
            "Crash recovery, transcript refresh, and playback consistency matter more than another layer of organization right now.",
            "The release should feel boring in the best way: install it, record something, and trust that it works.",
        ],
    },
    {
        "title": "Evening reflection after a long day",
        "tags": ["Reflection", "Family"],
        "transcript": [
            "Today was full but not chaotic, which feels like progress.",
            "Dinner was the part of the day where I finally stopped thinking about the backlog and paid attention to the room around me.",
            "I want to protect that kind of space more intentionally this week.",
        ],
    },
    {
        "title": "Learning notes on local transcription",
        "tags": ["Learning", "Work"],
        "transcript": [
            "Local transcription has a different feel than cloud transcription because the privacy promise is easier to understand.",
            "The tradeoff is that setup and model download need to be explained clearly, especially on first launch.",
            "If the app communicates what is happening, users will probably accept the wait because they get control in return.",
        ],
    },
    {
        "title": "Weekly reset and priorities",
        "tags": ["Reflection", "Decisions"],
        "transcript": [
            "This week should have one primary goal instead of five competing ones.",
            "The priority is to make the journaling loop feel complete: record, transcribe, find, and replay.",
            "Everything else can wait until that loop feels dependable.",
        ],
    },
    {
        "title": "Notes after testing the recording flow",
        "tags": ["Work"],
        "transcript": [
            "Testing the recording flow made it obvious that feedback needs to be immediate.",
            "The timer, pause state, and stop action should all feel calm and predictable.",
            "I also want the recovered recordings path to be invisible unless something actually goes wrong.",
        ],
    },
    {
        "title": "Health check after changing routines",
        "tags": ["Health", "Reflection"],
        "transcript": [
            "The new routine is helping, mostly because I am sleeping a little earlier and walking before lunch.",
            "Energy still drops in the late afternoon, so I should avoid scheduling decisions there.",
            "A shorter work block with a real break seems to be better than trying to push through.",
        ],
    },
]


def default_app_dir() -> Path:
    xdg_data_home = os.environ.get("XDG_DATA_HOME")
    if xdg_data_home:
        return Path(xdg_data_home) / "com.enticies.offline-audio-journal"
    return Path.home() / ".local/share/com.enticies.offline-audio-journal"


def ensure_schema(cursor: sqlite3.Cursor) -> None:
    cursor.executescript(
        """
        CREATE TABLE IF NOT EXISTS folders (
          id TEXT PRIMARY KEY,
          parent_id TEXT REFERENCES folders(id) ON DELETE RESTRICT,
          name TEXT NOT NULL,
          normalized_name TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_sibling_name
          ON folders(COALESCE(parent_id, ''), normalized_name);
        CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);

        INSERT OR IGNORE INTO folders (id, parent_id, name, normalized_name, created_at, updated_at)
          VALUES ('root', NULL, 'Root', 'root', 0, 0);

        CREATE TABLE IF NOT EXISTS entries (
          id TEXT PRIMARY KEY,
          storage_path TEXT NOT NULL,
          display_name TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          duration_seconds REAL,
          title TEXT
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_storage_path ON entries(storage_path);

        CREATE TABLE IF NOT EXISTS entry_folders (
          entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
          folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
          created_at INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (entry_id, folder_id)
        );

        CREATE INDEX IF NOT EXISTS idx_entry_folders_folder_id ON entry_folders(folder_id);

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


def make_wav(path: Path, seconds: float) -> None:
    sample_rate = 8000
    sample_count = int(seconds * sample_rate)
    silence = b"\x00\x00" * sample_count

    with wave.open(str(path), "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(silence)


def find_or_create_folder(cursor: sqlite3.Cursor, parent_id: str, name: str, now: int) -> str:
    normalized = name.strip().lower()
    cursor.execute(
        "SELECT id FROM folders WHERE parent_id = ? AND normalized_name = ? LIMIT 1",
        (parent_id, normalized),
    )
    row = cursor.fetchone()
    if row:
        return row[0]

    folder_id = str(uuid.uuid4())
    cursor.execute(
        "INSERT INTO folders (id, parent_id, name, normalized_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        (folder_id, parent_id, name, normalized, now, now),
    )
    return folder_id


def ensure_date_folder(cursor: sqlite3.Cursor, dt: datetime, now: int) -> str:
    year_id = find_or_create_folder(cursor, "root", f"{dt.year:04d}", now)
    month_id = find_or_create_folder(cursor, year_id, f"{dt.month:02d}", now)
    return find_or_create_folder(cursor, month_id, f"{dt.day:02d}", now)


def wipe_data(cursor: sqlite3.Cursor, recordings_dir: Path) -> None:
    cursor.execute("DELETE FROM transcript_overrides")
    cursor.execute("DELETE FROM transcript_segments")
    cursor.execute("DELETE FROM entry_tags")
    cursor.execute("DELETE FROM entry_folders")
    cursor.execute("DELETE FROM entries")
    cursor.execute("DELETE FROM tags")

    # Delete descendants before parents to satisfy the self-referential folder FK.
    for _ in range(8):
        cursor.execute(
            """
            DELETE FROM folders
            WHERE id != 'root'
              AND id NOT IN (SELECT DISTINCT parent_id FROM folders WHERE parent_id IS NOT NULL)
            """
        )

    if recordings_dir.exists():
        shutil.rmtree(recordings_dir)
    recordings_dir.mkdir(parents=True, exist_ok=True)


def ensure_tags(cursor: sqlite3.Cursor, now: int) -> dict[str, str]:
    tag_ids = {}
    for name in TAGS:
        tag_id = str(uuid.uuid4())
        tag_ids[name] = tag_id
        cursor.execute(
            "INSERT INTO tags (id, name, normalized_name, created_at) VALUES (?, ?, ?, ?)",
            (tag_id, name, name.lower(), now),
        )
    return tag_ids


def seeded_entries(count: int, seed: int) -> list[dict[str, object]]:
    rnd = random.Random(seed)
    entries = []
    for index in range(count):
        template = ENTRY_TEMPLATES[index % len(ENTRY_TEMPLATES)]
        cycle = index // len(ENTRY_TEMPLATES)
        title = template["title"] if cycle == 0 else f"{template['title']} #{cycle + 1}"
        entries.append(
            {
                "title": title,
                "tags": template["tags"],
                "transcript": template["transcript"],
                "duration": round(rnd.uniform(95.0, 740.0), 2),
                "hour_offset": index * rnd.choice([5, 7, 9, 13]),
            }
        )
    return entries


def seed_entries(app_dir: Path, count: int, seed: int, wipe_all: bool) -> None:
    recordings_dir = app_dir / "recordings"
    db_path = app_dir / "journal.db"

    app_dir.mkdir(parents=True, exist_ok=True)
    recordings_dir.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(db_path)
    cursor = connection.cursor()
    cursor.execute("PRAGMA foreign_keys = ON")
    ensure_schema(cursor)

    if wipe_all:
        wipe_data(cursor, recordings_dir)

    base_now = datetime.now(timezone.utc).replace(minute=15, second=0, microsecond=0)
    now_ts = int(base_now.timestamp())
    tag_ids = ensure_tags(cursor, now_ts)

    for item in seeded_entries(count, seed):
        entry_id = str(uuid.uuid4())
        created_at_dt = base_now - timedelta(hours=int(item["hour_offset"]))
        created_at = int(created_at_dt.timestamp())
        folder_id = ensure_date_folder(cursor, created_at_dt, now_ts)

        storage_path = f"{created_at_dt.year:04d}/{created_at_dt.month:02d}/{created_at_dt.day:02d}/{entry_id}_{created_at_dt.hour:02d}-{created_at_dt.minute:02d}-{created_at_dt.second:02d}.wav"
        display_name = f"{created_at_dt.year:04d}-{created_at_dt.month:02d}-{created_at_dt.day:02d}_{created_at_dt.hour:02d}-{created_at_dt.minute:02d}-{created_at_dt.second:02d}"
        duration_seconds = float(item["duration"])
        transcript = list(item["transcript"])

        file_dir = recordings_dir / f"{created_at_dt.year:04d}/{created_at_dt.month:02d}/{created_at_dt.day:02d}"
        file_dir.mkdir(parents=True, exist_ok=True)
        make_wav(recordings_dir / storage_path, duration_seconds)

        cursor.execute(
            "INSERT INTO entries (id, storage_path, display_name, created_at, duration_seconds, title) VALUES (?, ?, ?, ?, ?, ?)",
            (entry_id, storage_path, display_name, created_at, duration_seconds, item["title"]),
        )
        cursor.execute(
            "INSERT INTO entry_folders (entry_id, folder_id, created_at) VALUES (?, ?, ?)",
            (entry_id, folder_id, created_at),
        )

        total_ms = int(duration_seconds * 1000)
        for segment_index, text in enumerate(transcript):
            start_ms = int(segment_index * total_ms / len(transcript))
            end_ms = int((segment_index + 1) * total_ms / len(transcript))
            cursor.execute(
                "INSERT INTO transcript_segments (entry_id, segment_index, start_ms, end_ms, text) VALUES (?, ?, ?, ?, ?)",
                (entry_id, segment_index, start_ms, end_ms, text),
            )

        for tag_name in item["tags"]:
            cursor.execute(
                "INSERT INTO entry_tags (entry_id, tag_id) VALUES (?, ?)",
                (entry_id, tag_ids[tag_name]),
            )

    connection.commit()
    connection.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed realistic demo audio recordings and transcripts for Journica."
    )
    parser.add_argument("--count", type=int, default=36, help="Number of entries to create (default: 36).")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for repeatable data.")
    parser.add_argument(
        "--wipe-all",
        action="store_true",
        help="Delete all existing entries, tags, folders, and recording files before seeding.",
    )
    parser.add_argument(
        "--app-dir",
        type=Path,
        default=default_app_dir(),
        help="Override app data directory.",
    )

    args = parser.parse_args()
    if args.count < 1:
        raise SystemExit("count must be at least 1")

    seed_entries(args.app_dir, args.count, args.seed, args.wipe_all)
    print(
        f"Seeded {args.count} realistic entries in {args.app_dir / 'journal.db'} at {datetime.now().isoformat(timespec='seconds')}"
    )


if __name__ == "__main__":
    main()
