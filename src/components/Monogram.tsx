// The site's logo: a teal W and a W turned upside down (the M) drawn in the
// same square, so their strokes cross into a row of diamonds. The strokes run
// past the top and bottom of the viewBox, which cuts their ends flat.
// Scales with font size.
export function Monogram({ className = "" }: { className?: string }) {
  return (
    <svg
      role="img"
      aria-label="wilfullymisunderstand"
      viewBox="5 14 54 36"
      className={`block h-[1.75em] w-auto ${className}`}
      fill="none"
      strokeWidth={4}
      strokeMiterlimit={10}
    >
      <path d="M6.1 8.3 L20 50 L32 24 L44 50 L57.9 8.3" className="stroke-accent" />
      <path d="M6.1 55.7 L20 14 L32 40 L44 14 L57.9 55.7" stroke="currentColor" />
    </svg>
  );
}
