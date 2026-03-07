import { useMemo } from "react";

interface Segment {
  text: string;
  highlighted: boolean;
}

interface UseTranscriptViewParams {
  transcript: string;
  searchQuery: string;
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function useTranscriptView({ transcript, searchQuery }: UseTranscriptViewParams) {
  const terms = useMemo(
    () =>
      searchQuery
        .trim()
        .split(/[^\p{L}\p{N}]+/u)
        .map((token) => token.trim())
        .filter(Boolean)
        .map(escapeRegExp),
    [searchQuery],
  );

  const segments = useMemo(() => {
    if (terms.length === 0) {
      return [{ text: transcript, highlighted: false } satisfies Segment];
    }

    const splitRegex = new RegExp(`(${terms.join("|")})`, "gi");
    const matchRegex = new RegExp(`^(${terms.join("|")})$`, "i");

    return transcript.split(splitRegex).map((text) => ({
      text,
      highlighted: matchRegex.test(text),
    }));
  }, [terms, transcript]);

  return {
    segments,
  };
}
