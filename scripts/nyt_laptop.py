#!/usr/bin/env python3
"""Election night feed from the New York Times results pages, run on Mike's laptop.

Every minute it reads the NYT Senate results data for each state, turns it into
county counts, and posts them to the site the same way scripts/election-laptop.ts
does (owner sign-in, then /api/app/election/ingest). The site then treats those
states as fed by the laptop and runs the model on them. Needs only Python 3.9+,
no extra packages.

    python3 scripts/nyt_laptop.py --test 2024 NE   # read the 2024 Nebraska page, print, post nothing
    python3 scripts/nyt_laptop.py --inspect 2024 NE  # show the data file's layout (for fixing the parser)
    python3 scripts/nyt_laptop.py                  # election night: every state, every 60s, posts
    python3 scripts/nyt_laptop.py GA MI KS         # only these states

It asks for the site's owner email and password once (or set OWNER_EMAIL and
OWNER_PASSWORD). SITE=http://localhost:3000 points it at a local copy.

How it finds the data: NYT's page for each race loads a JSON file from
static01.nyt.com. The script reads the page, picks the JSON link out of it, and
falls back to the usual file name if the page doesn't list one. The JSON layout
changes between cycles, so the parser looks for the pieces it needs (county
units, candidates, votes, precincts) by name instead of by exact path. If a
state comes back empty, run --inspect on it and send me the output.
"""

import getpass
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request

SITE = os.environ.get("SITE", "https://www.wilfullymisunderstand.com")
EVERY = 60
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"

DATES = {"2024": ("2024/11/05", "2024-11-05"), "2026": ("2026/11/03", "2026-11-03")}

# The 35 states with a 2026 Senate race (Ohio's and Florida's are specials).
STATES = {
    "AL": "alabama", "AK": "alaska", "AR": "arkansas", "CO": "colorado", "DE": "delaware",
    "FL": "florida", "GA": "georgia", "ID": "idaho", "IL": "illinois", "IA": "iowa",
    "KS": "kansas", "KY": "kentucky", "LA": "louisiana", "ME": "maine", "MA": "massachusetts",
    "MI": "michigan", "MN": "minnesota", "MS": "mississippi", "MT": "montana", "NE": "nebraska",
    "NH": "new-hampshire", "NJ": "new-jersey", "NM": "new-mexico", "NC": "north-carolina",
    "OH": "ohio", "OK": "oklahoma", "OR": "oregon", "RI": "rhode-island", "SC": "south-carolina",
    "SD": "south-dakota", "TN": "tennessee", "TX": "texas", "VA": "virginia",
    "WV": "west-virginia", "WY": "wyoming",
}


# Python from python.org on a Mac often has no certificate list, so every HTTPS
# call fails with CERTIFICATE_VERIFY_FAILED. When that happens the script hands
# the request to the Mac's own curl, which uses the system keychain.
USE_CURL = False


def is_cert_error(e):
    return "CERTIFICATE_VERIFY_FAILED" in str(e)


def curl(url, headers, data=None, timeout=60):
    cmd = ["curl", "-sS", "-L", "--max-time", str(timeout), "-w", "\n%{http_code}"]
    for k, v in headers.items():
        cmd += ["-H", f"{k}: {v}"]
    if data is not None:
        cmd += ["-X", "POST", "--data-binary", "@-"]
    out = subprocess.run(cmd + [url], input=data, capture_output=True, timeout=timeout + 5)
    if out.returncode != 0:
        raise RuntimeError(f"curl: {out.stderr.decode(errors='replace').strip()[:200]}")
    body, _, code = out.stdout.rpartition(b"\n")
    if not code.isdigit() or int(code) >= 400:
        raise RuntimeError(f"HTTP {code.decode()} {body[:200]!r}")
    return body


def fetch(url, headers, data=None, timeout=60):
    global USE_CURL
    if not USE_CURL:
        req = urllib.request.Request(url, data=data, headers=headers, method="POST" if data is not None else "GET")
        try:
            with urllib.request.urlopen(req, timeout=timeout) as res:
                return res.read()
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"HTTP {e.code} {e.read()[:200]!r}")
        except Exception as e:
            if not is_cert_error(e):
                raise
            USE_CURL = True
    return curl(url, headers, data, timeout)


def get(url, timeout=25):
    return fetch(url, {"User-Agent": UA, "Accept": "*/*"}, timeout=timeout).decode("utf-8", "replace")


