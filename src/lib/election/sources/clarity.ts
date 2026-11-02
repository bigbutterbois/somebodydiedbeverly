// Clarity Elections (Scytl) results sites, used by Iowa and South Carolina.
// current_ver.txt gives the latest version; under it:
//  json/en/summary.json: every contest statewide. The Senate entry (by key K)
//    has CH (candidate names) and P (parties), in ballot order.
//  json/ALL.json: {Contests: [{A: county, C: [contest keys], V: [[votes]]}]},
//    V[i] in the same order as CH for contest C[i]. A = "-1" is the state total.
// ALL.json has no precinct counts, so counties are never marked complete here;
// the model estimates each county's final vote from 2024 turnout instead.
import type { RawCounty, Reader } from "./types";

type Summary = { K: string; C?: string; CH: string[]; P?: string[] };
type All = { Contests: { A: string; C: string[]; V: number[][] }[] };

export function clarity(base: string, contestKey: string, label: string): Reader {
  return {
    url: `${base}/`,
    async read(fetchText) {
      const ver = (await fetchText(`${base}/current_ver.txt`)).trim();
      if (!/^\d+$/.test(ver)) throw new Error(`${label}: odd version "${ver.slice(0, 40)}"`);
      const [summaryText, allText] = await Promise.all([
        fetchText(`${base}/${ver}/json/en/summary.json`),
        fetchText(`${base}/${ver}/json/ALL.json`),
      ]);
      const contest = (JSON.parse(summaryText) as Summary[]).find((s) => String(s.K) === contestKey);
      if (!contest) throw new Error(`${label}: no contest ${contestKey} in summary.json`);
      const out: RawCounty[] = [];
      for (const area of (JSON.parse(allText) as All).Contests) {
        if (area.A === "-1") continue;
        const i = area.C.indexOf(contestKey);
        if (i < 0) continue;
        out.push({
          name: area.A,
          candidates: contest.CH.map((name, j) => ({
            // South Carolina puts the party in front of the name ("REP Darline Graham").
            name: name.replace(/^[A-Z]{2,4}\s+/, ""),
            party: contest.P?.[j],
            votes: Number(area.V[i]?.[j]) || 0,
          })),
        });
      }
      if (!out.length) throw new Error(`${label}: no counties with contest ${contestKey}`);
      return out;
    },
  };
}

export const ia = clarity("https://electionresults.iowa.gov/IA/127077", "1000", "IA");
export const sc = clarity("https://www.enr-scvotes.org/SC/127300", "26000", "SC");
