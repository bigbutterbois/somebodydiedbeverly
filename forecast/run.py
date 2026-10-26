"""Daily forecast run: scrape polls, run the model, write the published files.

    python forecast/run.py --data-dir data              # scrape + today's forecast
    python forecast/run.py --data-dir data --backfill-from 2026-09-01
    python forecast/run.py --data-dir data --no-scrape  # rerun on stored polls
    python forecast/run.py --dry-run                    # print a summary, write nothing

The data dir holds polls.json (every poll ever scraped, including generic
ballot and Trump approval polls), extras.json (daily fundraising and weather
snapshots), latest.json (today's forecast) and history.json (one entry per
day). latest.json also carries the chart fields of every history day, so the
site reads today's numbers and the by-day charts from one file and they can't
come from two different runs.

The House forecast is made in the same run, on the same polls file and the same
national and regional draws, into house/latest.json and house/history.json;
house/districts.json keeps the last good scrape of the 435 districts.
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
import house
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


# Warn when the newest generic ballot or approval poll is older than this.
STALE_POLL_DAYS = 5

# Second-hand feeds, best first; Wikipedia's own rows (no feed) outrank them all.
FEED_RANK = {"rcp": 1, "votehub": 2}


def drop_feed_duplicates(polls: list[dict]) -> list[dict]:
    """Drop feed rows for polls a better source already lists: same race, end date within 3
    days, and a shared pollster name word or the same numbers. Wikipedia's row wins, then RCP's."""
    rank = lambda p: FEED_RANK.get(p.get("feed"), 0)  # noqa: E731
    kept: dict[str, list[dict]] = {}

    def duplicate(p: dict) -> bool:
        end = date.fromisoformat(p["end_date"])
        words = pollster_words(p["pollster"])
        for q in kept.get(p["state"], []):
            if rank(q) >= rank(p) or abs((date.fromisoformat(q["end_date"]) - end).days) > 3:
                continue
            if words & pollster_words(q["pollster"]) or (abs(q["opp"] - p["opp"]) <= 1 and abs(q["rep"] - p["rep"]) <= 1):
                return True
        return False

    out = []
    for p in sorted(polls, key=rank):
        if rank(p) == 0 or not duplicate(p):
            kept.setdefault(p["state"], []).append(p)
            out.append(p)
    return sorted(out, key=lambda p: (p["state"], p["end_date"], p["pollster"]))


def history_entry(result: dict) -> dict:
    return {
        "date": result["as_of"],
        "p_dem_control": result["p_dem_control"],
        "p_rep_control": result["p_rep_control"],
        "p_no_majority": result["p_no_majority"],
        "dem_seats_mean": result["dem_seats_mean"],
        "p_dem_both": result.get("p_dem_both"),
        # Polling averages for the trend charts (D/R generic ballot, approve/disapprove).
        "generic_ballot": result.get("generic_ballot_levels") and {
            "dem": result["generic_ballot_levels"]["opp"], "rep": result["generic_ballot_levels"]["rep"]},
        "approval": result.get("approval_levels") and {
            "approve": result["approval_levels"]["opp"], "disapprove": result["approval_levels"]["rep"]},
        "races": {r["state"]: r["p_opp"] for r in result["races"]},
    }


def national_polls(polls: list[dict], since: str, today: date, cfg: dict) -> dict:
    """The generic ballot and approval polls behind the trend charts' averages, from the
    first chart day on: each poll's end date, pollster and both sides' shares."""
    f = cfg["fundamentals"]
    out = {}
    for kind, state, half_life, keys in (
        ("generic_ballot", "US", f["generic_ballot_half_life_days"], ("dem", "rep")),
        ("approval", "APPROVAL", f["approval_half_life_days"], ("approve", "disapprove")),
    ):
        rows = model.weighted_rows([p for p in polls if p["state"] == state and p["end_date"] >= since],
                                   today, cfg, half_life)
        out[kind] = sorted(({"date": p["end_date"], "pollster": p["pollster"], keys[0]: p["opp"], keys[1]: p["rep"]}
                            for _, _, p in rows), key=lambda r: r["date"])
    return out


def input_checks(fetched: dict, polls: list[dict], extras: dict, result: dict, districts: list[dict],
                 today: date) -> list[dict]:
    """One row per model input for the admin page: did this run's fetch work, how fresh
    the newest data is, and a one-line summary of it. status is ok, stale or failed."""
    week_ago = (today - timedelta(7)).isoformat()

    def days_old(iso: str) -> int:
        return (today - date.fromisoformat(iso)).days

    def row(key: str, name: str, latest: str, summary: str, stale_days: int | None = None) -> dict:
        ok, note = fetched.get(key, (True, "Not fetched this run (rerun on stored data)"))
        status = "failed" if not ok else "stale" if stale_days is not None and latest and days_old(latest) > stale_days \
            else "ok"
        return {"name": name, "status": status, "fetch": note, "latest": latest, "summary": summary}

    def poll_row(key: str, name: str, keep, stale_days: int, describe) -> dict:
        ps = [p for p in polls if keep(p["state"]) and p["end_date"] <= today.isoformat()]
        if not ps:
            return row(key, name, "", "No polls", stale_days)
        newest = max(ps, key=lambda p: p["end_date"])
        recent = sum(1 for p in ps if p["end_date"] > week_ago)
        return row(key, name, newest["end_date"], f"{recent} polls in the last week. {describe(newest)}", stale_days)

    def money(snapshots: dict) -> tuple[str, str]:
        if not snapshots:
            return "", "No data"
        day = max(snapshots)
        senate = {k: v for k, v in snapshots[day].items() if "-" not in k}
        dem = sum(v["opp"] for v in senate.values()) / 1e6
        gop = sum(v["rep"] for v in senate.values()) / 1e6
        return day, f"Senate races: Dem side ${dem:,.0f}M, GOP side ${gop:,.0f}M ({len(senate)} races)"

    rows = []
    rows.append(poll_row("senate_polls", "Senate polls", lambda s: s != "US" and s != "APPROVAL" and "-" not in s, 7,
                         lambda p: f"Newest: {p['pollster']} in {p['state']}, {p['opp']:.0f}-{p['rep']:.0f}."))
    rows.append(poll_row("house_polls", "House district polls", lambda s: "-" in s, 14,
                         lambda p: f"Newest: {p['pollster']} in {p['state']}, {p['opp']:.0f}-{p['rep']:.0f}."))
    gb = result.get("generic_ballot_levels") or {}
    rows.append(poll_row("generic_ballot", "Generic ballot polls", lambda s: s == "US", STALE_POLL_DAYS,
                         lambda p: f"Average D {gb.get('opp', 0):.1f}, R {gb.get('rep', 0):.1f}."))
    ap = result.get("approval_levels") or {}
    rows.append(poll_row("approval", "Trump approval polls", lambda s: s == "APPROVAL", STALE_POLL_DAYS,
                         lambda p: f"Average approve {ap.get('opp', 0):.1f}, disapprove {ap.get('rep', 0):.1f}."))
    vh = [p for p in polls if p.get("feed") == "votehub" and p["end_date"] <= today.isoformat()]
    rows.append(row("votehub", "VoteHub (backup polls)", max((p["end_date"] for p in vh), default=""),
                    f"{len(vh)} VoteHub polls kept that Wikipedia doesn't list"))
    rows.append(row("districts", "House district list", today.isoformat() if "districts" in fetched else "",
                    f"{len(districts)} districts, {sum(1 for d in districts if d.get('uncontested'))} uncontested"))
    rows.append(row("fundraising", "FEC fundraising", *money(extras.get("fundraising", {}))))
    rows.append(row("super_pacs", "Super PAC spending", *money(extras.get("super_pacs", {}))))
    weather = extras.get("weather", {})
    if weather:
        day = max(weather)
        wet = sorted(weather[day].items(), key=lambda kv: -kv[1])[:3]
        summary = "Wettest on Election Day: " + ", ".join(f"{s} {v:.2f}\"" for s, v in wet if v > 0) if wet[0][1] > 0 \
            else "No rain forecast anywhere"
        rows.append(row("weather", "Election Day weather", day, summary, 1))
    else:
        rows.append(row("weather", "Election Day weather", "", "Election Day is too far out to forecast"))
    econ = extras.get("economy", {})
    if econ:
        latest = {k: max(v) for k, v in econ.items()}
        e = result.get("economy") or {}
        rows.append(row("economy", "Economy (FRED)", min(latest.values()),
                        f"S&P 500 {e.get('sp500_change_pct', 0):+.1f}%, 10-year yield {e.get('yield_10y_change', 0):+.2f}, "
                        f"Brent {e.get('brent_change_pct', 0):+.0f}% vs baseline; adds {result.get('economy_shift', 0):+.1f} "
                        f"to Dems", 7))
    else:
        rows.append(row("economy", "Economy (FRED)", "", "No data"))
    return rows


def extras_as_of(extras: dict, d: date) -> dict:
    """Fundraising and super PAC spending from the latest snapshot on or before d (else the
    earliest); weather from d, else from the day before if that day's fetch failed."""
    out = {}
    for key in ("fundraising", "super_pacs"):
        snapshots = extras.get(key, {})
        if snapshots:
            earlier = [k for k in snapshots if k <= d.isoformat()]
            out[key] = snapshots[max(earlier) if earlier else min(snapshots)]
    weather = extras.get("weather", {})
    for day in (d, d - timedelta(1)):
        if day.isoformat() in weather:
            out["weather"] = weather[day.isoformat()]
            break
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


