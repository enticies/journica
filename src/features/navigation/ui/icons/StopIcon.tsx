interface Props {
  className?: string;
}

export function StopIcon({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M7 7h10v10H7V7Z" />
    </svg>
  );
}
