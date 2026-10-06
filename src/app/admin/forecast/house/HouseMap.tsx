"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { favoriteLine, formatMargin, outOf100, partyLetter, ratingInfo, type Race } from "@/lib/forecast";
import tiles from "./districtTiles.json";

// Every House district as an equal-size hex, grouped by state (laid out by
// scripts/district-tiles.mjs). Shaded by rating; hover or tap a district for
// its odds. Zoom with the buttons, a pinch or ctrl/⌘ + scroll, drag to pan, and
// search by district, state or candidate.

const S = tiles.size;
const HEX = Array.from({ length: 6 }, (_, i) => {
  const a = ((60 * i - 30) * Math.PI) / 180;
  return `${(S * 0.94 * Math.cos(a)).toFixed(2)},${(S * 0.94 * Math.sin(a)).toFixed(2)}`;
}).join(" ");
const MAX_ZOOM = 8;

type Tile = { id: string; x: number; y: number };
type View = { k: number; x: number; y: number };

const ALL: Tile[] = Object.entries(tiles.cells as Record<string, number[]>).map(([id, [q, r]]) => ({
  id,
  x: S * Math.sqrt(3) * (q + r / 2),
  y: S * 1.5 * r,
}));
const MIN_X = Math.min(...ALL.map((t) => t.x)) - S * 1.5;
const MIN_Y = Math.min(...ALL.map((t) => t.y)) - S * 1.5;
const W = Math.max(...ALL.map((t) => t.x)) + S * 1.5 - MIN_X;
const H = Math.max(...ALL.map((t) => t.y)) + S * 1.5 - MIN_Y;
const TILES = ALL.map((t) => ({ ...t, x: t.x - MIN_X, y: t.y - MIN_Y }));

// A label for each state, at the middle of its tiles.
const STATE_LABELS = Object.entries(
  TILES.reduce<Record<string, Tile[]>>((acc, t) => ((acc[t.id.slice(0, 2)] ??= []).push(t), acc), {}),
).map(([code, list]) => ({
  code,
  x: list.reduce((s, t) => s + t.x, 0) / list.length,
  y: list.reduce((s, t) => s + t.y, 0) / list.length,
}));

