import { invoke } from "@tauri-apps/api/core";
import { EntryRow, EntryTagRecord, Tag } from "../model/types";

export async function listTags(): Promise<Tag[]> {
  return invoke<Tag[]>("list_tags");
}

export async function queryEntries(params: {
  query: string | null;
  limit: number;
  offset: number;
}): Promise<EntryRow[]> {
  return invoke<EntryRow[]>("query_entries", params);
}

export async function getEntryTags(entryIds: string[]): Promise<EntryTagRecord[]> {
  return invoke<EntryTagRecord[]>("get_entry_tags", { entryIds });
}

export async function deleteEntry(id: string): Promise<void> {
  await invoke("delete_entry", { id });
}

export async function createTag(name: string): Promise<Tag> {
  return invoke<Tag>("create_tag", { name });
}

export async function deleteTag(tagId: string): Promise<void> {
  await invoke("delete_tag", { tagId });
}

export async function setEntryTags(params: { entryId: string; tagIds: string[] }): Promise<void> {
  await invoke("set_entry_tags", params);
}

export async function getRecordingPath(filename: string): Promise<string> {
  return invoke<string>("get_recording_path", { filename });
}
