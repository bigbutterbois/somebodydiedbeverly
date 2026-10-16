"use client";

import { geoMercator } from "d3-geo";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BENDS,
  BUNDLES,
  LINES,
  LINE_BY_CODE,
  STATIONS,
  STATION_BY_KEY,
  type LabelSide,
  type Line,
  type LineCode,
  type Station,
} from "@/lib/metro/network";
import type { Train } from "@/lib/metro/wmata";
import { Updated } from "../Updated";
import { useStored } from "../useStored";

// Every Metrorail train, live, two ways: on WMATA's own system map, or to scale
// with the stations where they really are. Only the lines, stations and names
// are drawn, so the trains stand out.
//
// Trains come from /api/metro/trains every 10 seconds while the tab is visible.
// Each one glides along the track from where it was to where it is over the next
// 10 seconds, so the map runs a few seconds behind but something is always
// moving. Zoom with the buttons, a pinch or ctrl/⌘ + scroll, drag to pan, tap a
// train for its details.

type Mode = "diagram" | "scale";
type Point = [number, number];
type View = { k: number; x: number; y: number };
type Layout = {
  W: number;
  H: number;
  pos: Map<string, Point>;
  /** Corners between neighboring stations (diagram only), keyed like BENDS. */
  bends: Map<string, Point[]>;
  /** Line thickness; lines sharing track sit side by side, touching. */
  line: number;
  train: number;
  font: number;
  /** How round the track's corners are. */
  radius: number;
};

const REFRESH = 10_000;
const MODE_KEY = "metro.mapMode";

// Station marks as on WMATA's map: white with a dark ring.
const RING = "#231f20";
const FACE = "#ffffff";
// No-passenger trains: a color no Metro line uses, so they never pass for Silver.
const EMPTY_TRAIN = "#a855f7";

// Diagram: station spots and corners from network.ts (WMATA's map), scaled up.
const S = 1.4;
const BOUNDS = { x0: 30, x1: 1045, y0: 290, y1: 1115 };
const at = ([x, y]: Point): Point => [(x - BOUNDS.x0) * S, (y - BOUNDS.y0) * S];
const DIAGRAM: Layout = {
  W: (BOUNDS.x1 - BOUNDS.x0) * S,
  H: (BOUNDS.y1 - BOUNDS.y0) * S,
  pos: new Map(STATIONS.map((s) => [s.key, at([s.x, s.y])])),
  bends: new Map(Object.entries(BENDS).map(([id, pts]) => [id, pts.map(at)])),
  line: 17,
  train: 7.5,
  font: 13,
  radius: 22 * S,
};

function scaleLayout(coords: Record<string, Point>): Layout {
  const W = 1000;
  const H = 820;
  const projection = geoMercator().fitExtent(
    [
      [40, 40],
      [W - 40, H - 40],
    ],
    { type: "MultiPoint", coordinates: Object.values(coords) },
  );
  const pos = new Map<string, Point>();
  for (const [key, c] of Object.entries(coords)) {
    const p = projection(c);
    if (p) pos.set(key, p);
  }
  return { W, H, pos, bends: new Map(), line: 4, train: 4, font: 10, radius: 0 };
}

function unit([x, y]: Point): Point {
  const len = Math.hypot(x, y) || 1;
  return [x / len, y / len];
}

/** Unit vector at right angles to a → b: to the right of travel, since y points down. */
function normal(a: Point, b: Point): Point {
  return unit([a[1] - b[1], b[0] - a[0]]);
}

const key2 = (a: string, b: string) => [a, b].sort().join("|");

/**
 * Lines that share the track between two neighboring stations, keyed by the two
 * keys sorted, in their order across it on WMATA's map (left to right looking
 * from the first key toward the second).
 */
const SHARED = new Map<string, LineCode[]>();
for (const line of LINES) {
  for (let i = 1; i < line.stations.length; i++) {
    const id = key2(line.stations[i - 1], line.stations[i]);
    SHARED.set(id, [...(SHARED.get(id) ?? []), line.code]);
  }
}
for (const [id, users] of SHARED) {
  const order = BUNDLES[id];
  if (order?.length === users.length && users.every((u) => order.includes(u))) SHARED.set(id, order);
}

/** The three big downtown transfer stations, drawn as WMATA's bullseye: Metro Center, Gallery Place, L'Enfant Plaza. */
const BIG = new Set(["A01", "B01", "D03"]);

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

