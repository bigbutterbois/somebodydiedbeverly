// What a state results reader returns: every county's votes per candidate.
// Readers are plain functions of a text fetcher, so the site's server and the
// laptop backup (scripts/election-laptop.ts) run the same code.

export type RawCandidate = { name: string; party?: string; votes: number };
export type RawCounty = {
  /** County name (Alaska: state House district; "Statewide" when the feed has no breakdown). */
  name: string;
  fips?: string;
  /** Every precinct in. */
  complete?: boolean;
  /** The source's own estimate of this county's final vote (DDHQ gives one). */
  expected?: number;
  candidates: RawCandidate[];
};

export type Fetcher = (url: string) => Promise<string>;

export type Reader = {
  /** The page or file the results come from, shown on the admin page. */
  url: string;
  read: (fetchText: Fetcher) => Promise<RawCounty[]>;
};
