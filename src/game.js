export const START_CREDIT = 200;
export const BETS = [10, 20, 50];
export const SYMBOLS = ['cherry', 'lemon', 'grape', 'melon', 'seven', 'star'];
export const WEIGHTS = [5, 5, 4, 4, 3, 1];
export const PAYOUTS = [
  [2, 5, 12], [2, 5, 12], [3, 8, 20], [3, 8, 20], [10, 25, 100], [5, 15, 40],
];
const MACHINE_STATES = {
  LLLL: 'Înghețat', LLL: 'Rece', LLW: 'Se dezmorțește', LWL: 'Stă să dea',
  LWW: 'Călduț', WLL: 'Se răcește', WLW: 'Stă să dea', WWL: 'Călduț',
  WWW: 'Cald', WWWW: 'Fierbinte',
};
export function machineStateFor(outcomes) {
  return MACHINE_STATES[outcomes.slice(-4)] ?? MACHINE_STATES[outcomes.slice(-3)] ?? 'În așteptare';
}
export function randomUnit() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
}
export function pickSymbol(random = randomUnit) {
  let value = random() * WEIGHTS.reduce((a, b) => a + b, 0);
  for (let i = 0; i < WEIGHTS.length; i++) {
    value -= WEIGHTS[i];
    if (value < 0) return i;
  }
  return WEIGHTS.length - 1;
}
export function makeGrid(random = randomUnit) {
  return Array.from({ length: 5 }, () => Array.from({ length: 3 }, () => pickSymbol(random)));
}
export function evaluate(grid, bet) {
  if (!BETS.includes(bet)) throw new RangeError('Miză invalidă');
  if (grid.length !== 5 || grid.some(column => column.length !== 3 || column.some(s => !Number.isInteger(s) || s < 0 || s >= SYMBOLS.length))) throw new RangeError('Role invalide');
  const lines = [];
  let payout = 0;
  for (let row = 0; row < 3; row++) {
    const symbol = grid[0][row];
    let count = 1;
    while (count < 5 && grid[count][row] === symbol) count++;
    if (count >= 3) {
      const amount = bet * PAYOUTS[symbol][count - 3];
      payout += amount;
      lines.push({ row, symbol, count, amount });
    }
  }
  const stars = grid.flat().filter(symbol => symbol === 5).length;
  const bonus = stars >= 3 ? bet * 5 : 0;
  return { payout: payout + bonus, lines, bonus, jackpot: lines.some(line => line.symbol === 4 && line.count === 5) };
}
export class Game {
  constructor(random = randomUnit) { this.random = random; this.reset(); }
  reset() {
    this.credit = START_CREDIT; this.betIndex = 0; this.spins = 0;
    this.totalBet = 0; this.totalWon = 0; this.lastWin = 0;
    this.recentOutcomes = '';
    this.pending = null; this.startedAt = null;
  }
  get bet() { return BETS[this.betIndex]; }
  get machineState() { return machineStateFor(this.recentOutcomes); }
  cycleBet() {
    if (this.pending) return false;
    this.betIndex = (this.betIndex + 1) % BETS.length;
    return true;
  }
  spin(now = Date.now()) {
    if (this.pending || this.credit < this.bet) return null;
    const bet = this.bet;
    const grid = makeGrid(this.random);
    const result = evaluate(grid, bet);
    this.credit -= bet; this.totalBet += bet; this.spins++;
    this.lastWin = 0; this.startedAt ??= now;
    this.pending = { grid, bet, ...result };
    return this.pending;
  }
  settle() {
    if (!this.pending) return null;
    const result = this.pending;
    this.credit += result.payout; this.totalWon += result.payout;
    this.recentOutcomes = (this.recentOutcomes + (result.payout > 0 ? 'W' : 'L')).slice(-5);
    this.lastWin = result.payout; this.pending = null;
    return result;
  }
}
