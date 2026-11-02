// One results reader per state, keyed by postal code. A state without one
// (and not covered by Decision Desk HQ, see ddhq.ts) shows the forecast's odds
// all night. Each reader's file says where its feed lives and what it looks like.
import { mn } from "./mn";
import { nc } from "./nc";
import type { Reader } from "./types";

export const READERS: Partial<Record<string, Reader>> = {
  MN: mn,
  NC: nc,
};
