// Decision Desk HQ's results API (https://ddhq-election-results.readme.io).
// One call returns every Senate race on the ballot with county-level votes,
// precincts reporting and DDHQ's own estimate of each county's final vote, so
// when credentials are set (DDHQ_CLIENT_ID and DDHQ_CLIENT_SECRET, from DDHQ)
// it is the main source and the state readers only fill in states it lacks.
//
// The docs don't show where candidate names live (votes are keyed by
// candidate ID), so names are looked for in a few likely places; failing
// that, a state's candidate IDs can be pinned in CANDIDATE_IDS below once we
// see real data.

import type { RawCounty } from "./types";

const BASE = process.env.DDHQ_BASE_URL ?? "https://resultsapi.decisiondeskhq.com";
const SENATE = 4; // DDHQ office_id for US Senate
const ELECTION_DAY = "2026-11-03";

/** Candidate ID -> name, for races whose names can't be found in the response. */
const CANDIDATE_IDS: Record<string, Record<string, string>> = {};

export const ddhqConfigured = () => Boolean(process.env.DDHQ_CLIENT_ID && process.env.DDHQ_CLIENT_SECRET);
export const DDHQ_URL = `${BASE}/api/v4/races?race_date=${ELECTION_DAY}&office_id=${SENATE}`;

let token: { value: string; expires: number } | null = null;

async function getToken() {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  const res = await fetch(`${BASE}/api/v4/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.DDHQ_CLIENT_ID,
      client_secret: process.env.DDHQ_CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`DDHQ sign-in: ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: json.access_token, expires: Date.now() + json.expires_in * 1000 };
  return token.value;
}

type Votes = Record<string, number>;
type Estimated = { estimated_votes_mid?: number | null };
type Precincts = { total?: number | null; reporting?: number | null };
type DdhqCounty = { county: string; fips?: string; votes?: Votes; precincts?: Precincts; estimated_votes?: Estimated };
type DdhqCandidate = Record<string, unknown>;
type DdhqRace = {
  state: string;
  office_id: number;
  name?: string;
  test_data?: boolean;
  last_updated?: string;
  topline_results?: { votes?: Votes; estimated_votes?: Estimated; precincts?: Precincts };
  counties?: DdhqCounty[];
  candidates?: DdhqCandidate[];
};

/** Candidate ID -> "First Last" and party, from whatever the response carries. */
function candidateNames(race: DdhqRace) {
  const names = new Map<string, { name: string; party?: string }>();
  for (const c of race.candidates ?? []) {
    const id = String(c.cand_id ?? c.candId ?? c.id ?? "");
    const first = String(c.first_name ?? c.firstName ?? "");
    const last = String(c.last_name ?? c.lastName ?? c.name ?? "");
    const party = (c.party_name ?? c.party ?? c.party_abbr) as string | undefined;
    if (id) names.set(id, { name: `${first} ${last}`.trim(), party });
  }
  for (const [id, name] of Object.entries(CANDIDATE_IDS[race.state] ?? {})) names.set(id, { name });
  return names;
}

export type DdhqState = { state: string; counties: RawCounty[]; updated?: string };

/** Every Senate race's counties, by state. */
export async function readDdhq(): Promise<DdhqState[]> {
  const bearer = await getToken();
  const races: DdhqRace[] = [];
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(`${DDHQ_URL}&limit=250&page=${page}`, {
      headers: { authorization: `Bearer ${bearer}` },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`DDHQ races: ${res.status}`);
    const json = (await res.json()) as { data: DdhqRace[]; next_page_url?: string | null };
    races.push(...json.data);
    if (!json.next_page_url) break;
  }

  const allowTest = process.env.DDHQ_ALLOW_TEST === "1";
  const out: DdhqState[] = [];
  for (const race of races) {
    if (race.office_id !== SENATE || (race.test_data && !allowTest)) continue;
    if (race.name && !/general/i.test(race.name)) continue;
    const names = candidateNames(race);
    const toCandidates = (votes: Votes = {}) =>
      Object.entries(votes).map(([id, v]) => ({
        name: names.get(id)?.name ?? `#${id}`,
        party: names.get(id)?.party,
        votes: Number(v) || 0,
      }));
    const counties: RawCounty[] = (race.counties ?? []).map((c) => ({
      name: c.county,
      fips: c.fips,
      complete: Boolean(c.precincts?.total && c.precincts.reporting === c.precincts.total),
      expected: c.estimated_votes?.estimated_votes_mid ?? undefined,
      candidates: toCandidates(c.votes),
    }));
    // A race with no county breakdown still has statewide totals.
    if (!counties.length && race.topline_results) {
      counties.push({
        name: "Statewide",
        expected: race.topline_results.estimated_votes?.estimated_votes_mid ?? undefined,
        complete: Boolean(
          race.topline_results.precincts?.total && race.topline_results.precincts.reporting === race.topline_results.precincts.total,
        ),
        candidates: toCandidates(race.topline_results.votes),
      });
    }
    // Two Senate races in one state (a special) would need telling apart here.
    out.push({ state: race.state, counties, updated: race.last_updated });
  }
  return out;
}
