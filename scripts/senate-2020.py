"""Builds src/lib/election/senate2020.json for the election page's County swing
tab: the 2020 Senate margin (Democrat, or the top non-Republican where no
Democrat ran, minus Republican, in points) statewide and by county, for every
state with a 2026 Senate race. Downloads the NYT's 2020 race pages into
~/dev/election/nyt2020/ first. Run on a Mac (NYT blocks cloud machines):

    python3 scripts/senate-2020.py

Alaska's 2020 results are by its old (pre-2022) House districts, which don't
line up with today's, so Alaska gets only its statewide margin.
"""
import json, os, subprocess, urllib.request

STATES = ["alabama", "alaska", "arkansas", "colorado", "delaware", "georgia", "idaho", "illinois",
          "iowa", "kansas", "kentucky", "louisiana", "maine", "massachusetts", "michigan", "minnesota",
          "mississippi", "montana", "nebraska", "new-hampshire", "new-jersey", "new-mexico",
          "north-carolina", "oklahoma", "oregon", "rhode-island", "south-carolina", "south-dakota",
          "tennessee", "texas", "virginia", "west-virginia", "wyoming"]
BASE = "https://static01.nyt.com/elections-assets/2020/data/api/2020-11-03"
OUT = os.path.expanduser("~/dev/election/nyt2020")
os.makedirs(OUT, exist_ok=True)


def get(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.read()
    except Exception:
        # Macs sometimes lack Python's certificates; curl uses the system ones.
        r = subprocess.run(["curl", "-sfL", "--max-time", "60", "-A", "Mozilla/5.0", url], capture_output=True)
        return r.stdout if r.returncode == 0 and r.stdout else None


ok = []
for s in STATES:
    got = False
    for name, url in [(f"{s}-senate.json", f"{BASE}/race-page/{s}/senate.json"),
                      (f"{s}-state.json", f"{BASE}/state-page/{s}.json")]:
        data = get(url)
        if data:
            open(os.path.join(OUT, name), "wb").write(data)
            got = True
            break
    ok.append(s) if got else print("missing:", s)
print(f"saved {len(ok)} of {len(STATES)} states to {OUT}")


def margin(results, parties):
    tot = sum(results.values())
    if not tot:
        return None
    rep = sum(v for k, v in results.items() if parties.get(k) == "republican")
    dems = [k for k in results if parties.get(k) == "democrat"]
    if dems:
        opp = sum(results[k] for k in dems)
    else:
        opp = max((v for k, v in results.items() if parties.get(k) not in ("republican", "write-ins")), default=0)
    return round((opp - rep) / tot * 1000) / 10


out = {}
for s in STATES:
    path = os.path.join(OUT, f"{s}-senate.json")
    if not os.path.exists(path):
        continue
    race = json.load(open(path))["data"]["races"][0]
    st = race["race_id"][:2]
    parties = {c["candidate_key"]: c["party_id"] for c in race["candidates"]}
    counties = {} if st == "AK" else {c["fips"]: margin(c["results"], parties) for c in race["counties"]}
    out[st] = {
        "margin": margin({c["candidate_key"]: c["votes"] for c in race["candidates"]}, parties),
        "counties": {k: v for k, v in counties.items() if v is not None},
    }
dest = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "lib", "election", "senate2020.json")
with open(dest, "w") as f:
    f.write(json.dumps(out, separators=(",", ":")) + "\n")
print("wrote", dest)
