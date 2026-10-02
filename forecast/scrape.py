"""Scrape Senate race polls and generic ballot polls from Wikipedia.

Each race page's polling tables are read from Wikipedia's rendered HTML. A table
counts as a general election poll table when it has a date column plus a column
for both of the race's main candidates (rep and opp in races.yaml). Rows are
parsed into one dict per poll; anything that doesn't parse (notes, aggregates,
blank cells) is skipped rather than guessed at.
"""

from __future__ import annotations

import re
import sys
import time
import unicodedata
from datetime import date
from io import StringIO

import pandas as pd
import requests
from bs4 import BeautifulSoup

API = "https://en.wikipedia.org/api/rest_v1/page/html/"
HEADERS = {"User-Agent": "somebodydiedbeverly-forecast/1.0 (https://github.com/bigbutterbois/somebodydiedbeverly)"}
SEARCH_API = "https://en.wikipedia.org/w/api.php"
# Where the generic ballot polls might live; the first page with a usable table wins.
GENERIC_BALLOT_PAGES = [
    "Opinion_polling_for_the_2026_United_States_House_of_Representatives_elections",
    "Generic_ballot_polling_for_the_2026_United_States_House_of_Representatives_elections",
    "2026_United_States_elections",
    "2026_United_States_House_of_Representatives_elections",
]

MONTHS = {
    m: i + 1
    for i, names in enumerate(
        [
            ("jan", "january"), ("feb", "february"), ("mar", "march"), ("apr", "april"),
            ("may",), ("jun", "june"), ("jul", "july"), ("aug", "august"),
            ("sep", "sept", "september"), ("oct", "october"), ("nov", "november"), ("dec", "december"),
        ]
    )
    for m in names
}


def norm(text: str) -> str:
    """Lowercase, strip accents, footnote markers and extra whitespace."""
    text = re.sub(r"\[[^\]]*\]", "", str(text))
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", text).strip().lower()


def wiki_title(race: dict) -> str:
    return race.get("wiki") or f"2026_United_States_Senate_election_in_{race['name'].replace(' ', '_')}"


def fetch_html(title: str, retries: int = 4) -> str:
    for attempt in range(retries):
        try:
            r = requests.get(API + title, headers=HEADERS, timeout=30)
            if r.status_code == 200:
                return r.text
            print(f"  {title}: HTTP {r.status_code}", file=sys.stderr)
            if r.status_code == 404:
                break
        except requests.RequestException as e:
            print(f"  {title}: {e}", file=sys.stderr)
        time.sleep(2 ** attempt)
    raise RuntimeError(f"could not fetch {title}")


def parse_end_date(text: str, default_year: int) -> date | None:
    t = norm(re.sub("[‐-―−]", "-", str(text)))
    years = re.findall(r"\b(20\d\d)\b", t)
    year = int(years[-1]) if years else default_year
    t = re.sub(r"\b20\d\d\b", "", t)
    # Every "Month day" pair, plus bare days that follow a month ("June 4-7").
    tokens = re.findall(r"([a-z]+)\.?\s*(\d{1,2})|(?:-|to)\s*(\d{1,2})\b", t)
    month = day = None
    for mname, mday, bare in tokens:
        if mname and mname in MONTHS:
            month, day = MONTHS[mname], int(mday)
        elif bare and month:
            day = int(bare)
    if not month:
        return None
    try:
        return date(year, month, day)
    except ValueError:
        return None


def parse_sample(text: str) -> tuple[int | None, str | None]:
    t = norm(text)
    m = re.search(r"(\d[\d,]*)", t)
    n = int(m.group(1).replace(",", "")) if m else None
    p = re.search(r"\((lv|rv|a|v)\)", t)
    return n, (p.group(1).upper() if p else None)


def parse_pct(text) -> float | None:
    m = re.search(r"(\d+(?:\.\d+)?)\s*%", norm(text))
    return float(m.group(1)) if m else None


def flatten_columns(df: pd.DataFrame) -> list[str]:
    cols = []
    for c in df.columns:
        parts = c if isinstance(c, tuple) else (c,)
        seen = []
        for p in parts:
            p = norm(p)
            if p and not p.startswith("unnamed") and p not in seen:
                seen.append(p)
        cols.append(" ".join(seen))
    return cols


def candidate_pattern(cand: dict) -> re.Pattern:
    if cand.get("match"):
        return re.compile(cand["match"], re.I)
    last = norm(cand["name"]).split(" ")[-1]
    return re.compile(r"\b" + re.escape(last) + r"\b")


def find_col(cols: list[str], pattern: re.Pattern) -> int | None:
    hits = [i for i, c in enumerate(cols) if pattern.search(c)]
    return hits[0] if len(hits) == 1 else None


def read_tables(html: str, under_heading: str | None = None) -> list[pd.DataFrame]:
    """Every wikitable on the page, optionally only those under a heading containing `under_heading`."""
    soup = BeautifulSoup(html, "lxml")
    out = []
    for table in soup.select("table.wikitable"):
        if under_heading:
            heading = table.find_previous(["h2", "h3", "h4"])
            caption = table.find("caption")
            text = norm((heading.get_text() if heading else "") + " " + (caption.get_text() if caption else ""))
            if under_heading not in text:
                continue
        for sup in table.select("sup.reference"):
            sup.decompose()
        try:
            out.extend(pd.read_html(StringIO(str(table)), flavor="lxml"))
        except ValueError:
            continue
    return out


