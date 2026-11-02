import { loadSheet } from "../sheet";

// The county sheet as a CSV, for a spreadsheet. Under /admin, so the proxy
// only lets the signed-in owner through.
export async function GET(_req: Request, ctx: RouteContext<"/admin/election/[state]/csv">) {
  const { state } = await ctx.params;
  const data = await loadSheet(state.toUpperCase());
  if (!data) return new Response("No such race", { status: 404 });
  const { race, sheet } = data;
  const o = race.opp.name.split(" ").pop();
  const r = race.rep.name.split(" ").pop();
  const head = [
    "county",
    "fips",
    "margin_2024",
    "votes_2024",
    "expected_votes",
    `expected_${o}_pct`,
    `expected_${r}_pct`,
    "expected_other_pct",
    "expected_margin",
    `breakeven_${o}_pct`,
    `breakeven_${r}_pct`,
    "breakeven_margin",
    `live_${o}`,
    `live_${r}`,
    "live_other",
    "live_total",
    "counted_share",
    "complete",
    "live_margin",
    "vs_expected",
    "vs_breakeven",
    "projected_margin",
    "projected_votes",
  ];
  const cell = (v: unknown) =>
    v === null || v === undefined ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  const lines = sheet.rows.map((x) =>
    [
      x.name,
      x.fips,
      x.margin2024,
      x.votes2024,
      x.expectedVotes,
      x.expected.opp,
      x.expected.rep,
      x.expected.other,
      x.expected.margin,
      x.breakeven.opp,
      x.breakeven.rep,
      x.breakeven.margin,
      x.live.opp,
      x.live.rep,
      x.live.other,
      x.live.total,
      Math.round(x.live.counted * 1000) / 1000,
      x.live.complete,
      x.live.margin,
      x.vsExpected,
      x.vsBreakeven,
      x.projected.margin,
      x.projected.votes,
    ]
      .map(cell)
      .join(","),
  );
  return new Response([head.join(","), ...lines].join("\n") + "\n", {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${sheet.state}-counties.csv"`,
      "cache-control": "no-store",
    },
  });
}
