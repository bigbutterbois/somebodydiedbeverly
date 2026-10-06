"""House races: the 435 districts, their nominees and lean, and district polls, from Wikipedia.

The House forecast runs on the same model as the Senate (model.py), one race per
district. Its facts are scraped every run instead of hand-written like races.yaml:

- fetch_districts reads the per-district table on the cycle's main House page
  (district, 2025 Cook PVI, member, party, candidates). PVI is a district's Dem
  share of the two-party presidential vote (2024 weighted 75%, 2020 25%) minus
  the nation's, so twice it is the same lean, in margin points, that the Senate
  model computes from races.yaml.
- overperformance reads the previous cycle's page for how far each incumbent ran
  ahead of (or behind) their district's lean plus the national House vote.
- scrape_polls reads each state's House page for polls of a district's two nominees.

District ids look like "TX-28"; a state's only district is "AK-AL". They sit in
the "state" field the Senate model keys races by; model.py reads the first two
letters wherever it needs the state.
"""

from __future__ import annotations

import re
import sys
from datetime import date

from io import StringIO

import pandas as pd
from bs4 import BeautifulSoup

import scrape

# State, Wikipedia name, region for correlated error (the Senate's regions).
STATES = {
    "AL": ("Alabama", "south"), "AK": ("Alaska", "west"), "AZ": ("Arizona", "west"),
    "AR": ("Arkansas", "south"), "CA": ("California", "west"), "CO": ("Colorado", "west"),
    "CT": ("Connecticut", "northeast"), "DE": ("Delaware", "northeast"), "FL": ("Florida", "south"),
    "GA": ("Georgia", "south"), "HI": ("Hawaii", "west"), "ID": ("Idaho", "west"),
    "IL": ("Illinois", "midwest"), "IN": ("Indiana", "midwest"), "IA": ("Iowa", "midwest"),
    "KS": ("Kansas", "plains"), "KY": ("Kentucky", "south"), "LA": ("Louisiana", "south"),
    "ME": ("Maine", "northeast"), "MD": ("Maryland", "northeast"), "MA": ("Massachusetts", "northeast"),
    "MI": ("Michigan", "midwest"), "MN": ("Minnesota", "midwest"), "MS": ("Mississippi", "south"),
    "MO": ("Missouri", "midwest"), "MT": ("Montana", "west"), "NE": ("Nebraska", "plains"),
    "NV": ("Nevada", "west"), "NH": ("New Hampshire", "northeast"), "NJ": ("New Jersey", "northeast"),
    "NM": ("New Mexico", "west"), "NY": ("New York", "northeast"), "NC": ("North Carolina", "south"),
    "ND": ("North Dakota", "plains"), "OH": ("Ohio", "midwest"), "OK": ("Oklahoma", "plains"),
    "OR": ("Oregon", "west"), "PA": ("Pennsylvania", "northeast"), "RI": ("Rhode Island", "northeast"),
    "SC": ("South Carolina", "south"), "SD": ("South Dakota", "plains"), "TN": ("Tennessee", "south"),
    "TX": ("Texas", "south"), "UT": ("Utah", "west"), "VT": ("Vermont", "northeast"),
    "VA": ("Virginia", "south"), "WA": ("Washington", "west"), "WV": ("West Virginia", "south"),
    "WI": ("Wisconsin", "midwest"), "WY": ("Wyoming", "west"),
}
BY_NAME = {scrape.norm(name): abbr for abbr, (name, _) in STATES.items()}

PARTIES = {
    "republican": "R", "democratic": "D", "democratic-farmer-labor": "D", "democratic–farmer–labor": "D",
    "dfl": "D", "independent": "I",
}


def district_id(text: str) -> str | None:
    """'Texas 28' / 'Alaska at-large' / 'Texas's 28th congressional district' -> 'TX-28' / 'AK-AL'."""
    t = scrape.norm(text)
    for name in sorted(BY_NAME, key=len, reverse=True):
        if t.startswith(name):
            rest = t[len(name):]
            if "at-large" in rest or "at large" in rest:
                return f"{BY_NAME[name]}-AL"
            m = re.search(r"\d+", rest)
            return f"{BY_NAME[name]}-{int(m.group()):02d}" if m else None
    return None


