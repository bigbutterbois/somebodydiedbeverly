"""Daily forecast run: scrape polls, run the model, write the published files.

    python forecast/run.py --data-dir data              # scrape + today's forecast
    python forecast/run.py --data-dir data --backfill-from 2026-09-01
    python forecast/run.py --data-dir data --no-scrape  # rerun on stored polls
    python forecast/run.py --dry-run                    # print a summary, write nothing

The data dir holds polls.json (every poll ever scraped), latest.json (today's
forecast) and history.json (one entry per day, for the odds-over-time chart).
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import yaml

import model
import scrape

HERE = Path(__file__).parent
EASTERN = ZoneInfo("America/New_York")


def load_json(path: Path, default):
    return json.loads(path.read_text()) if path.exists() else default


def merge_polls(old: list[dict], new: list[dict]) -> list[dict]:
    """Keep every poll ever seen; a fresh scrape replaces matching old rows."""
    key = lambda p: (p["state"], scrape.norm(p["pollster"]), p["end_date"])  # noqa: E731
    merged = {key(p): p for p in old}
    merged.update({key(p): p for p in new})
    return sorted(merged.values(), key=lambda p: (p["state"], p["end_date"], p["pollster"]))


def history_entry(result: dict) -> dict:
    return {
        "date": result["as_of"],
        "p_dem_control": result["p_dem_control"],
        "p_rep_control": result["p_rep_control"],
        "p_no_majority": result["p_no_majority"],
        "dem_seats_mean": result["dem_seats_mean"],
        "races": {r["state"]: r["p_opp"] for r in result["races"]},
    }


def summarize(result: dict) -> None:
    print(
        f"\n{result['as_of']}: Dem control {result['p_dem_control']:.1%}, Rep {result['p_rep_control']:.1%}, "
        f"no majority {result['p_no_majority']:.1%}; Dem seats {result['dem_seats_mean']} "
        f"(env {result['national_environment']:+.1f}, {result['national_environment_source']})"
    )
    for r in sorted(result["races"], key=lambda r: -r["p_opp"]):
        avg = "  -  " if r["poll_avg"] is None else f"{r['poll_avg']:+5.1f}"
        print(
            f"  {r['state']} {r['opp']['name'][:22]:22} vs {r['rep']['name'][:20]:20} "
            f"p_opp {r['p_opp']:6.1%}  mean {r['mean_margin']:+6.1f}  polls {avg} (n={r['n_polls']:2}, "
            f"w={r['poll_weight']:.2f})  prior {r['prior_margin']:+6.1f}  rating {r['rating']:+d}"
        )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", type=Path, default=HERE / "out")
    ap.add_argument("--no-scrape", action="store_true")
    ap.add_argument("--as-of", type=date.fromisoformat)
    ap.add_argument("--backfill-from", type=date.fromisoformat)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    config_text = (HERE / "config.yaml").read_text()
    cfg = yaml.safe_load(config_text)
    cfg.setdefault("races", {})
    facts = yaml.safe_load((HERE / "races.yaml").read_text())
    version = model.config_version(config_text)

    data = args.data_dir
    data.mkdir(parents=True, exist_ok=True)
    polls = load_json(data / "polls.json", [])
    problems: list[str] = []
    if not args.no_scrape:
        scraped, problems = scrape.scrape_all(facts["races"], cfg["polls"]["aggregators"], verbose=args.verbose)
        print(f"scraped {len(scraped)} polls; {len(problems)} problems")
        for p in problems:
            print(f"  ! {p}")
        if not scraped:
            print("scrape returned nothing; keeping the last published forecast", file=sys.stderr)
            return 1
        polls = merge_polls(polls, scraped)

    today = args.as_of or datetime.now(EASTERN).date()
    days = [today]
    if args.backfill_from:
        days = [args.backfill_from + timedelta(d) for d in range((today - args.backfill_from).days + 1)]

    history = {h["date"]: h for h in load_json(data / "history.json", [])}
    result = None
    for d in days:
        result = model.run(facts, cfg, polls, d, seed=int(d.strftime("%Y%m%d")))
        history[d.isoformat()] = history_entry(result)
    assert result is not None
    result.update({
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "config_version": version,
        "problems": problems,
    })
    summarize(result)
    if args.dry_run:
        return 0

    (data / "polls.json").write_text(json.dumps(polls, indent=1) + "\n")
    (data / "latest.json").write_text(json.dumps(result, indent=1) + "\n")
    (data / "history.json").write_text(json.dumps([history[k] for k in sorted(history)], indent=1) + "\n")
    # The data branch has no app to build; tell Vercel not to deploy it.
    (data / "vercel.json").write_text(json.dumps({"git": {"deploymentEnabled": False}}) + "\n")
    print(f"wrote {data}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
