// The swing map's color scale, shared by the map and the homepage preview.

/** A shift this big (points of margin) or more gets the darkest color. */
export const FULL = 20;
/** On the 2026 margins view, a margin this big or more gets the darkest color. */
export const FULL_MARGIN = 40;

// White at no movement, through the party color at half, to a deep shade at FULL.
const BLUE: [number, number, number][] = [[255, 255, 255], [74, 134, 232], [12, 42, 110]];
const RED: [number, number, number][] = [[255, 255, 255], [229, 83, 75], [110, 16, 12]];

export function shiftColor(shift: number | null, full = FULL) {
  if (shift === null) return "var(--line)";
  const stops = shift >= 0 ? BLUE : RED;
  const t = Math.min(Math.abs(shift) / full, 1) * 2;
  const i = Math.min(Math.floor(t), 1);
  const f = t - i;
  const [a, b] = [stops[i], stops[i + 1]];
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
