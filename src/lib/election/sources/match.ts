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
/** "Rep." -> "Rep", "(D)" -> "D". */
const cleanParty = (p: string | undefined) => (p ?? "").replace(/[().\s]/g, "");
// Loose on purpose (feeds write "Republican Party", "DFL", "Ind."): a party only
// rules a candidate out when it's clearly a different one.
const LOOSE_R = /^(r$|rep|gop)/i;
const LOOSE_D = /^(d$|dem|dfl)/i;
const fits = (side: string, party: string) =>
  /^r/i.test(side) ? LOOSE_R.test(party) : /^d/i.test(side) ? LOOSE_D.test(party) : !LOOSE_R.test(party) && !LOOSE_D.test(party);
const normName = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();

/**
 * Is this feed candidate our candidate? Last name has to match, and when the
 * feed gives a party it has to fit too, unless the full name matches exactly:
 * Alaska 2026 has a Republican Dan Sullivan and a third-party Daniel Sullivan.
 */
function isSide(name: string, party: string, side: Side, last: string) {
  if (!name.includes(last)) return false;
  if (!party) return true;
  if (fits(side.party, party)) return true;
  return normName(name) === normName(side.name);
}

/** Splits each county's candidates into the Republican, the opposition and everyone else. */
export function toCounts(raw: RawCounty[], rep: Side, opp: Side): CountyCount[] {
  const repLast = lastName(rep.name);
  const oppLast = lastName(opp.name);
  return raw.map((county) => {
    let r = 0;
    let o = 0;
    let other = 0;
    const cands = county.candidates.map((c) => ({ ...c, name: c.name.toLowerCase(), party: cleanParty(c.party) }));
    // Party alone only counts when no candidate matches by name (a feed with
    // odd name spellings); otherwise a second Democrat, like Maine's write-in
    // Sigrid Olson, would be added to the Democrat's total.
    const repNamed = cands.some((c) => isSide(c.name, c.party, rep, repLast));
    const oppNamed = cands.some((c) => isSide(c.name, c.party, opp, oppLast));
    for (const c of cands) {
      if (isSide(c.name, c.party, rep, repLast) || (!repNamed && !c.name.includes(oppLast) && PARTY_R.test(c.party)))
        r += c.votes;
      else if (isSide(c.name, c.party, opp, oppLast) || (!oppNamed && opp.party === "D" && PARTY_D.test(c.party)))
        o += c.votes;
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
