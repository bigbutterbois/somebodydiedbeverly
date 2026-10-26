// Service worker for the home-screen app. It caches nothing, so no
// family-only page is ever stored on a phone; its only job is to show a
// friendly page instead of a browser error when a page can't load offline.

const OFFLINE_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Offline</title>
<style>
  :root { --bg: #121315; --fg: #e9e7e3; --muted: #8e9196; --accent: #3fbfb2; color-scheme: dark; }
  @media (prefers-color-scheme: light) {
    :root { --bg: #fafaf8; --fg: #1b1c1f; --muted: #63666c; --accent: #0f7c73; color-scheme: light; }
  }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--fg);
         font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 24px; box-sizing: border-box; }
  h1 { font-weight: 300; font-size: 1.75rem; margin: 0 0 8px; }
  p { color: var(--muted); margin: 0 0 24px; }
  button { font: inherit; color: var(--accent); background: none; border: 1px solid var(--accent);
           border-radius: 999px; padding: 6px 16px; }
</style>
</head>
<body>
<div>
  <h1>You're offline</h1>
  <p>This needs a connection. Try again once you have signal.</p>
  <button onclick="location.reload()">Try again</button>
</div>
</body>
</html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } }),
    ),
  );
});
