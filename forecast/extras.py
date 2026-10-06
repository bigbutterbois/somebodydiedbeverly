"""Extra fundamentals: FEC fundraising, approval polls, election-day weather, the economy.

Each fetcher returns plain data and never raises: a source that fails just
contributes nothing that day, and the run says so in its problems list.
"""

from __future__ import annotations

import csv
import io
import re
import zipfile
from datetime import date

import requests

import scrape

FEC_BULK = "https://www.fec.gov/files/bulk-downloads/{year}/weball{yy}.zip"
FEC_IE = "https://www.fec.gov/files/bulk-downloads/{year}/independent_expenditure_{year}.csv"
# Each party's flagship Senate super PAC, by FEC committee ID: Senate Leadership
# Fund (filed as SLF PAC) for Republicans, Senate Majority PAC (SMP) for Democrats.
SUPER_PACS = {"C00571703": "rep", "C00484642": "opp"}
# Spending they route through affiliated super PACs, matched by spender name:
# Senate Majority PAC's ads run through WinSenate.
SUPER_PAC_NAMES = {"winsenate": "opp"}
APPROVAL_PAGES = [
    "Opinion_polling_on_the_second_Trump_presidency",
    "Opinion_polling_on_the_second_Donald_Trump_administration",
]
OPEN_METEO = "https://api.open-meteo.com/v1/forecast"
FRED_CSV = "https://fred.stlouisfed.org/graph/fredgraph.csv"
# Daily market series from FRED (no API key needed): S&P 500 close, 10-year
# Treasury yield (percent) and Brent crude (dollars per barrel).
ECONOMY_SERIES = {"sp500": "SP500", "yield_10y": "DGS10", "brent": "DCOILBRENTEU"}
# VoteHub's open poll feed: a second source for polls Wikipedia hasn't listed (yet).
VOTEHUB = "https://api.votehub.com/polls"

# One point per state for the weather forecast: its largest metro area.
STATE_POINTS = {
    "AL": (33.52, -86.81), "AK": (61.22, -149.90), "AR": (34.75, -92.29), "CO": (39.74, -104.99),
    "DE": (39.74, -75.55), "FL": (28.54, -81.38), "GA": (33.75, -84.39), "ID": (43.62, -116.20),
    "IL": (41.88, -87.63), "IA": (41.59, -93.62), "KS": (37.69, -97.34), "KY": (38.25, -85.76),
    "LA": (29.95, -90.07), "ME": (43.66, -70.26), "MA": (42.36, -71.06), "MI": (42.33, -83.05),
    "MN": (44.98, -93.27), "MS": (32.30, -90.18), "MT": (45.78, -108.50), "NE": (41.26, -95.93),
    "NH": (42.99, -71.46), "NJ": (40.74, -74.17), "NM": (35.08, -106.65), "NC": (35.23, -80.84),
    "OH": (39.96, -82.99), "OK": (35.47, -97.52), "OR": (45.52, -122.68), "RI": (41.82, -71.41),
    "SC": (34.00, -81.03), "SD": (43.54, -96.73), "TN": (36.16, -86.78), "TX": (29.76, -95.37),
    "VA": (37.54, -77.44), "WV": (38.35, -81.63), "WY": (41.14, -104.82),
}

DEM_CODES = {"DEM", "DFL"}

STATE_NAMES = [
    "alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut", "delaware",
    "florida", "georgia", "hawaii", "idaho", "illinois", "indiana", "iowa", "kansas", "kentucky",
    "louisiana", "maine", "maryland", "massachusetts", "michigan", "minnesota", "mississippi",
    "missouri", "montana", "nebraska", "nevada", "new hampshire", "new jersey", "new mexico",
    "new york", "north carolina", "north dakota", "ohio", "oklahoma", "oregon", "pennsylvania",
    "rhode island", "south carolina", "south dakota", "tennessee", "texas", "utah", "vermont",
    "virginia", "washington", "west virginia", "wisconsin", "wyoming", "state",
]