def parse_pvi(text: str) -> float | None:
    """'R+17' -> -17, 'D+3' -> 3, 'EVEN' -> 0 (Dem-positive, in two-party share points)."""
    t = scrape.norm(text).upper()
    if "EVEN" in t:
        return 0.0
    m = re.search(r"([DR])\s*\+\s*(\d+(?:\.\d+)?)", t)
    if not m:
        return None
    return float(m.group(2)) * (1 if m.group(1) == "D" else -1)


def parse_candidates(cell) -> list[dict]:
    """Candidates in a table cell: one per list item (or line), 'Name (Party) 52.1%'."""
    items = [li.get_text(" ", strip=True) for li in cell.select("li")] or \
        [s for s in cell.get_text("\n", strip=True).split("\n") if "(" in s]
    out = []
    for text in items:
        # Drop footnotes and the leading party color box (and winner check) Wikipedia puts before names.
        text = re.sub(r"\[[^\]]*\]", "", text)
        text = re.sub(r"^[^\w(]+", "", text).strip()
        m = re.match(r"^(?:[✓YN]\s+)?(.+?)\s*\(([^)]+)\)\s*(\d+(?:\.\d+)?)?\s*%?", text)
        if not m:
            continue
        party_text = scrape.norm(m.group(2))
        party = PARTIES.get(party_text) or next(
            (code for word, code in PARTIES.items() if party_text.startswith(word)), None)
        out.append({"name": m.group(1).strip(), "party": party or "other", "party_text": m.group(2),
                    "pct": float(m.group(3)) if m.group(3) else None})
    return out


def district_rows(html: str) -> list[dict]:
    """One row per district from every table with District / PVI / Candidates columns."""
    soup = BeautifulSoup(html, "lxml")
    rows = []
    for table in soup.select("table.wikitable"):
        # The header can take two rows: District | Incumbent | Candidates over Location | PVI | Member ...
        header = [scrape.norm(c.get_text(" ")) for tr in table.select("tr")[:2] for c in tr.find_all("th")]
        if not any("candidates" in h for h in header) or not any("pvi" in h for h in header):
            continue
        for sup in table.select("sup.reference"):
            sup.decompose()
        for tr in table.select("tr"):
            cells = tr.find_all(["th", "td"])
            if len(cells) < 4:
                continue
            did = district_id(cells[0].get_text(" "))
            if not did:
                continue
            texts = [c.get_text(" ", strip=True) for c in cells]
            pvi = next((parse_pvi(t) for t in texts[1:3] if parse_pvi(t) is not None), None)
            cand_cell = cells[-1]
            # Member and party: the first cell after the PVI that names a person, then a party word.
            member = texts[2] if len(texts) > 2 else ""
            party = next((PARTIES[scrape.norm(t)] for t in texts[2:5] if scrape.norm(t) in PARTIES), None)
            status = " ".join(t for t in texts[3:-1] if not re.fullmatch(r"\d{4}.*", t))
            rows.append({"id": did, "pvi": pvi, "member": member, "member_party": party, "status": status,
                         "candidates": parse_candidates(cand_cell), "raw": " | ".join(texts)})
    # A district listed twice (a summary table and a state table) keeps the fuller row.
    best: dict[str, dict] = {}
    for r in rows:
        if r["id"] not in best or len(r["candidates"]) > len(best[r["id"]]["candidates"]):
            best[r["id"]] = r
    return list(best.values())


def last_name(name: str) -> str:
    words = [w for w in re.findall(r"[a-z'-]+", scrape.norm(name)) if w not in {"jr", "sr", "ii", "iii", "iv"}]
    return words[-1] if words else ""


def nominee(cands: list[dict], party: str) -> dict | None:
    """The party's one candidate; with several (a primary still to come), the first listed."""
    of_party = [c for c in cands if c["party"] == party]
    return of_party[0] if of_party else None


