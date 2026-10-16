"use client";

import { geoMercator, geoPath } from "d3-geo";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BENDS,
  BUNDLES,
  LINES,
  LINE_BY_CODE,
  STATIONS,
  STATION_BY_KEY,
  linesAt,
  type LabelSide,
  type LineCode,
  type Station,
} from "@/lib/metro/network";
import type { Train } from "@/lib/metro/wmata";
import { Updated } from "../Updated";
import { useStored } from "../useStored";
import backdrop from "./backdrop.json";
import scenery from "./diagram-backdrop.json";

// Every Metrorail train, live, two ways: WMATA's own system map traced line for
// line, or to scale over the real geography. Trains come from /api/metro/trains
// every 10 seconds while the tab is visible, and each one glides along the track
// from where it was to where it is over the next 10 seconds, so the map runs a
// few seconds behind but something is always moving. Zoom with the buttons, a
// pinch or ctrl/⌘ + scroll, drag to pan, tap a train for its details.

type Mode = "diagram" | "scale";
type Point = [number, number];
type View = { k: number; x: number; y: number };
type Layout = {
  W: number;
  H: number;
  pos: Map<string, Point>;
  /** Corners between neighboring stations (diagram only), keyed like BENDS. */
  bends: Map<string, Point[]>;
  line: number;
  gap: number;
  train: number;
  font: number;
};

const REFRESH = 10_000;
const MODE_KEY = "metro.mapMode";

// Diagram: stations and track traced from WMATA's map (network.ts), scaled up, over its
// rivers, parks and roads (diagram-backdrop.json, traced from the same map).
const S = 1.4;
const BOUNDS = { x0: 30, x1: 1030, y0: 290, y1: 1115 };
const at = ([x, y]: Point): Point => [(x - BOUNDS.x0) * S, (y - BOUNDS.y0) * S];
const DIAGRAM: Layout = {
  W: (BOUNDS.x1 - BOUNDS.x0) * S,
  H: (BOUNDS.y1 - BOUNDS.y0) * S,
  pos: new Map(STATIONS.map((s) => [s.key, at([s.x, s.y])])),
  bends: new Map(Object.entries(BENDS).map(([id, pts]) => [id, pts.map(at)])),
  // As thick as on WMATA's map, lines sharing track side by side and touching.
  line: 17,
  gap: 17,
  train: 7,
  font: 12,
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
  return { layout: { W, H, pos, bends: new Map(), line: 4, gap: 4, train: 4, font: 10 }, counties };
}

function unit([x, y]: Point): Point {
  const len = Math.hypot(x, y) || 1;
  return [x / len, y / len];
}

/** Unit vector at right angles to a → b: to the right of travel, since y points down. */
function normal(a: Point, b: Point): Point {
  return unit([a[1] - b[1], b[0] - a[0]]);
}

/**
 * Lines that share the track between two neighboring stations, keyed by the two
 * keys sorted, in their order across it on WMATA's map.
 */
const SHARED = new Map<string, LineCode[]>();
for (const line of LINES) {
  for (let i = 1; i < line.stations.length; i++) {
    const id = [line.stations[i - 1], line.stations[i]].sort().join("|");
    SHARED.set(id, [...(SHARED.get(id) ?? []), line.code]);
  }
}
for (const [id, users] of SHARED) {
  const order = BUNDLES[id];
  if (order?.length === users.length && users.every((u) => order.includes(u))) SHARED.set(id, order);
}

/** Stations where lines branch or cross (three or more directions), drawn as WMATA's bullseye. */
const HUBS = new Set(
  STATIONS.filter((st) => {
    const next = new Set<string>();
    for (const l of LINES) {
      const i = l.stations.indexOf(st.key);
      if (i < 0) continue;
      if (l.stations[i - 1]) next.add(l.stations[i - 1]);
      if (l.stations[i + 1]) next.add(l.stations[i + 1]);
    }
    return next.size > 2;
  }).map((st) => st.key),
);

/** The track from station a to station b: the two stations and any corners between. */
function track(layout: Layout, a: string, b: string): Point[] | null {
  const pa = layout.pos.get(a);
  const pb = layout.pos.get(b);
  if (!pa || !pb) return null;
  const [ka, kb] = [a, b].sort();
  const mid = layout.bends.get(`${ka}|${kb}`) ?? [];
  return [pa, ...(a === ka ? mid : [...mid].reverse()), pb];
}

