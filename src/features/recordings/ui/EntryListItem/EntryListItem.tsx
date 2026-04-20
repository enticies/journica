import { Entry } from "../../model/types";
import { SidebarListItem } from "../../../../shared/ui/SidebarListItem";
import { Typography } from "../../../../shared/ui/Typography";
import playIcon from "./play.svg";
import { useEntryListItem } from "./useEntryListItem";

interface Props {
  entry: Entry;
  selected: boolean;
  playing: boolean;
  progress: number | undefined;
  onSelect: (id: string) => void;
  onPlay: (entry: Entry) => void;
  onDelete: (id: string) => void;
}

export function EntryListItem({
  entry,
  selected,
  playing,
  progress,
  onSelect,
  onPlay,
  onDelete: _onDelete,
}: Props) {
  const { createdAtLabel, durationLabel, transcriptPreview } = useEntryListItem({ entry });

  return (
    <SidebarListItem
      asListItem
      element="div"
      className="px-[12px] py-0 rounded-[6px]"
      selected={selected}
      selectedClassName="bg-transparent hover:bg-light-80"
      unselectedClassName="bg-transparent hover:bg-light-80"
      unstyledLabel
      onClick={() => {
        onSelect(entry.id);
        onPlay(entry);
      }}
      label={
        <div className="w-full min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(entry.id);
                  onPlay(entry);
                }}
                className={`inline-flex h-7 aspect-square items-center justify-center rounded-[50px] border border-dark-20 p-2 transition-colors ${playing ? "bg-light-80" : "hover:bg-light-80"}`}
                aria-label={playing ? "Stop playback" : "Play recording"}
                title={playing ? "Stop" : "Play"}
              >
                <img src={playIcon} alt="" aria-hidden="true" className="h-3 w-auto" />
              </button>
              <span className="truncate block text-[14px] font-medium leading-5 text-dark-90">
                {createdAtLabel}
              </span>
            </div>
            <span className="text-[12px] font-normal leading-[18px] text-dark-30">
              {durationLabel || "0s"}
            </span>
          </div>
          <p className="mt-2 text-[13px] leading-5 text-dark-60">{transcriptPreview}</p>
          {progress !== undefined && (
            <Typography variant="caption" className="mt-2 block text-dark-30">
              Transcribing: {progress}%
            </Typography>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-1">
            {entry.tags.map((tag) => (
              <span
                key={tag.id}
                className="rounded-md border border-light-base bg-light-20 px-2 py-0.5 text-xs font-medium text-dark-70"
              >
                {tag.name}
              </span>
            ))}
          </div>
        </div>
      }
    />
  );
}
