import { useInputChange } from "../../../../shared/hooks/useInputChange";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function RecordingsSearch({ value, onChange }: Props) {
  const { handleChange } = useInputChange({ onChange });

  return (
    <input
      type="text"
      value={value}
      onChange={(event) => handleChange(event.target.value)}
      placeholder="Search names, transcripts, tags..."
      className="w-full px-3 py-2 text-sm border rounded bg-white"
    />
  );
}
