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

const S = (pollsClose: number, extra: Omit<StateSettings, "pollsClose"> = {}): StateSettings => ({
  pollsClose,
  ...extra,
});

export const ELECTION = {
  /** Election night runs from here (the first polls close at 6pm Eastern) to the end. */
  start: "2026-11-03T22:30:00Z",
  end: "2026-11-10T05:00:00Z",
  /** Seconds between refreshes of the state feeds. */
  refreshSeconds: 55,

  simulations: 2000,
  seed: 2026,
  /**
   * 2026 turnout as a share of 2024's, until finished counties say otherwise.
   * Default for states without their own figure: 2022 ran ~72% of 2024 and
   * 2026 early voting set a midterm record (46M+ by Oct 30, past all of
   * 2022's), so a bit above. States with their own figure below: 2022 turnout
   * as a share of 2024, times 1 + half of how far 2026 early voting runs ahead
   * of 2022 at the same point (half, because some early voters would have
   * voted on Election Day anyway), capped at 0.9. Researched Nov 2.
   */
  turnout: 0.78,
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
  /** Share of the expected vote counted at which the forecast stops counting (Mike: 50%). */
  forecastFadeAt: 0.5,
  /** Prior on the swing when reading the results alone: wide enough to barely matter. */
  flatSwingSd: 30,
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
  callMinCounted: 0.1,

  states: {
    AL: S(20),
    AK: S(25, { turnout: 0.8, lateVotes: 0.35, rankedChoice: true }), // 2022 0.78, no early data
    AR: S(20.5),
    CO: S(21),
    DE: S(20),
    FL: S(20, { turnout: 0.735 }), // 2022 0.70, early +10%
    GA: S(19, { turnout: 0.8, runoff: true }), // 2022 0.75, record early vote ~2.8M vs ~2.5M
    ID: S(23),
    IL: S(20),
    IA: S(21, { turnout: 0.76 }), // 2022 0.72, early up ~12% (Pottawattamie)
    KS: S(21, { turnout: 0.86 }), // 2022 0.75, early +30%
    KY: S(19),
    LA: S(21, { turnout: 0.74 }), // 2022 0.70, no early data
    ME: S(20, { turnout: 0.9, rankedChoice: true, lateVotes: 0.05 }), // 2022 0.82, early +44% (capped)
    MA: S(20),
    MI: S(21, { turnout: 0.82 }), // 2022 0.79, early reports conflict (+32% / -15%)
    MN: S(21, { turnout: 0.86 }), // 2022 0.77, early +24%
    MS: S(20),
    MT: S(22),
    NE: S(21, { turnout: 0.74 }), // 2022 0.70, no early data, open-race interest
    NH: S(20, { turnout: 0.81 }), // 2022 0.75, no early voting
    NJ: S(20),
    NM: S(21),
    NC: S(19.5, { turnout: 0.76 }), // 2022 0.66, early +30%
    OH: S(19.5, { turnout: 0.8 }), // 2022 0.72, early +21%
    OK: S(20),
    OR: S(23, { lateVotes: 0.15 }),
    RI: S(20),
    SC: S(19, { turnout: 0.8 }), // 2022 0.67, early +83% (capped at +20%)
    SD: S(21),
    TN: S(20),
    TX: S(21, { turnout: 0.85 }), // 2022 0.71, early +50% (capped at +20%)
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