def fetch_fundraising(races: list[dict], year: int) -> tuple[dict, list[str]]:
    """Individual contributions per candidate this cycle, from the FEC's all-candidates file.

    Returns {state: {"rep": dollars, "opp": dollars}} for races where both were found.
    """
    problems = []
    try:
        r = requests.get(FEC_BULK.format(year=year, yy=str(year)[2:]), headers=scrape.HEADERS, timeout=120)
        r.raise_for_status()
        with zipfile.ZipFile(io.BytesIO(r.content)) as z:
            text = z.read(z.namelist()[0]).decode("latin-1")
    except Exception as e:
        return {}, [f"fundraising: {e}"]

    senate = [row for row in csv.reader(io.StringIO(text), delimiter="|") if row and row[0].startswith("S")]

    def find(cand: dict, state: str, party: str) -> float | None:
        last = scrape.norm(cand["name"]).split(" ")[-1].upper()
        first = cand.get("fec_first", "").upper()
        best = None
        for row in senate:
            name, pty, st = row[1].upper(), row[4], row[18]
            if st != state or not re.search(rf"\b{re.escape(last)}\b", name):
                continue
            if first and first not in name:
                continue
            # Some filers have no party on record (UNK); the name match is enough for them.
            if party == "R" and pty not in {"REP", "UNK"} or party == "D" and pty not in DEM_CODES | {"UNK"}:
                continue
            if party == "I" and pty in DEM_CODES | {"REP"}:
                continue
            indiv = float(row[17] or 0)
            best = max(best or 0.0, indiv)
        return best

    out = {}
    for race in races:
        rep = find(race["rep"], race["state"], "R")
        opp = find(race["opp"], race["state"], race["opp"].get("party", "D"))
        if rep and opp:
            out[race["state"]] = {"rep": rep, "opp": opp}
        else:
            in_state = sorted({f"{row[1]} ({row[4]})" for row in senate if row[18] == race["state"]})
            problems.append(f"fundraising: no FEC match for {race['state']} "
                            f"({race['rep']['name'] if not rep else race['opp']['name']}); "
                            f"FEC has: {', '.join(in_state[:12])}")
    print(f"fundraising: {len(out)} of {len(races)} races matched")
    return out, problems


def fetch_super_pacs(races: list[dict], year: int) -> tuple[dict, list[str]]:
    """General-election spending this cycle by each side's flagship super PAC, per Senate race.

    From the FEC's independent expenditure file. Everything a PAC spends in a state's
    Senate general election counts for its own side, whether it backs its candidate
    or attacks the other one. Filings carry the PAC's running total for each
    candidate, so the largest one is used (amended or re-reported spending isn't
    counted twice); without one, distinct expenditures are summed.
    Returns {state: {"rep": dollars, "opp": dollars}}.
    """
    states = {r["state"] for r in races}
    running: dict[tuple[str, ...], float] = {}  # (state, side, candidate id, spender id) -> largest running total
    summed: dict[tuple[str, ...], float] = {}   # same key -> sum of distinct expenditures
    seen: set[tuple[str, ...]] = set()
    others: dict[str, float] = {}  # other spenders in these races, for the log
    try:
        r = requests.get(FEC_IE.format(year=year), headers=scrape.HEADERS, timeout=300, stream=True)
        r.raise_for_status()
        lines = (line.decode("latin-1") for line in r.iter_lines())
        for row in csv.reader(lines):
            # cand_id, cand_name, spe_id, spe_nam, ele_type, state, district, office, party,
            # exp_amo, exp_date, agg_amo, sup_opp, purpose, payee, file_num, amndt_ind, tran_id, ...
            if len(row) < 18 or row[7] != "S" or row[5] not in states or not row[4].upper().startswith("G"):
                continue  # only Senate general elections in this cycle's races (no primaries or runoffs)
            side = SUPER_PACS.get(row[2]) or next(
                (v for k, v in SUPER_PAC_NAMES.items() if k in re.sub(r"[^a-z]", "", row[3].lower())), None)
            if side is None:
                try:
                    others[row[3]] = others.get(row[3], 0.0) + float(row[9] or 0)
                except ValueError:
                    pass
                continue
            try:
                amount, agg = float(row[9] or 0), float(row[11] or 0)
            except ValueError:
                continue
            key = (row[5], side, row[0], row[2])
            running[key] = max(running.get(key, 0.0), agg)
            tran = (row[2], row[17]) if row[17] else tuple(row[:15])
            if tran not in seen:
                seen.add(tran)
                summed[key] = summed.get(key, 0.0) + amount
    except Exception as e:
        return {}, [f"super PACs: {e}"]
    totals = {key: running.get(key) or summed.get(key, 0.0) for key in running.keys() | summed.keys()}
    out: dict[str, dict[str, float]] = {}
    for (state, side, _, _), dollars in totals.items():
        out.setdefault(state, {"rep": 0.0, "opp": 0.0})[side] += dollars
    print("super PACs (SLF / SMP + WinSenate, $M): " + ", ".join(
        f"{s} {v['rep'] / 1e6:.1f}/{v['opp'] / 1e6:.1f}" for s, v in sorted(out.items())))
    print("other big outside spenders in these races ($M): " + ", ".join(
        f"{name} {dollars / 1e6:.1f}" for name, dollars in sorted(others.items(), key=lambda kv: -kv[1])[:12]))
    return out, []


