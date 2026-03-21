import { SearchIcon } from "../icons/SearchIcon";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function NavigationSearch({ value, onChange, placeholder = "Search" }: Props) {
  return (
    <label className="flex h-7 self-stretch items-center gap-2 rounded-[22px] border border-dark-20 bg-transparent px-3 py-2">
      <SearchIcon />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent font-sans text-[14px] font-normal leading-5 tracking-[-0.076px] outline-none text-dark-20 placeholder:text-dark-20"
      />
    </label>
  );
}