const clampView = ({ k, x, y }: View): View => {
  const kk = Math.min(MAX_ZOOM, Math.max(1, k));
  return { k: kk, x: Math.min(0, Math.max(W - W * kk, x)), y: Math.min(0, Math.max(H - H * kk, y)) };
};

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function HouseMap({ races }: { races: Race[] }) {
  const byId = useMemo(() => new Map(races.map((r) => [r.state, r])), [races]);
  const boxRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ k: 1, x: 0, y: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ moved: boolean; pinch?: number } | null>(null);

  const active = hover ?? selected;
  const activeTile = active ? TILES.find((t) => t.id === active) : null;
  const activeRace = active ? byId.get(active) : null;

  /** Map units per screen pixel. */
  function unitsPerPx() {
    return W / boxRef.current!.getBoundingClientRect().width;
  }
  function localPoint(clientX: number, clientY: number) {
    const box = boxRef.current!.getBoundingClientRect();
    const u = W / box.width;
    return { x: (clientX - box.left) * u, y: (clientY - box.top) * u };
  }
  function zoomAt(factor: number, at: { x: number; y: number }) {
    setView((v) => {
      const k = Math.min(MAX_ZOOM, Math.max(1, v.k * factor));
      const f = k / v.k;
      return clampView({ k, x: at.x - (at.x - v.x) * f, y: at.y - (at.y - v.y) * f });
    });
  }
  function focus(id: string) {
    const t = TILES.find((t) => t.id === id);
    if (!t) return;
    const k = Math.max(view.k, 4);
    setView(clampView({ k, x: W / 2 - t.x * k, y: H / 2 - t.y * k }));
    setSelected(id);
    setQuery("");
    setOpen(false);
  }

  // Plain scrolling scrolls the page; ctrl/⌘ + scroll (and trackpad pinches) zoom. A native
  // listener, since React's wheel handlers can't stop the browser zooming the whole page.
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef(zoomAt);
  useEffect(() => {
    zoomRef.current = zoomAt;
  });
  useEffect(() => {
    const el = svgRef.current!;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const box = el.getBoundingClientRect();
      const u = W / box.width;
      zoomRef.current(Math.exp(-e.deltaY * 0.01), { x: (e.clientX - box.left) * u, y: (e.clientY - box.top) * u });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  function onPointerDown(e: React.PointerEvent) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    drag.current = { moved: false };
  }
  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const u = unitsPerPx();
    if (pointers.current.size === 2) {
      // Pinch: zoom by the change in distance between the two fingers.
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (drag.current?.pinch) zoomAt(d / drag.current.pinch, localPoint((a.x + b.x) / 2, (a.y + b.y) / 2));
      drag.current = { moved: true, pinch: d };
      return;
    }
    const dx = (e.clientX - prev.x) * u;
    const dy = (e.clientY - prev.y) * u;
    if (Math.abs(dx) + Math.abs(dy) > 0.5 && view.k > 1) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (drag.current) drag.current.moved = true;
      setView((v) => clampView({ ...v, x: v.x + dx, y: v.y + dy }));
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) drag.current = null;
  }

  // Search: district ("TX-28", "tx28"), state name or code, or a candidate's name.
  const matches = useMemo(() => {
    const q = normalize(query);
    if (!q) return [];
    return races
      .filter(
        (r) =>
          normalize(r.state).startsWith(q) ||
          normalize(r.name).includes(q) ||
          [r.rep, r.opp].some((c) => !c.name.startsWith("No ") && normalize(c.name).includes(q)),
      )
      .sort((a, b) => a.state.localeCompare(b.state, undefined, { numeric: true }))
      .slice(0, 8);
  }, [query, races]);

  // Where the tooltip goes, in % of the box: the hovered/selected tile's center after zoom.
  const tip = activeTile && {
    left: ((activeTile.x * view.k + view.x) / W) * 100,
    top: ((activeTile.y * view.k + view.y + S * view.k) / H) * 100,
  };
  const showNumbers = view.k >= 2.5;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches[0]) focus(matches[0].state);
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder="Find a district, state or candidate"
            aria-label="Find a district, state or candidate"
            className="w-full rounded border border-line bg-surface px-3 py-1.5 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
          />
          {open && matches.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded border border-line bg-background text-sm shadow-lg">
              {matches.map((r) => (
                <li key={r.state}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => focus(r.state)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-surface"
                  >
                    <span className="inline-block size-2.5 shrink-0 rounded-sm" style={{ background: ratingInfo(r.rating).color }} />
                    <span className="w-14 shrink-0 tabular-nums">{r.state}</span>
                    <span className="truncate text-muted">
                      {r.opp.name} vs. {r.rep.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex overflow-hidden rounded border border-line text-sm">
          {[
            { label: "Zoom in", text: "+", f: 1.6 },
            { label: "Zoom out", text: "−", f: 1 / 1.6 },
          ].map((b) => (
            <button
              key={b.label}
              type="button"
              aria-label={b.label}
              onClick={() => zoomAt(b.f, { x: W / 2, y: H / 2 })}
              className="w-8 border-r border-line py-1.5 text-muted hover:bg-surface hover:text-foreground"
            >
              {b.text}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setView({ k: 1, x: 0, y: 0 });
              setSelected(null);
            }}
            className="px-2.5 py-1.5 text-muted hover:bg-surface hover:text-foreground"
          >
            Reset
          </button>
        </div>
      </div>

      <div
        ref={boxRef}
        className="relative overflow-hidden rounded border border-line"
        onPointerLeave={() => setHover(null)}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className={`h-auto w-full select-none ${view.k > 1 ? "cursor-grab touch-none active:cursor-grabbing" : "touch-pan-y"}`}
          role="img"
          aria-label="Map of 2026 House districts by rating"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            {TILES.map((t) => {
              const race = byId.get(t.id);
              return (
                <polygon
                  key={t.id}
                  points={HEX}
                  transform={`translate(${t.x} ${t.y})`}
                  fill={race ? ratingInfo(race.rating).color : "var(--line)"}
                  className="cursor-pointer"
                  onPointerEnter={(e) => e.pointerType === "mouse" && setHover(t.id)}
                  onClick={() => {
                    if (drag.current?.moved) return;
                    setSelected((s) => (s === t.id ? null : t.id));
                  }}
                />
              );
            })}
            {activeTile && (
              <polygon
                points={HEX}
                transform={`translate(${activeTile.x} ${activeTile.y})`}
                fill="none"
                stroke="var(--foreground)"
                strokeWidth={2 / view.k}
                pointerEvents="none"
              />
            )}
            {showNumbers
              ? TILES.map((t) => (
                  <text key={t.id} x={t.x} textAnchor="middle" pointerEvents="none" className="fill-background">
                    <tspan x={t.x} y={t.y - 1.5} style={{ fontSize: 3.6 }}>
                      {t.id.slice(0, 2)}
                    </tspan>
                    <tspan x={t.x} y={t.y + 4.5} className="font-medium" style={{ fontSize: 5.5 }}>
                      {t.id.slice(3) === "AL" ? "AL" : Number(t.id.slice(3))}
                    </tspan>
                  </text>
                ))
              : STATE_LABELS.map((l) => (
                  <text
                    key={l.code}
                    x={l.x}
                    y={l.y + 3.5}
                    textAnchor="middle"
                    pointerEvents="none"
                    className="fill-foreground font-semibold"
                    stroke="var(--background)"
                    strokeWidth={2.5}
                    paintOrder="stroke"
                    style={{ fontSize: 10 }}
                  >
                    {l.code}
                  </text>
                ))}
          </g>
        </svg>
        {activeRace && tip && <Tooltip race={activeRace} left={tip.left} top={tip.top} />}
      </div>
      <p className="text-xs text-muted">
        One hex per district, grouped by state; hexes aren&rsquo;t drawn to the districts&rsquo; real shapes. Tap or
        hover for a district&rsquo;s odds. Zoom with + and −, a pinch, or ctrl/⌘ + scroll, then drag to move around.
      </p>
    </div>
  );
}

function Tooltip({ race, left, top }: { race: Race; left: number; top: number }) {
  const rating = ratingInfo(race.rating);
  const repFavored = race.p_rep >= race.p_opp;
  const underdog = repFavored ? race.opp : race.rep;
  if (left < -5 || left > 105 || top < -5 || top > 110) return null; // panned out of view
  return (
    <div
      className="pointer-events-none absolute z-10 w-64 -translate-x-1/2 rounded border border-line bg-background/95 p-3 text-sm shadow-lg"
      style={{ left: `clamp(8rem, ${left}%, calc(100% - 8rem))`, top: `min(${top}%, calc(100% - 9rem))` }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium">
          {race.state}
          {race.new_lines && <span className="text-muted"> †</span>}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: rating.color }} />
          {rating.label}
        </span>
      </div>
      {race.uncontested ? (
        <p className="mt-2">
          {(race.uncontested === "R" ? race.rep : race.opp).name} ({race.uncontested}) is unopposed
        </p>
      ) : (
        <>
          <p className="mt-2">{favoriteLine(race)}</p>
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-xs text-muted tabular-nums">
            <dt>
              {underdog.name} ({partyLetter(underdog)})
            </dt>
            <dd className="text-right">{outOf100(repFavored ? race.p_opp : race.p_rep)}%</dd>
            <dt>Forecast margin</dt>
            <dd className="text-right">{formatMargin(race.mean_margin, partyLetter(race.opp))}</dd>
            {race.lean != null && (
              <>
                <dt>District lean</dt>
                <dd className="text-right">{formatMargin(race.lean, "D")}</dd>
              </>
            )}
          </dl>
        </>
      )}
      {race.new_lines && <p className="mt-2 text-xs text-muted">† New district lines for 2026</p>}
    </div>
  );
}
