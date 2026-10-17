"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BENDS,
  BUNDLES,
  LINES,
  LINE_BY_CODE,
  STATIONS,
  STATION_BY_KEY,
  type LabelSide,
  type LineCode,
  type Station,
} from "@/lib/metro/network";
import type { Train } from "@/lib/metro/wmata";
import { Updated } from "./Updated";
import { useStored } from "./useStored";

// Every Metrorail train, live, on WMATA's own system map, filling the screen.
// Only the lines and stations are drawn, so the trains stand out.
//
// Trains come from /api/metro/trains every 10 seconds while the tab is visible.
// Each one glides along the track from where it was to where it is over the next
// 10 seconds, so the map runs a few seconds behind but something is always
// moving. Zoom with the buttons, a pinch or the scroll wheel, drag to pan, tap a
// train for its details.

type Point = [number, number];
type View = { k: number; x: number; y: number };
type Layout = {
  W: number;
  H: number;
  pos: Map<string, Point>;
  /** Corners between neighboring stations, keyed like BENDS. */
  bends: Map<string, Point[]>;
  /** Line thickness; lines sharing track sit side by side, touching. */
  line: number;
  train: number;
  font: number;
  /** How round the track's corners are. */
  radius: number;
  /** The simple map: every line on one shared track down the middle. */
  merged: boolean;
};

const REFRESH = 10_000;
const LINES_KEY = "metro.showLines";
/** The simple map's one line: a grey between the page and its text, solid so overlapping lines don't darken. */
const TRACK = "color-mix(in srgb, var(--foreground) 32%, var(--background))";

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
  radius: 28 * S,
  merged: false,
};
const SIMPLE: Layout = { ...DIAGRAM, merged: true };

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
    const tc = Math.max(Math.min(radius, room), (line * 2 + 6) * half);
    // Never run past the middle of either side, or neighboring curves would overlap into a blob. A lane
    // curving round the track's middle already fits (room is measured there), and clamping it again on its
    // own sides would bend it tighter than its neighbors, pulling it off them.
    const fit = Math.min(Math.hypot(b[0] - pts[i - 1][0], b[1] - pts[i - 1][1]), Math.hypot(pts[i + 1][0] - b[0], pts[i + 1][1] - b[1])) / 2;
    const t = steady ? Math.max(0.5, tc - Math.sign(cross) * li * half) : Math.max(0.5, Math.min(fit, Math.min(radius, room)));
    const r = t / half;
    d += `L${f([b[0] - u1[0] * t, b[1] - u1[1] * t])}`;
    d += `A${r.toFixed(1)} ${r.toFixed(1)} 0 0 ${cross > 0 ? 1 : 0} ${f([b[0] + u2[0] * t, b[1] + u2[1] * t])}`;
  }
  return d + `L${f(pts[pts.length - 1])}`;
}

/** The edge of the track between a and b (keyed sorted) where it leaves station x: its direction away from x, and the sideways direction of its lanes. */
function edgeAt(key: string, x: string): { dir: Point; side: Point } {
  const [a, b] = key.split("|");
  const pts = track(DIAGRAM, a, b)!;
  const n = pts.length;
  const side = x === a ? normal(pts[0], pts[1]) : normal(pts[n - 2], pts[n - 1]);
  const dir = x === a ? unit([pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]]) : unit([pts[n - 2][0] - pts[n - 1][0], pts[n - 2][1] - pts[n - 1][1]]);
  return { dir, side };
}

/**
 * Each line's lane on every stretch of track, in line widths right of the track's
 * middle (looking from the first sorted key toward the second). Busy stretches go
 * first, and a stretch that carries straight on from one already placed keeps its
 * lines in the same lanes, so Orange and Silver hold their lanes from Rosslyn out to
 * East Falls Church and lines never jog sideways at a station along a straight run.
 */
