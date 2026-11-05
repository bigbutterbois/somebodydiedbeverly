import "server-only";
import { geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import us from "us-atlas/counties-albers-10m.json";
import { getForecast } from "@/lib/forecast";
import { priorsFrom } from "@/lib/election/live";
import { countySheet } from "@/lib/election/model";
import { getCountRows } from "@/lib/election/server";
import baselines from "@/lib/election/baselines.json";
import { demoCounts } from "@/lib/election/demo";
import akDistricts from "@/lib/election/ak-districts.json";
import senate2020 from "@/lib/election/senate2020.json";

/** 2020 Senate margins (Democrat or independent minus Republican), from scripts/senate-2020.mjs. */
const S2020 = senate2020 as Record<string, { margin: number; counties: Record<string, number> }>;
const AK = akDistricts as Record<string, string>;

/** A county's 2020 Senate margin; where 2020 has only a statewide number (Alaska), that. */
function margin2020(state: string, fips: string) {
  const s = S2020[state];
  if (!s) return null;
  return Object.keys(s.counties).length ? (s.counties[fips] ?? null) : s.margin;
}

// The election page's County swing tab: every county in a state with a Senate
// race, with the shift from Harris's 2024 margin (or the 2020 Senate race's) to
// the Democrat's (or the independent's) 2026 margin. Shapes come from us-atlas,
// already projected to Albers USA (975 x 610), the same frame as the other
// election maps; Alaska uses its state House districts (scripts/ak-districts.mjs).

const topology = us as unknown as Topology<{
  counties: GeometryCollection<{ name: string }>;
  states: GeometryCollection<{ name: string }>;
}>;
const path = geoPath().digits(1);

export type SwingCounty = {
  fips: string;
  name: string;
  state: string;
  d: string;
  /** Margins are opposition minus Republican, in points. Null before any votes. */
  margin2024: number;
  /** The 2020 Senate margin here, null where there was no 2020 race or no county result. */
  margin2020: number | null;
  margin2026: number | null;
  shift: number | null;
  votes: number;
  counted: number;
};

export type SwingState = {
  code: string;
  name: string;
  d: string;
  box: [number, number, number, number];
  opp: { name: string; party: string };
  rep: { name: string };
  /** True when the results only have a statewide total, no county breakdown. */
  statewide: boolean;
  margin2024: number;
  margin2020: number | null;
  margin2026: number | null;
  shift: number | null;
  votes: number;
  counted: number;
};

/** demo: made-up counts at about that percent counted, like /election?demo=40. */
export async function loadSwing(demo?: number) {
  const [forecast, rows] = await Promise.all([getForecast(), getCountRows().catch(() => [])]);
  if (!forecast) return null;
  const demoed = demo ? demoCounts(forecast, demo) : null;
  const priors = new Map(priorsFrom(forecast).map((p) => [p.state, p]));
  const base = baselines as Record<string, { fips: string }[]>;
  const byFips = new Map<string, SwingCounty>();
  const states: SwingState[] = [];
  const stateFips = new Map<string, string>();

  const usStates = feature(topology, topology.objects.states).features;
  for (const race of forecast.races) {
    const prior = priors.get(race.state);
    const fips = base[race.state]?.[0]?.fips.slice(0, 2);
    const shape = usStates.find((f) => String(f.id) === fips);
    if (!prior || !fips || !shape) continue;
    stateFips.set(fips, race.state);
    const counts = demoed ? demoed[race.state] : rows.find((r) => r.state === race.state && r.fetched_at)?.counties ?? null;
    const sheet = countySheet(prior, counts);
    const statewide = sheet.rows.length === 1 && sheet.rows[0].fips.length === 2;
    let v = 0;
    let m = 0;
    for (const r of sheet.rows) {
      if (r.live.margin === null) continue;
      v += r.live.total;
      m += r.live.margin * r.live.total;
      if (!statewide) {
        byFips.set(r.fips, {
          fips: r.fips,
          name: r.name,
          state: race.state,
          d: "",
          margin2024: r.margin2024,
          margin2020: margin2020(race.state, r.fips),
          margin2026: r.live.margin,
          shift: Math.round((r.live.margin - r.margin2024) * 10) / 10,
          votes: r.live.total,
          counted: r.live.counted,
        });
      }
    }
    if (!statewide) {
      for (const r of sheet.rows) {
        if (!byFips.has(r.fips)) {
          byFips.set(r.fips, {
            fips: r.fips, name: r.name, state: race.state, d: "",
            margin2024: r.margin2024, margin2020: margin2020(race.state, r.fips), margin2026: null, shift: null, votes: 0, counted: 0,
          });
        }
      }
    }
    const margin2026 = v > 0 ? Math.round((m / v) * 10) / 10 : null;
    const [[x0, y0], [x1, y1]] = path.bounds(shape);
    states.push({
      code: race.state,
      name: race.name,
      d: path(shape) ?? "",
      box: [x0, y0, x1, y1],
      opp: { name: race.opp.name, party: race.opp.party },
      rep: { name: race.rep.name },
      statewide,
      margin2024: sheet.margin2024,
      margin2020: S2020[race.state]?.margin ?? null,
      margin2026,
      shift: margin2026 === null ? null : Math.round((margin2026 - sheet.margin2024) * 10) / 10,
      votes: v,
      counted: sheet.counted,
    });
  }

  // County outlines for every Senate state. Statewide-only states get their
  // county lines too, filled with the statewide shift.
  const counties: SwingCounty[] = [];
  for (const f of feature(topology, topology.objects.counties).features) {
    const id = String(f.id);
    const code = stateFips.get(id.slice(0, 2));
    if (!code) continue;
    const st = states.find((s) => s.code === code)!;
    const d = path(f) ?? "";
    const c = byFips.get(id);
    if (c) counties.push({ ...c, d });
    else if (st.statewide) {
      counties.push({
        fips: id, name: f.properties.name, state: code, d,
        margin2024: st.margin2024, margin2020: st.margin2020, margin2026: st.margin2026, shift: st.shift, votes: 0, counted: st.counted,
      });
    }
  }

  // Alaska reports by state House district, not borough: swap in those shapes.
  const ak = states.find((s) => s.code === "AK");
  if (ak && !ak.statewide) {
    for (let i = counties.length - 1; i >= 0; i--) if (counties[i].state === "AK") counties.splice(i, 1);
    for (const [fips, d] of Object.entries(AK)) {
      const c = byFips.get(fips);
      if (c) counties.push({ ...c, d });
    }
  }

  const others = usStates.filter((f) => !stateFips.has(String(f.id))).map((f) => path(f) ?? "").join("");
  const borders = path(mesh(topology, topology.objects.states, (a, b) => a !== b)) ?? "";
  return { states, counties, others, borders, has2020: Object.keys(S2020).length > 0 };
}
