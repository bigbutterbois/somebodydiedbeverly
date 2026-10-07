import json, urllib.request, urllib.parse
B = "https://gamma-api.polymarket.com"
def get(path, **q):
    url = B + path + "?" + urllib.parse.urlencode(q, doseq=True)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)
events = {}
for tag in ["midterms", "senate-elections", "house", "house-elections", "us-house", "congress", "governor"]:
    off = 0
    while True:
        try:
            page = get("/events", tag_slug=tag, closed="false", limit=200, offset=off)
        except Exception as e:
            print(tag, "err", e); break
        if not page: break
        for e in page: events[e["id"]] = e
        print(tag, off, len(page))
        off += 200
        if off > 5000: break
json.dump(list(events.values()), open("scratch/pm_events.json", "w"))
print("total", len(events))
