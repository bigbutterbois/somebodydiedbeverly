// Minnesota Secretary of State media file: ussenatecty.txt, one line per
// county per candidate, semicolon-separated (no header):
//  1 state, 2 county ID (1-87, alphabetical, so FIPS = 27000 + 2*ID - 1),
//  3 precinct name, 4 office ID, 5 office name, 6 district, 7 candidate order,
//  8 candidate name, 9 suffix, 10 incumbent, 11 party, 12 precincts reporting,
//  13 precincts in the county, 14 votes, 15 percent, 16 county total.
import type { RawCounty, Reader } from "./types";

const URL = "https://electionresultsfiles.sos.mn.gov/20261103/ussenatecty.txt";

export const mn: Reader = {
  url: URL,
  async read(fetchText) {
    const text = await fetchText(URL);
    const counties = new Map<string, RawCounty>();
    for (const line of text.split(/\r?\n/)) {
      const f = line.split(";").map((s) => s.trim());
      if (f.length < 14 || !/^\d+$/.test(f[1])) continue;
      if (f[4] && !/senat/i.test(f[4])) continue;
      const id = Number(f[1]);
      const fips = String(27000 + 2 * id - 1);
      let c = counties.get(fips);
      if (!c) {
        const reported = Number(f[11]) || 0;
        const total = Number(f[12]) || 0;
        c = { name: fips, fips, complete: total > 0 && reported >= total, candidates: [] };
        counties.set(fips, c);
      }
      c.candidates.push({ name: f[7], party: f[10], votes: Number(f[13]) || 0 });
    }
    if (!counties.size) throw new Error("MN: no county lines in the file");
    return [...counties.values()];
  },
};
