// The YouAsked mark: a speech bubble holding the vote arrow. Ask, then vote it up.
export function Mark({ size = 24, fill = "var(--cobalt)", ink = "#fff", className }: { size?: number; fill?: string; ink?: string; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M16 6h32a12 12 0 0 1 12 12v22a12 12 0 0 1-12 12H30L16 62V52a12 12 0 0 1-12-12V18A12 12 0 0 1 16 6Z" fill={fill} />
      <path d="M21 37 32 26l11 11" fill="none" stroke={ink} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <Mark size={26} />
      YouAsked
    </span>
  );
}
