// Texas (Civix): one call returns every county. The response is
// {upload: base64}; decoded it is {countyId: {N: "ANDERSON", Races: {raceId:
// {PR, TP, C: {candId: {N, P, V}}}}}}. The Senate race is 5075. Counties are
// matched by name (N, uppercase).
import type { RawCounty, Reader } from "./types";

const URL = "https://goelect.txelections.civixapps.com/api-ivis-system/api/s3/enr/election/countyInfo/53815";
const SENATE = "5075";

type Race = { PR?: number; TP?: number; C?: Record<string, { N: string; P?: string; V?: number }> };
type County = { N: string; Races?: Record<string, Race> };

export const tx: Reader = {
  url: URL,
  async read(fetchText) {
    const { upload } = JSON.parse(await fetchText(URL)) as { upload?: string };
    if (!upload) throw new Error("TX: no upload in the response");
    const data = JSON.parse(Buffer.from(upload, "base64").toString("utf8")) as Record<string, County>;
    const out: RawCounty[] = [];
    for (const county of Object.values(data)) {
      const race = county.Races?.[SENATE];
      if (!race?.C) continue;
      out.push({
        name: county.N.trim(),
        complete: Boolean(race.TP && (race.PR ?? 0) >= race.TP),
        candidates: Object.values(race.C).map((c) => ({ name: c.N.trim(), party: c.P, votes: Number(c.V) || 0 })),
      });
    }
    if (!out.length) throw new Error(`TX: no counties with race ${SENATE}`);
    return out;
  },
};
