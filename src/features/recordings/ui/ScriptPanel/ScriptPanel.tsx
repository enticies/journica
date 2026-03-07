import { Entry } from "../../model/types";
import { TranscriptView } from "../TranscriptView";
import { useScriptPanel } from "./useScriptPanel";

interface Props {
  selectedEntry: Entry | null;
  searchQuery: string;
  scriptMessage: string | null;
}

export function ScriptPanel({ selectedEntry, searchQuery, scriptMessage }: Props) {
  const { transcript } = useScriptPanel({ selectedEntry });

  return (
    <section className="flex-1 overflow-y-auto p-6 bg-white">
      <h2 className="text-lg font-bold mb-3">Script</h2>
      {scriptMessage && <p className="text-gray-500">{scriptMessage}</p>}
      {transcript && <TranscriptView transcript={transcript} searchQuery={searchQuery} />}
    </section>
  );
}
