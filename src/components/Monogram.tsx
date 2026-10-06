// The site's logo: "WM" set in a thin outlined box. Scales with font size.
export function Monogram({ className = "" }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="wilfullymisunderstand"
      className={`inline-block border border-current py-[0.3em] pl-[0.55em] pr-[0.35em] leading-none font-light tracking-[0.2em] ${className}`}
    >
      WM
    </span>
  );
}
