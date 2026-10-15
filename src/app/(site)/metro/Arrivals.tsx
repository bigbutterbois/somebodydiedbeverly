"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LINE_BY_CODE, STATIONS, STATION_BY_KEY, linesAt } from "@/lib/metro/network";
import type { Alert, Arrival } from "@/lib/metro/wmata";
import { Updated } from "./Updated";
import { useStored } from "./useStored";

// Next trains at one station, like the signs on the platform. The station is
// the one in the link (?station=A01, from the map), else the one last viewed on
// this device, else the one nearest you (your location never leaves the
// browser), else Metro Center. Refreshes every 15 seconds while visible.

type Point = [number, number];
type Data = { arrivals: Arrival[]; alerts: Alert[]; updated: string };

const REFRESH = 15_000;
const SAVED_KEY = "metro.station";
const BY_NAME = [...STATIONS].sort((a, b) => a.name.localeCompare(b.name));

/** Miles between two [lon, lat] points. */
function miles(a: Point, b: Point) {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLon = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

function nearest(coords: Record<string, Point>, here: Point) {
  let best: { key: string; mi: number } | null = null;
  for (const [key, c] of Object.entries(coords)) {
    const mi = miles(here, c);
    if (!best || mi < best.mi) best = { key, mi };
  }
  return best;
}

function minText(min: string) {
  if (min === "BRD") return "Boarding";
  if (min === "ARR") return "Arriving";
  return `${min} min`;
}

export function Arrivals({ coords, requested }: { coords: Record<string, Point> | null; requested: string | null }) {
  const [saved, save] = useStored(SAVED_KEY);
  const [picked, setPicked] = useState<string | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = useCallback(
    (key: string, mi: number | null = null) => {
      setPicked(key);
      setDistance(mi);
      setData(null);
      save(key);
    },
    [save],
  );
  const [failed, setFailed] = useState(false);

  const locate = useCallback(() => {
    if (!coords || !navigator.geolocation) {
      setLocateError("Your location isn't available here.");
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const found = nearest(coords, [pos.coords.longitude, pos.coords.latitude]);
        if (found) choose(found.key, found.mi);
      },
      () => {
        setLocating(false);
        setFailed(true);
        setLocateError("Couldn't get your location. Pick a station instead.");
      },
      { maximumAge: 60_000, timeout: 15_000 },
    );
  }, [coords, choose]);

  // The station: one just picked here, then the link's, then the last one viewed on this
  // device, then the nearest (located below), then Metro Center.
  const valid = (key: string | null) => (key && STATION_BY_KEY.has(key) ? key : null);
  const station = valid(picked) ?? valid(requested) ?? valid(saved) ?? (coords && !failed ? null : "A01");

  // Nobody's picked anything yet: find the nearest station. Only on arrival.
  const located = useRef(false);
  useEffect(() => {
    if (located.current || station) return;
    located.current = true;
    locate();
  }, [station, locate]);

  useEffect(() => {
    if (!station) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    async function load() {
      clearTimeout(timer);
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/metro/arrivals?station=${station}`, { cache: "no-store" });
        const body = await res.json();
        if (stopped) return;
        if (!res.ok) setError(body.error ?? "wmata");
        else {
          setData(body);
          setError(null);
        }
      } catch {
        if (!stopped) setError("network");
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
  }, [station]);

  const here = station ? STATION_BY_KEY.get(station) : null;
  // One panel per platform direction, named for where most of its trains go.
  const groups = new Map<string, Arrival[]>();
  for (const a of data?.arrivals ?? []) groups.set(a.group, [...(groups.get(a.group) ?? []), a]);
  const panels = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, list]) => {
      const tally = new Map<string, number>();
      for (const a of list) tally.set(a.destination, (tally.get(a.destination) ?? 0) + 1);
      const toward = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return { group, toward, list };
    });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-light tracking-tight">{here?.name ?? "Finding your station…"}</h1>
          {here && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              {linesAt(here.key).map((l) => (
                <span key={l.code} className="flex items-center gap-1.5">
                  <span className="inline-block size-2.5 rounded-full" style={{ background: l.color }} />
                  {l.name}
                </span>
              ))}
              {distance !== null && <span className="tabular-nums">{distance.toFixed(1)} mi from you</span>}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <select
            value={station ?? ""}
            onChange={(e) => choose(e.target.value)}
            aria-label="Station"
            className="rounded border border-line bg-surface px-2 py-1.5"
          >
            {!station && <option value="">Pick a station</option>}
            {BY_NAME.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={locate}
            disabled={!coords || locating}
            className="rounded border border-accent px-3 py-1.5 text-accent transition-colors hover:bg-accent hover:text-background disabled:opacity-40"
          >
            {locating ? "Locating…" : "Nearest to me"}
          </button>
        </div>
      </div>
      {locateError && <p className="text-sm text-danger">{locateError}</p>}

      {data?.alerts.map((a, i) => (
        <div key={i} className="flex gap-3 rounded border border-line bg-surface px-3 py-2 text-sm">
          <span className="flex shrink-0 gap-1 pt-1">
            {a.lines.map((l) => (
              <span key={l} className="inline-block size-2.5 rounded-full" style={{ background: LINE_BY_CODE.get(l)!.color }} />
            ))}
          </span>
          <span>{a.text}</span>
        </div>
      ))}

      {error === "no-key" ? (
        <p className="text-muted">Live arrivals show up once the WMATA key is connected.</p>
      ) : error && !data ? (
        <p className="text-muted">WMATA isn&apos;t answering right now; trying again.</p>
      ) : !data ? (
        <p className="text-muted">Loading…</p>
      ) : panels.length === 0 ? (
        <p className="text-muted">No trains predicted right now. Metrorail may be closed for the night.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {panels.map((p) => (
            <section key={p.group} className="rounded border border-line">
              <h2 className="border-b border-line px-3 py-2 text-xs uppercase tracking-[0.12em] text-muted">
                Toward {p.toward}
              </h2>
              <ul>
                {p.list.map((a, i) => (
                  <li key={i} className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0">
                    <span
                      className="inline-block size-3 shrink-0 rounded-full"
                      style={{ background: a.line ? LINE_BY_CODE.get(a.line)!.color : "var(--muted)" }}
                      title={a.line ? `${LINE_BY_CODE.get(a.line)!.name} line` : undefined}
                    />
                    <span className="flex-1">
                      {a.destination}
                      {a.cars && <span className="ml-2 text-sm text-muted tabular-nums">{a.cars} cars</span>}
                    </span>
                    <span className={`tabular-nums ${a.min === "BRD" || a.min === "ARR" ? "text-accent" : ""}`}>
                      {minText(a.min)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {data && <p className="text-sm text-muted">{<Updated at={data.updated} />}</p>}
    </div>
  );
}