/** The middle of the track from station a to station b: the two stations and the corners between. */
function track(layout: Layout, a: string, b: string): Point[] | null {
  const pa = layout.pos.get(a);
  const pb = layout.pos.get(b);
  if (!pa || !pb) return null;
  const mid = layout.bends.get(key2(a, b)) ?? [];
  return [pa, ...([a, b].sort()[0] === a ? mid : [...mid].reverse()), pb];
}

/** A path moved right of travel by ds[i] at each point, its corners kept sharp (exact for the map's 45° and 90° turns). */
function offset(pts: Point[], ds: number | number[]): Point[] {
  const at = (i: number) => (typeof ds === "number" ? ds : ds[i]);
  return pts.map((p, i) => {
    const d = at(i);
    if (d === 0) return p;
    const n1 = normal(pts[Math.max(0, i - 1)], pts[Math.max(1, i)]);
    const n2 = normal(pts[Math.min(pts.length - 2, i)], pts[Math.min(pts.length - 1, i + 1)]);
    const m = unit([n1[0] + n2[0], n1[1] + n2[1]]);
    const k = d / Math.max(0.5, m[0] * n1[0] + m[1] * n1[1]);
    return [p[0] + m[0] * k, p[1] + m[1] * k];
  });
}

/**
 * An SVG path along the points with every corner rounded into a circular arc.
 * `lanes` is how far each point sits right of the shared track's middle and
 * `centers` is that middle, so every line through a corner curves around the
 * same center and lines sharing track stay touching all the way round.
 */
