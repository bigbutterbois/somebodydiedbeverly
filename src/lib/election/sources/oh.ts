// Ohio Secretary of State: one JSON call for the Senate race, with
// contestList = 88 counties {name, reportedPrecincts, totalPrecincts,
// candidatesRunning: [{primaryCandidate, candidateParty, vCount}]}.
import type { RawCounty, Reader } from "./types";

const URL =
  "https://liveresults.ohiosos.gov/Api/v1/Contest/GetContestDetailsObject?contestName=U.S.%20Senator&contestObjectId=_55A742EA56A709A3E0633390EE0AE290&resultsLevel=&countyId=";

type Candidate = { primaryCandidate: string; candidateParty?: string; vCount?: number; totalVotes?: number };
type County = { name: string; reportedPrecincts?: number; totalPrecincts?: number; candidatesRunning?: Candidate[] };

export const oh: Reader = {
  url: "https://liveresults.ohiosos.gov/",
  async read(fetchText) {
    const data = JSON.parse(await fetchText(URL)) as { contestList?: County[] };
    const out: RawCounty[] = (data.contestList ?? []).map((c) => ({
      name: c.name,
      complete: Boolean(c.totalPrecincts && (c.reportedPrecincts ?? 0) >= c.totalPrecincts),
      candidates: (c.candidatesRunning ?? []).map((k) => ({
        name: k.primaryCandidate,
        party: k.candidateParty,
        votes: Number(k.vCount ?? k.totalVotes) || 0,
      })),
    }));
    if (!out.length) throw new Error("OH: no counties in contestList");
    return out;
  },
};
