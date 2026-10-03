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
APPROVAL_PAGES = [
    "Opinion_polling_on_the_second_Trump_presidency",
    "Opinion_polling_on_the_second_Donald_Trump_administration",
]
OPEN_METEO = "https://api.open-meteo.com/v1/forecast"
FRED_CSV = "https://fred.stlouisfed.org/graph/fredgraph.csv"
# Daily market series from FRED (no API key needed): S&P 500 close, 10-year
# Treasury yield (percent) and Brent crude (dollars per barrel).
ECONOMY_SERIES = {"sp500": "SP500", "yield_10y": "DGS10", "brent": "DCOILBRENTEU"}

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


def scrape_approval(aggregators: list[str], year: int | None = None, pages: list[str] | None = None,
                    query: str = "Opinion polling on the second Trump presidency approval",
                    name: str = "trump") -> tuple[list[dict], list[str]]:
    """Presidential approval polls, stored as polls with state APPROVAL (opp = approve, rep = disapprove)."""
    required = {"opp": re.compile(r"^approv"), "rep": re.compile(r"^disapprov")}
    found = [t for t in scrape.search_titles(query) if name in t.lower()]
    year = year or date.today().year
    for title in dict.fromkeys((pages or APPROVAL_PAGES) + found):
        try:
            tables = scrape.read_tables(scrape.fetch_html(title, retries=1))
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
