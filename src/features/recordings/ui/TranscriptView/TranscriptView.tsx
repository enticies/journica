import { useTranscriptView } from "./useTranscriptView";

interface Props {
  transcript: string;
  searchQuery: string;
}

export function TranscriptView({ transcript, searchQuery }: Props) {
  const { segments } = useTranscriptView({ transcript, searchQuery });

  return (
    <p className="whitespace-pre-wrap leading-relaxed">
      {segments.map((segment, index) => {
        if (segment.highlighted) {
          return (
            <mark key={index} className="bg-yellow-200 rounded px-0.5">
              {segment.text}
            </mark>
          );
        }

        return <span key={index}>{segment.text}</span>;
      })}
    </p>
  );
}