function rounded(all: Point[], radius: number, line: number, allLanes: number[], allCenters: Point[]) {
  const f = (p: Point) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
  // Drop points along a straight run (stations mid-run) so a curve can start before them.
  const keep = all.map((p, i) => {
    if (i === 0 || i === all.length - 1) return true;
    const u1 = unit([p[0] - all[i - 1][0], p[1] - all[i - 1][1]]);
    const u2 = unit([all[i + 1][0] - p[0], all[i + 1][1] - p[1]]);
    return Math.abs(u1[0] * u2[1] - u1[1] * u2[0]) > 0.01 || u1[0] * u2[0] + u1[1] * u2[1] < 0;
  });
  const pts = all.filter((_, i) => keep[i]);
  const lanes = allLanes.filter((_, i) => keep[i]);
  const centers = allCenters.filter((_, i) => keep[i]);
  let d = `M${f(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const b = pts[i];
    // Within one lane, curve around the track's middle; where a line is easing between lanes, use its own path.
    const steady = lanes[i - 1] === lanes[i] && lanes[i] === lanes[i + 1];
    const [ca, cb, cc] = steady ? [centers[i - 1], centers[i], centers[i + 1]] : [pts[i - 1], pts[i], pts[i + 1]];
    const li = steady ? lanes[i] : 0;
    const u1 = unit([cb[0] - ca[0], cb[1] - ca[1]]);
    const u2 = unit([cc[0] - cb[0], cc[1] - cb[1]]);
    const cross = u1[0] * u2[1] - u1[1] * u2[0];
    const dot = u1[0] * u2[0] + u1[1] * u2[1];
    if (Math.abs(cross) < 0.01 || radius === 0) {
      d += `L${f(b)}`;
      continue;
    }
    // Size the curve on the middle of the track, then widen it for outside lanes and tighten it for inside ones.
    const half = Math.tan(Math.atan2(Math.abs(cross), dot) / 2);
    const room = Math.min(Math.hypot(cb[0] - ca[0], cb[1] - ca[1]), Math.hypot(cc[0] - cb[0], cc[1] - cb[1])) / 2;
    // Tight spots still leave the innermost of three lanes a visible curve.
    const tc = Math.max(Math.min(radius, room), (line * 1.5 + 6) * half);
    // Never run past the middle of either side, or neighboring curves would overlap into a blob.
    const fit = Math.min(Math.hypot(b[0] - pts[i - 1][0], b[1] - pts[i - 1][1]), Math.hypot(pts[i + 1][0] - b[0], pts[i + 1][1] - b[1])) / 2;
    const t = Math.max(0.5, Math.min(fit, (steady ? tc : Math.min(radius, room)) - Math.sign(cross) * li * half));
    const r = t / half;
    d += `L${f([b[0] - u1[0] * t, b[1] - u1[1] * t])}`;
    d += `A${r.toFixed(1)} ${r.toFixed(1)} 0 0 ${cross > 0 ? 1 : 0} ${f([b[0] + u2[0] * t, b[1] + u2[1] * t])}`;
  }
  return d + `L${f(pts[pts.length - 1])}`;
}

/** How far right of the shared track's middle a line runs between two stations, going from a to b. */
function lane(line: LineCode, a: string, b: string, layout: Layout) {
  const users = SHARED.get(key2(a, b)) ?? [line];
  const d = (users.indexOf(line) - (users.length - 1) / 2) * layout.line;
  return [a, b].sort()[0] === a ? d : -d;
}

const users = (a: string, b: string) => SHARED.get(key2(a, b))?.length ?? 1;

/** A point `dist` along the path's first edge, moved `d` right of travel. */
function stepIn(pts: Point[], dist: number, d: number): Point {
  const [a, b] = [pts[0], pts[1]];
  const u = unit([b[0] - a[0], b[1] - a[1]]);
  const n = normal(a, b);
  return [a[0] + u[0] * dist + n[0] * d, a[1] + u[1] * dist + n[1] * d];
}

/**
 * Where a line sits at its i-th station: in its lane of the busier track on
 * either side (the incoming one on a tie). Both neighboring runs meet there,
 * so the line never steps sideways at a station.
 */
function port(line: Line, i: number, layout: Layout): Point | null {
  const st = line.stations;
  const before = i > 0 ? track(layout, st[i - 1], st[i]) : null;
  const after = i < st.length - 1 ? track(layout, st[i], st[i + 1]) : null;
  const useAfter = !before || (after && users(st[i], st[i + 1]) > users(st[i - 1], st[i]));
  if (useAfter && after) return stepIn(after, 0, lane(line.code, st[i], st[i + 1], layout));
  if (!before) return null;
  return stepIn([...before].reverse(), 0, -lane(line.code, st[i - 1], st[i], layout));
}

/**
 * Each line as one path end to end, in its own lane wherever it shares track.
 * Where its lane at a station differs from its lane on the run (Blue joining
 * Orange and Silver at Rosslyn), it eases across just outside the station.
 */
function linePaths(layout: Layout) {
  return LINES.map((line) => {
    const st = line.stations;
    const pts: Point[] = [];
    const lanes: number[] = [];
    const centers: Point[] = [];
    const push = (p: Point, d: number, c: Point) => {
      const last = pts[pts.length - 1];
      if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) <= 0.5) return;
      pts.push(p);
      lanes.push(d);
      centers.push(c);
    };
    const far = (p: Point, q: Point) => Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.5;
    for (let i = 1; i < st.length; i++) {
      const [a, b] = [st[i - 1], st[i]];
      const mid = track(layout, a, b);
      const pa = port(line, i - 1, layout);
      const pb = port(line, i, layout);
      if (!mid || !pa || !pb) continue;
      const d = lane(line.code, a, b, layout);
      const ps = offset(mid, d);
      const n = ps.length;
      const len = (p: Point, q: Point) => Math.hypot(q[0] - p[0], q[1] - p[1]);
      const easeIn = far(pa, ps[0]);
      const easeOut = far(pb, ps[n - 1]);
      // NaN lanes mark the easing bits, which curve on their own path rather than the track's middle.
      if (easeIn) {
        push(pa, NaN, pa);
        const q = stepIn(mid, Math.min(layout.line * 2.5, len(mid[0], mid[1]) / 3), d);
        push(q, NaN, q);
      } else push(ps[0], d, mid[0]);
      for (let k = 1; k < n - 1; k++) push(ps[k], d, mid[k]);
      if (easeOut) {
        const back = [...mid].reverse();
        const q = stepIn(back, Math.min(layout.line * 2.5, len(back[0], back[1]) / 3), -d);
        push(q, NaN, q);
        push(pb, NaN, pb);
      } else push(ps[n - 1], d, mid[n - 1]);
    }
    return { code: line.code, color: line.color, d: pts.length > 1 ? rounded(pts, layout.radius, layout.line, lanes, centers) : "" };
  });
}

/** How many lines wide the track is at a station. */
function width(key: string) {
  let n = 1;
  for (const l of LINES) {
    const i = l.stations.indexOf(key);
    if (i < 0) continue;
    for (const j of [i - 1, i + 1]) if (l.stations[j]) n = Math.max(n, SHARED.get(key2(key, l.stations[j]))!.length);
  }
  return n;
}

function StationMark({
  station,
  layout,
  onHover,
}: {
  station: Station;
  layout: Layout;
  onHover: (key: string | null) => void;
}) {
  const p = layout.pos.get(station.key);
  if (!p) return null;
  const w = layout.line / 4.5;
  let mark;
  if (BIG.has(station.key)) {
    const r = layout.line * 1.2;
    mark = (
      <>
        <circle cx={p[0]} cy={p[1]} r={r} fill={FACE} stroke={RING} strokeWidth={w} />
        <circle cx={p[0]} cy={p[1]} r={r * 0.42} fill={FACE} stroke={RING} strokeWidth={w} />
      </>
    );
  } else {
    mark = <circle cx={p[0]} cy={p[1]} r={layout.line * 0.42} fill={FACE} stroke={RING} strokeWidth={w} />;
  }
  return (
    <a
      href={`/metro?station=${station.key}`}
      aria-label={`${station.name} arrivals`}
      onPointerEnter={() => onHover(station.key)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(station.key)}
      onBlur={() => onHover(null)}
    >
      {mark}
    </a>
  );
}

function Label({ station, layout }: { station: Station; layout: Layout }) {
  const at = layout.pos.get(station.key);
  if (!at) return null;
  const font = layout.font;
  // Clear the widest thing at the station: the bullseye, or every lane of shared track.
  const half = Math.max(HUBS.has(station.key) ? layout.line * 0.95 : 0, (width(station.key) * layout.line) / 2);
  const d = half + font * 0.4;
  // Diagonal labels start off the corner; the extra half font keeps the tops of the letters clear too.
  const c = half + font * 0.35;
  const f = font * 0.5;
  const props: Record<LabelSide, { dx: number; dy: number; anchor: "start" | "end"; rotate?: number }> = {
    l: { dx: -d, dy: font * 0.35, anchor: "end" },
    r: { dx: d, dy: font * 0.35, anchor: "start" },
    tl: { dx: -font * 0.3, dy: -d, anchor: "end" },
    tr: { dx: font * 0.3, dy: -d, anchor: "start" },
    bl: { dx: -font * 0.3, dy: d + font * 0.7, anchor: "end" },
    br: { dx: font * 0.3, dy: d + font * 0.7, anchor: "start" },
    ne: { dx: c + f, dy: -c, anchor: "start", rotate: -45 },
    se: { dx: c, dy: c + f, anchor: "start", rotate: 45 },
    sw: { dx: -c, dy: c + f, anchor: "end", rotate: -45 },
    nw: { dx: -c - f, dy: -c, anchor: "end", rotate: 45 },
  };
  const p = props[station.label];
  const [nx, ny] = station.nudge ?? [0, 0];
  const x = at[0] + p.dx + nx * layout.line;
  const y = at[1] + p.dy + ny * layout.line;
  return (
    <text
      x={x}
      y={y}
      textAnchor={p.anchor}
      fontSize={font}
      fontWeight={600}
      strokeWidth={font * 0.3}
      strokeLinejoin="round"
      paintOrder="stroke"
      transform={p.rotate ? `rotate(${p.rotate} ${x} ${y})` : undefined}
      className="pointer-events-none fill-foreground stroke-background"
    >
      {station.name}
    </text>
  );
}

/** How far along its line a train is, counted in stations (2.5 = halfway between the third and fourth). */
function along(train: Train) {
  const stops = LINE_BY_CODE.get(train.line)!.stations;
  const i = stops.indexOf(train.from);
  const j = stops.indexOf(train.to);
  return i + (j - i) * train.t;
}

/**
 * The spot `u` stations along a line (see along): on the track, just outside
 * the lines on the right-hand side of the way the train is heading, so trains
 * going opposite ways pass on opposite sides.
 */
function trainPoint(line: LineCode, u: number, forward: boolean, layout: Layout): Point | null {
  const stops = LINE_BY_CODE.get(line)!.stations;
  const i = Math.max(0, Math.min(stops.length - 2, Math.floor(u)));
  const from = stops[i];
  const to = stops[i + 1];
  const t = Math.max(0, Math.min(1, u - i));
  const users = SHARED.get(key2(from, to))?.length ?? 1;
  const side = (forward ? 1 : -1) * ((users * layout.line) / 2 + layout.train + 1.5);
  const mid = track(layout, from, to);
  if (!mid) return null;
  const pts = offset(mid, side);

  // Walk t of the way along it.
  const lengths = pts.slice(1).map((p, k) => Math.hypot(p[0] - pts[k][0], p[1] - pts[k][1]));
  let left = lengths.reduce((a, b) => a + b, 0) * t;
  let k = 0;
  while (k < lengths.length - 1 && left > lengths[k]) left -= lengths[k++];
  const f = lengths[k] ? left / lengths[k] : 0;
  return [pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f];
}

/** A train's trip on screen: from where it was drawn when new data came in, to where WMATA now says it is. */
type Trip = { line: LineCode; u0: number; u1: number; forward: boolean; start: number };

function tripAt(trip: Trip, now: number) {
  const f = Math.min(1, Math.max(0, (now - trip.start) / REFRESH));
  return trip.u0 + (trip.u1 - trip.u0) * f;
}

/** What a train is doing, from where it is and how long it's been there. */
function status(t: Train) {
  const name = (k: string) => STATION_BY_KEY.get(k)?.name ?? k;
  const time = t.still >= 120 ? `${Math.round(t.still / 60)} min` : `${t.still}s`;
  if (t.from === t.to || t.t === 0) return `At ${name(t.from)}${t.still >= 30 ? ` for ${time}` : ""}`;
  const [a, b] = t.forward ? [t.from, t.to] : [t.to, t.from];
  if (t.still >= 90) return `Stopped between ${name(a)} and ${name(b)} for ${time}`;
  return `Moving from ${name(a)} to ${name(b)}`;
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
  const layout = mode === "scale" && scale ? scale : DIAGRAM;
  const { W, H } = layout;
  const paths = useMemo(() => linePaths(layout), [layout]);
  const { trains, updated, error } = useTrains();
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
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
      next.set(t.id, { line: t.line, u0, u1, forward: t.forward, start: now });
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

  // Names stay hidden so the trains stand out; hovering a station shows its name.
  const labelled = hover ? STATIONS.filter((s) => s.key === hover) : [];
  const inService = trains.filter((t) => t.passengers);
  const counts = LINES.map((l) => ({ line: l, n: inService.filter((t) => t.line === l.code).length }));
  const empty = trains.length - inService.length;

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
            {paths.map((p) => (
              <path
                key={p.code}
                d={p.d}
                fill="none"
                stroke={p.color}
                strokeWidth={layout.line}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {STATIONS.map((s) => (
              <StationMark key={s.key} station={s} layout={layout} onHover={setHover} />
            ))}
            {labelled.map((s) => (
              <Label key={s.key} station={s} layout={layout} />
            ))}
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
                      : trainPoint(t.line, along(t), t.forward, layoutRef.current);
                    if (p) el.setAttribute("transform", `translate(${p[0].toFixed(1)} ${p[1].toFixed(1)})`);
                  }}
                  className="cursor-pointer"
                  onClick={() => !drag.current?.moved && setSelected(on ? null : t.id)}
                >
                  <circle
                    r={(on ? 1.5 : 1) * layout.train}
                    fill={t.passengers ? LINE_BY_CODE.get(t.line)!.color : EMPTY_TRAIN}
                    stroke="var(--foreground)"
                    strokeWidth={on ? 2.5 : 1.5}
                  />
                  <title>
                    {t.passengers
                      ? `${LINE_BY_CODE.get(t.line)!.name} line to ${t.destination ?? "?"}, ${t.cars} cars`
                      : `No passengers, ${t.cars} cars`}
                  </title>
                </g>
              );
            })}
          </g>
        </svg>
        {picked && (
          <div className="absolute bottom-2 left-2 rounded border border-line bg-background/95 px-3 py-2 text-sm">
            <span
              className="mr-2 inline-block size-2.5 rounded-full"
              style={{ background: picked.passengers ? LINE_BY_CODE.get(picked.line)!.color : EMPTY_TRAIN }}
            />
            {picked.passengers
              ? `${LINE_BY_CODE.get(picked.line)!.name} line to ${picked.destination ?? "?"}`
              : `No passengers (on ${LINE_BY_CODE.get(picked.line)!.name} line track)`}{" "}
            · {picked.cars} cars · train {picked.number}
            <div className="text-muted">{status(picked)}</div>
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
            <span className="flex items-center gap-1.5 tabular-nums">
              <span className="inline-block size-2.5 rounded-full" style={{ background: EMPTY_TRAIN }} />
              No passengers {empty}
            </span>
            {updated && <Updated at={updated} />}
          </>
        )}
      </div>
    </div>
  );
}
