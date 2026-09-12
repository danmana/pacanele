import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, evaluate, makeGrid, pickSymbol, machineStateFor, BETS } from '../src/game.js';

const empty = () => [[0,1,2],[1,2,3],[2,3,4],[3,4,0],[4,0,1]];
test('machine state follows every specified sequence, with four-spin extremes taking precedence', () => {
  const expected = {
    LLLL: 'Înghețat', LLL: 'Rece', LLW: 'Se dezmorțește', LWL: 'Stă să dea',
    LWW: 'Călduț', WLL: 'Se răcește', WLW: 'Stă să dea', WWL: 'Călduț',
    WWW: 'Cald', WWWW: 'Fierbinte',
  };
  for (const [history, label] of Object.entries(expected)) assert.equal(machineStateFor(history), label, history);
  for (const history of ['', 'L', 'W', 'LL', 'LW', 'WL', 'WW']) assert.equal(machineStateFor(history), 'În așteptare');
  assert.equal(machineStateFor('LLLLW'), 'Se dezmorțește');
  assert.equal(machineStateFor('WWWWL'), 'Călduț');
  assert.equal(machineStateFor('WLLLL'), 'Înghețat');
  assert.equal(machineStateFor('LWWWW'), 'Fierbinte');
});
test('only settled spins affect machine state; history rolls forward and resets with a new session', () => {
  const game = new Game(() => 0);
  for (let spin = 0; spin < 4; spin++) {
    game.spin(); assert.equal(game.recentOutcomes, 'W'.repeat(spin));
    game.settle(); assert.equal(game.recentOutcomes, 'W'.repeat(spin + 1));
    game.settle(); assert.equal(game.recentOutcomes, 'W'.repeat(spin + 1));
  }
  assert.equal(game.machineState, 'Fierbinte');
  let draw = 0; game.random = () => [0, .3, .5, .7, .85][draw++ % 5];
  game.spin(); assert.equal(game.machineState, 'Fierbinte'); game.settle();
  assert.equal(game.recentOutcomes, 'WWWL'); assert.equal(game.machineState, 'Călduț');
  game.reset(); assert.equal(game.recentOutcomes, ''); assert.equal(game.machineState, 'În așteptare');
});
test('only consecutive symbols from the left pay on three horizontal lines', () => {
  const grid = empty(); grid[1][0] = 0; grid[2][0] = 0;
  assert.deepEqual(evaluate(grid, 10), { payout: 20, lines: [{ row: 0, symbol: 0, count: 3, amount: 20 }], bonus: 0, jackpot: false });
  const right = empty(); right[2][0] = 0; right[3][0] = 0; right[4][0] = 0;
  assert.equal(evaluate(right, 10).payout, 0);
});
test('multiple lines, five sevens and scattered stars pay exactly the displayed rules', () => {
  const grid = Array.from({length:5}, () => [4,0,1]);
  const result = evaluate(grid, 20);
  assert.equal(result.payout, (100 + 12 + 12) * 20); assert.equal(result.jackpot, true); assert.equal(result.lines.length, 3);
  const stars = empty(); stars[0][1] = 5; stars[2][0] = 5; stars[4][2] = 5;
  assert.equal(evaluate(stars, 10).bonus, 50); assert.equal(evaluate(stars, 10).payout, 50);
});
test('invalid stakes and outcomes cannot be evaluated', () => {
  assert.throws(() => evaluate(empty(), -10), RangeError);
  assert.throws(() => evaluate([[1,2,3]], 10), RangeError);
  const bad = empty(); bad[2][1] = 100;
  assert.throws(() => evaluate(bad, 10), RangeError);
});
test('one debit per spin, frozen stake while spinning, one credit on settlement', () => {
  const game = new Game(() => 0);
  const result = game.spin(123);
  assert.equal(game.credit, 190); assert.equal(game.spins, 1); assert.equal(game.startedAt, 123);
  assert.equal(game.spin(), null); assert.equal(game.cycleBet(), false); assert.equal(game.credit, 190);
  assert.equal(result.payout, 360);
  game.settle(); assert.equal(game.credit, 550); assert.equal(game.totalWon, 360);
  assert.equal(game.settle(), null); assert.equal(game.credit, 550);
});
test('losing sessions cannot overdraw; reset restores a clean session', () => {
  let index = 0;
  const game = new Game(() => [0,.3,.5,.7,.85][index++ % 5]);
  for (let i = 0; i < 20; i++) { assert.ok(game.spin()); game.settle(); }
  assert.equal(game.credit, 0); assert.equal(game.spin(), null); assert.equal(game.spins, 20);
  game.reset(); assert.equal(game.credit, 200); assert.equal(game.spins, 0); assert.equal(game.totalBet, 0); assert.equal(game.totalWon, 0); assert.equal(game.startedAt, null);
});
test('stake selection cycles through only the advertised amounts', () => {
  const game = new Game();
  for (let i = 0; i < 9; i++) { assert.equal(game.bet, BETS[i % 3]); assert.ok(game.cycleBet()); }
});
test('weighted draws have full coverage and accounting stays exact over 10,000 rounds', () => {
  assert.deepEqual(new Set(Array.from({length:220}, (_, i) => pickSymbol(() => (i + .5) / 220))), new Set([0,1,2,3,4,5]));
  let seed = 12345;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const game = new Game(random); let rounds = 0;
  while (rounds++ < 10000) {
    if (game.credit < game.bet) game.reset();
    const previous = game.credit, result = game.spin();
    assert.equal(game.credit, previous - result.bet);
    game.settle(); assert.equal(game.credit, previous - result.bet + result.payout);
    assert.equal(game.credit, 200 - game.totalBet + game.totalWon);
    assert.ok(Number.isSafeInteger(game.credit) && game.credit >= 0);
    assert.equal(makeGrid(random).flat().length, 15);
  }
});