/** A path moved sideways by d, keeping its corners. */
function offset(pts: Point[], d: number): Point[] {
  if (d === 0) return pts;
  return pts.map((p, i) => {
    const n1 = normal(pts[Math.max(0, i - 1)], pts[Math.max(1, i)]);
    const n2 = normal(pts[Math.min(pts.length - 2, i)], pts[Math.min(pts.length - 1, i + 1)]);
    const m = unit([n1[0] + n2[0], n1[1] + n2[1]]);
    const k = d / Math.max(0.5, m[0] * n1[0] + m[1] * n1[1]);
    return [p[0] + m[0] * k, p[1] + m[1] * k];
  });
}

/** Each line's track as short paths, set side by side where several lines share one. */
function segments(layout: Layout) {
  const out: { id: string; color: string; points: string }[] = [];
  for (const line of LINES) {
    for (let i = 1; i < line.stations.length; i++) {
      const [ka, kb] = [line.stations[i - 1], line.stations[i]].sort();
      const pts = track(layout, ka, kb);
      if (!pts) continue;
      const users = SHARED.get(`${ka}|${kb}`)!;
      const shift = (users.indexOf(line.code) - (users.length - 1) / 2) * layout.gap;
      out.push({
        id: `${line.code}-${ka}-${kb}`,
        color: line.color,
        points: offset(pts, shift)
          .map((p) => p.join(","))
          .join(" "),
      });
    }
  }
  return out;
}

const TERMINALS = new Set(LINES.flatMap((l) => [l.stations[0], l.stations[l.stations.length - 1]]));

