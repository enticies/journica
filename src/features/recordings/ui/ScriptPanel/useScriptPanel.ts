import { useEffect, useMemo, useState } from "react";
import { formatDuration } from "../../../../shared/utils/formatDuration";
import { useAudioPlayer } from "../../hooks/useAudioPlayer";
import { Entry, Tag } from "../../model/types";

interface UseScriptPanelParams {
  selectedEntry: Entry | null;
  onSetEntryTags: (entryId: string, tagIds: string[]) => Promise<void>;
  audioPlayer: ReturnType<typeof useAudioPlayer>;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatCreatedAt(createdAtSeconds: number): string {
  const createdAt = new Date(createdAtSeconds * 1000);
  const day = createdAt.getDate();
  const month = MONTH_LABELS[createdAt.getMonth()] ?? "";
  const hour24 = createdAt.getHours();
  const hour12 = hour24 % 12 || 12;
  const minutes = String(createdAt.getMinutes()).padStart(2, "0");
  const period = hour24 >= 12 ? "PM" : "AM";

  return `${day} ${month} ${hour12}:${minutes} ${period}`;
}

export function useScriptPanel({ selectedEntry, onSetEntryTags, audioPlayer }: UseScriptPanelParams) {
  const [tagsOpen, setTagsOpen] = useState(false);
  const [draftTagIds, setDraftTagIds] = useState<string[]>([]);
  const [updatingTags, setUpdatingTags] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const transcript = useMemo(() => selectedEntry?.transcript ?? null, [selectedEntry]);
  const createdAtLabel = useMemo(
    () => (selectedEntry ? formatCreatedAt(selectedEntry.created_at) : ""),
    [selectedEntry],
  );
  const durationLabel = useMemo(
    () => (selectedEntry ? formatDuration(selectedEntry.duration_seconds) || "0s" : ""),
    [selectedEntry],
  );
  const isPlaying = Boolean(selectedEntry && audioPlayer.playingId === selectedEntry.id);
  const hasPlaybackProgress = Boolean(selectedEntry && audioPlayer.activeId === selectedEntry.id);
  const progressPercent = hasPlaybackProgress && audioPlayer.duration > 0 ? Math.min(100, (audioPlayer.currentTime / audioPlayer.duration) * 100) : 0;

  const openTags = () => {
    if (!selectedEntry) {
      return;
    }

    setDraftTagIds(selectedEntry.tags.map((tag) => tag.id));
    setTagsOpen(true);
  };

  const cancelTags = () => {
    setTagsOpen(false);
    setErrorMessage(null);
  };

  const handleToggleTag = (tag: Tag) => {
    setDraftTagIds((previous) =>
      previous.includes(tag.id) ? previous.filter((tagId) => tagId !== tag.id) : [...previous, tag.id],
    );
  };

  const saveTags = async () => {
    if (!selectedEntry) {
      return;
    }

    setUpdatingTags(true);
    setErrorMessage(null);
    try {
      await onSetEntryTags(selectedEntry.id, draftTagIds);
      setTagsOpen(false);
    } catch {
      setErrorMessage("Failed to update tags for this recording.");
    } finally {
      setUpdatingTags(false);
    }
  };

  useEffect(() => {
    setTagsOpen(false);
    setDraftTagIds(selectedEntry?.tags.map((tag) => tag.id) ?? []);
  }, [selectedEntry?.id]);

  return {
    transcript,
    createdAtLabel,
    durationLabel,
    tagsOpen,
    draftTagIds,
    updatingTags,
    errorMessage,
    isPlaying,
    progressPercent,
    handlePlay: audioPlayer.handlePlay,
    handleToggleTag,
    openTags,
    cancelTags,
    saveTags,
  };
}
