"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SwingCounty, SwingState } from "./data";

const WIDTH = 975;
const HEIGHT = 610;
/** A shift this big (points of margin) or more gets the darkest color. */
const FULL = 20;
/** On the 2026 margins view, a margin this big or more gets the darkest color. */
const FULL_MARGIN = 40;

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

const margin = (m: number | null, letter: string) =>
  m === null ? "–" : Math.abs(m) < 0.05 ? "Even" : m > 0 ? `${letter}+${m.toFixed(1)}` : `R+${(-m).toFixed(1)}`;
const shiftText = (s: number | null) =>
  s === null ? "–" : Math.abs(s) < 0.05 ? "no change" : `${s > 0 ? "D" : "R"}+${Math.abs(s).toFixed(1)}`;
const last = (n: string) => n.split(" ").pop();

type Hover = { county: SwingCounty | null; state: SwingState };
type Box = [number, number, number, number];
const ZOOM_MS = 450;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
type Base = "2024" | "2020" | "2026";
type Margins = { margin2024: number; margin2020: number | null; margin2026: number | null };

/** The 2026 margin minus the chosen baseline's, rounded to a tenth. */
function shiftFrom(x: Margins, base: Base) {
  const from = base === "2020" ? x.margin2020 : x.margin2024;
  if (x.margin2026 === null || from === null) return null;
  return Math.round((x.margin2026 - from) * 10) / 10;
}

/** What a view colors by: the shift from its baseline, or on the 2026 view the margin itself. */
const valueFor = (x: Margins, base: Base) => (base === "2026" ? x.margin2026 : shiftFrom(x, base));
const fullFor = (base: Base) => (base === "2026" ? FULL_MARGIN : FULL);

const BASES: { key: Base; label: string }[] = [
  { key: "2024", label: "vs. Harris 2024" },
  { key: "2020", label: "vs. 2020 Senate" },
  { key: "2026", label: "2026 margins" },
];

