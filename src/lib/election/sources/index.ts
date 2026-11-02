// One results reader per state, keyed by postal code. A state without one
// (and not covered by Decision Desk HQ, see ddhq.ts) shows the forecast's odds
// all night. Each reader's file says where its feed lives and what it looks like.
import { ak } from "./ak";
import { ia, sc } from "./clarity";
import { la } from "./la";
import { mn } from "./mn";
import { nc } from "./nc";
import { ne } from "./ne";
import { oh } from "./oh";
import { tx } from "./tx";
import type { Reader } from "./types";

export const READERS: Partial<Record<string, Reader>> = {
  AK: ak,
  IA: ia,
  LA: la,
  MN: mn,
  NC: nc,
  NE: ne,
  OH: oh,
  SC: sc,
  TX: tx,
};
