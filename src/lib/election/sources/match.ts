import type { CountyCount } from "../model";
import type { RawCounty } from "./types";

type Side = { name: string; party: string };

const lastName = (full: string) =>
  full
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\.?$/g, "")
    .trim()
    .split(/\s+/)
    .pop() ?? "";

const PARTY_R = /^(r|rep|republican|gop)$/i;
const PARTY_D = /^(d|dem|democrat|democratic|dfl)$/i;

/** Splits each county's candidates into the Republican, the opposition and everyone else. */
export function toCounts(raw: RawCounty[], rep: Side, opp: Side): CountyCount[] {
  const repLast = lastName(rep.name);
  const oppLast = lastName(opp.name);
  return raw.map((county) => {
    let r = 0;
    let o = 0;
    let other = 0;
    for (const c of county.candidates) {
      const name = c.name.toLowerCase();
      const party = (c.party ?? "").trim();
      if (name.includes(repLast) || (!name.includes(oppLast) && PARTY_R.test(party))) r += c.votes;
      else if (name.includes(oppLast) || (opp.party === "D" && PARTY_D.test(party))) o += c.votes;
      else other += c.votes;
    }
    return {
      name: county.name,
      fips: county.fips,
      rep: r,
      opp: o,
      other,
      complete: county.complete,
      expected: county.expected,
    };
  });
}