def scrape_approval(aggregators: list[str], year: int | None = None, pages: list[str] | None = None,
                    query: str = "Opinion polling on the second Trump presidency approval",
                    name: str = "trump") -> tuple[list[dict], list[str]]:
    """Presidential approval polls, stored as polls with state APPROVAL (opp = approve, rep = disapprove)."""
    required = {"opp": re.compile(r"^approv"), "rep": re.compile(r"^disapprov")}
    found = [t for t in scrape.search_titles(query) if name in t.lower()]
    year = year or date.today().year
    for title in dict.fromkeys((pages or APPROVAL_PAGES) + found):
        try:
            # State-level approval polls sit on the same page; keep national ones only.
            tables = scrape.read_tables(scrape.fetch_html(title, retries=1), skip_headings=STATE_NAMES)
        except RuntimeError:
            continue
        best = {}
        headers = []
        for df, cols, idx in scrape.poll_tables(tables, required, {}):
            if any("favorab" in c for c in cols):
                continue  # favorability, not job approval
            headers.append(" | ".join(cols))
            for poll in scrape.parse_rows(df, cols, idx, year, aggregators):
                best.setdefault((scrape.norm(poll["pollster"]), poll["end_date"]), poll)
        recent = [p for p in best.values() if p["end_date"] >= f"{year}-01-01"]
        if len(recent) >= 5:
            print(f"approval: {len(best)} polls from {title}, tables:")
            for h in dict.fromkeys(headers):
                print(f"    {h}")
            for p in sorted(recent, key=lambda p: p["end_date"])[-8:]:
                print(f"    {p['end_date']} {p['pollster']}: approve {p['opp']} disapprove {p['rep']} ({p['population']})")
            return [{"state": "APPROVAL", **p, "others": [],
                     "source": f"https://en.wikipedia.org/wiki/{title}"} for p in best.values()], []
    return [], [f"approval: no {name.title()} approval table found"]


