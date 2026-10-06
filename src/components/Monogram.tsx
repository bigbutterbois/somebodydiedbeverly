// The site's logo: a W and the same W turned upside down (the teal M) inside a
// ring. The W's right stroke and the M's left stroke run parallel and touch,
// edge to edge. The letters sit in a nested svg that crops their stroke ends
// flat at the top and bottom. Scales with font size.
export function Monogram({ className = "" }: { className?: string }) {
  return (
    <svg
      role="img"
      aria-label="wilfullymisunderstand"
      viewBox="0 0 64 64"
      className={`block h-[2em] w-[2em] ${className}`}
      fill="none"
    >
      <circle cx="32" cy="32" r="28.5" strokeWidth={2.5} className="stroke-accent" />
      <svg x="0" y="21" width="64" height="22" viewBox="0 21 64 22" strokeWidth={3.2} strokeMiterlimit={10}>
        <path d="M11.2 15.25 L19.4 43 L23.24 30 L27.08 43 L35.28 15.25" stroke="currentColor" />
        <path d="M52.8 48.75 L44.6 21 L40.76 34 L36.92 21 L28.72 48.75" className="stroke-accent" />
      </svg>
    </svg>
  );
}
