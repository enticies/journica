export interface Tag {
  id: string;
  name: string;
  created_at: number;
}

export interface Entry {
  id: string;
  filename: string;
  created_at: number;
  duration_seconds: number | null;
  transcript: string | null;
  title: string | null;
  tags: Tag[];
}

export interface EntryRow {
  id: string;
  filename: string;
  created_at: number;
  duration_seconds: number | null;
  transcript: string | null;
  title: string | null;
}

export interface EntryTagRecord {
  entry_id: string;
  tag_id: string;
  tag_name: string;
  tag_created_at: number;
}
