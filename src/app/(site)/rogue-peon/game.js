// Rogue Peon: a roguelike take on Scum / Great Dalmuti. Get rid of your cards first; build your deck between rounds.
// Plain DOM on purpose, so the same file runs on the site (RoguePeon.tsx mounts it), in a standalone test page,
// and headless in the balance simulations (scripts/rogue-peon).
//
// Ready for multiplayer:
// - Every decision a person makes goes through act(pid, action) as a small JSON action. Locally it applies
//   right away; a network layer (opts.net) can send the same action to the other players, whose copies apply
//   it in the same order. Shuffles are seeded, so every copy of the game stays in step.
// - S.me is the seat this screen belongs to, and everything is drawn from that seat's point of view.
// - Seats are 'local', 'remote' or 'bot'.

// Deck: one 1, two 2s ... ten 10s, plus 2 jokers (57 cards). Low numbers win. 15 cards dealt a round.
// Internally r is strength (higher beats lower): number n is stored as r = 12 - n, so 1 is r 11 and 10 is r 2.
// A joker on its own is an 11 (r 1); played with other cards it becomes their number.
const NUM = r => 12 - r;
const RN = r => String(NUM(r));
const COLORS = { 1: '#c99a1a', 2: '#7b3fb8', 3: '#2f5fd0', 4: '#11869a', 5: '#1f9a54', 6: '#6f9a15', 7: '#c7801a', 8: '#de5f1c', 9: '#cf3434', 10: '#c22d84' };
const ROUNDS = 7, HAND = 15, MIN_NUMBERS = 18, TOP = 11, ENH_COUNT = 3, REWARD_NUM_MAX = 5;
const BOT_NAMES = ['Otto', 'Juno', 'Bev', 'Marlo', 'Pip', 'Dex', 'Nova', 'Rufus', 'Ines', 'Gus', 'Tilly', 'Hank', 'Mabel', 'Ziggy', 'Lou', 'Wren', 'Boris', 'Cleo', 'Fitz', 'Opal', 'Sal', 'Vera', 'Kip', 'Dot'];
const PLACE = ['1st', '2nd', '3rd', '4th'];
const POS = ['bottom', 'left', 'top', 'right'];
const FROM = { bottom: [0, .42], left: [-.42, 0], top: [0, -.42], right: [.42, 0] };
const PACE = { bot: 900, autoPass: 400, clear: 1100, endRound: 1300, fast: 0 };

/* ---------- Powers ---------- */
// Rarity: c common (grey), u uncommon (blue), r rare (purple), e epic (gold).
const RAR = { c: 'Common', u: 'Uncommon', r: 'Rare', e: 'Epic' };
// Each enhancement reward goes on ENH_COUNT cards. pick: true means you choose them; otherwise they land on random cards.
// Rarities follow how much each power won in the Oct 27 simulations (see the balance report).
const ENH = {
  lucky:    { name: 'Lucky',    glyph: '✤', rar: 'u', desc: 'When this card is dealt to you, draw 1 extra card and put back your worst.' },
  heavy:    { name: 'Heavy',    glyph: '▼', rar: 'c', desc: 'When you lead with it, its whole set counts as 1 better.' },
  shielded: { name: 'Shielded', glyph: '◈', rar: 'c', desc: "Can't be taken from you by a Swap." },
  ghost:    { name: 'Ghost',    glyph: '◌', rar: 'c', desc: 'Vanishes from your hand the first time another player goes out.' },
  clearing: { name: 'Clearing', glyph: '✸', rar: 'e', pick: true, desc: 'Playing it clears the pile, like a 1.' },
  crowned:  { name: 'Crowned',  glyph: '♛', rar: 'u', pick: true, desc: 'Its set beats a set of the same number.' },
  twin:     { name: 'Twin',     glyph: '2×', rar: 'r', pick: true, desc: 'Counts as 2 cards in a set (a Twin 7 + a 7 = three 7s).' },
};
const SPEC = {
  peek: { name: 'Peek', glyph: '◉', rar: 'u', desc: "At the start of a round, look at one opponent's hand." },
  gift: { name: 'Gift', glyph: '❖', rar: 'u', desc: 'At the start of a round, give one card from your hand to any player.' },
  swap: { name: 'Swap', glyph: '⇄', rar: 'r', desc: 'At the start of a round, trade one of your cards for a random card from the player on your left.' },
};
const TRINK = {
  counter:   { name: 'Card Counter', glyph: '#', rar: 'u', desc: 'See how many of each number every opponent holds.' },
  dice:      { name: 'Loaded Dice',  glyph: '⚄', rar: 'u', desc: 'Your rewards show 5 choices instead of 4.' },
  thick:     { name: 'Thick Skin',   glyph: '⬢', rar: 'r', desc: 'Your deal bonus is 1 bigger, even when you finish 1st.' },
  pairpro:   { name: 'Pair Pro',     glyph: '⧈', rar: 'r', desc: 'Your pairs beat pairs of the same number.' },
  jwild:     { name: "Joker's Wild", glyph: '★', rar: 'u', desc: 'A joker you play alone counts as a 1.' },
  picky:     { name: 'Picky',        glyph: '✓', rar: 'e', desc: 'Take up to 3 rewards instead of 2.' },
  luckydraw: { name: 'Lucky Draw',   glyph: '✪', rar: 'e', desc: 'Your rewards show 1 extra choice, and it is always rare or epic.' },
};
const ACT = {
  remove: { name: 'Cut',     glyph: '✂', desc: n => `Remove up to ${n} cards you pick from your deck.` },
  raise:  { name: 'Improve', glyph: '⇩', desc: () => 'A random card in your deck gets 2 better (a 9 becomes a 7).' },
  copy:   { name: 'Copy',    glyph: '⧉', desc: () => 'Add a copy of a card you pick, powers included.' },
  reroll: { name: 'Reroll',  glyph: '?', desc: () => 'A card you pick turns into a random number from 1 to 10.' },
};
// Chance of common / uncommon / rare / epic for each reward slot, by finish. Better finishes get slightly better odds.
const RARITY = [[.65, .23, .09, .03], [.68, .21, .085, .025], [.71, .20, .07, .02], [.74, .18, .065, .015]];
const NUM_CURVE = [0.6, 0.4, 0.2, 0];

const HELP = {
  putback: `<h3>Deal bonus</h3><p>You drew extra cards. Click the cards you want to send back to your deck until you're down to 15, then press Done. Send back your weakest cards.</p><ul><li>2nd place draws 1 extra, 3rd draws 2, 4th draws 3.</li><li>Lucky cards and Thick Skin can add more.</li><li>Round 7 has no bonus for anyone.</li></ul>`,
  specials: `<h3>Special cards</h3><p>Special cards in your deck don't go in your hand. When one is drawn, you can use it before the round starts. Click a card to use it, or press Start round to skip.</p><ul><li><b>Peek:</b> look at one opponent's hand.</li><li><b>Gift:</b> pick a card from your hand and give it to any player.</li><li><b>Swap:</b> pick a card from your hand and trade it for a random card from the player on your left. Shielded cards can't be taken.</li></ul>`,
  play: `<h3>Your goal</h3><p>Get rid of all your cards first.</p><h3>On your turn</h3><ul><li>Click cards to pick them, then press Play. A set is one or more cards of the same number.</li><li>If you lead, play any set. Otherwise play the same number of cards as the pile, but a lower number, or Pass.</li><li>When the pile is a pair or bigger, clicking one card picks the whole set for you.</li><li>Low numbers win: 1 is the best card and 10 is the worst.</li><li>Jokers are wild in sets. A joker alone counts as an 11.</li><li>If nothing in your hand can beat the pile, you pass automatically.</li></ul><h3>The deck</h3><p>Everyone starts with one 1, two 2s, three 3s and so on up to ten 10s, plus 2 jokers (57 cards). You're dealt 15 each round.</p><h3>Clearing the pile</h3><ul><li>If everyone else passes, the pile clears and the last player to play leads.</li><li>A 1 (or a set of 1s) clears the pile right away, and whoever played it leads again.</li><li>Passing doesn't lock you out of the trick.</li></ul><h3>Enhanced cards</h3><p>A small badge on a card means it has a power. Hover the badge to read it.</p>`,
  roundEnd: `<h3>Rewards</h3><ul><li>Click up to 2 rewards (3 with Picky), then press Next round. You don't have to take any.</li><li>Colors show rarity: grey common, blue uncommon, purple rare, gold epic.</li><li>Anyone can get anything, but better finishes get slightly better odds.</li></ul><h3>Kinds of rewards</h3><ul><li><b>Cards:</b> a 1 to 5, or a joker, added to your deck.</li><li><b>Actions:</b> Cut, Improve, Copy, Reroll.</li><li><b>Enhancements:</b> a power on 3 cards. Lucky, Heavy, Shielded and Ghost land on random cards; Crowned, Twin and Clearing go on cards you pick.</li><li><b>Special cards:</b> Peek, Gift, Swap, used at the start of a round.</li><li><b>Trinkets:</b> passive powers that always work. They show at the top of the screen.</li></ul>`,
  apply: `<h3>Using a reward</h3><ul><li><b>Cut:</b> click up to the shown number of cards, then press Confirm. You must keep at least 18 number cards.</li><li><b>Crowned, Twin, Clearing:</b> click up to 3 cards, then press Confirm.</li><li><b>Copy, Reroll:</b> click one card, then press Confirm.</li><li>Skip wastes the reward.</li></ul>`,
  over: `<h3>Game over</h3><p>Round 7's going-out order is the final standing.</p>`,
};

