import { useMemo } from "react";
import { formatDuration } from "../../../../shared/utils/formatDuration";
import { Entry } from "../../model/types";

interface UseEntryListItemParams {
  entry: Entry;
}

export function useEntryListItem({ entry }: UseEntryListItemParams) {
  const displayTitle = useMemo(() => entry.title || entry.filename.replace(".wav", ""), [
    entry.filename,
    entry.title,
  ]);
  const createdAtLabel = useMemo(() => new Date(entry.created_at * 1000).toLocaleString(), [entry.created_at]);
  const durationLabel = useMemo(() => formatDuration(entry.duration_seconds), [entry.duration_seconds]);

  return {
    displayTitle,
    createdAtLabel,
    durationLabel,
  };
}