def overperformance(year: int, national_margin: float, verbose: bool = False) -> dict[str, dict]:
    """How far each district's winner ran ahead of their district's expected margin in the given
    election: {id: {"member": name, "party": D/R, "over": points toward their own party}}.

    Expected = twice the district's PVI plus the national House vote margin. Uncontested races
    and districts without a PVI are left out.
    """
    html = scrape.fetch_html(f"{year}_United_States_House_of_Representatives_elections")
    out = {}
    for r in district_rows(html):
        d = nominee(r["candidates"], "D")
        rep = nominee(r["candidates"], "R")
        if r["pvi"] is None or not d or not rep or d["pct"] is None or rep["pct"] is None:
            continue
        margin = d["pct"] - rep["pct"]
        winner = d if margin > 0 else rep
        over = margin - (2 * r["pvi"] + national_margin)
        out[r["id"]] = {"member": winner["name"], "party": winner["party"],
                        "over": round(over if winner["party"] == "D" else -over, 2)}
    if verbose:
        print(f"{year} over-performance: {len(out)} contested districts")
    return out


def fetch_districts(facts: dict, verbose: bool = False) -> tuple[list[dict], list[str]]:
    """Race dicts for model.run, one per district, from the main House page."""
    year = facts["election_day"].year
    problems: list[str] = []
    html = scrape.fetch_html(f"{year}_United_States_House_of_Representatives_elections")
    rows = district_rows(html)
    if verbose or len(rows) < 400:  # show what the page's tables look like, to fix the parser
        print(f"house page: {len(rows)} district rows parsed; sample rows:")
        for r in rows[:3] + [r for r in rows if r["id"] in ("TX-28", "AK-AL")]:
            print(f"    {r['raw'][:300]}")
            print(f"      -> {r['candidates']}")
        if len(rows) < 400:
            for table in BeautifulSoup(html, "lxml").select("table.wikitable")[:12]:
                trs = table.select("tr")
                print("    table: " + " || ".join(" | ".join(c.get_text(" ", strip=True)[:40]
                                                         for c in tr.find_all(["th", "td"])) for tr in trs[:3]))
    try:
        past = overperformance(year - 2, facts["national_house_margin_prev"], verbose)
    except Exception as e:
        past, problems = {}, problems + [f"house over-performance: {e}"]
    redrawn = set(facts.get("redrawn_states", []))
    races = []
    for r in sorted(rows, key=lambda r: r["id"]):
        st = r["id"][:2]
        name, region = STATES[st]
        cands = r["candidates"]
        rep, dem = nominee(cands, "R"), nominee(cands, "D")
        opp = dem or next((c for c in cands if c["party"] == "I"), None)
        if r["pvi"] is None:
            problems.append(f"{r['id']}: no PVI ({r['raw'][:120]})")
            continue
        race = {
            "state": r["id"], "name": f"{name} {'at-large' if r['id'].endswith('AL') else int(r['id'][3:])}",
            "region": region, "lean": 2 * r["pvi"], "new_lines": st in redrawn,
            "rep": {"name": rep["name"] if rep else "No Republican"},
            "opp": {"name": opp["name"] if opp else "No Democrat", "party": opp["party"] if opp else "D",
                    "caucus": "D" if not opp or opp["party"] == "D" else "none"},
            "incumbent": "none",
        }
        if not rep and not opp:
            problems.append(f"{r['id']}: no candidates parsed ({r['raw'][:160]})")
            race["uncontested"] = r["member_party"] or ("D" if r["pvi"] > 0 else "R")
        elif not rep:
            race["uncontested"] = "D" if race["opp"]["party"] == "D" else "I"
        elif not opp:
            race["uncontested"] = "R"
        # The incumbent counts only if they are running here (members move after redistricting).
        member_last = last_name(r["member"])
        running = next((c for c in (rep, opp) if c and member_last and last_name(c["name"]) == member_last), None)
        if running:
            race["incumbent"] = running["party"]
            prev = past.get(r["id"])
            if prev and st not in redrawn and last_name(prev["member"]) == member_last:
                # Signed toward the opposition (Dem) side, like every other margin.
                race["overperformance"] = prev["over"] if running["party"] == "D" else -prev["over"]
        races.append(race)
    missing = 435 - len(races)
    if missing:
        problems.append(f"house: {len(races)} districts parsed, {missing} missing")
    if verbose:
        print(f"house: {len(races)} districts; {sum(1 for r in races if 'uncontested' in r)} uncontested; "
              f"{sum(1 for r in races if r['incumbent'] != 'none')} incumbents running; "
              f"{sum(1 for r in races if 'overperformance' in r)} with 2024 over-performance")
        for r in races[:6] + [r for r in races if r["state"] in ("TX-28", "NY-17", "PA-07", "CA-13")]:
            print(f"    {r['state']} lean {r['lean']:+.0f} inc {r['incumbent']} {r['opp']['name']} ({r['opp']['party']}) "
                  f"vs {r['rep']['name']} over {r.get('overperformance')} {r.get('uncontested', '')}")
    return races, problems


