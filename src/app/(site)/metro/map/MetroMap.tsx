"use client";

import { geoMercator, geoPath } from "d3-geo";
import { useEffect, useMemo, useRef, useState } from "react";
import { LINES, LINE_BY_CODE, STATIONS, STATION_BY_KEY, linesAt, type LabelSide, type Station } from "@/lib/metro/network";
import type { Train } from "@/lib/metro/wmata";
import { Updated } from "../Updated";
import { useStored } from "../useStored";
import backdrop from "./backdrop.json";

// Every Metrorail train, live, two ways: a diagram like the one in the cars, or
// to scale over the real geography. Trains come from /api/metro/trains every 10
// seconds while the tab is visible, and glide to their new spot. Zoom with the
// buttons, a pinch or ctrl/⌘ + scroll, drag to pan, tap a train for its details.

type Mode = "diagram" | "scale";
type Point = [number, number];
type View = { k: number; x: number; y: number };
type Layout = { W: number; H: number; pos: Map<string, Point>; line: number; gap: number; font: number };

const REFRESH = 10_000;
const MODE_KEY = "metro.mapMode";

// Diagram: grid units from network.ts, U pixels apart, with room around for names.
const U = 36;
const BOUNDS = { x0: -21.5, x1: 16, y0: -16, y1: 13 };
const DIAGRAM: Layout = {
  W: (BOUNDS.x1 - BOUNDS.x0) * U,
  H: (BOUNDS.y1 - BOUNDS.y0) * U,
  pos: new Map(STATIONS.map((s) => [s.key, [(s.x - BOUNDS.x0) * U, (s.y - BOUNDS.y0) * U]])),
  line: 5,
  gap: 5,
  font: 9,
};

function scaleLayout(coords: Record<string, Point>): { layout: Layout; counties: string[] } {
  const W = 1000;
  const H = 820;
  const points = Object.values(coords);
  const projection = geoMercator().fitExtent(
    [
      [40, 40],
      [W - 40, H - 40],
    ],
    { type: "MultiPoint", coordinates: points },
  );
  const pos = new Map<string, Point>();
  for (const [key, c] of Object.entries(coords)) {
    const p = projection(c);
    if (p) pos.set(key, p);
  }
  const path = geoPath(projection);
  const counties = (backdrop as GeoJSON.FeatureCollection).features.map((f) => path(f) ?? "");
  return { layout: { W, H, pos, line: 3, gap: 3, font: 10 }, counties };
}

/** Unit vector at right angles to a → b. */
function normal(a: Point, b: Point): Point {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return [-dy / len, dx / len];
}

/** Each line's track as short segments, nudged sideways where several lines share one. */
function segments(layout: Layout) {
  const shared = new Map<string, string[]>();
  for (const line of LINES) {
    for (let i = 1; i < line.stations.length; i++) {
      const id = [line.stations[i - 1], line.stations[i]].sort().join("|");
      shared.set(id, [...(shared.get(id) ?? []), line.code]);
    }
  }
  const out: { id: string; color: string; x1: number; y1: number; x2: number; y2: number }[] = [];
  for (const line of LINES) {
    for (let i = 1; i < line.stations.length; i++) {
      const [ka, kb] = [line.stations[i - 1], line.stations[i]].sort();
      const a = layout.pos.get(ka);
      const b = layout.pos.get(kb);
      if (!a || !b) continue;
      const users = shared.get(`${ka}|${kb}`)!;
      const shift = (users.indexOf(line.code) - (users.length - 1) / 2) * layout.gap;
      const n = normal(a, b);
      out.push({
        id: `${line.code}-${ka}-${kb}`,
        color: line.color,
        x1: a[0] + n[0] * shift,
        y1: a[1] + n[1] * shift,
        x2: b[0] + n[0] * shift,
        y2: b[1] + n[1] * shift,
      });
    }
  }
  return out;
}

const TERMINALS = new Set(LINES.flatMap((l) => [l.stations[0], l.stations[l.stations.length - 1]]));

function Label({ station, at, font }: { station: Station; at: Point; font: number }) {
  const d = font * 0.9;
  const props: Record<LabelSide, { dx: number; dy: number; anchor: "start" | "end"; rotate?: number }> = {
    l: { dx: -d, dy: font * 0.35, anchor: "end" },
    r: { dx: d, dy: font * 0.35, anchor: "start" },
    tl: { dx: -d * 0.6, dy: -d * 0.7, anchor: "end" },
    tr: { dx: d * 0.6, dy: -d * 0.7, anchor: "start" },
    bl: { dx: -d * 0.6, dy: d * 1.4, anchor: "end" },
    br: { dx: d * 0.6, dy: d * 1.4, anchor: "start" },
    ne: { dx: d * 0.7, dy: -d * 0.4, anchor: "start", rotate: -45 },
    se: { dx: d * 0.7, dy: d * 0.9, anchor: "start", rotate: 45 },
    sw: { dx: -d * 0.7, dy: d * 0.9, anchor: "end", rotate: -45 },
  };
  const p = props[station.label];
  const x = at[0] + p.dx;
  const y = at[1] + p.dy;
  return (
    <text
      x={x}
      y={y}
      textAnchor={p.anchor}
      fontSize={font}
      transform={p.rotate ? `rotate(${p.rotate} ${x} ${y})` : undefined}
      className="pointer-events-none fill-foreground"
    >
      {station.name}
    </text>
  );
}