export function SwingMap({
  states,
  counties,
  others,
  borders,
  compare2020,
}: {
  states: SwingState[];
  counties: SwingCounty[];
  others: string;
  borders: string;
  compare2020: boolean;
}) {
  const [base, setBase] = useState<Base>("2024");
  const [zoom, setZoom] = useState<string | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [pinned, setPinned] = useState<SwingCounty | null>(null);
  const mapRef = useRef<HTMLElement>(null);
  const byCode = useMemo(() => new Map(states.map((s) => [s.code, s])), [states]);
  const zoomed = zoom ? byCode.get(zoom) : undefined;

  const target = useMemo<Box>(() => {
    if (!zoomed) return [0, 0, WIDTH, HEIGHT];
    const [x0, y0, x1, y1] = zoomed.box;
    const pad = Math.max(x1 - x0, y1 - y0) * 0.06;
    let w = x1 - x0 + pad * 2;
    let h = y1 - y0 + pad * 2;
    // Keep the map's shape so the frame doesn't jump around.
    if (w / h > WIDTH / HEIGHT) h = (w * HEIGHT) / WIDTH;
    else w = (h * WIDTH) / HEIGHT;
    return [(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h / 2, w, h];
  }, [zoomed]);

  // Glide the frame from wherever it is now to the new target. The viewBox is set straight on the
  // svg each frame, so React doesn't redraw thousands of counties 60 times a second.
  const svgRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<Box>(target);
  useEffect(() => {
    const svg = svgRef.current;
    const from = boxRef.current;
    if (!svg || from.every((v, i) => v === target[i])) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const [fx, fy, fw, fh] = from;
    const [tx, ty, tw, th] = target;
    const fc = [fx + fw / 2, fy + fh / 2];
    const tc = [tx + tw / 2, ty + th / 2];
    let start: number | null = null;
    let frame = 0;
    const step = (now: number) => {
      // Start the clock on the first frame, so a slow first paint doesn't eat the opening of the zoom.
      start ??= now;
      const t = reduce ? 1 : Math.min((now - start) / ZOOM_MS, 1);
      const k = ease(t);
      // Scale geometrically so zooming in feels as even as zooming out, and move the center in step
      // with the scale so the map grows toward the state instead of sliding then popping.
      const w = fw * (tw / fw) ** k;
      const h = fh * (th / fh) ** k;
      const m = Math.abs(tw - fw) > 1e-6 ? (fw - w) / (fw - tw) : k;
      const cx = fc[0] + (tc[0] - fc[0]) * m;
      const cy = fc[1] + (tc[1] - fc[1]) * m;
      const next: Box = [cx - w / 2, cy - h / 2, w, h];
      boxRef.current = next;
      svg.setAttribute("viewBox", next.join(" "));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  // Strokes don't scale with the zoom; this keeps them the same on-screen width they'd have unzoomed.
  const [px, setPx] = useState(1);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const ro = new ResizeObserver(([e]) => setPx(e.contentRect.width / WIDTH || 1));
    ro.observe(svg);
    return () => ro.disconnect();
  }, []);

  // Only redrawn when the view or stroke size changes: not on hover, and not on zoom (the dimming of
  // other states is a style rule below), so clicking a state starts the zoom right away.
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  const countyLayer = useMemo(
    () =>
      counties.map((c) => {
        const state = byCode.get(c.state)!;
        return (
          <path
            key={c.fips}
            d={c.d}
            fill={shiftColor(valueFor(c, base), fullFor(base))}
            stroke="var(--background)"
            strokeWidth={0.3 * px}
            vectorEffect="non-scaling-stroke"
            data-state={c.state}
            className="cursor-pointer"
            onPointerEnter={() =>
              setHover({ county: zoomRef.current === c.state && !state.statewide ? c : null, state })
            }
            onClick={() => {
              if (zoomRef.current !== c.state) {
                setZoom(c.state);
                setPinned(null);
                setHover({ county: null, state });
              } else if (!state.statewide) {
                setPinned((p) => (p?.fips === c.fips ? null : c));
                setHover({ county: c, state });
              }
            }}
          />
        );
      }),
    [counties, byCode, base, px],
  );

  const zoomTo = (code: string | null) => {
    setZoom(code);
    setPinned(null);
  };

  const sorted = states
    .map((s) => ({ s, shift: valueFor(s, base) }))
    .sort((a, b) => (b.shift ?? -999) - (a.shift ?? -999));

  const pinnedState = pinned ? byCode.get(pinned.state)! : null;
  const info: Hover | null = pinned
    ? { county: pinned, state: pinnedState! }
    : hover ?? (zoomed ? { county: null, state: zoomed } : null);
  // A whole state lights up when the pointer is on it and its counties aren't the thing being explored.
  const litState = hover && !hover.county && hover.state.code !== zoom ? hover.state : null;

  return (
    <div className="flex flex-col gap-6">
      <section ref={mapRef} className="flex scroll-mt-4 flex-col gap-2">
        <h2 className="text-2xl font-light tracking-tight">Blue tsunami map</h2>
        <p className="text-sm text-muted">
          {base === "2026"
            ? "Each county shaded by the 2026 margin between the Democrat (or independent) and the Republican, using the votes counted so far."
            : `Each county shaded by how much the Democrat's (or independent's) 2026 margin moved from ${
                base === "2024" ? "Harris's 2024 margin" : "the 2020 Senate race"
              }, using the votes counted so far.`}
          {base === "2020" && " Florida and Ohio had no 2020 Senate race; Alaska's districts were redrawn, so it uses its statewide margin."}
        </p>
          <div className="flex flex-wrap gap-1 text-sm" role="tablist" aria-label="Map view">
            {BASES.filter((b) => compare2020 || b.key !== "2020").map((b) => (
              <button
                key={b.key}
                type="button"
                role="tab"
                aria-selected={base === b.key}
                onClick={() => setBase(b.key)}
                className={`rounded-full border px-3 py-1 transition-colors ${
                  base === b.key ? "border-foreground text-foreground" : "border-line text-muted hover:text-foreground"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        <div className="flex min-h-6 items-center gap-3 text-sm">
          {zoomed ? (
            <>
              <button type="button" onClick={() => zoomTo(null)} className="underline">
                ← All states
              </button>
              <span className="text-muted">
                {zoomed.name}
                {!zoomed.statewide && " · click a county to keep its numbers up, click it again to let go"}
              </span>
            </>
          ) : (
            <span className="text-muted">Hover a state for its totals. Click it to zoom in to its counties.</span>
          )}
        </div>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full touch-manipulation"
          role="img"
          aria-label={base === "2026" ? "2026 margin by county" : "County swing to 2026"}
          onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)}
        >
          {zoom && <style>{`path[data-state]:not([data-state="${zoom}"]){fill-opacity:.35}`}</style>}
          <path d={others} fill="var(--surface)" />
          {countyLayer}
          <path d={borders} fill="none" stroke="var(--background)" strokeWidth={1.2 * px}
              vectorEffect="non-scaling-stroke" pointerEvents="none" />
          {litState && (
            <path
              d={litState.d}
              fill="var(--foreground)"
              fillOpacity={0.12}
              stroke="var(--foreground)"
              strokeWidth={2 * px}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              pointerEvents="none"
            />
          )}
          {hover?.county && hover.county.fips !== pinned?.fips && (
            <path
              d={hover.county.d}
              fill="none"
              stroke="var(--foreground)"
              strokeWidth={1.5 * px}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          )}
          {pinned && (
            <path
              d={pinned.d}
              fill="var(--foreground)"
              fillOpacity={0.15}
              stroke="var(--foreground)"
              strokeWidth={2.5 * px}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              pointerEvents="none"
            />
          )}
        </svg>
        <Legend base={base} />
        <Readout info={info} base={base} pinned={!!pinned} onUnpin={() => setPinned(null)} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs uppercase tracking-[0.12em] text-muted">{base === "2026" ? "Statewide margin" : "Statewide shift"}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm tabular-nums">
            <thead className="text-xs uppercase tracking-[0.12em] text-muted">
              <tr className="border-b border-line">
                <th className="py-2 pr-4 font-normal">State</th>
                <th className="py-2 pr-4 font-normal">{base === "2020" ? "Senate 2020" : "Harris 2024"}</th>
                {base !== "2026" && <th className="py-2 pr-4 font-normal">2026</th>}
                <th className="py-2 pr-4 font-normal">{base === "2026" ? "2026 margin" : "Shift"}</th>
                <th className="py-2 pr-4 font-normal">Counted</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ s, shift }) => (
                <tr key={s.code} className="border-b border-line">
                  <td className="py-1.5 pr-4">
                    <button type="button" className="underline" onClick={() => {
                        zoomTo(s.code);
                        setHover(null);
                        mapRef.current?.scrollIntoView({ behavior: "smooth" });
                      }}>
                      {s.name}
                    </button>
                    {s.statewide && <span className="ml-1 text-xs text-muted">statewide only</span>}
                  </td>
                  <td className="py-1.5 pr-4">{margin(base === "2020" ? s.margin2020 : s.margin2024, "D")}</td>
                  {base !== "2026" && (
                    <td className="py-1.5 pr-4">
                      {margin(s.margin2026, s.opp.party)} <span className="text-muted">{last(s.opp.name)}</span>
                    </td>
                  )}
                  <td className="py-1.5 pr-4">
                    <span
                      className="mr-2 inline-block h-3 w-3 rounded-sm align-middle"
                      style={{ background: shiftColor(shift, fullFor(base)) }}
                    />
                    {base === "2026"
                      ? `${margin(shift, s.opp.party)} ${last(s.opp.name)}`
                      : shift === null && base === "2020"
                        ? "no 2020 race"
                        : shiftText(shift)}
                  </td>
                  <td className="py-1.5 pr-4">{Math.round(s.counted * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Legend({ base }: { base: Base }) {
  const full = fullFor(base);
  const ticks = [-full, -full / 2, 0, full / 2, full];
  const stops = Array.from({ length: 21 }, (_, i) => -full + (i * 2 * full) / 20);
  return (
    <div className="flex max-w-md flex-col gap-1 text-xs text-muted tabular-nums">
      <div
        className="h-3 rounded-sm"
        style={{ background: `linear-gradient(to right, ${stops.map((v) => shiftColor(v, full)).join(", ")})` }}
      />
      <div className="flex justify-between">
        {ticks.map((t) => (
          <span key={t}>{t === 0 ? "0" : `${t > 0 ? "D" : "R"}+${Math.abs(t)}${Math.abs(t) === full ? "+" : ""}`}</span>
        ))}
      </div>
      <p>
        {base === "2026"
          ? "2026 margin, Democrat or independent against the Republican."
          : `Shift in margin from ${base === "2024" ? "Harris 2024" : "the 2020 Senate race"} to the 2026 Democrat or independent.`}
      </p>
    </div>
  );
}

function Readout({
  info,
  base,
  pinned,
  onUnpin,
}: {
  info: Hover | null;
  base: Base;
  pinned: boolean;
  onUnpin: () => void;
}) {
  if (!info) return <p className="min-h-16 text-sm text-muted">&nbsp;</p>;
  const { county: c, state: s } = info;
  const x = c ?? s;
  const rows: [string, string][] = [
    base === "2020" ? ["Senate 2020", margin(x.margin2020, "D")] : ["Harris 2024", margin(x.margin2024, "D")],
    [`${last(s.opp.name)} 2026`, margin(x.margin2026, s.opp.party)],
    [base === "2026" ? "Shift from Harris" : "Shift", shiftText(shiftFrom(x, base))],
    ["Votes", `${Math.round(x.votes).toLocaleString()} (${Math.round(x.counted * 100)}% counted)`],
  ];
  return (
    <div className="min-h-16 text-sm">
      <p className="font-medium">
        {c ? `${c.name}, ${s.code}` : s.name}
        {!c && s.statewide && <span className="ml-2 text-xs text-muted">statewide total only, no county results</span>}
        {pinned && (
          <button type="button" onClick={onUnpin} className="ml-2 text-xs text-muted underline">
            clear
          </button>
        )}
      </p>
      <dl className="flex flex-wrap gap-x-5 gap-y-1 tabular-nums">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-1.5">
            <dt className="text-muted">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
