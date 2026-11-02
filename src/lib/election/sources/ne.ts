// Nebraska Secretary of State: {d: [...]}, one row per county per candidate
// with CountyName, calcCandidate (name, padded with extra spaces), PartyCode,
// calcCandidateVotes, PrecinctsReporting and TotalPrecincts.
import type { RawCounty, Reader } from "./types";

const URL =
  "https://neresultswebservice.azurewebsites.us/ResultsAjax.svc/GetMapData?type=SW&category=CTY&raceID=13224&osn=102&county=0&party=0";

type Row = {
  CountyName: string;
  calcCandidate: string;
  PartyCode?: string;
  calcCandidateVotes?: number;
  PrecinctsReporting?: number;
  TotalPrecincts?: number;
};

export const ne: Reader = {
  url: "https://electionresults.nebraska.gov/",
  async read(fetchText) {
    const rows = (JSON.parse(await fetchText(URL)) as { d?: Row[] }).d ?? [];
    const counties = new Map<string, RawCounty>();
    for (const r of rows) {
      let c = counties.get(r.CountyName);
      if (!c) {
        c = {
          name: r.CountyName.trim(),
          complete: Boolean(r.TotalPrecincts && (r.PrecinctsReporting ?? 0) >= r.TotalPrecincts),
          candidates: [],
        };
        counties.set(r.CountyName, c);
      }
      c.candidates.push({
        name: r.calcCandidate.replace(/\s+/g, " ").trim(),
        party: r.PartyCode,
        votes: Number(r.calcCandidateVotes) || 0,
      });
    }
    if (!counties.size) throw new Error("NE: no rows");
    return [...counties.values()];
  },
};
