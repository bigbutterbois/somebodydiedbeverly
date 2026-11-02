// Louisiana Secretary of State. The .htm files are JSON:
//  RacesCandidates_Multiparish.htm: {Races: {Race: [{ID, Choice: [{ID, Desc: "Julia Letlow (REP)"}]}]}}
//  VotesParish/Votes_NN.htm (NN = 01-64, parishes in alphabetical order, which
//  is also FIPS order): {Races: {Race: [{ID, PrecinctsReporting,
//  PrecinctsExpected, Choice: [{ID, VoteTotal}]}]}}, every number a string.
// The Senate race is 67997.
import baselines from "../baselines.json";
import type { Fetcher, RawCounty, Reader } from "./types";

const DATA = "https://voterportal.sos.la.gov/ElectionResults/ElectionResults/Data?blob=20261103";
const SENATE = "67997";
const PARISHES = (baselines as Record<string, { name: string; fips: string }[]>).LA;

type Choice = { ID: string; Desc?: string; VoteTotal?: string };
type Race = { ID: string; PrecinctsReporting?: string; PrecinctsExpected?: string; Choice?: Choice | Choice[] };
type File = { Races?: { Race?: Race | Race[] } };

const list = <T>(x: T | T[] | undefined) => (x == null ? [] : Array.isArray(x) ? x : [x]);
const senate = (text: string) => list((JSON.parse(text) as File).Races?.Race).find((r) => r.ID === SENATE);

async function parish(fetchText: Fetcher, n: number, names: Map<string, { name: string; party?: string }>) {
  const nn = String(n).padStart(2, "0");
  const race = senate(await fetchText(`${DATA}/VotesParish/Votes_${nn}.htm`));
  if (!race) throw new Error(`LA parish ${nn}: no race ${SENATE}`);
  const reported = parseInt(race.PrecinctsReporting ?? "0", 10);
  const total = parseInt(race.PrecinctsExpected ?? "0", 10);
  return {
    name: PARISHES[n - 1].name,
    fips: PARISHES[n - 1].fips,
    complete: total > 0 && reported >= total,
    candidates: list(race.Choice).map((c) => ({
      name: names.get(c.ID)?.name ?? `#${c.ID}`,
      party: names.get(c.ID)?.party,
      votes: parseInt(c.VoteTotal ?? "0", 10) || 0,
    })),
  } satisfies RawCounty;
}

export const la: Reader = {
  url: "https://voterportal.sos.la.gov/graphical",
  async read(fetchText) {
    const race = senate(await fetchText(`${DATA}/RacesCandidates_Multiparish.htm`));
    if (!race) throw new Error(`LA: no race ${SENATE} in the candidate list`);
    const names = new Map<string, { name: string; party?: string }>();
    for (const c of list(race.Choice)) {
      const m = (c.Desc ?? "").match(/^(.*)\s+\(([^)]+)\)\s*$/);
      names.set(c.ID, { name: (m ? m[1] : (c.Desc ?? "")).replace(/"/g, "").trim(), party: m?.[2] });
    }
    const out: RawCounty[] = [];
    let failed = 0;
    let lastError = "";
    for (let start = 1; start <= 64; start += 8) {
      const batch = await Promise.allSettled(
        Array.from({ length: Math.min(8, 65 - start) }, (_, i) => parish(fetchText, start + i, names)),
      );
      for (const r of batch) {
        if (r.status === "fulfilled") out.push(r.value);
        else {
          failed++;
          lastError = String(r.reason?.message ?? r.reason);
        }
      }
    }
    if (failed > 32) throw new Error(`LA: ${failed} of 64 parishes failed (${lastError})`);
    return out;
  },
};
