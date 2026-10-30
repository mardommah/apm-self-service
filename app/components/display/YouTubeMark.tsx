/** YouTube play-button mark (lucide-react has no brand icons). */
export function YouTubeMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 14) / 20} viewBox="0 0 20 14" aria-hidden className="shrink-0">
      <rect width="20" height="14" rx="3.5" fill="#FF0000" />
      <path d="M8 4v6l5.2-3z" fill="#FFFFFF" />
    </svg>
  );
}