const LANES = (() => {
  const lanes = new Map<string, Map<LineCode, number>>();
  const order = [...SHARED.keys()].sort((p, q) => SHARED.get(q)!.length - SHARED.get(p)!.length);
  while (lanes.size < order.length) {
    let placed = false;
    for (const key of order) {
      if (lanes.has(key)) continue;
      const users = SHARED.get(key)!;
      let best: { from: Map<LineCode, number>; here: Point; there: Point; size: number } | null = null;
      for (const x of key.split("|")) {
        const mine = edgeAt(key, x);
        for (const [other, theirs] of lanes) {
          if (!other.split("|").includes(x) || !users.every((u) => theirs.has(u))) continue;
          const e = edgeAt(other, x);
          // Straight on through the station: leaving x in opposite directions.
          if (mine.dir[0] * e.dir[0] + mine.dir[1] * e.dir[1] > -0.99) continue;
          if (!best || theirs.size > best.size) best = { from: theirs, here: mine.side, there: e.side, size: theirs.size };
        }
      }
      if (!best) continue;
      const flip = best.here[0] * best.there[0] + best.here[1] * best.there[1] < 0 ? -1 : 1;
      lanes.set(key, new Map(users.map((u) => [u, best!.from.get(u)! * flip])));
      placed = true;
    }
    if (placed) continue;
    // Nothing carries straight on: center the busiest unplaced stretch on its track.
    const key = order.find((k) => !lanes.has(k))!;
    const users = SHARED.get(key)!;
    lanes.set(key, new Map(users.map((u, i) => [u, i - (users.length - 1) / 2])));
  }
  return lanes;
})();

/** How far right of the track's middle a line runs going from station a to b. */
function lane(line: LineCode, a: string, b: string, layout: Layout) {
  if (layout.merged) return 0;
  const d = LANES.get(key2(a, b))?.get(line) ?? 0;
  return ([a, b].sort()[0] === a ? d : -d) * layout.line;
}

/** Points every couple of pixels along a path made of M, L and small-arc A commands (as rounded draws them). */
function trace(d: string): Point[] {
  const out: Point[] = [];
  const re = /([MLA])([^MLA]*)/g;
  let at: Point = [0, 0];
  for (const m of d.matchAll(re)) {
    const n = m[2].trim().split(/[\s,]+/).map(Number);
    if (m[1] === "M") {
      at = [n[0], n[1]];
      out.push(at);
      continue;
    }
    const to: Point = m[1] === "L" ? [n[0], n[1]] : [n[5], n[6]];
    const chord = Math.hypot(to[0] - at[0], to[1] - at[1]);
    if (m[1] === "L" || chord < 0.01) {
      const steps = Math.max(1, Math.ceil(chord / 2));
      for (let k = 1; k <= steps; k++) out.push([at[0] + ((to[0] - at[0]) * k) / steps, at[1] + ((to[1] - at[1]) * k) / steps]);
    } else {
      // Small arc: the center sits right of the chord for a clockwise sweep (y points down), left otherwise.
      const r = Math.max(n[0], chord / 2);
      const side = n[4] === 1 ? 1 : -1;
      const nn = normal(at, to);
      const h = Math.sqrt(Math.max(0, r * r - (chord / 2) ** 2));
      const c: Point = [(at[0] + to[0]) / 2 + nn[0] * h * side, (at[1] + to[1]) / 2 + nn[1] * h * side];
      const a0 = Math.atan2(at[1] - c[1], at[0] - c[0]);
      let a1 = Math.atan2(to[1] - c[1], to[0] - c[0]);
      if (side === 1 && a1 < a0) a1 += 2 * Math.PI;
      if (side === -1 && a1 > a0) a1 -= 2 * Math.PI;
      const steps = Math.max(2, Math.ceil((Math.abs(a1 - a0) * r) / 2));
      for (let k = 1; k <= steps; k++) {
        const ang = a0 + ((a1 - a0) * k) / steps;
        out.push([c[0] + Math.cos(ang) * r, c[1] + Math.sin(ang) * r]);
      }
    }
    at = to;
  }
  return out;
}

function nearestOn(pts: Point[], p: Point): Point {
  let best = pts[0];
  let bd = Infinity;
  for (const q of pts) {
    const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2;
    if (d < bd) {
      bd = d;
      best = q;
    }
  }
  return best;
}

/**
 * Where each station's mark goes: on each of its lines exactly as drawn (curves
 * included), averaged across the lines that stop there, so it sits in the middle
 * of shared track.
 */
