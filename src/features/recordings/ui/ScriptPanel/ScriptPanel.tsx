import { Entry, Tag } from "../../model/types";
import { CheckIcon, PauseIcon, PlayIcon, TagIcon } from "../icons";
import { TranscriptView } from "../TranscriptView";
import { useScriptPanel } from "./useScriptPanel";

interface Props {
  selectedEntry: Entry | null;
  tags: Tag[];
  searchQuery: string;
  scriptMessage: string | null;
  onSetEntryTags: (entryId: string, tagIds: string[]) => Promise<void>;
}

export function ScriptPanel({ selectedEntry, tags, searchQuery, scriptMessage, onSetEntryTags }: Props) {
  const {
    transcript,
    createdAtLabel,
    durationLabel,
    tagsOpen,
    draftTagIds,
    updatingTags,
    errorMessage,
    isPlaying,
    progressPercent,
    audioRef,
    handlePlay,
    handleEnded,
    handleLoadedMetadata,
    handleTimeUpdate,
    handleToggleTag,
    openTags,
    cancelTags,
    saveTags,
  } = useScriptPanel({ selectedEntry, onSetEntryTags });

  if (!selectedEntry) {
    return (
      <section className="flex-1 overflow-y-auto bg-light-50 p-6">
        {scriptMessage && <p className="text-sm text-dark-50">{scriptMessage}</p>}
      </section>
    );
  }

  return (
    <section className="flex-1 overflow-y-auto bg-light-50 px-6 py-8">
      <audio
        ref={audioRef}
        onEnded={handleEnded}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        className="hidden"
      />

      <div className="flex w-full max-w-3xl flex-col gap-6">
        <header className="space-y-5">
          <div>
            <h1 className="text-base font-medium text-dark-90">{createdAtLabel}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-10 text-sm">
            <div className="flex items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-dark-40">Duration</p>
              <p className="font-semibold text-dark-80">{durationLabel}</p>
            </div>
          </div>
        </header>

        <div>
          <div className="h-2 overflow-hidden rounded-full bg-light-base mb-6" aria-label="Audio progress">
            <div
              className="h-full rounded-full bg-dark-80 transition-[width] duration-150"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center">
            <div className="relative">
              {tagsOpen && (
                <div className="absolute left-0 top-11 z-10 flex w-56 flex-col rounded-2xl border border-light-base bg-white p-2 shadow-lg">
                  <div className="flex flex-col gap-1">
                  {tags.map((tag) => {
                    const selected = draftTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          handleToggleTag(tag);
                        }}
                        disabled={updatingTags}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors disabled:opacity-50 ${selected ? "bg-light-40 text-dark-90" : "text-dark-70 hover:bg-light-30"
                          }`}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <TagIcon className={`size-4 shrink-0 ${selected ? "text-dark-80" : "text-dark-40"}`} />
                          <span className="truncate">{tag.name}</span>
                        </span>
                        {selected && <CheckIcon className="size-4 shrink-0 text-dark-80" />}
                      </button>
                    );
                  })}
                  </div>
                  <div className="mt-2 flex justify-end gap-2 border-t border-light-base pt-2">
                    <button
                      type="button"
                      onClick={cancelTags}
                      disabled={updatingTags}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold text-dark-60 transition-colors hover:bg-light-30 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void saveTags();
                      }}
                      disabled={updatingTags}
                      className="rounded-full bg-dark-90 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-dark-70 disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}


            </div>

            <button
              type="button"
              onClick={() => {
                void handlePlay(selectedEntry);
              }}
              aria-label={isPlaying ? "Pause playback" : "Play recording"}
              title={isPlaying ? "Pause" : "Play"}
              className="mr-2 flex size-10 items-center justify-center rounded-full bg-dark-90 text-white transition-colors hover:bg-dark-70"
            >
              {isPlaying ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
            </button>
            <button
              type="button"
              onClick={() => {
                if (tagsOpen) {
                  cancelTags();
                  return;
                }

                openTags();
              }}
              disabled={tags.length === 0 || updatingTags}
              className="rounded-full border border-dark-20 px-4 py-2 text-sm font-semibold text-dark-80 transition-colors hover:bg-light-30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add tag
            </button>
          </div>

          {errorMessage && <p className="text-sm text-red-700">{errorMessage}</p>}
        </div>

        <section>
          <h2 className="mb-3 text-lg font-bold text-dark-90">Transcript</h2>
          {scriptMessage && <p className="text-sm text-dark-50">{scriptMessage}</p>}
          {transcript && <TranscriptView transcript={transcript} searchQuery={searchQuery} />}
        </section>
      </div>
    </section>
  );
}