function Label({ station, at, font, clear }: { station: Station; at: Point; font: number; clear: number }) {
  const d = font * 0.5 + clear;
  const props: Record<LabelSide, { dx: number; dy: number; anchor: "start" | "end"; rotate?: number }> = {
    l: { dx: -d, dy: font * 0.35, anchor: "end" },
    r: { dx: d, dy: font * 0.35, anchor: "start" },
    tl: { dx: -d * 0.6, dy: -d * 0.9, anchor: "end" },
    tr: { dx: d * 0.6, dy: -d * 0.9, anchor: "start" },
    bl: { dx: -d * 0.6, dy: d * 1.6, anchor: "end" },
    br: { dx: d * 0.6, dy: d * 1.6, anchor: "start" },
    ne: { dx: d * 0.7, dy: -d * 0.5, anchor: "start", rotate: -45 },
    se: { dx: d * 0.6, dy: d * 1.0, anchor: "start", rotate: 45 },
    sw: { dx: -d * 0.6, dy: d * 1.0, anchor: "end", rotate: -45 },
    nw: { dx: -d * 0.7, dy: -d * 0.4, anchor: "end", rotate: 45 },
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

/** Which way a train is heading: toward the end of its line's station list, or back toward the start. */
function heading(train: Train) {
  const stops = LINE_BY_CODE.get(train.line)!.stations;
  const here = stops.indexOf(train.from);
  const dest = train.toward ? stops.indexOf(train.toward) : -1;
  return dest >= 0 && dest !== here ? dest > here : train.track === 2;
}

/** How far along its line a train is, counted in stations (2.5 = halfway between the third and fourth). */
function along(train: Train) {
  const stops = LINE_BY_CODE.get(train.line)!.stations;
  const i = stops.indexOf(train.from);
  const j = stops.indexOf(train.to);
  return i + (j - i) * train.t;
}

/**
 * The spot `u` stations along a line (see along), on the track and just
 * outside the lines on the right-hand side of the way the train is heading,
 * so trains going opposite ways pass on opposite sides.
 */
function trainPoint(line: LineCode, u: number, forward: boolean, layout: Layout): Point | null {
  const stops = LINE_BY_CODE.get(line)!.stations;
  const i = Math.max(0, Math.min(stops.length - 2, Math.floor(u)));
  const from = stops[i];
  const to = stops[i + 1];
  const t = Math.max(0, Math.min(1, u - i));
  const pts = track(layout, from, to);
  if (!pts) return null;

  // Walk t of the way along the track.
  const lengths = pts.slice(1).map((p, k) => Math.hypot(p[0] - pts[k][0], p[1] - pts[k][1]));
  let left = lengths.reduce((a, b) => a + b, 0) * t;
  let k = 0;
  while (k < lengths.length - 1 && left > lengths[k]) left -= lengths[k++];
  const f = lengths[k] ? left / lengths[k] : 0;
  const a = pts[k];
  const b = pts[k + 1];

  const users = SHARED.get([from, to].sort().join("|"))?.length ?? 1;
  const side = (forward ? 1 : -1) * ((users * layout.gap) / 2 + layout.train + 2);
  const n = normal(a, b);
  return [a[0] + (b[0] - a[0]) * f + n[0] * side, a[1] + (b[1] - a[1]) * f + n[1] * side];
}

/** A train's trip on screen: from where it was drawn when new data came in, to where WMATA now says it is. */
type Trip = { line: LineCode; u0: number; u1: number; forward: boolean; start: number };

function tripAt(trip: Trip, now: number) {
  const f = Math.min(1, Math.max(0, (now - trip.start) / REFRESH));
  return trip.u0 + (trip.u1 - trip.u0) * f;
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

  // Each train glides along the track to its new spot over one refresh, moved
  // frame by frame outside React so the map itself doesn't re-render.
  const trips = useRef(new Map<string, Trip>());
  const dots = useRef(new Map<string, SVGGElement>());
  const layoutRef = useRef(layout);
  useEffect(() => {
    layoutRef.current = layout;
  });
  useEffect(() => {
    const now = performance.now();
    const next = new Map<string, Trip>();
    for (const t of trains) {
      const u1 = along(t);
      const old = trips.current.get(t.id);
      let u0 = old && old.line === t.line ? tripAt(old, now) : u1;
      // A jump of more than a few stations is a train turned around or renumbered: no gliding.
      if (Math.abs(u1 - u0) > 3) u0 = u1;
      next.set(t.id, { line: t.line, u0, u1, forward: heading(t), start: now });
    }
    trips.current = next;
  }, [trains]);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const now = performance.now();
      for (const [id, trip] of trips.current) {
        const el = dots.current.get(id);
        const p = el && trainPoint(trip.line, tripAt(trip, now), trip.forward, layoutRef.current);
        if (p) el.setAttribute("transform", `translate(${p[0].toFixed(1)} ${p[1].toFixed(1)})`);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

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
            {mode === "diagram" && (
              <g transform={`scale(${S}) translate(${-BOUNDS.x0} ${-BOUNDS.y0})`} fillRule="evenodd">
                <path d={scenery.park} fill="color-mix(in srgb, #d1e4aa 14%, var(--background))" />
                <path d={scenery.mall} fill="color-mix(in srgb, #a0bb6c 18%, var(--background))" />
                <path d={scenery.river} fill="color-mix(in srgb, #7fc0ea 20%, var(--background))" />
                <path d={scenery.road} fill="color-mix(in srgb, #c5cec9 14%, var(--background))" />
              </g>
            )}
            {segs.map((s) => (
              <polyline
                key={s.id}
                points={s.points}
                fill="none"
                // Faded a little toward the page color so the trains stand out.
                stroke={`color-mix(in srgb, ${s.color} 70%, var(--background))`}
                strokeWidth={layout.line}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {STATIONS.map((s) => {
              const p = layout.pos.get(s.key);
              if (!p) return null;
              const hub = HUBS.has(s.key);
              const r = hub ? layout.line * 0.9 : layout.line * 0.36;
              return (
                <a key={s.key} href={`/metro?station=${s.key}`} aria-label={`${s.name} arrivals`}>
                  <circle cx={p[0]} cy={p[1]} r={r} className="fill-background stroke-foreground" strokeWidth={layout.line / 5}>
                    <title>{`${s.name}: ${linesAt(s.key).map((l) => l.name).join(", ")}`}</title>
                  </circle>
                  {hub && (
                    <circle cx={p[0]} cy={p[1]} r={r * 0.45} className="pointer-events-none fill-background stroke-foreground" strokeWidth={layout.line / 6} />
                  )}
                </a>
              );
            })}
            {labelled.map((s) => {
              const p = layout.pos.get(s.key);
              return p ? <Label key={s.key} station={s} at={p} font={layout.font} clear={layout.line} /> : null;
            })}
            {trains.map((t) => {
              const on = t.id === selected;
              return (
                <g
                  key={t.id}
                  ref={(el) => {
                    if (!el) {
                      dots.current.delete(t.id);
                      return;
                    }
                    dots.current.set(t.id, el);
                    // Where it stands right now, before the next frame moves it.
                    const trip = trips.current.get(t.id);
                    const p = trip
                      ? trainPoint(trip.line, tripAt(trip, performance.now()), trip.forward, layoutRef.current)
                      : trainPoint(t.line, along(t), heading(t), layoutRef.current);
                    if (p) el.setAttribute("transform", `translate(${p[0].toFixed(1)} ${p[1].toFixed(1)})`);
                  }}
                  className="cursor-pointer"
                  onClick={() => !drag.current?.moved && setSelected(on ? null : t.id)}
                >
                  <circle
                    r={on ? layout.train * 1.5 : layout.train}
                    fill={LINE_BY_CODE.get(t.line)!.color}
                    stroke="var(--foreground)"
                    strokeWidth={on ? 2.5 : 1.5}
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