def summarize_house(result: dict) -> None:
    print(
        f"\nHouse {result['as_of']}: Dem control {result['p_dem_control']:.1%}; Dem seats {result['dem_seats_mean']} "
        f"({result['dem_seats_10']}-{result['dem_seats_90']}); both chambers {result.get('p_dem_both', 0):.1%}"
    )
    close = sorted(result["races"], key=lambda r: abs(r["p_opp"] - 0.5))[:40]
    for r in sorted(close, key=lambda r: -r["p_opp"]):
        avg = "  -  " if r["poll_avg"] is None else f"{r['poll_avg']:+5.1f}"
        print(
            f"  {r['state']:5} {r['opp']['name'][:20]:20} vs {r['rep']['name'][:20]:20} p_opp {r['p_opp']:6.1%} "
            f"mean {r['mean_margin']:+6.1f}  lean {r['lean']:+5.1f}  inc {r['incumbent']:4}  over {r['overperformance_shift']:+.1f}  "
            f"polls {avg} (n={r['n_polls']:2})  money {r['fundraising_shift']:+.1f}{'  new lines' if r['new_lines'] else ''}"
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
    house_facts = house.load_facts(HERE / "house.yaml")
    house_cfg = house.config(cfg)

    data = args.data_dir
    data.mkdir(parents=True, exist_ok=True)
    (data / "house").mkdir(exist_ok=True)
    polls = load_json(data / "polls.json", [])
    districts = load_json(data / "house" / "districts.json", [])
    problems: list[str] = []
    house_problems: list[str] = []
    # How each input's fetch went this run (ok, note), for the admin input check.
    fetched: dict[str, tuple[bool, str]] = {}
    if not args.no_scrape:
        try:
            scraped_districts, house_problems = house.fetch_districts(house_facts, verbose=args.verbose)
            if len(scraped_districts) >= 400:  # a broken scrape keeps the last good list
                districts = scraped_districts
                fetched["districts"] = (True, f"{len(scraped_districts)} districts parsed from Wikipedia")
            else:
                house_problems.append(f"house: only {len(scraped_districts)} districts parsed; keeping the last list")
                fetched["districts"] = (False, house_problems[-1])
        except Exception as e:
            house_problems.append(f"house districts: {e}")
            fetched["districts"] = (False, house_problems[-1])
        for p in house_problems:
            print(f"  ! {p}")
    house_facts["races"] = districts
    if not args.no_scrape:
        scraped, problems = scrape.scrape_all(facts["races"], cfg["polls"]["aggregators"], verbose=args.verbose)
        if districts:
            house_polls, house_poll_problems = house.scrape_polls(
                districts, cfg["polls"]["aggregators"], house_facts["election_day"].year, verbose=args.verbose)
            scraped += house_polls
            house_problems += house_poll_problems
        print(f"scraped {len(scraped)} polls; {len(problems)} problems")
        for p in problems:
            print(f"  ! {p}")
        if not scraped:
            print("scrape returned nothing; keeping the last published forecast", file=sys.stderr)
            return 1
        senate_n = sum(1 for p in scraped if p["state"] != "US" and "-" not in p["state"])
        gb_n = sum(1 for p in scraped if p["state"] == "US")
        house_n = sum(1 for p in scraped if "-" in p["state"])
        gb_errors = [p for p in problems if p.startswith("generic ballot")]
        race_errors = [p for p in problems if not p.startswith("generic ballot")]
        fetched["senate_polls"] = (senate_n > 0 and not race_errors, "; ".join(race_errors) or
                                   f"{senate_n} polls read from Wikipedia")
        fetched["generic_ballot"] = (gb_n > 0, "; ".join(gb_errors) or f"{gb_n} polls read from Wikipedia")
        fetched["house_polls"] = (house_n > 0 and not any(p.startswith("house polls") for p in house_problems),
                                  f"{house_n} polls read from Wikipedia")
        approval, approval_problems = extra_sources.scrape_approval(cfg["polls"]["aggregators"])
        fetched["approval"] = (bool(approval) and not approval_problems,
                               "; ".join(approval_problems) or f"{len(approval)} polls read from Wikipedia")
        election = facts["election_day"]
        election = election if isinstance(election, date) else date.fromisoformat(election)
        votehub, votehub_problems = extra_sources.fetch_votehub(
            facts["races"], cfg["polls"]["aggregators"], election.year)
        # RealClearPolling blocks scripts, so its approval table is a saved copy (Jan 2025 to Oct 5 2026).
        rcp = json.loads((HERE / "rcp_approval.json").read_text())
        before = [p for p in merge_polls(polls, scraped + approval) if p.get("feed") is None]
        # Better sources go in later so their rows replace a weaker feed's on a key collision.
        polls = drop_feed_duplicates(merge_polls(merge_polls(merge_polls(polls, votehub), rcp), scraped + approval))
        problems += approval_problems + votehub_problems
        fetched["votehub"] = (bool(votehub) and not votehub_problems,
                              "; ".join(votehub_problems) or f"{len(votehub)} usable polls in the feed")
        since = f"{election.year}-06-01"
        count = lambda ps, s: sum(1 for p in ps if p["end_date"] >= since and s(p["state"]))  # noqa: E731
        print(f"polls since {since} (Wikipedia only -> with RCP and VoteHub; {len(votehub)} VoteHub polls "
              f"before dedupe):")
        for label, s in (("approval", lambda x: x == "APPROVAL"), ("generic ballot", lambda x: x == "US"),
                         ("senate races", lambda x: x not in ("APPROVAL", "US") and "-" not in x),
                         ("house districts", lambda x: "-" in x)):
            print(f"    {label}: {count(before, s)} -> {count(polls, s)}")

    today = args.as_of or datetime.now(EASTERN).date()
    extras = load_json(data / "extras.json", {"fundraising": {}, "weather": {}})
    if not args.no_scrape:
        election = facts["election_day"]
        election = election if isinstance(election, date) else date.fromisoformat(election)
        funds, fund_problems = extra_sources.fetch_fundraising(facts["races"], election.year)
        pacs, pac_problems = extra_sources.fetch_super_pacs(facts["races"], election.year)
        fund_problems += pac_problems
        if districts:
            house_funds, house_fund_problems = extra_sources.fetch_fundraising(districts, election.year, "H")
            house_pacs, house_pac_problems = extra_sources.fetch_super_pacs(districts, election.year, "H")
            funds, pacs = {**funds, **house_funds}, {**pacs, **house_pacs}
            house_problems += house_fund_problems + house_pac_problems
        weather, weather_problems = extra_sources.fetch_weather(election)
        economy, economy_problems = extra_sources.fetch_economy(date(election.year - 1, 1, 1))
        fetched["fundraising"] = (bool(funds), "; ".join(p for p in fund_problems if p.startswith("fundraising"))
                                  or "FEC candidate file read")
        fetched["super_pacs"] = (bool(pacs), "; ".join(pac_problems) or "FEC independent expenditure file read")
        fetched["weather"] = (not weather_problems, "; ".join(weather_problems) or
                              (f"Forecast for {len(weather)} states" if weather else "Election Day not in range yet"))
        fetched["economy"] = (len(economy) == len(extra_sources.ECONOMY_SERIES),
                              "; ".join(economy_problems) or "S&P 500, 10-year yield and Brent read from FRED")
        if funds:
            extras["fundraising"][today.isoformat()] = funds
        if pacs:
            extras.setdefault("super_pacs", {})[today.isoformat()] = pacs
        if weather:
            extras["weather"][today.isoformat()] = weather
        for key, values in economy.items():  # whole daily series; the model only reads days up to as_of
            extras.setdefault("economy", {}).setdefault(key, {}).update(values)
        problems += fund_problems + weather_problems + economy_problems
        # A national poll feed that goes quiet is otherwise silent: the model just leans on old polls.
        for label, state in (("generic ballot", "US"), ("approval", "APPROVAL")):
            newest = max((p["end_date"] for p in polls if p["state"] == state), default="")
            if newest and (today - date.fromisoformat(newest)).days > STALE_POLL_DAYS:
                problems.append(f"{label}: newest poll ends {newest}, over {STALE_POLL_DAYS} days ago")
                print(f"  ! {problems[-1]}")
        for p in fund_problems + weather_problems + economy_problems + approval_problems + votehub_problems:
            print(f"  ! {p}")
    days = [today]
    if args.backfill_from:
        days = [args.backfill_from + timedelta(d) for d in range((today - args.backfill_from).days + 1)]

    history = {h["date"]: h for h in load_json(data / "history.json", [])}
    house_history = {h["date"]: h for h in load_json(data / "house" / "history.json", [])}
    # Every saved day is rebuilt from all the polls known now, so polls that are
    # published or found late (or a new field) fill in the charts going back.
    if not args.backfill_from and history:
        days = [date.fromisoformat(min(history)) + timedelta(d)
                for d in range((today - date.fromisoformat(min(history))).days + 1)]
    result = house_result = None
    for d in days:
        seed = model.day_seed(cfg, d)
        day_extras = extras_as_of(extras, d)
        result, sims = model.simulate(facts, cfg, polls, d, seed=seed, extras=day_extras)
        if districts:
            # Same national and regional draws as the Senate, so the chambers swing together.
            house_result, house_sims = model.simulate(house_facts, house_cfg, polls, d, seed=seed,
                                                      extras=day_extras, shocks=sims)
            both = round(float((sims["dem_control"] & house_sims["dem_control"]).mean()), 4)
            result["p_dem_both"] = house_result["p_dem_both"] = both
            house_history[d.isoformat()] = history_entry(house_result)
        history[d.isoformat()] = history_entry(result)
    assert result is not None
    result.update({
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "config_version": version,
        "problems": problems,
        # The by-day charts, minus per-race odds (only history.json keeps those).
        "history": [{k: v for k, v in history[day].items() if k != "races"} for day in sorted(history)],
        "national_polls": national_polls(polls, min(history), today, cfg),
        "inputs": input_checks(fetched, polls, extras, result, districts, today),
    })
    summarize(result)
    if house_result is not None:
        house_result.update({
            "generated_at": result["generated_at"],
            "config_version": version,
            "problems": house_problems,
            "history": [{k: v for k, v in house_history[day].items() if k != "races"} for day in sorted(house_history)],
        })
        summarize_house(house_result)
    if args.dry_run:
        return 0

    (data / "polls.json").write_text(json.dumps(polls, indent=1) + "\n")
    (data / "extras.json").write_text(json.dumps(extras, indent=1) + "\n")
    (data / "latest.json").write_text(json.dumps(result, indent=1) + "\n")
    (data / "history.json").write_text(json.dumps([history[k] for k in sorted(history)], indent=1) + "\n")
    if house_result is not None:
        (data / "house" / "districts.json").write_text(json.dumps(districts, indent=1) + "\n")
        (data / "house" / "latest.json").write_text(json.dumps(house_result, indent=1) + "\n")
        (data / "house" / "history.json").write_text(
            json.dumps([house_history[k] for k in sorted(house_history)], indent=1) + "\n")
    # The data branch has no app to build; tell Vercel not to deploy it.
    (data / "vercel.json").write_text(json.dumps({"git": {"deploymentEnabled": False}}) + "\n")
    print(f"wrote {data}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
