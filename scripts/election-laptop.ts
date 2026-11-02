// Election night backup, run on Mike's laptop: reads state results feeds from
// the laptop's own connection and posts the counts to the site. Use it when
// the site can't reach a state's feed (some block data-center servers) or the
// once-a-minute refresh stops. The site's own reads skip a state while the
// laptop has fed it in the last 5 minutes.
//
//   npx jiti scripts/election-laptop.ts            # every state with a reader
//   npx jiti scripts/election-laptop.ts KS IA TX   # only these
//
// Asks for the owner email and password once (same login as /login). Set
// SITE=http://localhost:3000 to point it at a local copy.
import { createInterface } from "node:readline/promises";
import { READERS } from "../src/lib/election/sources";
import type { RawCounty } from "../src/lib/election/sources/types";

const SITE = process.env.SITE ?? "https://www.wilfullymisunderstand.com";
const EVERY_MS = 60_000;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

type Tokens = { access_token: string; refresh_token: string; expires_at: number | null };

async function ask(question: string, hidden = false) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  if (hidden) {
    // Don't echo the password.
    const out = rl as unknown as { _writeToOutput: (s: string) => void };
    const write = out._writeToOutput.bind(rl);
    out._writeToOutput = (s: string) => write(s.startsWith(question) ? s : "");
  }
  const answer = await rl.question(question);
  rl.close();
  if (hidden) process.stdout.write("\n");
  return answer.trim();
}

async function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${SITE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path}: ${res.status} ${JSON.stringify(json).slice(0, 200)}`);
  return json as T;
}

async function fetchText(url: string) {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "*/*" }, signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
  return res.text();
}

async function main() {
  const wanted = process.argv.slice(2).map((s) => s.toUpperCase());
  const states = Object.keys(READERS).filter((s) => !wanted.length || wanted.includes(s));
  if (!states.length) throw new Error(`No readers for ${wanted.join(", ") || "any state"}.`);
  console.log(`Feeding ${states.join(", ")} to ${SITE} every ${EVERY_MS / 1000}s. Ctrl-C to stop.`);

  let tokens = await post<Tokens>("/api/app/login", {
    email: process.env.OWNER_EMAIL ?? (await ask("Email: ")),
    password: process.env.OWNER_PASSWORD ?? (await ask("Password: ", true)),
  });

  for (;;) {
    const started = Date.now();
    if (tokens.expires_at && tokens.expires_at * 1000 - Date.now() < 5 * 60_000) {
      tokens = await post<Tokens>("/api/app/refresh", { refresh_token: tokens.refresh_token });
    }
    const batch: { state: string; source: string; counties: RawCounty[] }[] = [];
    await Promise.all(
      states.map(async (state) => {
        const reader = READERS[state]!;
        try {
          batch.push({ state, source: reader.url, counties: await reader.read(fetchText) });
        } catch (e) {
          console.log(`${state}: ${e instanceof Error ? e.message : e}`);
        }
      }),
    );
    if (batch.length) {
      try {
        const { saved } = await post<{ saved: Record<string, number | string> }>(
          "/api/app/election/ingest",
          { states: batch },
          tokens.access_token,
        );
        const time = new Date().toLocaleTimeString();
        console.log(`${time} ${Object.entries(saved).map(([s, v]) => `${s} ${typeof v === "number" ? v.toLocaleString() : v}`).join(" · ")}`);
      } catch (e) {
        console.log(`Posting failed: ${e instanceof Error ? e.message : e}`);
      }
    }
    await new Promise((r) => setTimeout(r, Math.max(5_000, EVERY_MS - (Date.now() - started))));
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