function hashSeed(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

/**
 * Mounts the game in root and returns { destroy, receive, state, debug }.
 * @param {HTMLElement} root
 * @param {{ dev?: boolean, autostart?: boolean, storageKey?: string, headless?: boolean, allBots?: boolean, seed?: string,
 *   rules?: Record<string, any>, net?: { send: (pid: number, action: object) => void },
 *   onRound?: (state: any) => void, onOver?: (state: any) => void }} [opts]
 *   dev shows the test tools; headless, allBots, seed, rules and the callbacks are for scripts/rogue-peon simulations.
 */
export function mountRoguePeon(root, opts = {}) {
  const storageKey = opts.storageKey || 'roguepeon.save.v1';
  let S = null, timer = null;
  const UI = { screen: 'menu', sheet: null, sel: [], pick: [], sp: null, peekAt: -1, dealAnim: false, animDone: 0 };
  root.classList.add('peon');
  root.innerHTML = '<div class="app"></div><div class="fx"></div>';
  const app = root.querySelector('.app'), fx = root.querySelector('.fx');

  /* ---------- Helpers ---------- */
  function rng() { S.rng = (S.rng + 0x6D2B79F5) >>> 0; let t = S.rng; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  function pick(a) { return a[Math.floor(rng() * a.length)]; }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  // Cosmetic wobble for pile layers. Hashed from the layer id so every copy of the game draws the same pile.
  function jitter(id, k) { return (hashSeed(`${S.seed}:${id}:${k}`) % 1000) / 1000 - .5; }
  function card(r, j) { return j ? { id: S.nextId++, r: 1, j: true } : { id: S.nextId++, r }; }
  function byRank(a, b) { return a.r - b.r || (a.j ? 1 : 0) - (b.j ? 1 : 0); }
  function label(c) { return c.sp ? SPEC[c.sp].name : c.j ? 'Joker' : RN(c.r); }
  function isNum(c) { return !c.sp; }
  function has(pid, t) { return S.players[pid].trinkets.includes(t); }
  function auto() { return S.autoUntil > 0 && S.round < S.autoUntil; }
  // A person makes this seat's decisions (bots, and you while "Skip to round 7" runs, decide on their own).
  function human(pid) { const k = S.players[pid].kind; return k === 'remote' || (k === 'local' && !auto()); }
  function name(pid) { return pid === S.me ? 'You' : S.players[pid].name; }
  function verb(pid, v) { return pid === S.me ? v : v + 's'; }
  function wait(ms) { return auto() ? PACE.fast : ms; }
  function log(msg) { S.log.unshift(msg); if (S.log.length > 150) S.log.pop(); }
  function keepScore(c) { return c.j ? 20 : c.r + (c.e ? 1 : 0); }
  function banner(text, sub = '', cls = '') {
    if (!S || auto() || opts.headless) return;
    const el = document.createElement('div');
    el.className = 'banner ' + cls;
    el.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`;
    fx.innerHTML = ''; fx.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }
  function handSize() { return opts.rules?.hand ?? HAND; }
  function resetSel() { UI.sel = []; UI.pick = []; UI.sp = null; UI.peekAt = -1; }

  /* ---------- Sets ---------- */
  // What a set of cards counts as: its strength, how many cards it counts as, and its powers.
  function info(cards, pid, leading) {
    const real = cards.filter(c => !c.j);
    let r = real.length ? real[0].r : (cards.length === 1 && has(pid, 'jwild') ? TOP : 1);
    const count = cards.reduce((t, c) => t + (c.e === 'twin' ? 2 : 1), 0);
    if ((leading || opts.rules?.heavyAlways) && cards.some(c => c.e === 'heavy')) r = Math.min(TOP, r + 1);
    const tie = cards.some(c => c.e === 'crowned') || (has(pid, 'pairpro') && count === 2);
    const clears = (r === TOP && opts.rules?.oneClears !== false) || cards.some(c => c.e === 'clearing');
    return { r, count, tie, clears };
  }
  function beats(inf) { return inf.r > S.pile.r || (inf.r === S.pile.r && inf.tie); }
  function setDesc(cards, inf) { const n = inf.count, r = RN(inf.r); if (cards.length === 1 && cards[0].j && inf.r === 1) return 'a joker'; return n === 1 ? `a ${r}` : n === 2 ? `a pair of ${r}s` : n === 3 ? `three ${r}s` : `${n} ${r}s`; }
  function groups(hand) { const g = {}; for (const c of hand) if (!c.j) (g[c.r] ||= []).push(c); return g; }

  /* ---------- Game flow ---------- */
  function newGame(seed, mode = 'solo') {
    clearTimeout(timer);
    S = { v: 2, seed: seed || String(Math.floor(Math.random() * 1e6)), mode, me: 0, rng: 0, nextId: 1, round: 1, phase: '', players: [], order: [0, 1, 2, 3], turn: 0,
          pile: null, stack: [], anim: 0, clearing: false, clearLeader: -1, clearMsg: '', passed: [], finished: [], ghostDone: false,
          log: [], need: [0, 0, 0, 0], tray: [[], [], [], []], played: [[], [], [], []], moved: [false, false, false, false],
          rewards: null, rstate: ['done', 'done', 'done', 'done'], apply: [[], [], [], []], showBots: false, autoUntil: 0, stats: null };
    S.rng = hashSeed(S.seed);
    const names = ['You', ...shuffle(BOT_NAMES.slice()).slice(0, 3)];
    S.players = names.map((nm, i) => ({ name: nm, kind: i === 0 && !opts.allBots ? 'local' : 'bot', deck: [], hand: [], trinkets: [], place: null, lastPlace: null }));
    for (const p of S.players) { for (let n = 1; n <= (opts.rules?.deckMax ?? 10); n++) for (let k = 0; k < n; k++) p.deck.push(card(12 - n)); p.deck.push(card(1, true), card(1, true)); }
    const pr = opts.rules?.probe; // Simulations: start seat 0 with a power, to measure what it's worth.
    if (pr) {
      const p0 = S.players[0];
      if (pr.enh) for (let i = 0; i < (pr.n || 1); i++) { const pool = p0.deck.filter(c => !c.j && !c.e && (!pr.num || NUM(c.r) === pr.num)); if (pool.length) pick(pool).e = pr.enh; }
      if (pr.tr) p0.trinkets.push(pr.tr);
      if (pr.sp) for (let i = 0; i < (pr.n || 1); i++) p0.deck.push({ id: S.nextId++, sp: pr.sp });
      if (pr.card) for (let i = 0; i < (pr.n || 1); i++) p0.deck.push(pr.card === 'joker' ? card(1, true) : card(12 - pr.card));
      if (pr.cut) for (let i = 0; i < pr.n; i++) { const w = p0.deck.filter(c => !c.j).sort((x, y) => x.r - y.r)[0]; p0.deck = p0.deck.filter(c => c !== w); }
    }
    UI.sheet = null; UI.screen = 'game';
    startRound();
  }

  function startRound() {
    Object.assign(S, { pile: null, stack: [], passed: [], finished: [], clearing: false, ghostDone: false,
      need: [0, 0, 0, 0], tray: [[], [], [], []], played: [[], [], [], []], moved: [false, false, false, false] });
    resetSel();
    if (S.autoUntil && S.round >= S.autoUntil) S.autoUntil = 0;
    S.order = S.round === 1 ? shuffle([0, 1, 2, 3]) : [0, 1, 2, 3].sort((a, b) => S.players[a].lastPlace - S.players[b].lastPlace);
    const lead = S.order[0];
    log(`Round ${S.round} begins. ${name(lead)} ${verb(lead, 'lead')}.`);
    S.players.forEach((p, pid) => {
      p.place = null;
      let bonus = (S.round > 1 && S.round < ROUNDS) ? (opts.rules?.bonus ?? [0, 1, 2, 3])[p.lastPlace - 1] + (has(pid, 'thick') ? 1 : 0) : 0;
      const drawn = [];
      for (const c of shuffle(p.deck.slice())) {
        if (drawn.length >= handSize() + bonus) break;
        if (c.sp) { S.tray[pid].push(c); continue; }
        drawn.push(c);
        if (c.e === 'lucky') bonus++;
      }
      const back = Math.max(0, drawn.length - handSize());
      if (human(pid) && back > 0) { p.hand = drawn.sort(byRank); S.need[pid] = back; }
      else p.hand = drawn.sort((a, b) => keepScore(a) - keepScore(b)).slice(back).sort(byRank);
    });
    S.players.forEach((p, pid) => { if (!human(pid)) botSpecials(pid); });
    UI.dealAnim = true;
    banner(S.round === ROUNDS ? 'Final round' : `Round ${S.round}`, S.round === ROUNDS ? 'Winner takes the game' : `${name(lead)} ${verb(lead, 'lead')}`, S.round === ROUNDS ? 'gold' : '');
    S.phase = 'putback';
    afterStep();
  }
  // Moves past the put-back and special-card steps once every person has finished them.
  function afterStep() {
    if (S.phase === 'putback') {
      if (S.need.some(n => n > 0)) return render();
      S.phase = 'specials';
    }
    if (S.phase === 'specials') {
      if (S.players.some((p, pid) => human(pid) && S.tray[pid].length)) return render();
      beginPlay();
    }
  }

  function beginPlay() { S.turn = 0; S.phase = 'play'; resetSel(); render(); schedule(); }
  function active(pid) { return S.players[pid].hand.length > 0; }
  function curPid() { return S.order[S.turn]; }
  function nextActiveSeat(seat) { for (let i = 1; i <= 4; i++) { const s = (seat + i) % 4; if (active(S.order[s])) return s; } return -1; }
  function leftOf(pid) { return S.order[(S.order.indexOf(pid) + 1) % 4]; }

  /* ---------- Special cards (start of round) ---------- */
  function giveCard(pid, cardId, to) {
    const p = S.players[pid], c = p.hand.find(c => c.id === cardId); if (!c || to === pid) return;
    p.hand = p.hand.filter(x => x !== c); S.players[to].hand.push(c); S.players[to].hand.sort(byRank);
    S.moved[to] = true;
    log(`${name(pid)} gave ${pid === S.me || to === S.me ? `a ${label(c)}` : 'a card'} to ${name(to)}.`);
  }
  function swapCard(pid, cardId) {
    const p = S.players[pid], c = p.hand.find(c => c.id === cardId), left = leftOf(pid), q = S.players[left];
    const pool = q.hand.filter(x => x.e !== 'shielded');
    if (!c || !pool.length) { log(`${name(pid)}'s Swap found nothing to take.`); return; }
    const t = pick(pool);
    p.hand = p.hand.filter(x => x !== c); q.hand = q.hand.filter(x => x !== t);
    p.hand.push(t); q.hand.push(c); p.hand.sort(byRank); q.hand.sort(byRank);
    S.moved[pid] = S.moved[left] = true;
    const mine = pid === S.me || left === S.me;
    log(mine ? `${name(pid)} swapped a ${label(c)} for ${name(left)}'s ${label(t)}.` : `${name(pid)} swapped a card with ${name(left)}.`);
  }
  function botSpecials(pid) {
    const p = S.players[pid];
    for (const c of S.tray[pid]) {
      const worst = () => p.hand.slice().sort((a, b) => keepScore(a) - keepScore(b))[0];
      if (c.sp === 'peek') log(`${name(pid)} peeked at ${name(pick(S.order.filter(q => q !== pid)))}'s hand.`);
      else if (c.sp === 'gift' && worst()) giveCard(pid, worst().id, pick([0, 1, 2, 3].filter(q => q !== pid)));
      else if (c.sp === 'swap' && worst()) swapCard(pid, worst().id);
    }
    S.tray[pid] = [];
  }
  function playTray(pid, a) {
    const c = S.tray[pid][a.i]; if (!c) return;
    if (c.sp === 'peek') log(`${name(pid)} peeked at ${name(a.at)}'s hand.`);
    if (c.sp === 'gift') giveCard(pid, a.card, a.to);
    if (c.sp === 'swap') swapCard(pid, a.card);
    S.tray[pid].splice(a.i, 1);
    if (pid === S.me) resetSel();
    afterStep();
  }

  /* ---------- Play ---------- */
  function canPlay(pid, ids) {
    const cards = S.players[pid].hand.filter(c => ids.includes(c.id));
    if (!cards.length || cards.length !== ids.length) return 'Pick one or more cards.';
    const real = cards.filter(c => !c.j);
    if (real.some(c => c.r !== real[0].r)) return 'A set must all be one number.';
    if (S.pile) {
      const inf = info(cards, pid, false);
      if (inf.count !== S.pile.n) return `Play exactly ${S.pile.n} card${S.pile.n > 1 ? 's' : ''}.`;
      if (!beats(inf)) return `You need lower than ${RN(S.pile.r)}.`;
    }
    return '';
  }

  function play(pid, ids) {
    const p = S.players[pid];
    // Enhanced cards go last so their badges sit on top of the pile.
    const cards = p.hand.filter(c => ids.includes(c.id)).sort((a, b) => byRank(a, b) || (a.e ? 1 : 0) - (b.e ? 1 : 0));
    const inf = info(cards, pid, !S.pile);
    p.hand = p.hand.filter(c => !ids.includes(c.id));
    S.played[pid].push(...ids);
    const id = S.nextId++;
    const layer = { id, by: pid, cards, desc: setDesc(cards, inf), dx: jitter(id, 1) * .07, dy: jitter(id, 2) * .06, rot: jitter(id, 3) * 26, fr: jitter(id, 4) * 60 };
    S.stack.push(layer); S.anim = id;
    S.pile = { r: inf.r, n: inf.count, by: pid };
    S.passed = [];
    if (pid === S.me) UI.sel = [];
    log(`${name(pid)} played ${layer.desc}.`);
    if (S.stats) S.stats.plays++;
    if (!p.hand.length) {
      goOut(pid);
      if (!S.ghostDone) {
        S.ghostDone = true;
        S.order.forEach(q => {
          const pl = S.players[q], g = pl.hand.filter(c => c.e === 'ghost');
          if (q === pid || !g.length) return;
          pl.hand = pl.hand.filter(c => c.e !== 'ghost');
          log(`${g.length} Ghost card${g.length > 1 ? 's' : ''} vanished from ${name(q)}${q === S.me ? 'r' : "'s"} hand.`);
          if (!pl.hand.length) goOut(q);
        });
      }
      const left = S.order.filter(active);
      if (left.length <= 1) {
        if (left.length) S.finished.push(left[0]);
        S.clearing = true; S.clearMsg = 'Round over';
        render(); clearTimeout(timer); timer = setTimeout(endRound, wait(PACE.endRound)); return;
      }
    }
    if (inf.clears) {
      const leader = active(pid) ? pid : S.order[nextActiveSeat(S.order.indexOf(pid))];
      const msg = inf.r === TOP ? '1 clears' : 'Clearing!';
      log(`${msg}: the pile is cleared.`);
      if (!auto() && !opts.headless) setTimeout(() => banner(msg + (inf.r === TOP ? '!' : ''), '', 'gold'), 300);
      return endTrick(leader, msg);
    }
    S.turn = nextActiveSeat(S.turn);
    render(); schedule();
  }
  function goOut(pid) {
    if (S.finished.includes(pid)) return;
    S.finished.push(pid);
    log(`${name(pid)} ${pid === S.me ? 'are' : 'is'} out in ${PLACE[S.finished.length - 1]}.`);
    if (pid === S.me) banner(`You're out ${PLACE[S.finished.length - 1]}`, '', S.finished.length === 1 ? 'gold' : '');
  }

  function pass(pid) {
    S.passed.push(pid);
    if (S.stats) { S.stats.passes++; if (!hasPlay(pid)) S.stats.forced++; }
    if (pid === S.me) UI.sel = [];
    log(`${name(pid)} passed.`);
    const others = S.order.filter(q => active(q) && q !== S.pile.by);
    if (others.every(q => S.passed.includes(q))) {
      const by = S.pile.by;
      const leader = active(by) ? by : S.order[nextActiveSeat(S.order.indexOf(by))];
      return endTrick(leader, 'Cleared');
    }
    S.turn = nextActiveSeat(S.turn);
    render(); schedule();
  }

  function endTrick(leader, msg) {
    S.clearing = true; S.clearLeader = leader; S.clearMsg = msg;
    render(); clearTimeout(timer); timer = setTimeout(finishClear, wait(PACE.clear));
  }
  function finishClear() {
    S.clearing = false; S.stack = []; S.pile = null; S.passed = [];
    S.turn = S.order.indexOf(S.clearLeader);
    if (S.stats) S.stats.tricks++;
    log(`${name(S.clearLeader)} ${verb(S.clearLeader, 'lead')}.`);
    render(); schedule();
  }

  function endRound() {
    S.clearing = false; S.stack = []; S.pile = null; S.passed = [];
    S.finished.forEach((pid, i) => S.players[pid].place = i + 1);
    S.phase = S.round === ROUNDS ? 'over' : 'roundEnd';
    const w = S.finished[0];
    log(S.round === ROUNDS ? `${name(w)} won the game.` : `Round ${S.round} over.`);
    if (opts.onRound) opts.onRound(S);
    if (S.round === ROUNDS) { banner(w === S.me ? 'You win!' : `${name(w)} wins`, 'Game over', 'gold'); try { localStorage.removeItem(storageKey); } catch { /* storage blocked */ } if (opts.onOver) opts.onOver(S); return render(); }
    grantRewards();
    if (S.rstate.every(s => s === 'done')) { render(); clearTimeout(timer); timer = setTimeout(nextRound, wait(PACE.endRound)); return; }
    render();
  }

  /* ---------- Bots ---------- */
  // Cards of number r (plus jokers if needed) that count as exactly n cards. Fewest jokers first.
  function buildSet(g, jokers, r, n) {
    const normals = (g[r] || []).filter(c => c.e !== 'twin'), twins = (g[r] || []).filter(c => c.e === 'twin');
    if (!normals.length && !twins.length) return null;
    for (let j = 0; j <= jokers.length; j++) for (let t = 0; t <= twins.length; t++) {
      const k = n - j - 2 * t;
      if (k >= 0 && k <= normals.length && k + t > 0) return [...normals.slice(0, k), ...twins.slice(0, t), ...jokers.slice(0, j)];
    }
    return null;
  }
  // Exact check, using the cards in the hand: can anything beat the pile? Counts every power.
  function hasPlay(pid) {
    if (!S.pile) return true;
    const hand = S.players[pid].hand, g = groups(hand), jokers = hand.filter(c => c.j);
    for (const r of [...Object.keys(g).map(Number), null]) {
      const normals = r === null ? [] : g[r].filter(c => c.e !== 'twin'), twins = r === null ? [] : g[r].filter(c => c.e === 'twin');
      for (let j = 0; j <= jokers.length; j++) for (let t = 0; t <= twins.length; t++) for (let k = 0; k <= normals.length; k++) {
        if (j + t + k === 0) continue;
        const set = [...normals.slice(0, k), ...twins.slice(0, t), ...jokers.slice(0, j)];
        const crown = normals.find(c => c.e === 'crowned' && !set.includes(c));
        if (crown && k > 0) set[0] = crown;
        const inf = info(set, pid, false);
        if (inf.count === S.pile.n && beats(inf)) return true;
      }
    }
    return false;
  }
  // Multiplayer check, from what everyone else can see: the player's hand size, trinkets, and the cards
  // in their deck they haven't played this round. If no hand that size could beat the pile, they pass.
  function publiclyPossible(pid) {
    if (!S.pile) return true;
    if (S.moved[pid]) return true; // A Gift or Swap put a card we can't account for in their hand.
    const p = S.players[pid], h = p.hand.length, n = S.pile.n;
    const unseen = p.deck.filter(c => isNum(c) && !S.played[pid].includes(c.id));
    const jokers = unseen.filter(c => c.j).length, g = groups(unseen);
    for (const r of Object.keys(g).map(Number)) {
      const cs = g[r], twins = cs.filter(c => c.e === 'twin').length, normals = cs.length - twins;
      const tie = cs.some(c => c.e === 'crowned') || (has(pid, 'pairpro') && n === 2);
      if (!(r > S.pile.r || (r === S.pile.r && tie))) continue;
      const t = Math.min(twins, Math.floor(n / 2)), rest = n - 2 * t;
      if (rest <= normals + jokers && t + rest <= h && t + Math.min(rest, normals) >= 1) return true;
    }
    const jr = n === 1 && has(pid, 'jwild') ? TOP : 1;
    return jokers >= n && n <= h && jr > S.pile.r;
  }
  function botMove(pid) {
    const hand = S.players[pid].hand, g = groups(hand), jokers = hand.filter(c => c.j);
    const ranks = Object.keys(g).map(Number).sort((a, b) => a - b);
    if (!S.pile) {
      // Lead the weakest number, as a whole set. Lone jokers go last.
      if (!ranks.length) return { play: jokers.map(c => c.id) };
      return { play: g[ranks[0]].map(c => c.id) };
    }
    for (const r of ranks) {
      if (r < S.pile.r) continue;
      const set = buildSet(g, jokers, r, S.pile.n);
      if (!set) continue;
      const inf = info(set, pid, false);
      if (inf.count !== S.pile.n || !beats(inf)) continue;
      if (inf.r === TOP && hand.length > 6 && S.pile.r < 8 && rng() < 0.6) return { pass: true };
      return { play: set.map(c => c.id) };
    }
    if (S.pile.n === 1 && jokers.length && hand.length <= 3) {
      const inf = info([jokers[0]], pid, false);
      if (beats(inf)) return { play: [jokers[0].id] };
    }
    return { pass: true };
  }

  /* ---------- Rewards ---------- */
  function rewardRarity(o) { return o.k === 'card' ? (o.j ? 'u' : 'c') : o.k === 'act' ? (o.type === 'copy' ? 'u' : 'c') : (o.k === 'enh' ? ENH[o.e] : o.k === 'sp' ? SPEC[o.sp] : TRINK[o.t]).rar; }
  function rewardInfo(o) {
    if (o.k === 'card') return { name: o.j ? 'Joker' : `A ${RN(o.r)}`, kind: 'Card', desc: o.j ? 'Add a joker: wild in sets, an 11 on its own.' : `Add a ${RN(o.r)} to your deck.` };
    if (o.k === 'act') return { name: ACT[o.type].name + (o.type === 'remove' ? ` ${o.n}` : ''), kind: 'Action', glyph: ACT[o.type].glyph, desc: ACT[o.type].desc(o.n) };
    if (o.k === 'enh') return { name: `${ENH[o.e].name} ×${ENH_COUNT}`, kind: 'Enhancement', glyph: ENH[o.e].glyph, desc: `${ENH[o.e].desc} ${ENH[o.e].pick ? `Goes on ${ENH_COUNT} cards you pick.` : `Goes on ${ENH_COUNT} random cards.`}` };
    if (o.k === 'sp') return { name: SPEC[o.sp].name, kind: 'Special card', glyph: SPEC[o.sp].glyph, desc: SPEC[o.sp].desc };
    return { name: TRINK[o.t].name, kind: 'Trinket', glyph: TRINK[o.t].glyph, desc: TRINK[o.t].desc };
  }
  function rewardNumber(place) {
    const a = NUM_CURVE[place - 1], w = [];
    for (let n = 1; n <= 10; n++) w.push(n > (opts.rules?.numMax ?? REWARD_NUM_MAX) ? 0 : Math.pow(11 - n, a));
    let x = rng() * w.reduce((t, v) => t + v, 0), n = 1;
    while (x > w[n - 1]) { x -= w[n - 1]; n++; }
    return 12 - n;
  }
  function rewardPool(pid, rar) {
    const owned = S.players[pid].trinkets, pool = [];
    const add = (o, w = 1) => { for (let i = 0; i < w; i++) pool.push(o); };
    if (rar === 'c') {
      add({ k: 'card' }, 4);
      add({ k: 'act', type: 'remove' }); add({ k: 'act', type: 'raise' }); add({ k: 'act', type: 'reroll' });
    }
    if (rar === 'u') { add({ k: 'card', j: true }, 2); add({ k: 'act', type: 'copy' }); }
    Object.keys(ENH).filter(e => ENH[e].rar === rar).forEach(e => add({ k: 'enh', e }));
    Object.keys(SPEC).filter(s => SPEC[s].rar === rar).forEach(sp => add({ k: 'sp', sp }));
    Object.keys(TRINK).filter(t => TRINK[t].rar === rar && !owned.includes(t)).forEach(t => add({ k: 'tr', t }));
    return pool;
  }
  function rewardOffer(pid) {
    const place = S.players[pid].place, odds = (opts.rules?.rarity ?? RARITY)[place - 1];
    const lucky = has(pid, 'luckydraw'), n = 4 + (has(pid, 'dice') ? 1 : 0) + (lucky ? 1 : 0), offer = [];
    let guard = 0;
    while (offer.length < n && guard++ < 200) {
      const x = rng();
      // Lucky Draw's extra choice is the last slot, and it is always rare (75%) or epic (25%).
      const rar = lucky && offer.length === n - 1 ? (x < .75 ? 'r' : 'e') : x < odds[0] ? 'c' : x < odds[0] + odds[1] ? 'u' : x < odds[0] + odds[1] + odds[2] ? 'r' : 'e';
      const pool = rewardPool(pid, rar); if (!pool.length) continue;
      const o = { ...pick(pool) };
      if (o.k === 'card' && !o.j) o.r = rewardNumber(place);
      if (o.k === 'act' && o.type === 'remove') o.n = rng() < 0.5 ? 2 : 3;
      const key = x => JSON.stringify({ ...x, n: 0 });
      if (offer.some(x => key(x) === key(o))) continue; // No duplicate choices in one offer.
      offer.push(o);
    }
    return offer;
  }
  function maxPicks(pid) { return has(pid, 'picky') ? 3 : 2; }
  function numberFloor(p) { return p.deck.filter(isNum).length - MIN_NUMBERS; }
  function canUse(p, o) { return !(o.k === 'act' && o.type === 'remove' && numberFloor(p) <= 0); }
  function rewardValue(p, o) {
    if (o.k === 'card') return o.j ? 5 : Math.max(0.5, o.r - 4);
    if (o.k === 'act') return o.type === 'remove' ? Math.max(0, Math.min(o.n, numberFloor(p), p.deck.filter(c => !c.j && !c.e && c.r <= 4).length)) * 2 : o.type === 'raise' ? 3 : o.type === 'copy' ? 4 : 2.5;
    if (o.k === 'enh') return ({ lucky: 4, heavy: 1.5, shielded: 1, ghost: 1, clearing: 6, twin: 3.5, crowned: 2.5 })[o.e];
    if (o.k === 'sp') return 3;
    return ({ counter: 0.5, dice: 2.5, picky: 5, luckydraw: 4 })[o.t] ?? 3.5;
  }
  function botRewards(pid) {
    const p = S.players[pid];
    const policy = opts.rules?.policy?.[pid] ?? (opts.rules?.randomRewards ? 'random' : 'value');
    if (policy === 'none') return;
    if (policy === 'random') {
      shuffle(S.rewards[pid].map((o, i) => i)).filter(i => canUse(p, S.rewards[pid][i])).slice(0, maxPicks(pid))
        .forEach(i => { const o = S.rewards[pid][i]; applyReward(pid, o, null); if (S.stats) S.stats.took.push([pid, o, S.round]); });
      return;
    }
    S.rewards[pid].map((o, i) => [canUse(p, o) ? rewardValue(p, o) : 0, i]).sort((a, b) => b[0] - a[0]).slice(0, maxPicks(pid))
      .forEach(([v, i]) => { if (v >= 2) { const o = S.rewards[pid][i]; applyReward(pid, o, null); log(`${name(pid)} took ${rewardInfo(o).name}.`); if (S.stats) S.stats.took.push([pid, o, S.round]); } });
  }
  function grantRewards() {
    S.rewards = S.players.map((p, pid) => rewardOffer(pid));
    S.apply = [[], [], [], []];
    S.rstate = S.players.map((p, pid) => human(pid) ? 'choose' : 'done');
    S.players.forEach((p, pid) => { if (!human(pid)) botRewards(pid); });
    if (S.rstate[S.me] === 'choose') resetSel();
  }
  // Rewards that need a card choice go through the apply step. ids null means "choose for me" (bots).
  function needsPick(o) { return (o.k === 'enh' && ENH[o.e].pick) || (o.k === 'act' && o.type !== 'raise'); }
  function eligible(p, o) {
    if (o.k === 'enh') return p.deck.filter(c => isNum(c) && !c.j && !c.e);
    if (o.k === 'act' && (o.type === 'copy' || o.type === 'reroll')) return p.deck.filter(c => isNum(c) && !(o.type === 'reroll' && c.j));
    return p.deck.slice();
  }
  function rerollCard(c) {
    const from = label(c);
    c.r = 12 - (1 + Math.floor(rng() * 10));
    return `${from} → ${label(c)}`;
  }
  function improveRandom(p) {
    const pool = p.deck.filter(c => isNum(c) && !c.j && c.r < TOP);
    if (!pool.length) return null;
    const c = pick(pool), from = RN(c.r);
    c.r = Math.min(TOP, c.r + 2);
    return `${from} → ${RN(c.r)}`;
  }
  function applyReward(pid, o, ids) {
    const p = S.players[pid], bot = ids === null, me = pid === S.me;
    const pool = eligible(p, o).sort((a, b) => keepScore(a) - keepScore(b));
    const chosen = bot ? null : p.deck.filter(c => ids.includes(c.id));
    if (o.k === 'card') p.deck.push(card(o.r, o.j));
    else if (o.k === 'tr') p.trinkets.push(o.t);
    else if (o.k === 'sp') p.deck.push({ id: S.nextId++, sp: o.sp });
    else if (o.k === 'act' && o.type === 'raise') { const ch = improveRandom(p); if (ch && me) { log(`Improved a card: ${ch}.`); banner(ch, 'Improved', 'gold'); } }
    else if (o.k === 'act' && o.type === 'remove') {
      const cut = bot ? pool.filter(c => !c.j && !c.sp).slice(0, Math.max(0, Math.min(o.n, numberFloor(p)))) : chosen;
      p.deck = p.deck.filter(c => !cut.includes(c));
    } else if (o.k === 'act' && o.type === 'copy') { const c = bot ? pool[pool.length - 1] : chosen[0]; if (c) p.deck.push({ ...c, id: S.nextId++ }); }
    else if (o.k === 'act' && o.type === 'reroll') { const c = bot ? pool[0] : chosen[0]; if (c) { const ch = rerollCard(c); if (me) { log(`You rerolled a card: ${ch}.`); banner(ch, 'Rerolled', 'gold'); } } }
    else if (o.k === 'enh') {
      let cs = chosen ? chosen.slice(0, ENH_COUNT) : [];
      if (!ENH[o.e].pick) cs = shuffle(pool.slice()).slice(0, ENH_COUNT);
      else if (bot) {
        // Clearing on the weakest cards, Crowned on the best, Twin on the most common number.
        if (o.e === 'clearing') cs = pool.slice(0, ENH_COUNT);
        else if (o.e === 'crowned') cs = pool.slice(-ENH_COUNT);
        else cs = Object.values(groups(pool)).sort((a, b) => b.length - a.length).flat().slice(0, ENH_COUNT);
      }
      cs.forEach(c => { c.e = o.e; });
      if (cs.length && me && !ENH[o.e].pick) { const ls = cs.map(label).sort((a, b) => a - b).join(', '); log(`${ENH[o.e].name} went on ${ls}.`); banner(`${ENH[o.e].glyph} ${ls}`, `${ENH[o.e].name} cards`, 'gold'); }
    }
  }
  function takeRewards(pid, picks) {
    if (S.phase !== 'roundEnd' || S.rstate[pid] !== 'choose') return;
    const p = S.players[pid], offer = S.rewards[pid];
    const ok = [...new Set(picks)].filter(i => offer[i] && canUse(p, offer[i])).slice(0, maxPicks(pid));
    ok.forEach(i => { const o = offer[i]; log(`${name(pid)} took ${rewardInfo(o).name}.`); if (needsPick(o)) S.apply[pid].push(o); else applyReward(pid, o, []); });
    S.apply[pid] = S.apply[pid].filter(o => canUse(p, o) && eligible(p, o).length);
    S.rstate[pid] = S.apply[pid].length ? 'apply' : 'done';
    if (pid === S.me) resetSel();
    roundDone();
  }
  function applyNext(pid, ids) {
    if (S.phase !== 'roundEnd' || S.rstate[pid] !== 'apply') return;
    const o = S.apply[pid].shift();
    if (ids.length) applyReward(pid, o, ids);
    if (!S.apply[pid].length) S.rstate[pid] = 'done';
    if (pid === S.me) resetSel();
    roundDone();
  }
  function roundDone() { if (S.rstate.every(s => s === 'done')) return nextRound(); render(); }
  function multiPick(o) { return o.k === 'enh' || (o.k === 'act' && o.type === 'remove'); }
  function applyLimit(pid, o) {
    const p = S.players[pid];
    if (o.k === 'enh') return Math.min(ENH_COUNT, eligible(p, o).length);
    return o.k === 'act' && o.type === 'remove' ? Math.max(0, Math.min(o.n, numberFloor(p) + p.deck.filter(c => c.sp).length)) : 1;
  }
  function nextRound() { S.rewards = null; S.players.forEach(p => p.lastPlace = p.place); S.round++; startRound(); }

  /* ---------- Actions: every decision a person makes ---------- */
  // { t: 'play', ids } · { t: 'pass' } · { t: 'putback', ids } · { t: 'tray', i, at?, card?, to? } · { t: 'traydone' }
  // { t: 'rewards', picks } · { t: 'apply', ids }
  function act(pid, a) {
    if (opts.net && S.players[pid].kind === 'local') opts.net.send(pid, a);
    perform(pid, a);
  }
  function perform(pid, a) {
    const p = S.players[pid];
    if (a.t === 'play' && S.phase === 'play' && curPid() === pid && !S.clearing && !canPlay(pid, a.ids)) return play(pid, a.ids);
    if (a.t === 'pass' && S.phase === 'play' && curPid() === pid && !S.clearing && S.pile) return pass(pid);
    if (a.t === 'putback' && S.phase === 'putback' && a.ids.length === S.need[pid]) { p.hand = p.hand.filter(c => !a.ids.includes(c.id)); S.need[pid] = 0; if (pid === S.me) resetSel(); return afterStep(); }
    if (a.t === 'tray' && S.phase === 'specials') return playTray(pid, a);
    if (a.t === 'traydone' && S.phase === 'specials') { S.tray[pid] = []; if (pid === S.me) resetSel(); return afterStep(); }
    if (a.t === 'rewards') return takeRewards(pid, a.picks);
    if (a.t === 'apply') return applyNext(pid, a.ids);
  }

  /* ---------- Pacing ---------- */
  function schedule() {
    clearTimeout(timer);
    if (S.clearing || UI.screen !== 'game' || S.phase !== 'play') return;
    const pid = curPid(), p = S.players[pid];
    if (!human(pid)) {
      timer = setTimeout(() => { const m = botMove(pid); if (m.pass) pass(pid); else play(pid, m.play); }, wait(PACE.bot));
    } else if (p.kind === 'local') {
      // Solo: pass for you when nothing in your hand can beat the pile. With other people at the table,
      // only when nobody could, judging from what they can see, so the pass gives nothing away.
      const can = S.mode === 'solo' ? hasPlay(pid) : publiclyPossible(pid);
      if (!can) timer = setTimeout(() => { if (S.phase === 'play' && curPid() === pid && !S.clearing) { log('You had no play.'); act(pid, { t: 'pass' }); } }, wait(PACE.autoPass));
    }
  }

  /* ---------- Save (solo games survive a reload) ---------- */
  function save() { if (!S || S.mode !== 'solo' || S.phase === 'over' || opts.headless) return; try { localStorage.setItem(storageKey, JSON.stringify(S)); } catch { /* storage blocked */ } }
  function loadSave() { try { const s = JSON.parse(localStorage.getItem(storageKey) || 'null'); return s && s.v === 2 && s.phase !== 'over' ? s : null; } catch { return null; } }
  function resume() {
    UI.screen = 'game'; UI.sheet = null; resetSel();
    render();
    if (S.clearing && S.phase === 'play') { if (S.order.filter(active).length <= 1) endRound(); else finishClear(); }
    else if (S.phase === 'roundEnd' && S.rstate.every(s => s === 'done')) nextRound();
    else schedule();
  }

  /* ---------- Render ---------- */
  function cardHTML(c, o = {}) {
    const cls = `card face${c.j ? ' joker' : ''}${c.sp ? ' special' : ''}${o.cls ? ' ' + o.cls : ''}${o.sel ? ' sel' : ''}`;
    let inner, style = o.style || '';
    if (c.sp) inner = `<span class="pip2">${SPEC[c.sp].glyph}</span><span class="tl">${SPEC[c.sp].name}</span>`;
    else {
      const t = c.j ? '★' : NUM(c.r);
      inner = `<span class="ix">${t}</span><span class="pip2">${t}</span><span class="ix br">${t}</span>`;
      if (!c.j) style = `--cc:${COLORS[NUM(c.r)]};` + style;
    }
    if (c.e) inner += `<span class="badge rar-${ENH[c.e].rar}" title="${ENH[c.e].name}: ${ENH[c.e].desc}">${ENH[c.e].glyph}</span>`;
    const aria = label(c) + (c.e ? `, ${ENH[c.e].name}` : '');
    if (o.act) return `<button class="${cls}" data-act="${o.act}" data-id="${c.id}" aria-pressed="${!!o.sel}" aria-label="${aria}" style="${style}" ${o.disabled ? 'disabled' : ''}>${inner}</button>`;
    return `<span class="${cls}" aria-label="${aria}" style="${style}">${inner}</span>`;
  }
  function rewardArt(o) {
    if (o.k === 'card') return cardHTML(o.j ? { j: true, r: 1, id: 0 } : { r: o.r, id: 0 });
    if (o.k === 'enh') return cardHTML({ r: 12 - 7, id: 0, e: o.e }, { cls: 'ghostcard' }).replace('class="badge', 'class="badge big');
    const ri = rewardInfo(o);
    return `<span class="card face ${o.k === 'sp' ? 'special' : 'mystery'}"><span class="pip2">${ri.glyph}</span></span>`;
  }
  function rewardTile(o, i, sel, off) {
    const ri = rewardInfo(o), rar = rewardRarity(o);
    return `<button class="rtile rar-${rar}${sel ? ' sel' : ''}" data-act="reward" data-id="${i}" aria-pressed="${sel}" ${off ? 'disabled' : ''}>
      <span class="rart">${rewardArt(o)}</span>
      <span class="rname">${ri.name}</span>
      <span class="rrar">${RAR[rar]} · ${ri.kind}</span>
      <span class="rdesc">${ri.desc}</span>
      <span class="rcheck" aria-hidden="true">✓</span>
    </button>`;
  }
  function posOf(pid) { return POS[(S.order.indexOf(pid) - S.order.indexOf(S.me) + 4) % 4]; }
  function edgeHTML(pid) {
    const p = S.players[pid], pos = posOf(pid);
    if (!p.hand.length) return '';
    const cards = S.showBots && p.kind === 'bot' ? p.hand.map(c => cardHTML(c, { cls: 'sm' })).join('') : p.hand.map(() => '<span class="card sm back"></span>').join('');
    return `<div class="edge ${pos}"><div class="strip">${cards}</div></div>`;
  }
  function countsText(p) {
    const g = {}; p.hand.forEach(c => { const k = c.j ? '★' : RN(c.r); g[k] = (g[k] || 0) + (c.e === 'twin' ? 2 : 1); });
    return Object.keys(g).sort((a, b) => (a === '★') - (b === '★') || a - b).map(k => `${k}×${g[k]}`).join(' ');
  }
  function plateHTML(pid) {
    const p = S.players[pid], pos = posOf(pid), me = pid === S.me;
    const isTurn = S.phase === 'play' && !S.clearing && curPid() === pid;
    const place = S.finished.indexOf(pid);
    let tag = '';
    if (place >= 0 && S.phase === 'play') tag = `<span class="tag gold">${PLACE[place]}</span>`;
    else if (S.pile && S.passed.includes(pid)) tag = '<span class="tag">Pass</span>';
    const trs = p.trinkets.map(t => TRINK[t].name).join(', ');
    const tip = me ? '' : ` title="Deck ${p.deck.length}${trs ? ` · ${trs}` : ''}"`;
    const cnt = !me && p.hand.length ? `<span class="cnt">${p.hand.length}</span>` : '';
    const cc = !me && has(S.me, 'counter') && p.hand.length && S.phase === 'play' ? `<span class="cc">${countsText(p)}</span>` : '';
    return `<div class="plate ${pos}${isTurn ? ' turn' : ''}"${tip}><span class="nm">${name(pid)}</span>${cnt}${tag}${cc}</div>`;
  }
  function pileHTML() {
    const fresh = S.anim !== UI.animDone ? S.anim : 0;
    const layers = S.stack.slice(-8).map(l => {
      const [fx, fy] = FROM[posOf(l.by)];
      const style = `--dx:calc(var(--T)*${l.dx.toFixed(3)});--dy:calc(var(--T)*${l.dy.toFixed(3)});--rot:${l.rot.toFixed(1)}deg;--fx:calc(var(--T)*${fx});--fy:calc(var(--T)*${fy});--fr:${l.fr.toFixed(1)}deg`;
      return `<div class="layer${l.id === fresh ? ' fresh' : ''}" style="${style}">${l.cards.map(c => cardHTML(c)).join('')}</div>`;
    }).join('');
    return `<div class="pile${S.clearing ? ' sweep' : ''}">${layers}</div>`;
  }
  function captionHTML() {
    if (S.phase !== 'play') return '';
    if (S.clearing) return `<div class="caption">${S.clearMsg}</div>`;
    if (!S.pile) return `<div class="caption"><b>${name(curPid())}</b> ${verb(curPid(), 'lead')}</div>`;
    return '';
  }
  function handHTML() {
    const me = S.players[S.me];
    if (!['play', 'putback', 'specials'].includes(S.phase) || !me.hand.length) return '';
    const n = me.hand.length, mid = (n - 1) / 2, cw = .1, maxW = .74;
    const step = n > 1 ? Math.min(cw * .92, (maxW - cw) / (n - 1)) : 0;
    const deal = UI.dealAnim;
    const cards = me.hand.map((c, i) => {
      const k = i - mid;
      const style = `--x:calc(var(--T)*${(k * step).toFixed(4)});--y:calc(var(--T)*${(k * k * .0009).toFixed(4)});--r:${(k * Math.min(2.4, 26 / n)).toFixed(2)}deg;z-index:${i + 1}${deal ? `;animation-delay:${i * 30}ms` : ''}`;
      return cardHTML(c, { cls: 'big' + (deal ? ' deal' : ''), act: 'sel', sel: UI.sel.includes(c.id), style });
    }).join('');
    return `<div class="hand">${cards}</div>`;
  }
  const waitingHTML = () => '<div class="felt small land"><h2>Waiting for the others</h2></div>';
  function controlsHTML() {
    const me = S.me, P = S.players;
    if (S.phase === 'putback') {
      if (!S.need[me]) return waitingHTML();
      return `<div class="felt small land"><h2>Put back ${S.need[me]}</h2>
        <button class="btn teal" data-act="putback" ${UI.sel.length === S.need[me] ? '' : 'disabled'}>Done</button></div>`;
    }
    if (S.phase === 'specials') {
      if (!S.tray[me].length) return waitingHTML();
      const u = UI.sp, opp = S.order.filter(q => q !== me);
      let body = `<div class="tray">${S.tray[me].map((c, i) => cardHTML({ ...c, id: i }, { act: 'tray', sel: u && u.i === i })).join('')}</div>`;
      if (u && u.sp === 'peek') {
        body += UI.peekAt >= 0
          ? `<div class="muted">${name(UI.peekAt)}'s hand</div><div class="peek">${P[UI.peekAt].hand.map(c => cardHTML(c)).join('')}</div><button class="btn teal" data-act="peekdone">Done</button>`
          : `<div class="row" style="justify-content:center">${opp.map(q => `<button class="btn ghost" data-act="peekat" data-p="${q}">${name(q)}</button>`).join('')}</div>`;
      } else if (u && u.sp === 'gift') {
        body += `<div class="muted">Pick a card from your hand, then who gets it</div><div class="row" style="justify-content:center">${opp.map(q => `<button class="btn ghost" data-act="giftto" data-p="${q}" ${UI.sel.length === 1 ? '' : 'disabled'}>${name(q)}</button>`).join('')}</div>`;
      } else if (u && u.sp === 'swap') {
        body += `<div class="muted">Pick a card from your hand</div><button class="btn ghost" data-act="swapgo" ${UI.sel.length === 1 ? '' : 'disabled'}>Swap with ${name(leftOf(me))}</button>`;
      }
      return `<div class="felt mid land"><h2>Special cards</h2>${body}<button class="btn gold" data-act="startplay">Start round</button></div>`;
    }
    if (S.phase !== 'play' || !P[me].hand.length) return '';
    const myTurn = curPid() === me && human(me) && !S.clearing;
    const why = UI.sel.length ? canPlay(me, UI.sel) : '';
    let hint = '', cls = '';
    if (why) { hint = why; cls = ' bad'; }
    else if (myTurn) { hint = 'Your turn'; cls = ' go'; }
    return `<div class="hint${cls}">${hint}</div>
      <div class="acts">
        <button class="btn red" data-act="pass" ${myTurn && S.pile ? '' : 'disabled'}>Pass</button>
        <button class="btn teal" data-act="play" ${myTurn && UI.sel.length && !why ? '' : 'disabled'}>Play</button>
      </div>`;
  }
  // Round results, rewards and card picks cover the whole stage, Slay the Spire style.
  function screenHTML() {
    const P = S.players, me = S.me;
    if (S.phase !== 'roundEnd' && S.phase !== 'over') return '';
    const over = S.phase === 'over';
    const places = S.finished.map((pid, i) => `<span class="pchip${i === 0 ? ' first' : ''}${pid === me ? ' me' : ''}"><b>${PLACE[i]}</b> ${name(pid)}</span>`).join('');
    const head = `<div class="rhead"><h2>${over ? (S.finished[0] === me ? 'You win the game' : `${name(S.finished[0])} wins the game`) : `Round ${S.round} results`}</h2><div class="places">${places}</div></div>`;
    if (over) return `<div class="rscreen land">${head}<div class="grow"></div><div class="rfoot"><button class="btn ghost" data-act="menu">Menu</button><button class="btn teal" data-act="new">New game</button></div></div>`;
    const st = S.rstate[me];
    if (st === 'choose') {
      const max = maxPicks(me), n = UI.pick.length;
      return `<div class="rscreen land">${head}
        <div class="rsub">Choose up to ${max} reward${max > 1 ? 's' : ''}</div>
        <div class="rgrid">${S.rewards[me].map((o, i) => rewardTile(o, i, UI.pick.includes(i), !canUse(P[me], o))).join('')}</div>
        <div class="rfoot"><button class="btn gold" data-act="next">${n ? `Take ${n} · Next round` : 'Skip · Next round'}</button></div></div>`;
    }
    if (st === 'apply') {
      const o = S.apply[me][0], ri = rewardInfo(o), lim = applyLimit(me, o), multi = multiPick(o);
      const deck = eligible(P[me], o).sort(byRank);
      return `<div class="rscreen land">
        <div class="rhead"><h2>${ri.name}${multi ? '' : ': pick a card'}</h2><div class="muted">${multi ? `${UI.sel.length} / ${lim} picked` : ri.desc}</div></div>
        <div class="picker">${deck.map(c => cardHTML(c, { act: 'pick', sel: UI.sel.includes(c.id) })).join('')}</div>
        <div class="rfoot"><button class="btn ghost" data-act="skipapply">Skip</button><div class="grow"></div><button class="btn teal" data-act="apply" ${UI.sel.length && (multi ? UI.sel.length <= lim : UI.sel.length === 1) ? '' : 'disabled'}>Confirm</button></div></div>`;
    }
    return `<div class="rscreen land">${head}<div class="grow"></div><div class="rsub">Waiting for the others</div><div class="grow"></div></div>`;
  }
  function helpHTML() {
    const ph = !S || UI.screen === 'menu' ? 'menu' : S.phase === 'roundEnd' && S.rstate[S.me] === 'apply' ? 'apply' : S.phase;
    if (ph === 'menu') return HELP.play + HELP.roundEnd;
    return (HELP[ph] || HELP.play) + (ph === 'play' ? '' : `<h3>Playing a round</h3><p>Lead any set of one number, or beat the pile with the same number of cards and a lower number. 1 is best, 10 is worst, 1s clear the pile, and jokers are wild in sets.</p>`);
  }
  function sheetHTML() {
    if (!UI.sheet) return '';
    let title = '', body = '';
    if (UI.sheet === 'deck') {
      const me = S.players[S.me];
      title = `Your deck · ${me.deck.length} cards`;
      const g = groups(me.deck.filter(isNum)), jk = me.deck.filter(c => c.j), sp = me.deck.filter(c => c.sp);
      const row = (lbl, cs) => `<div class="rankrow"><span class="lbl">${lbl}</span><div class="cards">${cs.map(c => cardHTML(c)).join('') || '<span class="muted">none</span>'}</div></div>`;
      body = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2].map(r => row(RN(r), g[r] || [])).join('') + row('★', jk) + (sp.length ? row('◆', sp) : '')
        + (me.trinkets.length ? `<div class="muted">Trinkets: ${me.trinkets.map(t => TRINK[t].name).join(', ')}</div>` : '');
    } else if (UI.sheet === 'log') {
      title = 'Log';
      body = `<div class="loglist">${S.log.map(l => `<div>${l}</div>`).join('')}</div>`;
    } else if (UI.sheet === 'tools') {
      title = 'Test tools';
      body = `<div class="tools">
        <div class="row">Seed <span class="seedv">${S.seed}</span><div class="grow"></div><button class="btn ghost" data-act="replay">Replay this seed</button><button class="btn teal" data-act="new">New game</button></div>
        <div class="row"><button class="btn ghost" data-act="bots">${S.showBots ? 'Hide' : 'Show'} bot hands</button><button class="btn gold" data-act="loadpowers">Give me every power</button><button class="btn ghost" data-act="skip" ${S.round >= ROUNDS || auto() ? 'disabled' : ''}>Skip to round 7</button></div>
        <div class="muted">Same seed, same shuffles. "Give me every power" adds all trinkets, one of each special card, and puts each enhancement on a random card in your deck (it kicks in next round). "Skip to round 7" lets a bot play and pick rewards for you until the final.</div></div>`;
    } else if (UI.sheet === 'help') {
      title = 'How to play';
      body = `<div class="helpbody">${helpHTML()}</div>`;
    }
    return `<div class="modal" data-act="close"><div class="sheet" data-stop="1"><header><h2>${title}</h2><button class="btn ghost" data-act="close">Close</button></header><div class="body">${body}</div></div></div>`;
  }
  function menuHTML() {
    const saved = loadSave();
    const fan = [11, 9, 1, 6, 3].map((r, i) => cardHTML(r === 1 ? { j: true, r: 1, id: i } : { r, id: i }, { style: `--i:${i - 2}` })).join('');
    return `<div class="menu">
      <div class="mfan" aria-hidden="true">${fan}</div>
      <h1 class="mtitle">Rogue <span>Peon</span></h1>
      <p class="msub">Get rid of your cards first. Seven rounds. Build your deck in between.</p>
      <div class="mbtns">
        ${saved ? `<button class="btn gold big" data-act="continue">Continue · round ${saved.round}</button>` : ''}
        <button class="btn ${saved ? 'ghost' : 'teal'} big" data-act="newsolo">${saved ? 'New game' : 'Play vs bots'}</button>
        <button class="btn ghost big" disabled>Play with friends <span class="soon">Soon</span></button>
        <button class="btn ghost" data-act="sheet" data-s="help">How to play</button>
      </div>
    </div>${sheetHTML()}`;
  }
  function render() {
    if (opts.headless) return;
    if (UI.screen === 'menu') { app.innerHTML = menuHTML(); return; }
    const me = S.players[S.me];
    const pips = Array.from({ length: ROUNDS }, (_, i) => `<span class="pip${i + 1 < S.round || S.phase === 'over' ? ' done' : ''}${i + 1 === S.round && S.phase !== 'over' ? ' now' : ''}${i + 1 === ROUNDS ? ' final' : ''}">${i + 1}</span>`).join('');
    const trs = me.trinkets.map(t => `<span class="tchip rar-${TRINK[t].rar}" title="${TRINK[t].name}: ${TRINK[t].desc}"><i>${TRINK[t].glyph}</i><span>${TRINK[t].name}</span></span>`).join('');
    app.innerHTML = `
      <div class="hud">
        <button class="logo" data-act="menu" aria-label="Menu">Rogue Peon</button>
        <div class="pips" aria-label="Round ${S.round} of ${ROUNDS}">${pips}</div>
        <div class="trinkets">${trs}</div>
        <div class="spacer"></div>
        <button class="chipbtn" data-act="sheet" data-s="deck">Deck ${me.deck.length}</button>
        <button class="chipbtn" data-act="sheet" data-s="log">Log</button>
        ${opts.dev ? '<button class="chipbtn" data-act="sheet" data-s="tools">Tools</button>' : ''}
      </div>
      <div class="stage">
        <div class="table">
          ${S.order.filter(pid => pid !== S.me).map(edgeHTML).join('')}
          ${S.order.map(plateHTML).join('')}
          ${pileHTML()}
          ${captionHTML()}
          ${handHTML()}
          ${controlsHTML()}
          <button class="help" data-act="sheet" data-s="help" aria-label="How to play">?</button>
        </div>
        ${screenHTML()}
      </div>
      ${sheetHTML()}`;
    UI.animDone = S.anim; UI.dealAnim = false;
    layout();
    save();
  }
  function layout() {
    const st = app.querySelector('.stage'); if (!st) return;
    const r = st.getBoundingClientRect();
    root.style.setProperty('--T', Math.floor(Math.max(260, Math.min(r.height, r.width))) + 'px');
  }
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(layout) : null;
  ro?.observe(root);

  function loadPowers() {
    const me = S.players[S.me];
    me.trinkets = Object.keys(TRINK);
    Object.keys(SPEC).forEach(sp => me.deck.push({ id: S.nextId++, sp }));
    Object.keys(ENH).forEach(e => { const pool = me.deck.filter(c => isNum(c) && !c.j && !c.e); if (pool.length) pick(pool).e = e; });
    log('Test: you got every power.');
  }

  // Clicking one card picks a whole set: when the pile is a pair or bigger, the cards of that number
  // (plus jokers if needed) that make the right count, preferring powers that help and fewer jokers.
  function quickSet(c) {
    const hand = S.players[S.me].hand, n = S.pile.n;
    const same = hand.filter(d => !d.j && d.r === c.r && d !== c).sort((a, b) => (b.e === 'crowned') - (a.e === 'crowned'));
    const jokers = hand.filter(d => d.j && d !== c);
    let best = null;
    const total = 1 << same.length;
    for (let m = 0; m < total; m++) {
      const set = [c, ...same.filter((d, i) => m & (1 << i))];
      for (let j = 0; j <= jokers.length; j++) {
        const s = [...set, ...jokers.slice(0, j)], inf = info(s, S.me, false);
        if (inf.count !== n) continue;
        const score = j * 10 + s.length - (s.some(d => d.e === 'crowned') ? 5 : 0) + (beats(inf) ? 0 : 100);
        if (!best || score < best.score) best = { score, ids: s.map(d => d.id) };
      }
    }
    return best ? best.ids : [c.id];
  }

  /* ---------- Input ---------- */
  function onClick(e) {
    const el = e.target.closest('[data-act]'); if (!el || !root.contains(el)) return;
    if (el.dataset.act === 'close' && e.target.closest('[data-stop]') && !e.target.closest('button')) return;
    const a = el.dataset.act;
    if (a === 'newsolo') return newGame();
    if (a === 'continue') { const s = loadSave(); if (s) { S = s; resume(); } return; }
    if (a === 'sheet') { UI.sheet = el.dataset.s; return render(); }
    if (a === 'close') { UI.sheet = null; return render(); }
    if (a === 'menu') { clearTimeout(timer); UI.screen = 'menu'; UI.sheet = null; return render(); }
    if (!S) return;
    const me = S.me, hand = S.players[me].hand;
    if (a === 'sel') {
      if (!['play', 'putback', 'specials'].includes(S.phase)) return;
      const id = Number(el.dataset.id), c = hand.find(c => c.id === id); if (!c) return;
      if (S.phase === 'specials') UI.sel = UI.sel.includes(id) ? [] : [id];
      else if (S.phase === 'putback') UI.sel = UI.sel.includes(id) ? UI.sel.filter(x => x !== id) : [...UI.sel, id];
      else if (UI.sel.includes(id)) UI.sel = S.pile && S.pile.n > 1 ? [] : UI.sel.filter(x => x !== id);
      else if (S.pile && S.pile.n > 1 && !c.j) UI.sel = quickSet(c);
      else if (S.pile && S.pile.n === 1) UI.sel = [id];
      else {
        UI.sel = [...UI.sel, id];
        if (!c.j) UI.sel = UI.sel.filter(x => { const d = hand.find(d => d.id === x); return d.j || d.r === c.r; });
      }
      return render();
    }
    if (a === 'pick') {
      const id = Number(el.dataset.id), o = S.apply[me][0], lim = applyLimit(me, o);
      if (!multiPick(o)) UI.sel = UI.sel.includes(id) ? [] : [id];
      else if (UI.sel.includes(id)) UI.sel = UI.sel.filter(x => x !== id);
      else if (UI.sel.length < lim) UI.sel = [...UI.sel, id];
      return render();
    }
    if (a === 'reward') { const i = Number(el.dataset.id); UI.pick = UI.pick.includes(i) ? UI.pick.filter(x => x !== i) : UI.pick.length < maxPicks(me) ? [...UI.pick, i] : UI.pick; return render(); }
    if (a === 'tray') { const i = Number(el.dataset.id); UI.sp = UI.sp && UI.sp.i === i ? null : { i, sp: S.tray[me][i].sp }; UI.peekAt = -1; UI.sel = []; return render(); }
    if (a === 'peekat') { UI.peekAt = Number(el.dataset.p); return render(); }
    if (a === 'peekdone') return act(me, { t: 'tray', i: UI.sp.i, at: UI.peekAt });
    if (a === 'giftto') return act(me, { t: 'tray', i: UI.sp.i, card: UI.sel[0], to: Number(el.dataset.p) });
    if (a === 'swapgo') return act(me, { t: 'tray', i: UI.sp.i, card: UI.sel[0] });
    if (a === 'startplay') return act(me, { t: 'traydone' });
    if (a === 'play') return act(me, { t: 'play', ids: UI.sel.slice() });
    if (a === 'pass') return act(me, { t: 'pass' });
    if (a === 'putback') return act(me, { t: 'putback', ids: UI.sel.slice() });
    if (a === 'next') return act(me, { t: 'rewards', picks: UI.pick.slice() });
    if (a === 'apply') return act(me, { t: 'apply', ids: UI.sel.slice() });
    if (a === 'skipapply') return act(me, { t: 'apply', ids: [] });
    if (a === 'new') return newGame();
    if (a === 'replay') return newGame(S.seed);
    if (a === 'bots') { S.showBots = !S.showBots; return render(); }
    if (a === 'loadpowers') { loadPowers(); UI.sheet = null; return render(); }
    if (a === 'skip') {
      UI.sheet = null; S.autoUntil = ROUNDS; resetSel();
      const p = S.players[me];
      if (S.phase === 'putback' && S.need[me]) { p.hand = p.hand.sort((x, y) => keepScore(x) - keepScore(y)).slice(S.need[me]).sort(byRank); S.need[me] = 0; botSpecials(me); return afterStep(); }
      if (S.phase === 'specials') { botSpecials(me); return afterStep(); }
      if (S.phase === 'roundEnd') {
        if (S.rstate[me] === 'choose') botRewards(me);
        else while (S.apply[me].length) applyReward(me, S.apply[me].shift(), null);
        S.rstate[me] = 'done'; return roundDone();
      }
      render(); return schedule();
    }
  }
  root.addEventListener('click', onClick);

  if (opts.headless) newGame(opts.seed);
  else { const s = loadSave(); if (opts.autostart && !s) newGame(); else render(); }

  return {
    destroy() { clearTimeout(timer); ro?.disconnect(); root.removeEventListener('click', onClick); root.innerHTML = ''; root.classList.remove('peon'); },
    // For a network layer later: apply an action another player made.
    receive(pid, a) { perform(pid, a); },
    // For tests and simulations.
    get state() { return S; },
    debug: { newGame: (seed, o) => { Object.assign(opts, o || {}); newGame(seed); }, hasPlay, publiclyPossible, quickSet, info, rewardOffer, rewardRarity, act, perform, schedule, render, loadPowers, stop: () => clearTimeout(timer), set: s => { S = s; } },
  };
}