function stationPoints(layout: Layout, paths: { code: LineCode; d: string }[]) {
  const traced = new Map(paths.map((p) => [p.code, trace(p.d)]));
  const out = new Map<string, Point>();
  for (const st of STATIONS) {
    const p = layout.pos.get(st.key);
    if (!p) continue;
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (const l of LINES) {
      const i = l.stations.indexOf(st.key);
      const pts = traced.get(l.code);
      if (i < 0 || !pts?.length) continue;
      // Where this line would cross the station if its stretch ran straight, pulled onto the line as drawn.
      const next = l.stations[i + 1] ?? l.stations[i - 1];
      const mid = track(layout, st.key, next);
      let guess = p;
      if (mid) {
        const side = normal(mid[0], mid[1]);
        const d = lane(l.code, st.key, next, layout);
        guess = [p[0] + side[0] * d, p[1] + side[1] * d];
      }
      const q = nearestOn(pts, guess);
      sx += q[0];
      sy += q[1];
      n++;
    }
    out.set(st.key, n ? [sx / n, sy / n] : p);
  }
  return out;
}

/** Where two offset lines meet, or null when they run parallel. */
function meet(p1: Point, u1: Point, p2: Point, u2: Point): Point | null {
  const den = u1[0] * u2[1] - u1[1] * u2[0];
  if (Math.abs(den) < 1e-6) return null;
  const t = ((p2[0] - p1[0]) * u2[1] - (p2[1] - p1[1]) * u2[0]) / den;
  return [p1[0] + u1[0] * t, p1[1] + u1[1] * t];
}

/** Each line as one path end to end, in its own lane wherever it shares track. */
function linePaths(layout: Layout) {
  return LINES.map((line) => ({
    code: line.code,
    color: line.color,
    d: lanePath(line.stations, (a, b) => lane(line.code, a, b, layout), layout),
  }));
}

/**
 * A path through stations st, each stretch a set distance right of the track's
 * middle (laneOf, looking from a to b). Corners are mitred so neighboring lanes
 * stay parallel and then rounded about the track's middle, so every lane's curve
 * shares one center; where the distance changes on a straight run, it eases across.
 */
