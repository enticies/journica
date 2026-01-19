import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

export interface Entry {
  id: string;
  filename: string;
  created_at: number;
  duration_seconds: number | null;
  transcript: string | null;
  title: string | null;
}

export function useEntries() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEntries = async () => {
    setLoading(true);
    const result = await invoke<Entry[]>("get_entries");
    setEntries(result);
    setLoading(false);
  };

  const deleteEntry = async (id: string) => {
    await invoke("delete_entry", { id });
    await loadEntries();
  };

  useEffect(() => {
    loadEntries();
  }, []);

  return { entries, loading, loadEntries, deleteEntry };
}