/** Where a train sits: along its segment, nudged to one side of the line by track. */
function trainPoint(train: Train, layout: Layout): Point | null {
  const a = layout.pos.get(train.from);
  const b = layout.pos.get(train.to);
  if (!a || !b) return null;
  // At a station (from = to), take the direction toward the next station on the line.
  let dir: [Point, Point] = [a, b];
  if (train.from === train.to) {
    const stops = LINE_BY_CODE.get(train.line)!.stations;
    const i = stops.indexOf(train.from);
    const next = layout.pos.get(stops[i + 1]);
    const prev = layout.pos.get(stops[i - 1]);
    dir = next ? [a, next] : prev ? [prev, a] : [a, [a[0] + 1, a[1]]];
  }
  const n = normal(...dir);
  const side = (train.track === 1 ? -1 : 1) * layout.gap * 1.6;
  return [a[0] + (b[0] - a[0]) * train.t + n[0] * side, a[1] + (b[1] - a[1]) * train.t + n[1] * side];
}

function useTrains() {
  const [state, setState] = useState<{ trains: Train[]; updated: string | null; error: string | null }>({
    trains: [],
    updated: null,
    error: null,
  });
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    async function load() {
      clearTimeout(timer);
      if (document.hidden) return;
      try {
        const res = await fetch("/api/metro/trains", { cache: "no-store" });
        const body = await res.json();
        if (stopped) return;
        if (!res.ok) setState((s) => ({ ...s, error: body.error ?? "wmata" }));
        else setState({ trains: body.trains, updated: body.updated, error: null });
      } catch {
        if (!stopped) setState((s) => ({ ...s, error: "network" }));
      }
      if (!stopped) timer = setTimeout(load, REFRESH);
    }
    load();
    document.addEventListener("visibilitychange", load);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, []);
  return state;
}

