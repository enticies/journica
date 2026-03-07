import { useMemo } from "react";
import { Entry } from "../../model/types";

interface UseScriptPanelParams {
  selectedEntry: Entry | null;
}

export function useScriptPanel({ selectedEntry }: UseScriptPanelParams) {
  const transcript = useMemo(() => selectedEntry?.transcript ?? null, [selectedEntry]);

  return {
    transcript,
  };
}
