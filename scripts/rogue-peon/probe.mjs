// What each power is worth: seat 0 starts with one power, nobody takes rewards, and we count how often seat 0
// wins a round (all 7) and the final. Baseline is about 25%. Usage: node scripts/rogue-peon/probe.mjs [games] ['<rules json>']
import { runGame } from './sim.mjs';
const N = +(process.argv[2] || 3000), extra = JSON.parse(process.argv[3] || '{}');
const probes = [['baseline', null],
  ['3 Lucky', { enh: 'lucky', n: 3 }], ['3 Heavy', { enh: 'heavy', n: 3 }], ['3 Shielded', { enh: 'shielded', n: 3 }], ['3 Ghost', { enh: 'ghost', n: 3 }],
  ['3 Clearing', { enh: 'clearing', n: 3 }], ['3 Crowned', { enh: 'crowned', n: 3 }], ['3 Twin', { enh: 'twin', n: 3 }],
  ['2 Peek', { sp: 'peek', n: 2 }], ['2 Gift', { sp: 'gift', n: 2 }], ['2 Swap', { sp: 'swap', n: 2 }],
  ['Thick Skin', { tr: 'thick' }], ['Pair Pro', { tr: 'pairpro' }], ["Joker's Wild", { tr: 'jwild' }],
  ['+2 jokers', { card: 'joker', n: 2 }], ['+2 ones', { card: 1, n: 2 }], ['+3 fives', { card: 5, n: 3 }], ['+3 nines', { card: 9, n: 3 }], ['cut 3 tens', { cut: true, n: 3 }]];
for (const [label, probe] of probes) {
  let rw = 0, fw = 0, place = 0;
  for (let i = 0; i < N; i++) {
    const g = runGame('p' + label + i, { policy: ['none', 'none', 'none', 'none'], probe, ...extra });
    g.rounds.forEach(r => { if (r.finish[0] === 0) rw++; place += r.finish.indexOf(0) + 1; });
    if (g.rounds[6].finish[0] === 0) fw++;
  }
  console.log(`${label.padEnd(14)} round wins ${(100 * rw / N / 7).toFixed(1)}%  final ${(100 * fw / N).toFixed(1)}%  avg place ${(place / N / 7).toFixed(2)}`);
}
