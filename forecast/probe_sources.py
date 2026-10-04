"""Temporary probe: which pollster release feeds answer from GitHub Actions and
carry Trump approval numbers. Deleted once a source is wired in."""

import re

import requests

HEADERS = {"User-Agent": "somebodydiedbeverly-forecast/1.0 (https://github.com/bigbutterbois/somebodydiedbeverly)"}
NUM = re.compile(r"(\d{2})\s?(?:%|percent)[^.]{0,60}?\b(approve|disapprove)", re.I)
URLS = {
    "yougov substack": "https://yougovamerica.substack.com/feed",
    "yougov articles": "https://today.yougov.com/topics/politics/articles-reports",
    "emerson": "https://emersoncollegepolling.com/feed/",
    "quinnipiac": "https://poll.qu.edu/",
    "marist": "https://maristpoll.marist.edu/feed/",
    "ap-norc": "https://apnorc.org/feed/",
    "echelon": "https://echeloninsights.com/feed/",
    "quantus": "https://quantus.substack.com/feed",
    "ipsos": "https://www.ipsos.com/en-us/news-polls",
    "gallup": "https://news.gallup.com/poll/203198/presidential-approval-ratings-donald-trump.aspx",
    "rasmussen": "https://www.rasmussenreports.com/",
    "morning consult": "https://pro.morningconsult.com/trackers/donald-trump-approval-rating",
    "nyt": "https://www.nytimes.com/interactive/polls/donald-trump-approval-rating-polls.html",
}
for name, url in URLS.items():
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
        text = r.text
        items = re.findall(r"<item>.*?<title>(.*?)</title>.*?<pubDate>(.*?)</pubDate>", text, re.S)
        hits = NUM.findall(re.sub(r"<[^>]+>", " ", text))
        print(f"{r.status_code} {name}: {len(text)} bytes, {len(items)} feed items, {len(hits)} approval numbers")
        for t, d in items[:6]:
            print(f"    {d[:16]} | {re.sub(r'<!\\[CDATA\\[|\\]\\]>', '', t)[:110]}")
        if hits:
            print(f"    numbers: {hits[:6]}")
    except Exception as e:
        print(f"ERR {name}: {e}")

for q in ("Opinion polling on the second Trump presidency", "Trump approval rating 2026 opinion polling"):
    r = requests.get("https://en.wikipedia.org/w/api.php", headers=HEADERS, timeout=30, params={
        "action": "query", "list": "search", "srsearch": q, "format": "json", "srlimit": 10})
    print(f"wikipedia search '{q}':", [h["title"] for h in r.json()["query"]["search"]])
