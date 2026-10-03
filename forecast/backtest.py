"""Backtest the model on a past Senate cycle and report how well calibrated it was.

    python forecast/backtest.py                          # 2022, scraping Wikipedia, FEC and FRED
    python forecast/backtest.py --config other.yaml      # same, with different model settings
    python forecast/backtest.py --data backtest-data     # cache scraped data there, reuse it next time

Runs the model as of several dates before the election with the current
config.yaml (minus the hand-set 2026 candidate-quality nudges, which don't apply
to past races) and compares each race's odds and margin with the real result.
No weather: the forecast rain on past election days isn't recorded.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import yaml

import extras as extra_sources
import model
import scrape

HERE = Path(__file__).parent


def load_facts(year: int) -> dict:
    facts = yaml.safe_load((HERE / "backtest" / f"{year}.yaml").read_text())
    if isinstance(facts["election_day"], str):
        facts["election_day"] = date.fromisoformat(facts["election_day"])
    return facts


def remap_lean_years(cfg: dict, year: int) -> dict:
    """The config weights the last two presidential results; point them at the ones before `year`."""
    weights = list(cfg["fundamentals"]["lean_weights"].values())
    pres_years = [y for y in range(year - 1, year - 12, -1) if y % 4 == 0][:len(weights)]
    cfg["fundamentals"]["lean_weights"] = {str(y): w for y, w in zip(pres_years, weights)}
    return cfg


def gather(facts: dict, cfg: dict, cache: Path | None) -> tuple[list[dict], dict]:
    if cache and (cache / "polls.json").exists():
        print(f"using cached data in {cache}")
        return json.loads((cache / "polls.json").read_text()), json.loads((cache / "extras.json").read_text())
    year = facts["election_day"].year
    aggregators = cfg["polls"]["aggregators"]
    polls, problems = scrape.scrape_all(facts["races"], aggregators, verbose=True, year=year,
                                        generic_ballot_pages=facts.get("generic_ballot_pages"),
                                        generic_ballot_search=facts.get("generic_ballot_search"))
    approval, approval_problems = extra_sources.scrape_approval(
        aggregators, year, facts.get("approval_pages"), facts.get("approval_search", ""), facts.get("approval_name", ""))
    polls += approval
    problems += approval_problems
    # FEC files are keyed by two-letter state; a second race in a state (OK-S) is looked up on its own.
    funds: dict = {}
    for group in ([r for r in facts["races"] if len(r["state"]) == 2], [r for r in facts["races"] if len(r["state"]) > 2]):
        if not group:
            continue
        found, fund_problems = extra_sources.fetch_fundraising([{**r, "state": r["state"][:2]} for r in group], year)
        for r in group:
            if r["state"][:2] in found:
                funds[r["state"]] = found[r["state"][:2]]
        problems += fund_problems
    economy, economy_problems = extra_sources.fetch_economy(date(year - 1, 1, 1))
    problems += economy_problems
    print(f"\n{len(polls)} polls; {len(problems)} problems")
    for p in problems:
        print(f"  ! {p}")
    extras = {"fundraising": funds, "economy": economy}
    if cache:
        cache.mkdir(parents=True, exist_ok=True)
        (cache / "polls.json").write_text(json.dumps(polls, indent=1) + "\n")
        (cache / "extras.json").write_text(json.dumps(extras, indent=1) + "\n")
    return polls, extras


def report(facts: dict, cfg: dict, polls: list[dict], extras: dict, label: str) -> None:
    election = facts["election_day"]
    results = {r["state"]: r["result"] for r in facts["races"]}
    print(f"\n=== {label} ===")
    print(f"{'as of':10} {'D control':>9} {'D seats':>8} {'Brier':>6} {'log loss':>8} {'misses':>6} "
          f"{'abs err':>7} {'D bias':>6} {'poll bias':>9} {'prior bias':>10}  env")
    pooled = []
    for days_out in (68, 37, 24, 1):
        d = election - timedelta(days_out)
        r = model.run(facts, cfg, polls, d, seed=int(d.strftime("%Y%m%d")), extras=extras)
        p = np.array([x["p_opp"] for x in r["races"]])
        won = np.array([results[x["state"]] > 0 for x in r["races"]])
        err = np.array([x["mean_margin"] - results[x["state"]] for x in r["races"]])
        poll_err = [x["poll_avg"] - results[x["state"]] for x in r["races"] if x["poll_avg"] is not None]
        prior_err = np.array([x["prior_margin"] - results[x["state"]] for x in r["races"]])
        clipped = np.clip(p, 1e-3, 1 - 1e-3)
        pooled += list(zip(p, won))
        print(
            f"{d.isoformat():10} {r['p_dem_control']:9.1%} {r['dem_seats_mean']:8.1f} "
            f"{np.mean((p - won) ** 2):6.3f} {-np.mean(won * np.log(clipped) + (~won) * np.log(1 - clipped)):8.3f} "
            f"{int(((p > 0.5) != won).sum()):6d} {np.mean(np.abs(err)):7.1f} {np.mean(err):+6.1f} "
            f"{(f'{np.mean(poll_err):+.1f}' if poll_err else '-'):>9} {np.mean(prior_err):+10.1f}  "
            f"{r['national_environment']:+.1f} (economy {r['economy_shift']:+.1f})"
        )
        if days_out == 1:
            final = r
    print(f"actual: Dem seats {facts['actual_dem_seats']}")
    print("\ncalibration, all dates pooled (when the model said X, the Dem/opposition side won Y):")
    for lo, hi in ((0, .05), (.05, .2), (.2, .4), (.4, .6), (.6, .8), (.8, .95), (.95, 1.01)):
        bucket = [w for q, w in pooled if lo <= q < hi]
        if bucket:
            mid = np.mean([q for q, _ in pooled if lo <= q < hi])
            print(f"  {lo:4.0%}-{min(hi, 1):4.0%}: said {mid:5.1%}, won {np.mean(bucket):5.1%} of {len(bucket)}")
    print("\nday before, closest races (model mean margin vs result):")
    for x in sorted(final["races"], key=lambda x: abs(results[x["state"]]))[:12]:
        poll = "  -  " if x["poll_avg"] is None else f"{x['poll_avg']:+5.1f}"
        print(f"  {x['state']:4} p_opp {x['p_opp']:6.1%}  model {x['mean_margin']:+6.1f}  polls {poll} "
              f"(n={x['n_polls']:2})  prior {x['prior_margin']:+6.1f}  result {results[x['state']]:+6.1f}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, default=2022)
    ap.add_argument("--config", type=Path, action="append",
                    help="config file(s) to compare; default forecast/config.yaml")
    ap.add_argument("--data", type=Path, help="directory to cache scraped data in")
    args = ap.parse_args()

    facts = load_facts(args.year)
    configs = args.config or [HERE / "config.yaml"]
    base = yaml.safe_load(configs[0].read_text())
    polls, extras = gather(facts, base, args.data)
    for path in configs:
        cfg = yaml.safe_load(path.read_text())
        cfg["races"] = {}  # 2026 candidate-quality nudges don't apply to past races
        report(facts, remap_lean_years(cfg, args.year), polls, extras, f"{args.year} with {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
