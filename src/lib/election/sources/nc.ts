// North Carolina State Board of Elections: one JSON file per county,
// results_{n}.txt with n = 1..100 in the board's county order (alphabetical,
// "Mc" filed as "Mac", the same as FIPS order). One row per candidate per
// contest: cnm contest, bnm candidate, pty party, vct votes, prt/ptl
// precincts reported/total.
import baselines from "../baselines.json";
import type { Fetcher, RawCounty, Reader } from "./types";

const BASE = "https://er.ncsbe.gov/enr/20261103/data";
const COUNTIES = (baselines as Record<string, { name: string; fips: string }[]>).NC;

type Row = {
  cnm: string;
  bnm: string;
  pty?: string;
  vct: string | number;
  prt?: string | number;
  ptl?: string | number;
};

async function county(fetchText: Fetcher, n: number): Promise<RawCounty> {
  const rows = JSON.parse(await fetchText(`${BASE}/results_${n}.txt`)) as Row[];
  const senate = rows.filter((r) => /^US SENATE/i.test(r.cnm));
  if (!senate.length) throw new Error(`NC county ${n}: no US Senate contest`);
  const reported = Number(senate[0].prt ?? 0);
  const total = Number(senate[0].ptl ?? 0);
  return {
    name: COUNTIES[n - 1].name,
    fips: COUNTIES[n - 1].fips,
    complete: total > 0 && reported >= total,
    candidates: senate.map((r) => ({ name: r.bnm, party: r.pty, votes: Number(r.vct) || 0 })),
  };
}

export const nc: Reader = {
  url: "https://er.ncsbe.gov/?election_dt=11/03/2026",
  async read(fetchText) {
    const out: RawCounty[] = [];
    let failed = 0;
    let lastError = "";
    // Ten at a time, to be polite to the board's server. A county that fails
    // this time keeps its last counts out of this read; the model treats it as
    // not yet reporting until the next minute.
    for (let start = 1; start <= 100; start += 10) {
      const batch = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => county(fetchText, start + i)));
      for (const r of batch) {
        if (r.status === "fulfilled") out.push(r.value);
        else {
          failed++;
          lastError = String(r.reason?.message ?? r.reason);
        }
      }
    }
    if (failed > 50) throw new Error(`NC: ${failed} of 100 counties failed (${lastError})`);
    return out;
  },
};
