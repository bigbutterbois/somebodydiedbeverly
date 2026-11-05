"use client";

import { useMemo, useRef, useState } from "react";
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
  const mapRef = useRef<HTMLElement>(null);
  const byCode = useMemo(() => new Map(states.map((s) => [s.code, s])), [states]);
  const zoomed = zoom ? byCode.get(zoom) : undefined;

  const viewBox = useMemo(() => {
    if (!zoomed) return `0 0 ${WIDTH} ${HEIGHT}`;
    const [x0, y0, x1, y1] = zoomed.box;
    const pad = Math.max(x1 - x0, y1 - y0) * 0.06;
    let w = x1 - x0 + pad * 2;
    let h = y1 - y0 + pad * 2;
    // Keep the map's shape so the frame doesn't jump around.
    if (w / h > WIDTH / HEIGHT) h = (w * HEIGHT) / WIDTH;
    else w = (h * WIDTH) / HEIGHT;
    return `${(x0 + x1) / 2 - w / 2} ${(y0 + y1) / 2 - h / 2} ${w} ${h}`;
  }, [zoomed]);
  const scale = zoomed ? WIDTH / Number(viewBox.split(" ")[2]) : 1;

  const sorted = states
    .map((s) => ({ s, shift: valueFor(s, base) }))
    .sort((a, b) => (b.shift ?? -999) - (a.shift ?? -999));

  const info = hover ?? (zoomed ? { county: null, state: zoomed } : null);

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
              <button type="button" onClick={() => setZoom(null)} className="underline">
                ← All states
              </button>
              <span className="text-muted">{zoomed.name}</span>
            </>
          ) : (
            <span className="text-muted">Click a state to zoom in. Hover a county for its numbers.</span>
          )}
        </div>
        <svg
          viewBox={viewBox}
          className="h-auto w-full touch-manipulation"
          role="img"
          aria-label={base === "2026" ? "2026 margin by county" : "County swing to 2026"}
          onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)}
        >
          <path d={others} fill="var(--surface)" />
          {counties.map((c) => {
            const state = byCode.get(c.state)!;
            return (
              <path
                key={c.fips}
                d={c.d}
                fill={shiftColor(valueFor(c, base), fullFor(base))}
                stroke="var(--background)"
                strokeWidth={0.3 / scale}
                opacity={zoom && zoom !== c.state ? 0.35 : 1}
                className={zoom === c.state ? "" : "cursor-pointer"}
                onPointerEnter={() => setHover({ county: state.statewide ? null : c, state })}
                onClick={() => {
                  setHover({ county: state.statewide ? null : c, state });
                  if (zoom !== c.state) setZoom(c.state);
                }}
              />
            );
          })}
          <path d={borders} fill="none" stroke="var(--background)" strokeWidth={1.2 / scale} pointerEvents="none" />
          {hover?.county && (
            <path
              d={hover.county.d}
              fill="none"
              stroke="var(--foreground)"
              strokeWidth={1.5 / scale}
              pointerEvents="none"
            />
          )}
        </svg>
        <Legend base={base} />
        <Readout info={info} base={base} />
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
                        setZoom(s.code);
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

function Readout({ info, base }: { info: Hover | null; base: Base }) {
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
