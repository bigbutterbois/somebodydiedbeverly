"""Daily forecast run: scrape polls, run the model, write the published files.

    python forecast/run.py --data-dir data              # scrape + today's forecast
    python forecast/run.py --data-dir data --backfill-from 2026-09-01
    python forecast/run.py --data-dir data --no-scrape  # rerun on stored polls
    python forecast/run.py --dry-run                    # print a summary, write nothing

The data dir holds polls.json (every poll ever scraped, including generic
ballot and Trump approval polls), extras.json (daily fundraising and weather
snapshots), latest.json (today's forecast) and history.json (one entry per
day, for the odds-over-time chart).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import yaml

import extras as extra_sources
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


# Words too common in pollster names to tell two pollsters apart.
NAME_FILLER = {"the", "and", "research", "university", "college", "poll", "polling", "polls", "insights", "group",
               "strategies", "associates", "public", "opinion", "center", "survey", "partners", "analytics", "co"}


def pollster_words(name: str) -> set[str]:
    return {w for w in re.findall(r"[a-z]+", scrape.norm(name)) if len(w) >= 3 and w not in NAME_FILLER}


def drop_feed_duplicates(polls: list[dict]) -> list[dict]:
    """Drop VoteHub rows for polls Wikipedia already lists: same race, end date within 3 days,
    and a shared pollster name word or the same numbers. Wikipedia's row wins."""
    wiki: dict[str, list[dict]] = {}
    for p in polls:
        if p.get("feed") != "votehub":
            wiki.setdefault(p["state"], []).append(p)

    def duplicate(p: dict) -> bool:
        end = date.fromisoformat(p["end_date"])
        words = pollster_words(p["pollster"])
        for q in wiki.get(p["state"], []):
            if abs((date.fromisoformat(q["end_date"]) - end).days) > 3:
                continue
            if words & pollster_words(q["pollster"]) or (abs(q["opp"] - p["opp"]) <= 1 and abs(q["rep"] - p["rep"]) <= 1):
                return True
        return False

    return [p for p in polls if p.get("feed") != "votehub" or not duplicate(p)]


def history_entry(result: dict) -> dict:
    return {
        "date": result["as_of"],
        "p_dem_control": result["p_dem_control"],
        "p_rep_control": result["p_rep_control"],
        "p_no_majority": result["p_no_majority"],
        "dem_seats_mean": result["dem_seats_mean"],
        # Polling averages for the trend charts (D/R generic ballot, approve/disapprove).
        "generic_ballot": result.get("generic_ballot_levels") and {
            "dem": result["generic_ballot_levels"]["opp"], "rep": result["generic_ballot_levels"]["rep"]},
        "approval": result.get("approval_levels") and {
            "approve": result["approval_levels"]["opp"], "disapprove": result["approval_levels"]["rep"]},
        "races": {r["state"]: r["p_opp"] for r in result["races"]},
    }


def extras_as_of(extras: dict, d: date) -> dict:
    """Fundraising and super PAC spending from the latest snapshot on or before d (else the
    earliest); weather from d only."""
    out = {}
    for key in ("fundraising", "super_pacs"):
        snapshots = extras.get(key, {})
        if snapshots:
            earlier = [k for k in snapshots if k <= d.isoformat()]
            out[key] = snapshots[max(earlier) if earlier else min(snapshots)]
    if d.isoformat() in extras.get("weather", {}):
        out["weather"] = extras["weather"][d.isoformat()]
    if extras.get("economy"):
        out["economy"] = extras["economy"]
    return out