function lanePath(st: string[], laneOf: (a: string, b: string) => number, layout: Layout) {
  // Every straight edge of the line's track, with its lane.
  const edges: { a: Point; b: Point; d: number }[] = [];
  for (let i = 1; i < st.length; i++) {
    const mid = track(layout, st[i - 1], st[i]);
    if (!mid) continue;
    const d = laneOf(st[i - 1], st[i]);
    for (let k = 1; k < mid.length; k++) {
      if (Math.hypot(mid[k][0] - mid[k - 1][0], mid[k][1] - mid[k - 1][1]) > 0.5) edges.push({ a: mid[k - 1], b: mid[k], d });
    }
  }
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
  const shifted = (e: { a: Point; b: Point; d: number }, p: Point): Point => {
    const n = normal(e.a, e.b);
    return [p[0] + n[0] * e.d, p[1] + n[1] * e.d];
  };
  if (!edges.length) return "";
  push(shifted(edges[0], edges[0].a), edges[0].d, edges[0].a);
  for (let k = 1; k < edges.length; k++) {
    const [e, f] = [edges[k - 1], edges[k]];
    const u1 = unit([e.b[0] - e.a[0], e.b[1] - e.a[1]]);
    const u2 = unit([f.b[0] - f.a[0], f.b[1] - f.a[1]]);
    const corner = meet(shifted(e, e.a), u1, shifted(f, f.a), u2);
    if (corner) {
      // Same lane round the corner curves about the track's middle; a lane change at a corner just follows the mitre.
      push(corner, e.d === f.d ? e.d : NaN, corner && e.d === f.d ? e.b : corner);
    } else if (e.d === f.d) {
      push(shifted(e, e.b), e.d, e.b);
    } else {
      // Straight on but changing lane: slide across over a short stretch centered on the station.
      const room = Math.min(Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]), Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1])) / 2;
      const half = Math.min(layout.line * 1.5, room * 0.8);
      const p: Point = [e.b[0] - u1[0] * half, e.b[1] - u1[1] * half];
      const q: Point = [f.a[0] + u2[0] * half, f.a[1] + u2[1] * half];
      const pe = shifted(e, p);
      const qf = shifted(f, q);
      // Each end of the slide sits squarely in its own lane, so a curve just past it still counts as steady.
      push(pe, e.d, p);
      push(qf, f.d, q);
    }
  }
  const last = edges[edges.length - 1];
  push(shifted(last, last.b), last.d, last.b);
  return pts.length > 1 ? rounded(pts, layout.radius, layout.line, lanes, centers) : "";
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
  at: p,
  layout,
  onHover,
}: {
  station: Station;
  at: Point | undefined;
  layout: Layout;
  onHover: (key: string | null) => void;
}) {
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
      href={`/metro/arrivals?station=${station.key}`}
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

function Label({ station, at, layout }: { station: Station; at: Point | undefined; layout: Layout }) {
  if (!at) return null;
  const font = layout.font;
  // Clear the widest thing at the station: the bullseye, or every lane of shared track.
  const half = Math.max(HUBS.has(station.key) ? layout.line * 0.95 : 0, ((layout.merged ? 1 : width(station.key)) * layout.line) / 2);
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

/** How far right of the track's middle a train runs from a to b: just outside the outermost lane, on its right. */
function trainLane(line: LineCode, a: string, b: string, forward: boolean, layout: Layout) {
  const ds = layout.merged ? [0] : (SHARED.get(key2(a, b)) ?? [line]).map((l) => lane(l, a, b, layout));
  const clear = layout.line / 2 + layout.train + 1.5;
  return forward ? Math.max(...ds) + clear : Math.min(...ds) - clear;
}

/**
 * The path a line's trains run along in one direction, drawn like the lines
 * themselves so it curves alongside them, with how far along it each station is.
 */
type Rail = { pts: Point[]; len: number[]; stops: number[] };

function rail(line: LineCode, forward: boolean, layout: Layout): Rail {
  const st = LINE_BY_CODE.get(line)!.stations;
  const pts = trace(lanePath(st, (a, b) => trainLane(line, a, b, forward, layout), layout));
  const len = [0];
  for (let k = 1; k < pts.length; k++) len.push(len[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  // Each station: the nearest point on the rail to where it would be on straight track, never behind the last one.
  const stops: number[] = [];
  let from = 0;
  st.forEach((key, i) => {
    const p = layout.pos.get(key);
    const [a, b] = i < st.length - 1 ? [key, st[i + 1]] : [st[i - 1], key];
    const mid = p && track(layout, a, b);
    if (!p || !mid) {
      stops.push(len[from]);
      return;
    }
    const side = i < st.length - 1 ? normal(mid[0], mid[1]) : normal(mid[mid.length - 2], mid[mid.length - 1]);
    const d = trainLane(line, a, b, forward, layout);
    const guess: Point = [p[0] + side[0] * d, p[1] + side[1] * d];
    let best = from;
    let bd = Infinity;
    for (let k = from; k < pts.length; k++) {
      const dd = (pts[k][0] - guess[0]) ** 2 + (pts[k][1] - guess[1]) ** 2;
      if (dd < bd) {
        bd = dd;
        best = k;
      }
    }
    stops.push(len[best]);
    from = best;
  });
  return { pts, len, stops };
}

/** Every line's rails, both ways, for one layout. */
function rails(layout: Layout) {
  const out = new Map<string, Rail>();
  for (const l of LINES) for (const f of [true, false]) out.set(`${l.code}${f}`, rail(l.code, f, layout));
  return out;
}

/**
 * The spot `u` stations along a line (see along): beside the lines on the
 * right-hand side of the way the train is heading, so trains going opposite ways
 * pass on opposite sides, following the lines round their curves.
 */
function trainPoint(line: LineCode, u: number, forward: boolean, all: Map<string, Rail>): Point | null {
  const r = all.get(`${line}${forward}`);
  if (!r || r.pts.length < 2) return null;
  const i = Math.max(0, Math.min(r.stops.length - 2, Math.floor(u)));
  const t = Math.max(0, Math.min(1, u - i));
  const want = r.stops[i] + (r.stops[i + 1] - r.stops[i]) * t;
  // Binary search for the stretch of rail holding that distance.
  let lo = 0;
  let hi = r.len.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (r.len[m] <= want) lo = m;
    else hi = m;
  }
  const span = r.len[hi] - r.len[lo];
  const f = span ? (want - r.len[lo]) / span : 0;
  return [r.pts[lo][0] + (r.pts[hi][0] - r.pts[lo][0]) * f, r.pts[lo][1] + (r.pts[hi][1] - r.pts[lo][1]) * f];
}

/** A train's trip on screen: from where it was drawn when new data came in, to where WMATA now says it is. */
/**
 * A train's trip on screen, from u0 to u1 over one refresh, leaving at speed v0
 * and arriving at speed v1 (stations per millisecond). Speed changes smoothly
 * between trips, so a train pulls away gently, keeps a steady pace, and eases to
 * a stop at a platform.
 */
type Trip = { line: LineCode; u0: number; u1: number; v0: number; v1: number; forward: boolean; start: number };

/** How long a train keeps rolling past its trip's end at its arrival speed while the next update is on its way. */
const COAST = 3000;

function tripAt(trip: Trip, now: number) {
  const ms = now - trip.start;
  if (ms >= REFRESH) return trip.u1 + trip.v1 * Math.min(ms - REFRESH, COAST);
  const f = Math.max(0, ms / REFRESH);
  const [f2, f3] = [f * f, f * f * f];
  return (
    (2 * f3 - 3 * f2 + 1) * trip.u0 +
    (f3 - 2 * f2 + f) * REFRESH * trip.v0 +
    (-2 * f3 + 3 * f2) * trip.u1 +
    (f3 - f2) * REFRESH * trip.v1
  );
}

function speedAt(trip: Trip, now: number) {
  const ms = now - trip.start;
  if (ms >= REFRESH) return ms - REFRESH < COAST ? trip.v1 : 0;
  const f = Math.max(0, ms / REFRESH);
  const f2 = f * f;
  return (
    ((6 * f2 - 6 * f) * trip.u0 + (-6 * f2 + 6 * f) * trip.u1) / REFRESH +
    (3 * f2 - 4 * f + 1) * trip.v0 +
    (3 * f2 - 2 * f) * trip.v1
  );
}

/** Speeds that keep a trip moving one way only: never past where it's going, never backing up. */
function steady(du: number, v: number) {
  if (du === 0 || Math.sign(v) !== Math.sign(du)) return 0;
  return Math.sign(du) * Math.min(Math.abs(v), (3 * Math.abs(du)) / REFRESH);
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

export function MetroMap() {
  // Colored lines are off unless turned on; remembered on this device, and the tap still works where storage is off.
  const [stored, store] = useStored(LINES_KEY);
  const [chosen, setChosen] = useState<boolean | null>(null);
  const showLines = chosen ?? stored === "1";
  const simple = !showLines;
  function toggleLines() {
    setChosen(!showLines);
    store(showLines ? "0" : "1");
  }
  const layout = simple ? SIMPLE : DIAGRAM;
  const { W, H } = layout;
  const paths = useMemo(() => linePaths(layout), [layout]);
  const points = useMemo(() => stationPoints(layout, paths), [layout, paths]);
  const { trains, updated, error } = useTrains();
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const picked = trains.find((t) => t.id === selected);

  // Each train glides along the track to its new spot over one refresh, moved
  // frame by frame outside React so the map itself doesn't re-render.
  const trips = useRef(new Map<string, Trip>());
  const dots = useRef(new Map<string, SVGGElement>());
  const allRails = useMemo(() => rails(layout), [layout]);
  const railsRef = useRef(allRails);
  useEffect(() => {
    railsRef.current = allRails;
  });
  useEffect(() => {
    const now = performance.now();
    const next = new Map<string, Trip>();
    for (const t of trains) {
      const u1 = along(t);
      const old = trips.current.get(t.id);
      const same = old && old.line === t.line && old.forward === t.forward;
      let u0 = same ? tripAt(old, now) : u1;
      // A jump of more than a few stations is a train turned around or renumbered: no gliding.
      if (Math.abs(u1 - u0) > 3) u0 = u1;
      // A train that coasted a hair past where it then turned out to stop holds still rather than backing up.
      const heading = same ? Math.sign(old.u1 - old.u0) : 0;
      const target = heading && Math.sign(u1 - u0) === -heading && Math.abs(u1 - u0) < 0.3 ? u0 : u1;
      const du = target - u0;
      // Carry on at the speed it had; arrive still if WMATA says it's stopped or at a platform.
      const v0 = same ? steady(du, speedAt(old, now)) : 0;
      const stops = t.still >= 20 || t.t === 0 || t.from === t.to;
      const v1 = stops ? 0 : steady(du, du / REFRESH);
      next.set(t.id, { line: t.line, u0, u1: target, v0, v1, forward: t.forward, start: now });
    }
    trips.current = next;
  }, [trains]);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const now = performance.now();
      for (const [id, trip] of trips.current) {
        const el = dots.current.get(id);
        const p = el && trainPoint(trip.line, tripAt(trip, now), trip.forward, railsRef.current);
        if (p) el.setAttribute("transform", `translate(${p[0].toFixed(1)} ${p[1].toFixed(1)})`);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  // The map fills its box beside the key (below it on a phone, where the key sits
  // at the bottom), centered, with the spare room as margin: the drawing is a
  // VW × VH canvas in map units, and zoom and pan move over it.
  const boxRef = useRef<HTMLDivElement>(null);
  const keyRef = useRef<HTMLDivElement>(null);
  const zoomBarRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [box, setBox] = useState({ w: W, h: H, x0: 0, y0: 0, x1: W, y1: H });
  useEffect(() => {
    const el = boxRef.current!;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) return;
      const key = keyRef.current!.getBoundingClientRect();
      const zoom = zoomBarRef.current!.getBoundingClientRect();
      const GAP = 12;
      const atBottom = key.bottom > r.bottom - 40 && key.width > r.width / 2;
      const room = atBottom
        ? { x0: GAP, y0: zoom.bottom - r.top + GAP, x1: r.width - GAP, y1: key.top - r.top - GAP }
        : { x0: key.right - r.left + GAP, y0: GAP, x1: r.width - GAP, y1: r.height - GAP };
      // Never squeeze the map below half the box, whatever the key does.
      if (room.x1 - room.x0 < r.width / 2) room.x0 = GAP;
      if (room.y1 - room.y0 < r.height / 2) room.y0 = GAP;
      setBox({ w: r.width, h: r.height, ...room });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(keyRef.current!);
    return () => ro.disconnect();
  }, []);
  const fit = Math.min((box.x1 - box.x0) / W, (box.y1 - box.y0) / H);
  const VW = box.w / fit;
  const VH = box.h / fit;
  const ox = (box.x0 + (box.x1 - box.x0 - W * fit) / 2) / fit;
  const oy = (box.y0 + (box.y1 - box.y0 - H * fit) / 2) / fit;

  // Zoom and pan, as on the House map.
  const [view, setView] = useState<View>({ k: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ moved: boolean; pinch?: number } | null>(null);
  const clampView = ({ k, x, y }: View): View => {
    const kk = Math.min(8, Math.max(1, k));
    return { k: kk, x: Math.min(0, Math.max(VW - VW * kk, x)), y: Math.min(0, Math.max(VH - VH * kk, y)) };
  };
  function localPoint(clientX: number, clientY: number) {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: (clientX - r.left) / fit, y: (clientY - r.top) / fit };
  }
  function zoomAt(factor: number, at: { x: number; y: number }) {
    setView((v) => {
      const k = Math.min(8, Math.max(1, v.k * factor));
      const f = k / v.k;
      return clampView({ k, x: at.x - (at.x - v.x) * f, y: at.y - (at.y - v.y) * f });
    });
  }
  const zoomRef = useRef({ zoomAt, localPoint });
  useEffect(() => {
    zoomRef.current = { zoomAt, localPoint };
  });
  useEffect(() => {
    const el = svgRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { zoomAt, localPoint } = zoomRef.current;
      // Trackpad pinches arrive as ctrl + wheel, in bigger steps than a mouse wheel.
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)), localPoint(e.clientX, e.clientY));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  // Where the map opens (and Reset goes back to): the whole map, except on a tall
  // screen like a phone, where it starts zoomed in on downtown to fill the room
  // and the far ends are a drag away.
  function home(): View {
    const tall = (box.y1 - box.y0) / (H * fit);
    if (tall < 1.4) return { k: 1, x: 0, y: 0 };
    const k = Math.min(1.7, tall);
    const [mx, my] = layout.pos.get("A01")!;
    const cx = (box.x0 + box.x1) / 2 / fit;
    const cy = (box.y0 + box.y1) / 2 / fit;
    return clampView({ k, x: cx - k * (ox + mx), y: cy - k * (oy + my) });
  }
  // A new window size starts over.
  const [seen, setSeen] = useState<typeof box | null>(null);
  if (seen?.w !== box.w || seen?.h !== box.h || seen?.x0 !== box.x0 || seen?.y1 !== box.y1) {
    setSeen(box);
    setView(home());
  }
  function onPointerDown(e: React.PointerEvent) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    drag.current = { moved: false };
  }
  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    if (pointers.current.size === 2) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (drag.current?.pinch) zoomAt(d / drag.current.pinch, localPoint((a.x + b.x) / 2, (a.y + b.y) / 2));
      drag.current = { moved: true, pinch: d };
      return;
    }
    const dx = (e.clientX - prev.x) / fit;
    const dy = (e.clientY - prev.y) / fit;
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

  // The whole width of the window, down to its bottom edge, with the key and zoom
  // buttons floating on top: the key down the left side, or along the bottom on a phone.
  return (
    <div ref={boxRef} className="relative ml-[calc(50%-50vw)] min-h-[420px] w-screen flex-1 overflow-hidden">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VW} ${VH}`}
        className={`absolute inset-0 size-full touch-none select-none ${view.k > 1 ? "cursor-grab active:cursor-grabbing" : ""}`}
        role="img"
        aria-label={`Map of Metrorail with ${trains.length} trains`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k}) translate(${ox} ${oy})`}>
          {paths.map((p) => (
            <path
              key={p.code}
              d={p.d}
              fill="none"
              stroke={simple ? TRACK : p.color}
              // A hair wider than the lane so neighboring lines overlap instead of leaving a thin seam.
              strokeWidth={layout.line + 1.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {STATIONS.map((s) => (
            <StationMark key={s.key} station={s} at={points.get(s.key)} layout={layout} onHover={setHover} />
          ))}
          {labelled.map((s) => (
            <Label key={s.key} station={s} at={points.get(s.key)} layout={layout} />
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
                    ? trainPoint(trip.line, tripAt(trip, performance.now()), trip.forward, railsRef.current)
                    : trainPoint(t.line, along(t), t.forward, railsRef.current);
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

      <div
        ref={keyRef}
        className="absolute inset-x-3 bottom-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-line bg-background/90 px-3 py-2 text-sm text-muted md:inset-x-auto md:bottom-auto md:left-4 md:top-1/2 md:-translate-y-1/2 md:flex-col md:items-start md:gap-y-1.5 md:px-4 md:py-3"
      >
        <button
          type="button"
          role="switch"
          aria-checked={showLines}
          onClick={toggleLines}
          className="flex items-center gap-2 text-xs hover:text-foreground md:mb-1"
        >
          <span
            className={`relative inline-block h-4 w-7 rounded-full transition-colors ${showLines ? "bg-accent" : "bg-muted/50"}`}
          >
            <span
              className={`absolute top-0.5 size-3 rounded-full bg-background transition-[left] ${showLines ? "left-3.5" : "left-0.5"}`}
            />
          </span>
          Show lines
        </button>
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
                {line.name} <span className="text-foreground">{n}</span>
              </span>
            ))}
            <span className="flex items-center gap-1.5 tabular-nums">
              <span className="inline-block size-2.5 rounded-full" style={{ background: EMPTY_TRAIN }} />
              No passengers <span className="text-foreground">{empty}</span>
            </span>
          </>
        )}
      </div>

      <div
        ref={zoomBarRef}
        className="absolute right-3 top-3 flex overflow-hidden rounded border border-line bg-background/90 text-sm"
      >
        {[
          { label: "Zoom in", text: "+", f: 1.6 },
          { label: "Zoom out", text: "−", f: 1 / 1.6 },
        ].map((b) => (
          <button
            key={b.label}
            type="button"
            aria-label={b.label}
            onClick={() => zoomAt(b.f, { x: VW / 2, y: VH / 2 })}
            className="w-8 border-r border-line py-1.5 text-muted hover:bg-surface hover:text-foreground"
          >
            {b.text}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setView(home())}
          className="px-2.5 py-1.5 text-muted hover:bg-surface hover:text-foreground"
        >
          Reset
        </button>
      </div>

      {updated && !error && (
        <div className="pointer-events-none absolute left-3 top-3 text-xs text-muted opacity-60 md:left-auto md:right-4 md:top-auto md:bottom-3">
          <Updated at={updated} />
        </div>
      )}

      {picked && (
        <div className="absolute left-3 top-10 max-w-[calc(100%-1.5rem)] rounded border border-line bg-background/95 px-3 py-2 text-sm md:left-auto md:right-4 md:top-14">
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
  );
}
