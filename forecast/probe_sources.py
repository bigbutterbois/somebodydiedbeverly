"""Temporary probe: which public poll feeds answer from GitHub Actions.

RealClearPolling returns 403 to automated requests, so this checks other
sources that publish poll lists openly. Deleted once a source is wired in.
"""

import requests

HEADERS = {"User-Agent": "somebodydiedbeverly-forecast/1.0 (https://github.com/bigbutterbois/somebodydiedbeverly)"}
URLS = [
    "https://api.votehub.com/polls?poll_type=approval&subject=Trump",
    "https://api.votehub.com/polls?poll_type=generic-ballot",
    "https://api.votehub.com/polls",
    "https://www.realclearpolling.com/robots.txt",
]

for url in URLS:
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
        print(f"{r.status_code} {url} {r.headers.get('content-type')} {len(r.content)} bytes")
        print("    " + r.text[:600].replace("\n", " "))
    except Exception as e:
        print(f"ERR {url}: {e}")