def summarize(result: dict) -> None:
    print(
        f"\n{result['as_of']}: Dem control {result['p_dem_control']:.1%}, Rep {result['p_rep_control']:.1%}, "
        f"no majority {result['p_no_majority']:.1%}; Dem seats {result['dem_seats_mean']} "
        f"(env {result['national_environment']:+.1f} from {result['national_environment_source']}, "
        f"economy {result['economy_shift']:+.1f} {result['economy']}: "
        f"generic ballot {result['generic_ballot']}, Trump net approval {result['trump_net_approval']})"
    )
    for r in sorted(result["races"], key=lambda r: -r["p_opp"]):
        avg = "  -  " if r["poll_avg"] is None else f"{r['poll_avg']:+5.1f}"
        print(
            f"  {r['state']} {r['opp']['name'][:22]:22} vs {r['rep']['name'][:20]:20} "
            f"p_opp {r['p_opp']:6.1%}  mean {r['mean_margin']:+6.1f}  polls {avg} (n={r['n_polls']:2}, "
            f"w={r['poll_weight']:.2f}, miss adj {r['poll_miss_adjustment']:+.1f})  prior {r['prior_margin']:+6.1f} (money {r['fundraising_shift']:+.1f}, "
            f"rain {r['weather_shift']:+.1f})  rating {r['rating']:+d}"
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
        approval, approval_problems = extra_sources.scrape_approval(cfg["polls"]["aggregators"])
        election = facts["election_day"]
        election = election if isinstance(election, date) else date.fromisoformat(election)
        votehub, votehub_problems = extra_sources.fetch_votehub(
            facts["races"], cfg["polls"]["aggregators"], election.year)
        before = [p for p in merge_polls(polls, scraped + approval) if p.get("feed") != "votehub"]
        # Wikipedia's rows go in last so a VoteHub row never replaces one.
        polls = drop_feed_duplicates(merge_polls(merge_polls(polls, votehub), scraped + approval))
        problems += approval_problems + votehub_problems
        since = f"{election.year}-06-01"
        count = lambda ps, s: sum(1 for p in ps if p["end_date"] >= since and s(p["state"]))  # noqa: E731
        print(f"polls since {since} (Wikipedia only -> with VoteHub; {len(votehub)} VoteHub polls before dedupe):")
        for label, s in (("approval", lambda x: x == "APPROVAL"), ("generic ballot", lambda x: x == "US"),
                         ("senate races", lambda x: x not in ("APPROVAL", "US"))):
            print(f"    {label}: {count(before, s)} -> {count(polls, s)}")

    today = args.as_of or datetime.now(EASTERN).date()
    extras = load_json(data / "extras.json", {"fundraising": {}, "weather": {}})
    if not args.no_scrape:
        election = facts["election_day"]
        election = election if isinstance(election, date) else date.fromisoformat(election)
        funds, fund_problems = extra_sources.fetch_fundraising(facts["races"], election.year)
        pacs, pac_problems = extra_sources.fetch_super_pacs(facts["races"], election.year)
        fund_problems += pac_problems
        weather, weather_problems = extra_sources.fetch_weather(election)
        economy, economy_problems = extra_sources.fetch_economy(date(election.year - 1, 1, 1))
        if funds:
            extras["fundraising"][today.isoformat()] = funds
        if pacs:
            extras.setdefault("super_pacs", {})[today.isoformat()] = pacs
        if weather:
            extras["weather"][today.isoformat()] = weather
        for key, values in economy.items():  # whole daily series; the model only reads days up to as_of
            extras.setdefault("economy", {}).setdefault(key, {}).update(values)
        problems += fund_problems + weather_problems + economy_problems
        for p in fund_problems + weather_problems + economy_problems + approval_problems + votehub_problems:
            print(f"  ! {p}")
    days = [today]
    if args.backfill_from:
        days = [args.backfill_from + timedelta(d) for d in range((today - args.backfill_from).days + 1)]

    history = {h["date"]: h for h in load_json(data / "history.json", [])}
    # Every saved day is rebuilt from all the polls known now, so polls that are
    # published or found late (or a new field) fill in the charts going back.
    if not args.backfill_from and history:
        days = [date.fromisoformat(min(history)) + timedelta(d)
                for d in range((today - date.fromisoformat(min(history))).days + 1)]
    result = None
    for d in days:
        result = model.run(facts, cfg, polls, d, seed=int(d.strftime("%Y%m%d")), extras=extras_as_of(extras, d))
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
    (data / "extras.json").write_text(json.dumps(extras, indent=1) + "\n")
    (data / "latest.json").write_text(json.dumps(result, indent=1) + "\n")
    (data / "history.json").write_text(json.dumps([history[k] for k in sorted(history)], indent=1) + "\n")
    # The data branch has no app to build; tell Vercel not to deploy it.
    (data / "vercel.json").write_text(json.dumps({"git": {"deploymentEnabled": False}}) + "\n")
    print(f"wrote {data}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
