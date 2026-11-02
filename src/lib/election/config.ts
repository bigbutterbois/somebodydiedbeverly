// Election night settings: model knobs and per-state facts. Margins are
// opposition minus Republican, in points.

type StateSettings = {
  /** Last polls close, Eastern time, as hours after midnight Nov 3 (7.5 = 7:30pm is 19.5). */
  pollsClose: number;
  /** Expected 2026 votes as a share of 2024 presidential votes (default below). */
  turnout?: number;
  /** Share more votes still to come after every precinct reports (mail, provisional). */
  lateVotes?: number;
  /** Points the first votes counted are expected to lean toward the opposition vs the final count. */
  earlyLean?: number;
  /** A runoff when nobody passes 50% (Georgia). */
  runoff?: boolean;
  /** Ranked-choice voting: the model projects the first round only. */
  rankedChoice?: boolean;
};

const S = (pollsClose: number, extra: Omit<StateSettings, "pollsClose"> = {}): StateSettings => ({ pollsClose, ...extra });

export const ELECTION = {
  /** Election night runs from here (the first polls close at 6pm Eastern) to the end. */
  start: "2026-11-03T22:30:00Z",
  end: "2026-11-10T05:00:00Z",
  /** Seconds between refreshes of the state feeds. */
  refreshSeconds: 55,

  simulations: 2000,
  seed: 2026,
  /** 2026 turnout as a share of 2024's, until finished counties say otherwise (2022 was ~70% of 2020). */
  turnout: 0.72,
  /** Extra votes after every precinct is in, as a share of what's counted. */
  lateVotes: 0.03,
  /** A county's own swing differs from the state's by about this much (points) at countyNoiseVotes votes. */
  countyNoise: 4,
  countyNoiseVotes: 20000,
  /** How far a partly counted county can sit from its final margin (points, at 0% counted). */
  partialNoise: 8,
  /** How far the first votes counted can lean from the final count, statewide (points, sd). */
  earlyLeanSd: 8,
  /** Extra swing uncertainty for what the model gets wrong (points, sd). */
  modelSlack: 1.5,
  /** Turnout uncertainty: statewide and per county (log scale). */
  turnoutNoise: 0.08,
  countyTurnoutNoise: 0.1,
  /** Third-party share assumed in counties with no votes yet. */
  otherShare: 0.02,
  /** How tightly races move together (share of their uncertainty that is national). */
  nationalCorrelation: 0.6,
  /** States need this much of their uncertainty resolved before they move the others. */
  signalMinInfo: 0.3,
  /** How strongly the national signal moves states without much data yet (0 = off). */
  signalWeight: 0.5,
  /** Our own call: this sure, with at least this share of the vote counted. */
  callAt: 0.995,
  callMinCounted: 0.5,

  states: {
    AL: S(20),
    AK: S(25, { lateVotes: 0.35, rankedChoice: true }),
    AR: S(20.5),
    CO: S(21),
    DE: S(20),
    FL: S(20),
    GA: S(19, { runoff: true }),
    ID: S(23),
    IL: S(20),
    IA: S(21),
    KS: S(21),
    KY: S(19),
    LA: S(21),
    ME: S(20, { rankedChoice: true, lateVotes: 0.05 }),
    MA: S(20),
    MI: S(21),
    MN: S(21),
    MS: S(20),
    MT: S(22),
    NE: S(21),
    NH: S(20),
    NJ: S(20),
    NM: S(21),
    NC: S(19.5),
    OH: S(19.5),
    OK: S(20),
    OR: S(23, { lateVotes: 0.15 }),
    RI: S(20),
    SC: S(19),
    SD: S(21),
    TN: S(20),
    TX: S(21),
    VA: S(19),
    WV: S(19.5),
    WY: S(21),
  } as Record<string, StateSettings>,
};

/** When a state's last polls close. */
export function pollsCloseAt(state: string) {
  const hours = ELECTION.states[state]?.pollsClose ?? 21;
  // Eastern Standard Time on Nov 3 is UTC-5.
  return new Date(Date.UTC(2026, 10, 3, 5) + hours * 3600_000);
}
