// Headless simulations of Rogue Peon: the real game code, 4 bots, and a virtual clock (no waiting).
// The game file is copied to a temp .mjs so Node loads it as a module.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const src = readFileSync(new URL('../../src/app/(site)/rogue-peon/game.js', import.meta.url), 'utf8');
const copy = join(mkdtempSync(join(tmpdir(), 'rogue-peon-')), 'game.mjs');
writeFileSync(copy, src);
let now = 0, seq = 0, timers = new Map();
globalThis.setTimeout = (fn, ms = 0) => { const id = ++seq; timers.set(id, { fn, at: now + ms, id }); return id; };
globalThis.clearTimeout = id => timers.delete(id);
function drain() { let n = 0; while (timers.size && n++ < 1e6) { const t = [...timers.values()].sort((a, b) => a.at - b.at || a.id - b.id)[0]; timers.delete(t.id); now = Math.max(now, t.at); t.fn(); } }
const { mountRoguePeon } = await import(pathToFileURL(copy).href);
const fakeRoot = () => ({ classList: { add() {}, remove() {} }, innerHTML: '', querySelector: () => ({}), addEventListener() {}, removeEventListener() {}, style: { setProperty() {} }, contains: () => true });

export function runGame(seed, rules = {}) {
  const rounds = [];
  timers = new Map(); now = 0;
  let roundStart = 0;
  const g = mountRoguePeon(fakeRoot(), { headless: true, allBots: true, seed, rules,
    onRound: S => { rounds.push({ round: S.round, finish: S.finished.slice(), lead: S.order[0], secs: (now - roundStart) / 1000,
      plays: S.stats.plays, tricks: S.stats.tricks, passes: S.stats.passes, forced: S.stats.forced,
      decks: S.players.map(p => p.deck.length), trink: S.players.map(p => p.trinkets.slice()), enh: S.players.map(p => p.deck.filter(c => c.e).map(c => c.e)), jokers: S.players.map(p => p.deck.filter(c => c.j).length),
      avgNum: S.players.map(p => { const n = p.deck.filter(c => !c.sp && !c.j); return n.reduce((t, c) => t + 12 - c.r, 0) / n.length; }) });
      Object.assign(S.stats, { plays: 0, tricks: 0, passes: 0, forced: 0 }); roundStart = now; } });
  g.state.stats = { plays: 0, tricks: 0, passes: 0, forced: 0, took: [] };
  drain();
  return { rounds, took: g.state.stats.took, final: g.state.players.map(p => p.place) };
}
