"""RealClearPolling: a second source for Senate, generic ballot and approval polls.

Wikipedia misses some polls RCP lists (and the other way round), so run.py
merges both; merge_polls drops a poll seen in both sources (same race, end
date and numbers). Like the other fetchers this never raises: a page that
fails just adds nothing and a line to the problems list.
"""

from __future__ import annotations

import json
import re
from datetime import date
from io import StringIO

import pandas as pd
import requests
from bs4 import BeautifulSoup

import scrape

BASE = "https://www.realclearpolling.com"
# Browser-like headers: RCP serves bots a stripped page.
HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}
INDEX_PAGES = ["/latest-polls/senate", "/elections/senate/2026", "/latest-polls"]
APPROVAL_PAGE = "/polls/approval/donald-trump/approval-rating"
GENERIC_BALLOT_PAGES = ["/polls/state-of-the-union/generic-congressional-vote",
                        "/polls/state-of-the-union/2026-generic-congressional-vote"]


def fetch(path: str) -> str:
    r = requests.get(BASE + path, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.text


def describe(path: str, html: str) -> None:
    """Print what a page looks like, to fit the parser to it."""
    soup = BeautifulSoup(html, "lxml")
    tables = soup.find_all("table")
    nxt = soup.find("script", id="__NEXT_DATA__")
    print(f"rcp: {path}: {len(html)} bytes, {len(tables)} tables, next_data={'yes' if nxt else 'no'}")
    for t in tables[:4]:
        try:
            df = pd.read_html(StringIO(str(t)))[0]
            print(f"    table {df.shape}: {' | '.join(map(str, df.columns))[:200]}")
            for row in df.head(3).itertuples(index=False):
                print(f"      {' | '.join(map(str, row))[:200]}")
        except ValueError:
            pass
    if nxt:
        print(f"    next_data keys: {list(json.loads(nxt.string).get('props', {}).get('pageProps', {}))[:15]}")


def race_links(verbose: bool) -> list[str]:
    links: set[str] = set()
    for path in INDEX_PAGES:
        try:
            html = fetch(path)
        except Exception as e:
            print(f"rcp: {path}: {e}")
            continue
        found = set(re.findall(r'href="(/polls/senate/general/2026/[^"#?]+)"', html))
        if verbose:
            print(f"rcp: {path}: {len(found)} senate race links")
        links |= found
    return sorted(links)


def probe(verbose: bool = True) -> None:
    """Diagnostics only, for the PR dry run while the parser is fitted to RCP's pages."""
    links = race_links(verbose)
    for link in links[:40]:
        print(f"    {link}")
    for path in [APPROVAL_PAGE, *GENERIC_BALLOT_PAGES, *links[:2]]:
        try:
            describe(path, fetch(path))
        except Exception as e:
            print(f"rcp: {path}: {e}")


if __name__ == "__main__":
    probe()
