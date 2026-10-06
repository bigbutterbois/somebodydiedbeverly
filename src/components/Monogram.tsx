// The site's logo: a W and the same W turned upside down (the teal M) inside a
// ring. The W's right stroke and the M's left stroke run parallel, side by
// side. The letters sit in a nested svg that crops their stroke ends flat at
// the top and bottom. Scales with font size.
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
        <path d="M9.53 15.25 L17.73 43 L21.57 30 L25.41 43 L33.61 15.25" stroke="currentColor" />
        <path d="M54.47 48.75 L46.27 21 L42.43 34 L38.59 21 L30.39 48.75" className="stroke-accent" />
      </svg>
    </svg>
  );
}
