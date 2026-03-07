import { useEffect, useMemo, useState } from "react";
import { Entry } from "../model/types";

interface UseEntrySelectionResult {
  selectedEntryId: string | null;
  setSelectedEntryId: (id: string | null) => void;
  selectedEntry: Entry | null;
}

export function useEntrySelection(entries: Entry[]): UseEntrySelectionResult {
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  useEffect(() => {
    if (entries.length === 0) {
      setSelectedEntryId(null);
      return;
    }

    if (selectedEntryId && entries.some((entry) => entry.id === selectedEntryId)) {
      return;
    }

    setSelectedEntryId(entries[0].id);
  }, [entries, selectedEntryId]);

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedEntryId) ?? null,
    [entries, selectedEntryId],
  );

  return {
    selectedEntryId,
    setSelectedEntryId,
    selectedEntry,
  };
}