def fetch_votehub(races: list[dict], aggregators: list[str], year: int) -> tuple[list[dict], list[str]]:
    """Senate, generic ballot and Trump approval polls from VoteHub, in the same shape as the Wikipedia rows."""
    try:
        r = requests.get(VOTEHUB, headers=scrape.HEADERS, timeout=60)
        r.raise_for_status()
        feed = r.json()
    except Exception as e:
        return [], [f"votehub: {e}"]
    by_name = {f"{year} {race['name']}".lower(): race for race in races}
    best: dict[tuple, dict] = {}
    for p in feed:
        kind, subject = p.get("poll_type"), (p.get("subject") or "").lower()
        shares = {scrape.norm(a["choice"]): a["pct"] for a in p.get("answers") or [] if a.get("pct") is not None}
        if kind == "approval" and subject == "donald trump":
            state, picks = "APPROVAL", {"opp": re.compile(r"^approv"), "rep": re.compile(r"^disapprov")}
        elif kind == "generic-ballot" and subject == str(year):
            state, picks = "US", {"opp": re.compile(r"^dem"), "rep": re.compile(r"^rep")}
        elif kind == "us-senator" and subject in by_name:
            race = by_name[subject]
            state = race["state"]
            picks = {"rep": scrape.candidate_pattern(race["rep"]), "opp": scrape.candidate_pattern(race["opp"]),
                     **{f"other{i}": scrape.candidate_pattern(o) for i, o in enumerate(race.get("others", []))}}
        else:
            continue
        found = {}
        for key, pattern in picks.items():
            hits = [v for c, v in shares.items() if pattern.search(c)]
            if len(hits) == 1:
                found[key] = hits[0]
        if "rep" not in found or "opp" not in found or not p.get("end_date"):
            continue
        # Sponsors go in the name so pollster ratings match ("YouGov/The Economist").
        pollster = "/".join([p.get("pollster") or "", *(p.get("sponsors") or [])]).strip("/")
        if not pollster or any(str(a) in scrape.norm(pollster) for a in aggregators):
            continue
        population = (p.get("population") or "").upper() or None
        poll = {
            "state": state, "pollster": pollster,
            "sponsor_party": {"REP": "R", "DEM": "D"}.get(p.get("partisan") or ""),
            "end_date": p["end_date"], "n": p.get("sample_size"), "population": population,
            "rep": found["rep"], "opp": found["opp"],
            "others": [v for k, v in found.items() if k.startswith("other")],
            "source": p.get("url") or VOTEHUB, "feed": "votehub",
        }
        # One version per poll: likely voters over registered voters over adults.
        key = (state, scrape.norm(pollster), p["end_date"])
        rank = {"LV": 0, "V": 1, "RV": 2, "A": 3}.get(population or "", 4)
        if key not in best or rank < best[key][0]:
            best[key] = (rank, poll)
    polls = [poll for _, poll in best.values()]
    if not polls:
        return [], ["votehub: no usable polls in the feed"]
    return polls, []


def fetch_weather(election_day: date) -> tuple[dict, list[str]]:
    """Forecast election-day rain (inches) per state, once election day is within forecast range."""
    out = {}
    try:
        for state, (lat, lon) in STATE_POINTS.items():
            r = requests.get(OPEN_METEO, headers=scrape.HEADERS, timeout=30, params={
                "latitude": lat, "longitude": lon, "daily": "precipitation_sum",
                "precipitation_unit": "inch", "timezone": "auto", "forecast_days": 16,
            })
            r.raise_for_status()
            daily = r.json()["daily"]
            day = election_day.isoformat()
            if day not in daily["time"]:
                return {}, []  # too far out to forecast yet; not a problem
            out[state] = daily["precipitation_sum"][daily["time"].index(day)] or 0.0
    except Exception as e:
        return {}, [f"weather: {e}"]
    print(f"weather: election-day rain forecast for {len(out)} states")
    return out, []


def fetch_economy(start: date) -> tuple[dict, list[str]]:
    """Daily values since `start`: {"sp500": {date: value}, "yield_10y": {...}, "brent": {...}}."""
    out, problems = {}, []
    for key, series in ECONOMY_SERIES.items():
        try:
            r = requests.get(FRED_CSV, headers=scrape.HEADERS, timeout=60,
                             params={"id": series, "cosd": start.isoformat()})
            r.raise_for_status()
            rows = list(csv.reader(io.StringIO(r.text)))[1:]
            values = {d: float(v) for d, v, *_ in rows if v not in ("", ".")}
            if not values:
                raise ValueError("no data")
            out[key] = values
            last = max(values)
            print(f"economy: {key} ({series}) {len(values)} days, latest {last} = {values[last]}")
        except Exception as e:
            problems.append(f"economy: {series}: {e}")
    return out, problems
