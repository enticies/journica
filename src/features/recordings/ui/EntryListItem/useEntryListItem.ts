import { useMemo } from "react";
import { formatDuration } from "../../../../shared/utils/formatDuration";
import { Entry } from "../../model/types";

interface UseEntryListItemParams {
  entry: Entry;
}

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatCreatedAt(createdAtSeconds: number): string {
  const createdAt = new Date(createdAtSeconds * 1000);
  const monthLabel = MONTH_LABELS[createdAt.getMonth()] ?? "";
  const day = createdAt.getDate();
  const hour24 = createdAt.getHours();
  const hour12 = hour24 % 12 || 12;
  const minutes = String(createdAt.getMinutes()).padStart(2, "0");
  const period = hour24 >= 12 ? "PM" : "AM";

  return `${day} ${monthLabel} ${hour12}:${minutes} ${period}`;
}

function getTranscriptPreview(transcript: string | null): string {
  if (!transcript) {
    return "No transcript available yet.";
  }

  const words = transcript.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "No transcript available yet.";
  }

  if (words.length <= 50) {
    return words.join(" ");
  }

  return `${words.slice(0, 50).join(" ")}...`;
}

export function useEntryListItem({ entry }: UseEntryListItemParams) {
  const createdAtLabel = useMemo(() => formatCreatedAt(entry.created_at), [entry.created_at]);
  const durationLabel = useMemo(() => formatDuration(entry.duration_seconds), [entry.duration_seconds]);
  const transcriptPreview = useMemo(() => getTranscriptPreview(entry.transcript), [entry.transcript]);

  return {
    createdAtLabel,
    durationLabel,
    transcriptPreview,
  };
}
