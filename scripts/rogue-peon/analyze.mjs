// Balance report for Rogue Peon. Usage: node scripts/rogue-peon/analyze.mjs <label> <games> '<rules json>'
// Rules (all optional): bonus [0,1,2,3], hand 15, numMax 5, deckMax 10, oneClears, heavyAlways,
// randomRewards (everyone picks at random, and it prints each reward's effect), policy ["value"|"random"|"none" x4].
import { runGame } from './sim.mjs';
const [,, label = 'base', N = '1000', rulesJson = '{}'] = process.argv;
const rules = JSON.parse(rulesJson);
const games = []; for (let i = 0; i < +N; i++) games.push(runGame(label + i, rules));
const pct = x => (100 * x).toFixed(1) + '%', avg = a => a.reduce((t, x) => t + x, 0) / a.length;
const R = games.flatMap(g => g.rounds);
// Snowball: place in round r vs place in round r+1 (rounds 1-6 -> next)
const trans = [0, 1, 2, 3].map(() => [0, 0, 0, 0]);
for (const g of games) for (let r = 0; r < 6; r++) { const a = g.rounds[r].finish, b = g.rounds[r + 1].finish; a.forEach((pid, i) => trans[i][b.indexOf(pid)]++); }
console.log(`== ${label} (${N} games) rules=${rulesJson}`);
console.log('P(next round place | this round place), rounds 1-6 -> next:');
trans.forEach((row, i) => { const t = row.reduce((a, b) => a + b); console.log(`  from ${i + 1}: ` + row.map(x => pct(x / t)).join(' ')); });
// Final round: does the game's best performer win?
let r6win = 0, mostWins = 0, r7lead = 0;
for (const g of games) {
  const f7 = g.rounds[6].finish[0];
  if (g.rounds[5].finish[0] === f7) r6win++;
  const w = [0, 0, 0, 0]; g.rounds.slice(0, 6).forEach(r => w[r.finish[0]]++); const m = Math.max(...w); if (w[f7] === m) mostWins++;
  if (g.rounds[6].lead === f7) r7lead++;
}
console.log(`Final won by round-6 winner: ${pct(r6win / games.length)} (25% = no edge) | by a player tied for most wins in 1-6: ${pct(mostWins / games.length)} | by round-7 leader: ${pct(r7lead / games.length)}`);
const leadWin = R.filter(r => r.finish[0] === r.lead).length / R.length;
console.log(`Round winner was the player who led first: ${pct(leadWin)}`);
console.log(`Per round: plays ${avg(R.map(r => r.plays)).toFixed(1)}, tricks ${avg(R.map(r => r.tricks)).toFixed(1)}, passes ${avg(R.map(r => r.passes)).toFixed(1)} (forced ${avg(R.map(r => r.forced)).toFixed(1)}), est. minutes with bots at table pace ${avg(R.map(r => r.secs)).toFixed(0) / 60 | 0}m${(avg(R.map(r => r.secs)) % 60).toFixed(0)}s`);
const last = games.map(g => g.rounds[5]);
console.log(`Deck after round 6: size ${avg(last.flatMap(r => r.decks)).toFixed(1)}, avg number ${avg(last.flatMap(r => r.avgNum)).toFixed(2)} (start 7.00), jokers ${avg(last.flatMap(r => r.jokers)).toFixed(2)}, trinkets ${avg(last.flatMap(r => r.trink.map(t => t.length))).toFixed(2)}, enhancements ${avg(last.flatMap(r => r.enh.map(e => e.length))).toFixed(2)}`);
// Reward impact (only meaningful with randomRewards): round-7 win rate of players who took it in rounds 1-6
if (rules.randomRewards) {
  const key = o => o.k === 'card' ? (o.j ? 'card:joker' : `card:${12 - o.r}`) : o.k === 'act' ? `act:${o.type}` : o.k === 'enh' ? `enh:${o.e}` : o.k === 'sp' ? `sp:${o.sp}` : `tr:${o.t}`;
  const stat = {};
  for (const g of games) {
    const w = g.rounds[6].finish[0], has = [0, 1, 2, 3].map(() => new Set());
    g.took.forEach(([pid, o]) => has[pid].add(key(o)));
    has.forEach((set, pid) => set.forEach(k => { (stat[k] ||= [0, 0])[0]++; if (pid === w) stat[k][1]++; }));
  }
  console.log('Round-7 win rate after taking it (25% = neutral):');
  Object.entries(stat).sort((a, b) => b[1][1] / b[1][0] - a[1][1] / a[1][0]).forEach(([k, [n, w]]) => console.log(`  ${k.padEnd(16)} ${pct(w / n).padStart(6)}  (n=${n})`));
}
if (rules.policy) {
  const w = [0, 0, 0, 0], pl = [0, 0, 0, 0];
  for (const g of games) { w[g.rounds[6].finish[0]]++; g.rounds.forEach(r => r.finish.forEach((pid, i) => { pl[pid] += i + 1; })); }
  console.log('Seat round-7 win rate: ' + w.map((x, i) => `${rules.policy[i]} ${pct(x / games.length)}`).join(' | ') + ' | avg place all rounds: ' + pl.map(x => (x / games.length / 7).toFixed(2)).join(' '));
}
{
  // Alternative scoring: points every round (3/2/1/0), round 7 counts double. Who wins then, and does skill show more?
  const w = [0, 0, 0, 0]; let comeback = 0;
  for (const g of games) {
    const pts = [0, 0, 0, 0];
    g.rounds.forEach((r, ri) => r.finish.forEach((pid, i) => pts[pid] += [3, 2, 1, 0][i] * (ri === 6 ? 2 : 1)));
    const best = Math.max(...pts), win = pts.indexOf(best); w[win]++;
    const pre = [0, 0, 0, 0]; g.rounds.slice(0, 6).forEach(r => r.finish.forEach((pid, i) => pre[pid] += [3, 2, 1, 0][i]));
    if (pre[win] < Math.max(...pre)) comeback++;
  }
  console.log(`Points scoring (3/2/1/0, round 7 double): seat wins ${w.map(x => pct(x / games.length)).join(' ')} | winner was behind before round 7: ${pct(comeback / games.length)}`);
}