export function MetroMap({ coords }: { coords: Record<string, Point> | null }) {
  const [saved, save] = useStored(MODE_KEY);
  const mode: Mode = saved === "scale" && coords ? "scale" : "diagram";
  function switchMode(next: Mode) {
    save(next);
    setView({ k: 1, x: 0, y: 0 });
  }

  const scale = useMemo(() => (coords ? scaleLayout(coords) : null), [coords]);
  const layout = mode === "scale" && scale ? scale.layout : DIAGRAM;
  const { W, H } = layout;
  const segs = useMemo(() => segments(layout), [layout]);
  const { trains, updated, error } = useTrains();
  const [selected, setSelected] = useState<string | null>(null);
  const picked = trains.find((t) => t.id === selected);

  // Zoom and pan, as on the House map.
  const boxRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>({ k: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ moved: boolean; pinch?: number } | null>(null);
  const clampView = ({ k, x, y }: View): View => {
    const kk = Math.min(8, Math.max(1, k));
    return { k: kk, x: Math.min(0, Math.max(W - W * kk, x)), y: Math.min(0, Math.max(H - H * kk, y)) };
  };
  function localPoint(clientX: number, clientY: number) {
    const box = boxRef.current!.getBoundingClientRect();
    const u = W / box.width;
    return { x: (clientX - box.left) * u, y: (clientY - box.top) * u };
  }
  function zoomAt(factor: number, at: { x: number; y: number }) {
    setView((v) => {
      const k = Math.min(8, Math.max(1, v.k * factor));
      const f = k / v.k;
      return clampView({ k, x: at.x - (at.x - v.x) * f, y: at.y - (at.y - v.y) * f });
    });
  }
  const zoomRef = useRef({ zoomAt, W });
  useEffect(() => {
    zoomRef.current = { zoomAt, W };
  });
  useEffect(() => {
    const el = svgRef.current!;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const box = el.getBoundingClientRect();
      const u = zoomRef.current.W / box.width;
      zoomRef.current.zoomAt(Math.exp(-e.deltaY * 0.01), { x: (e.clientX - box.left) * u, y: (e.clientY - box.top) * u });
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
    const u = W / boxRef.current!.getBoundingClientRect().width;
    if (pointers.current.size === 2) {
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

  // On the to-scale map only the big stations get names; the rest are a tap away in Arrivals.
  const labelled = mode === "diagram" ? STATIONS : STATIONS.filter((s) => s.codes.length > 1 || TERMINALS.has(s.key));
  const counts = LINES.map((l) => ({ line: l, n: trains.filter((t) => t.line === l.code).length }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex overflow-hidden rounded border border-line text-sm">
          {(
            [
              { mode: "diagram", label: "Diagram" },
              { mode: "scale", label: "To scale" },
            ] as const
          ).map((b) => (
            <button
              key={b.mode}
              type="button"
              disabled={b.mode === "scale" && !coords}
              aria-pressed={mode === b.mode}
              onClick={() => switchMode(b.mode)}
              className={`px-3 py-1.5 transition-colors disabled:opacity-40 ${
                mode === b.mode ? "bg-accent text-background" : "text-muted hover:bg-surface hover:text-foreground"
              }`}
            >
              {b.label}
            </button>
          ))}
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
            onClick={() => setView({ k: 1, x: 0, y: 0 })}
            className="px-2.5 py-1.5 text-muted hover:bg-surface hover:text-foreground"
          >
            Reset
          </button>
        </div>
      </div>

      <div ref={boxRef} className="relative overflow-hidden rounded border border-line">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className={`h-auto w-full select-none ${view.k > 1 ? "cursor-grab touch-none active:cursor-grabbing" : "touch-pan-y"}`}
          role="img"
          aria-label={`Map of Metrorail with ${trains.length} trains${mode === "scale" ? ", to scale" : ""}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            {mode === "scale" &&
              scale?.counties.map((d, i) => <path key={i} d={d} className="fill-surface stroke-line" strokeWidth={1} />)}
            {segs.map((s) => (
              <line
                key={s.id}
                x1={s.x1}
                y1={s.y1}
                x2={s.x2}
                y2={s.y2}
                stroke={s.color}
                strokeWidth={layout.line}
                strokeLinecap="round"
              />
            ))}
            {STATIONS.map((s) => {
              const p = layout.pos.get(s.key);
              if (!p) return null;
              const big = s.codes.length > 1;
              return (
                <a key={s.key} href={`/metro?station=${s.key}`} aria-label={`${s.name} arrivals`}>
                  <circle
                    cx={p[0]}
                    cy={p[1]}
                    r={big ? layout.line * 1.3 : layout.line * 0.75}
                    className="fill-background stroke-foreground"
                    strokeWidth={1.5}
                  >
                    <title>{`${s.name}: ${linesAt(s.key).map((l) => l.name).join(", ")}`}</title>
                  </circle>
                </a>
              );
            })}
            {labelled.map((s) => {
              const p = layout.pos.get(s.key);
              return p ? <Label key={s.key} station={s} at={p} font={layout.font} /> : null;
            })}
            {trains.map((t) => {
              const p = trainPoint(t, layout);
              if (!p) return null;
              const on = t.id === selected;
              return (
                <g
                  key={t.id}
                  className="cursor-pointer"
                  style={{ transform: `translate(${p[0]}px, ${p[1]}px)`, transition: "transform 2s linear" }}
                  onClick={() => !drag.current?.moved && setSelected(on ? null : t.id)}
                >
                  <circle
                    r={on ? layout.line * 1.4 : layout.line}
                    fill={LINE_BY_CODE.get(t.line)!.color}
                    stroke={on ? "var(--foreground)" : "var(--background)"}
                    strokeWidth={1.5}
                  />
                  <title>{`${LINE_BY_CODE.get(t.line)!.name} line to ${t.destination ?? "?"}, ${t.cars} cars`}</title>
                </g>
              );
            })}
          </g>
        </svg>
        {picked && (
          <div className="absolute bottom-2 left-2 rounded border border-line bg-background/90 px-3 py-2 text-sm">
            <span className="mr-2 inline-block size-2.5 rounded-full" style={{ background: LINE_BY_CODE.get(picked.line)!.color }} />
            {LINE_BY_CODE.get(picked.line)!.name} line to {picked.destination ?? "?"} · {picked.cars} cars · train{" "}
            {picked.id}
            <div className="text-muted">
              {picked.from === picked.to
                ? `At ${STATION_BY_KEY.get(picked.from)?.name}`
                : `Between ${STATION_BY_KEY.get(picked.from)?.name} and ${STATION_BY_KEY.get(picked.to)?.name}`}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        {error === "no-key" ? (
          <span>Live trains show up once the WMATA key is connected.</span>
        ) : error === "budget" ? (
          <span>Pausing for a moment to stay under WMATA&apos;s call limit; trying again.</span>
        ) : error ? (
          <span>WMATA isn&apos;t answering right now; trying again.</span>
        ) : (
          <>
            {counts.map(({ line, n }) => (
              <span key={line.code} className="flex items-center gap-1.5 tabular-nums">
                <span className="inline-block size-2.5 rounded-full" style={{ background: line.color }} />
                {line.name} {n}
              </span>
            ))}
            {updated && <Updated at={updated} />}
          </>
        )}
      </div>
    </div>
  );
}
