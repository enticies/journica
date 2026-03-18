interface Props {
  expanded?: boolean;
}

export function ChevronRightIcon({ expanded = false }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="6"
      height="9"
      viewBox="0 0 6 9"
      fill="none"
      className={expanded ? "rotate-90" : ""}
      aria-hidden="true"
    >
      <path
        d="M3.83333 4.42313L0 0.589792L0.589792 0L5.01292 4.42313L0.589792 8.84625L0 8.25646L3.83333 4.42313Z"
        fill="#5C5A52"
      />
    </svg>
  );
}