def poll_tables(tables, required: dict[str, re.Pattern], optional: dict[str, re.Pattern]):
    """Yield (df, cols, column index per candidate key) for tables with every required candidate."""
    for df in tables:
        cols = flatten_columns(df)
        joined = " | ".join(cols)
        if "aggregat" in joined or not any("date" in c for c in cols):
            continue
        idx = {k: find_col(cols, p) for k, p in {**required, **optional}.items()}
        if any(idx[k] is None for k in required):
            continue
        yield df, cols, {k: v for k, v in idx.items() if v is not None}


def parse_rows(df, cols, idx, default_year, aggregators):
    pollster_col = next((i for i, c in enumerate(cols) if "poll" in c or "source" in c), 0)
    date_col = next(i for i, c in enumerate(cols) if "date" in c)
    sample_col = next((i for i, c in enumerate(cols) if "sample" in c), None)
    for _, row in df.iterrows():
        values = list(row.values)
        pollster_raw = str(values[pollster_col])
        pollster = re.sub(r"\[[^\]]*\]", "", pollster_raw).strip()
        if not pollster or pollster.lower() == "nan" or any(str(a) in norm(pollster) for a in aggregators):
            continue
        end = parse_end_date(str(values[date_col]), default_year)
        if not end:
            continue
        n, pop = parse_sample(str(values[sample_col])) if sample_col is not None else (None, None)
        shares = {k: parse_pct(values[i]) for k, i in idx.items()}
        if any(shares[k] is None for k in ("rep", "opp") if k in shares):
            continue
        partisan = re.search(r"\((D|R)\)", pollster)
        yield {
            "pollster": re.sub(r"\s*\((D|R|I)\)\s*$", "", pollster).strip(),
            "sponsor_party": partisan.group(1) if partisan else None,
            "end_date": end.isoformat(),
            "n": n,
            "population": pop,
            **shares,
        }


def scrape_race(race: dict, aggregators: list[str], default_year: int) -> tuple[list[dict], list[str]]:
    title = wiki_title(race)
    tables = read_tables(fetch_html(title))
    required = {"rep": candidate_pattern(race["rep"]), "opp": candidate_pattern(race["opp"])}
    optional = {f"other{i}": candidate_pattern(o) for i, o in enumerate(race.get("others", []))}
    best: dict[tuple, tuple[int, dict]] = {}
    headers = []
    for df, cols, idx in poll_tables(tables, required, optional):
        headers.append(" | ".join(cols))
        for poll in parse_rows(df, cols, idx, default_year, aggregators):
            # A poll can appear in several tables (head-to-head and three-way).
            # Keep the version that names the most of this race's candidates.
            key = (norm(poll["pollster"]), poll["end_date"])
            if key not in best or len(idx) > best[key][0]:
                best[key] = (len(idx), poll)
    if not headers:  # show what was there, to fix candidate name matching
        headers = ["unmatched: " + " | ".join(c) for c in map(flatten_columns, tables) if any("date" in x for x in c)]
    polls = []
    for _, poll in best.values():
        others = [v for k, v in poll.items() if k.startswith("other")]
        polls.append(
            {
                "state": race["state"],
                **{k: v for k, v in poll.items() if not k.startswith("other")},
                "others": others,
                "source": f"https://en.wikipedia.org/wiki/{title}",
            }
        )
    return polls, headers


def search_titles(query: str) -> list[str]:
    try:
        r = requests.get(SEARCH_API, headers=HEADERS, timeout=30, params={
            "action": "query", "list": "search", "srsearch": query, "format": "json", "srlimit": 5})
        return [hit["title"].replace(" ", "_") for hit in r.json()["query"]["search"]]
    except Exception:
        return []


def scrape_generic_ballot(aggregators: list[str], default_year: int) -> list[dict]:
    # Party columns ("Democratic", "Republican"), not candidate names.
    required = {"opp": re.compile(r"^democrat"), "rep": re.compile(r"^republican")}
    found = [t for t in search_titles("2026 generic congressional ballot opinion polling") if "2026" in t]
    titles = GENERIC_BALLOT_PAGES + found
    for title in dict.fromkeys(titles):
        try:
            tables = read_tables(fetch_html(title, retries=1))
        except RuntimeError:
            continue
        best = {}
        for df, cols, idx in poll_tables(tables, required, {}):
            for poll in parse_rows(df, cols, idx, default_year, aggregators):
                best.setdefault((norm(poll["pollster"]), poll["end_date"]), poll)
        if len(best) >= 5:
            recent = sorted(best.values(), key=lambda p: p["end_date"])[-5:]
            print(f"generic ballot: {len(best)} polls from {title}; latest:")
            for p in recent:
                print(f"    {p['end_date']} {p['pollster']}: D {p['opp']} R {p['rep']}")
            return [{"state": "US", **p, "others": [],
                     "source": f"https://en.wikipedia.org/wiki/{title}"} for p in best.values()]
    raise RuntimeError(f"no generic ballot table found in {', '.join(dict.fromkeys(titles))}")


def scrape_all(races: list[dict], aggregators: list[str], verbose: bool = False) -> tuple[list[dict], list[str]]:
    year = date.today().year
    polls, problems = [], []
    for race in races:
        try:
            got, headers = scrape_race(race, aggregators, year)
        except Exception as e:  # one bad page shouldn't sink the run
            problems.append(f"{race['state']}: {e}")
            continue
        polls.extend(got)
        if verbose or not got:
            print(f"{race['state']}: {len(got)} polls from {len(headers)} tables")
            for h in headers:
                print(f"    {h}")
    try:
        polls.extend(scrape_generic_ballot(aggregators, year))
    except Exception as e:
        problems.append(f"generic ballot: {e}")
    return polls, problems