def state_page(abbr: str, year: int) -> str:
    name = STATES[abbr][0].replace(" ", "_")
    for title in (f"{year}_United_States_House_of_Representatives_elections_in_{name}",
                  f"{year}_United_States_House_of_Representatives_election_in_{name}"):
        try:
            return scrape.fetch_html(title, retries=2)
        except RuntimeError:
            continue
    raise RuntimeError(f"no {year} House page for {name}")


def scrape_polls(races: list[dict], aggregators: list[str], year: int,
                 verbose: bool = False) -> tuple[list[dict], list[str]]:
    """District polls of each contested race's two nominees from its state's House page."""
    polls, problems = [], []
    contested = [r for r in races if "uncontested" not in r]
    for st in sorted({r["state"][:2] for r in contested}):
        try:
            html = state_page(st, year)
        except Exception as e:
            problems.append(f"house polls {st}: {e}")
            continue
        soup = BeautifulSoup(html, "lxml")
        # Each table belongs to the district named by the nearest heading above it that names one.
        by_district: dict[str, list] = {}
        for table in soup.select("table.wikitable"):
            did = None
            for h in table.find_all_previous(["h2", "h3"]):
                t = scrape.norm(h.get_text())
                if "at-large" in t or "at large" in t:
                    did = f"{st}-AL"
                    break
                m = re.search(r"district\s*(\d+)|(\d+)(?:st|nd|rd|th)\s+district", t)
                if m:
                    did = f"{st}-{int(m.group(1) or m.group(2)):02d}"
                    break
            if did:
                by_district.setdefault(did, []).append(table)
        for race in (r for r in contested if r["state"][:2] == st):
            tables = []
            for table in by_district.get(race["state"], []):
                for sup in table.select("sup.reference"):
                    sup.decompose()
                try:
                    tables.extend(pd.read_html(StringIO(str(table)), flavor="lxml"))
                except ValueError:
                    continue
            required = {"rep": scrape.candidate_pattern(race["rep"]), "opp": scrape.candidate_pattern(race["opp"])}
            best = {}
            for df, cols, idx in scrape.poll_tables(tables, required, {}):
                for poll in scrape.parse_rows(df, cols, idx, year, aggregators):
                    best.setdefault((scrape.norm(poll["pollster"]), poll["end_date"]), poll)
            for poll in best.values():
                polls.append({"state": race["state"], **poll, "others": [],
                              "source": f"https://en.wikipedia.org/wiki/{year}_United_States_House_of_Representatives_elections_in_{STATES[st][0].replace(' ', '_')}"})
            if verbose and best:
                print(f"    {race['state']}: {len(best)} polls")
    print(f"house polls: {len(polls)} from {len({p['state'] for p in polls})} districts")
    return polls, problems


def load_facts(path) -> dict:
    import yaml
    facts = yaml.safe_load(path.read_text())
    if isinstance(facts["election_day"], str):
        facts["election_day"] = date.fromisoformat(facts["election_day"])
    return facts


def config(cfg: dict) -> dict:
    """The House settings: the shared config with the house: section's values laid over it."""
    def merge(base: dict, over: dict) -> dict:
        out = dict(base)
        for k, v in over.items():
            out[k] = merge(base[k], v) if isinstance(v, dict) and isinstance(base.get(k), dict) and k != "races" else v
        return out
    out = merge({k: v for k, v in cfg.items() if k != "house"}, cfg.get("house") or {})
    out.setdefault("races", {})
    if out["races"] is None:
        out["races"] = {}
    return out


if __name__ == "__main__":  # python forecast/house.py: print the parsed districts
    from pathlib import Path
    races, problems = fetch_districts(load_facts(Path(__file__).parent / "house.yaml"), verbose=True)
    for p in problems:
        print(f"  ! {p}", file=sys.stderr)
