"""Temporary probe: what VoteHub's open poll feed holds. Deleted once it is wired in."""

import json
from collections import Counter

import requests

HEADERS = {"User-Agent": "somebodydiedbeverly-forecast/1.0 (https://github.com/bigbutterbois/somebodydiedbeverly)"}
polls = requests.get("https://api.votehub.com/polls", headers=HEADERS, timeout=60).json()
print(f"{len(polls)} polls; keys {sorted(polls[0])}")
print("poll_type:", Counter(p["poll_type"] for p in polls).most_common())
print("population:", Counter(p.get("population") for p in polls).most_common())
print("partisan:", Counter(p.get("partisan") for p in polls).most_common())
print("internal:", Counter(p.get("internal") for p in polls).most_common())
recent = [p for p in polls if (p.get("end_date") or "") >= "2026-06-01"]
print(f"since June 1: {len(recent)}", Counter(p["poll_type"] for p in recent).most_common())
for t in sorted({p["poll_type"] for p in polls}):
    rows = [p for p in recent if p["poll_type"] == t]
    print(f"\n== {t}: {len(rows)} since June; subjects {Counter(p.get('subject') for p in rows).most_common(8)}")
    print("   seat_name:", Counter(p.get("seat_name") for p in rows).most_common(60))
    for p in rows[-3:]:
        print("   " + json.dumps({k: v for k, v in p.items() if k != "url"})[:700])
