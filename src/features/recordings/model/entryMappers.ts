import { EntryTagRecord, Tag } from "./types";

export function sortTagsByName(tags: Tag[]): Tag[] {
  return [...tags].sort((a, b) => a.name.localeCompare(b.name));
}

export function mapEntryTags(records: EntryTagRecord[]): Map<string, Tag[]> {
  const tagsByEntry = new Map<string, Tag[]>();

  for (const record of records) {
    const tag: Tag = {
      id: record.tag_id,
      name: record.tag_name,
      created_at: record.tag_created_at,
    };

    const existing = tagsByEntry.get(record.entry_id) ?? [];
    existing.push(tag);
    tagsByEntry.set(record.entry_id, existing);
  }

  for (const [entryId, entryTags] of tagsByEntry.entries()) {
    tagsByEntry.set(entryId, sortTagsByName(entryTags));
  }

  return tagsByEntry;
}