def post(path, body, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    try:
        return json.loads(fetch(SITE + path, headers, json.dumps(body).encode()) or b"{}")
    except RuntimeError as e:
        raise RuntimeError(f"{path}: {e}")


# ---------------------------------------------------------------- finding the data


def page_urls(year, slug):
    path, _ = DATES[year]
    base = f"https://www.nytimes.com/interactive/{path}/us/elections/results-{slug}-us-senate"
    return [base + ".html", base + "-special.html"]


def data_urls(year, slug, html):
    """The usual file names for this race, then JSON links found in the page."""
    _, day = DATES[year]
    found = re.findall(r"https://static01\.nyt\.com/elections-assets/[^\"'\s\\]+?\.json", html or "")
    found = sorted(set(found), key=lambda u: (slug not in u, "senate" not in u, len(u)))
    guesses = [
        f"https://static01.nyt.com/elections-assets/pages/data/{day}/results-{slug}-us-senate.json",
        f"https://static01.nyt.com/elections-assets/pages/data/{day}/results-{slug}-us-senate-special.json",
    ]
    # The usual file names first: a page can also link other races' data (2024
    # Nebraska's regular-race page links the special election's file).
    return guesses + [u for u in found if u not in guesses]


def load(year, state):
    slug = STATES[state]
    html = ""
    for url in page_urls(year, slug):
        try:
            html = get(url)
            break
        except Exception:
            continue
    errors = []
    for url in data_urls(year, slug, html):
        try:
            data = json.loads(get(url))
            if find_race(data):
                return url, data
        except Exception as e:
            errors.append(f"{url.rsplit('/', 1)[-1]}: {e}")
    raise RuntimeError("no results data found (" + "; ".join(errors[-2:]) + ")")


# ---------------------------------------------------------------- reading it


def walk(node):
    if isinstance(node, dict):
        yield node
        for v in node.values():
            yield from walk(v)
    elif isinstance(node, list):
        for v in node:
            yield from walk(v)


def find_race(data):
    """The race object: the dict holding reporting_units, preferring a US Senate one."""
    races = [d for d in walk(data) if isinstance(d.get("reporting_units"), list)]
    if not races:
        return None

    def score(r):
        text = json.dumps({k: v for k, v in r.items() if isinstance(v, (str, int))}).lower()
        return ("senate" in text) + ("general" in text)

    return max(races, key=score)


def first(d, *keys, default=None):
    for k in keys:
        if isinstance(d, dict) and d.get(k) not in (None, ""):
            return d[k]
    return default


def candidate_names(data, race):
    """Candidate id -> (name, party), from whatever metadata the file carries."""
    names = {}
    for d in walk(data):
        cid = first(d, "nyt_id", "candidate_id", "candidate_key", "id")
        last = first(d, "last_name", "lastName")
        if cid is None or not last:
            continue
        party = first(d, "party")
        if isinstance(party, dict):
            party = first(party, "abbreviation", "abbr", "nyt_abbrev", "name")
        name = f"{first(d, 'first_name', 'firstName', default='')} {last}".strip()
        names[str(cid)] = (name, party)
    return names


def votes_of(c):
    v = first(c, "votes", "vote_count", "total_votes")
    if isinstance(v, dict):
        v = first(v, "total", "count", default=0)
    try:
        return int(v or 0)
    except (TypeError, ValueError):
        return 0


def sum_units(units):
    """One unit adding up every unit's candidate votes (when there is no state-level unit)."""
    totals = {}
    for u in units:
        for c in first(u, "candidates", default=[]) or []:
            cid = str(first(c, "nyt_id", "candidate_id", "candidate_key", "id", default=""))
            t = totals.setdefault(cid, dict(c, votes=0))
            t["votes"] += votes_of(c)
    return {"level": "state", "candidates": list(totals.values())}


def counties(data):
    race = find_race(data)
    if not race:
        raise RuntimeError("no reporting units")
    names = candidate_names(data, race)
    units = race["reporting_units"]
    # The site's baselines are by county, so only county units are sent as is.
    # States NYT reports by town or district (Maine, New Hampshire, Alaska) go
    # in as one statewide row, which the model treats as one big county.
    pick = [u for u in units if str(first(u, "level", default="")).lower() == "county"]
    statewide = not pick
    if statewide:
        pick = [u for u in units if str(first(u, "level", default="")).lower() in ("state", "")][:1] or [sum_units(units)]
    out = []
    for u in pick:
        reported = first(u, "precincts_reporting", "precinctsReporting", "reporting")
        total = first(u, "total_precincts", "precincts_total", "precinctsTotal", "precincts")
        expected = first(u, "total_expected_vote", "expected_votes", "expectedVotes")
        cands = []
        for c in first(u, "candidates", default=[]) or []:
            cid = str(first(c, "nyt_id", "candidate_id", "candidate_key", "id", default=""))
            name, party = names.get(cid, (first(c, "name", default=f"#{cid}"), first(c, "party")))
            if isinstance(party, dict):
                party = first(party, "abbreviation", "name")
            cands.append({"name": name, "party": party, "votes": votes_of(c)})
        row = {
            "name": "Statewide" if statewide else str(first(u, "name", "county_name", default="?")),
            "candidates": cands,
        }
        fips = first(u, "fips_code", "fips", "county_fips")
        if fips and not statewide:
            row["fips"] = str(fips).zfill(5)
        try:
            if total and int(total) > 0:
                row["complete"] = int(reported or 0) >= int(total)
        except (TypeError, ValueError):
            pass
        try:
            if expected and int(expected) > 0:
                row["expected"] = int(expected)
        except (TypeError, ValueError):
            pass
        out.append(row)
    return out


def inspect(data):
    race = find_race(data)
    print("top-level keys:", list(data)[:30] if isinstance(data, dict) else type(data).__name__)
    if not race:
        print("no dict with reporting_units found")
        return
    print("race keys:", [k for k in race if k != "reporting_units"])
    units = race["reporting_units"]
    print("units:", len(units), "levels:", sorted({str(u.get("level")) for u in units}))
    sample = dict(units[-1])
    if isinstance(sample.get("candidates"), list):
        sample["candidates"] = sample["candidates"][:2]
    print("one unit:", json.dumps(sample, indent=1)[:2500])
    names = candidate_names(data, race)
    print("candidate names found:", list(names.items())[:6])


# ---------------------------------------------------------------- main


def main():
    args = sys.argv[1:]
    year = "2026"
    mode = "run"
    if args and args[0] in ("--test", "--inspect"):
        mode = args.pop(0)[2:]
        if args and args[0] in DATES:
            year = args.pop(0)
    wanted = [a.upper() for a in args] or list(STATES)
    bad = [s for s in wanted if s not in STATES]
    if bad:
        sys.exit(f"Unknown state(s): {', '.join(bad)}")

    if mode != "run":
        for state in wanted:
            try:
                url, data = load(year, state)
                print(f"\n{state}: {url}")
                if mode == "inspect":
                    inspect(data)
                    continue
                rows = counties(data)
                total = sum(c["votes"] for r in rows for c in r["candidates"])
                print(f"{len(rows)} units, {total:,} votes")
                for r in rows[:5]:
                    print("  ", r["name"], r.get("fips", ""), "done" if r.get("complete") else "",
                          r.get("expected", ""), [(c["name"], c["party"], c["votes"]) for c in r["candidates"][:3]])
            except Exception as e:
                print(f"\n{state}: FAILED {e}")
        return

    email = os.environ.get("OWNER_EMAIL") or input("Email: ").strip()
    password = os.environ.get("OWNER_PASSWORD") or getpass.getpass("Password: ")
    tokens = post("/api/app/login", {"email": email, "password": password})
    print(f"Feeding {len(wanted)} states from NYT to {SITE} every {EVERY}s. Ctrl-C to stop.")

    while True:
        started = time.time()
        try:
            if tokens.get("expires_at") and tokens["expires_at"] - time.time() < 300:
                tokens = post("/api/app/refresh", {"refresh_token": tokens["refresh_token"]})
        except Exception as e:
            print("token refresh failed:", e)
        batch, failed, waiting = [], [], []
        for state in wanted:
            try:
                url, data = load(year, state)
                rows = counties(data)
                if sum(c["votes"] for r in rows for c in r["candidates"]) > 0:
                    batch.append({"state": state, "source": url, "counties": rows})
                else:
                    waiting.append(state)
            except Exception as e:
                print(f"{state}: {e}")
                failed.append({"state": state, "error": str(e)[:200]})
        # Posts every round, even with nothing new, so Admin -> Election can see
        # the script is alive and which states it couldn't read.
        try:
            res = post(
                "/api/app/election/ingest",
                {"states": batch, "failed": failed, "waiting": waiting},
                tokens["access_token"],
            )
            if batch:
                print(time.strftime("%H:%M:%S"), json.dumps(res.get("saved", res))[:400])
            else:
                print(time.strftime("%H:%M:%S"), "checked in; no states with votes yet")
        except Exception as e:
            print(time.strftime("%H:%M:%S"), "post failed:", e)
        time.sleep(max(5, EVERY - (time.time() - started)))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nStopped.")
