// Senate forecast data. The model (forecast/ in the repo) runs every morning in
// GitHub Actions and publishes JSON to the forecast-data branch; the site
// reads it from there and refreshes its copy every 15 minutes. latest.json
// carries the by-day history too, so the headline odds and the charts always
// come from the same run (two files are cached separately and can disagree).

const DATA_URL =
  process.env.FORECAST_DATA_URL ?? "https://raw.githubusercontent.com/bigbutterbois/somebodydiedbeverly/forecast-data";

export type Candidate = { name: string; party: string; caucus?: string };

export type Race = {
  state: string;
  name: string;
  special: boolean;
  rep: Candidate;
  opp: Candidate;
  incumbent: string;
  p_opp: number;
  p_rep: number;
  mean_margin: number;
  margin_10: number;
  margin_90: number;
  poll_avg: number | null;
  n_polls: number;
  prior_margin: number;
  rating: number; // -3 Safe R .. 0 Toss-up .. +3 Safe D/opposition
};

export type Forecast = {
  as_of: string;
  generated_at: string;
  election_day: string;
  simulations: number;
  national_environment: number;
  generic_ballot?: number | null;
  trump_net_approval?: number | null;
  p_dem_control: number;
  p_rep_control: number;
  p_no_majority: number;
  dem_seats_not_up?: number;
  dem_seats_mean: number;
  rep_seats_mean: number;
  dem_seats_10: number;
  dem_seats_90: number;
  dem_seat_distribution: Record<string, number>;
  sample_simulations?: SampleSimulation[];
  races: Race[];
  history?: HistoryPoint[];
};

/** One simulated election: Dem seats and, per race in `races` order, "D" or "R" for the winner. */
export type SampleSimulation = { dem_seats: number; winners: string };

export type HistoryPoint = {
  date: string;
  p_dem_control: number;
  p_rep_control: number;
  p_no_majority: number;
  dem_seats_mean: number;
  generic_ballot?: { dem: number; rep: number } | null;
  approval?: { approve: number; disapprove: number } | null;
};

async function getJson<T>(file: string): Promise<T | null> {
  try {
    const res = await fetch(`${DATA_URL}/${file}`, { next: { revalidate: 900 } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export const getForecast = () => getJson<Forecast>("latest.json");
// From latest.json when it carries it; history.json only for files published before it did.
export const getHistory = async (forecast: Forecast) =>
  forecast.history ?? (await getJson<HistoryPoint[]>("history.json")) ?? [];

// Party colors for the map, legend and chart. Forecast charts use their own
// party colors rather than the site accent (docs/design.md).
export const DEM = "#4a86e8";
export const REP = "#e5534b";
// Trump approval chart lines.
export const APPROVE = "#d9a13b";
export const DISAPPROVE = "#9b8fd6";

export const RATINGS = [
  { value: 3, label: "Safe D", color: "#2a62c9" },
  { value: 2, label: "Likely D", color: "#5a8fe6" },
  { value: 1, label: "Lean D", color: "#9dbcf0" },
  { value: 0, label: "Toss-up", color: "#a8a39a" },
  { value: -1, label: "Lean R", color: "#f0a49d" },
  { value: -2, label: "Likely R", color: "#e2675f" },
  { value: -3, label: "Safe R", color: "#c13a35" },
] as const;

export function ratingInfo(value: number) {
  return RATINGS.find((r) => r.value === value) ?? RATINGS[3];
}

export function partyLetter(c: Candidate): "D" | "I" | "R" {
  return c.party === "R" ? "R" : c.party === "I" ? "I" : "D";
}

/** "Susan Collins (R) wins 56 of 100 times" for the race's favorite. */
export function favoriteLine(race: Race) {
  const repFavored = race.p_rep >= race.p_opp;
  const c = repFavored ? race.rep : race.opp;
  return `${c.name} (${partyLetter(c)}) wins ${outOf100(repFavored ? race.p_rep : race.p_opp)} of 100 times`;
}

/** Whether this candidate holds the seat now. */
export function isIncumbent(race: Race, side: "rep" | "opp") {
  return side === "rep" ? race.incumbent === "R" : race.incumbent === "D" || race.incumbent === "I";
}

/** A probability as a whole count out of 100, never rounding a possibility to 0 or 100. */
export function outOf100(p: number) {
  const n = Math.round(p * 100);
  if (n === 0 && p > 0) return "<1";
  if (n === 100 && p < 1) return ">99";
  return String(n);
}

/** A margin (opposition minus Republican) as "D+4.2" or "R+1.0". */
export function formatMargin(m: number | null, opp: "D" | "I" | "R" = "D") {
  if (m === null) return "–";
  if (Math.abs(m) < 0.05) return "Even";
  return `${m > 0 ? opp : "R"}+${Math.abs(m).toFixed(1)}`;
}

export function formatDay(iso: string, opts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" }) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

/** When a forecast run finished, in Eastern time: "Monday, October 5 at 3:01 PM ET". */
export function formatUpdated(iso: string) {
  const at = new Date(iso);
  const day = at.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/New_York" });
  const time = at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
  return `${day} at ${time} ET`;
}

/** Round the seat distribution to 100 dots (largest remainder), keyed by Democratic seats. */
export function seatDots(distribution: Record<string, number>, dots = 100) {
  const entries = Object.entries(distribution).map(([s, p]) => ({ s: Number(s), exact: p * dots }));
  const base = entries.map((e) => ({ ...e, n: Math.floor(e.exact) }));
  let left = dots - base.reduce((sum, e) => sum + e.n, 0);
  for (const e of [...base].sort((a, b) => b.exact - b.n - (a.exact - a.n))) {
    if (left-- <= 0) break;
    e.n += 1;
  }
  return new Map(base.filter((e) => e.n > 0).sort((a, b) => a.s - b.s).map((e) => [e.s, e.n]));
}
