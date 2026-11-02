// Alaska Division of Elections: statewide.js is JSON despite the name.
// contestNames[] and candidateNames[] ("Peltola, Mary (DEM)") are lookups;
// districts[] = [{number: "1".."40", contests: [{n: contest index, p, r,
// c: [{n: candidate index, t: votes}]}]}], by state House district (Alaska has
// no counties). Ranked-choice: these are first-choice votes.
// The general election file wasn't up when this was written; the format is
// taken from the 2026 primary.
import type { RawCounty, Reader } from "./types";

const URL = "https://www.elections.alaska.gov/enr26/results/statewide.js";

type Contest = { n: number; p?: number; r?: number; c?: { n: number; t: number }[] };
type Data = { contestNames: string[]; candidateNames: string[]; districts?: { number: string; contests: Contest[] }[] };

function candidate(label: string) {
  const m = label.match(/^(.*?)(?:\s+\(([^)]+)\))?$/);
  const [last, first] = (m?.[1] ?? label).split(",").map((s) => s.trim());
  return { name: first ? `${first} ${last}` : last, party: m?.[2] };
}

export const ak: Reader = {
  url: "https://www.elections.alaska.gov/",
  async read(fetchText) {
    const data = JSON.parse(await fetchText(`${URL}?d=${Date.now()}`)) as Data;
    const idx = data.contestNames.findIndex((n) => /senat/i.test(n) && /(u\.?\s?s\.?|united states)/i.test(n));
    if (idx < 0) throw new Error("AK: no US Senate contest");
    const out: RawCounty[] = [];
    for (const d of data.districts ?? []) {
      const contest = d.contests.find((c) => c.n === idx);
      if (!contest) continue;
      out.push({
        name: `District ${d.number}`,
        complete: Boolean(contest.p && (contest.r ?? 0) >= contest.p),
        candidates: (contest.c ?? []).map((c) => ({ ...candidate(data.candidateNames[c.n] ?? `#${c.n}`), votes: c.t })),
      });
    }
    if (!out.length) throw new Error("AK: no districts with the Senate race");
    return out;
  },
};
