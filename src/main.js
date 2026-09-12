import { Game, START_CREDIT, BETS } from './game.js';
import { Screen } from './textures.js';
import { CabinetScene } from './scene.js';
import { CabinetAudio } from './audio.js';
import * as THREE from 'three';

const $ = id => document.getElementById(id);
const game = new Game();
const sound = new CabinetAudio();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const format = new Intl.NumberFormat('ro-RO');
let scene, screen, ready = false, winningUntil = 0, lastPaint = 0, sessionNudgeShown = false;
let startedWallTime = null, pendingCashout = false;
const quips = {
  spin: ['Hai cu șeptarii!', 'Ultima gheară. Pe cuvânt.', 'Mai dau o gheară și mă duc.', 'L-am mirosit. Acum dă.', 'Îmi scot banii și plec.'],
  lose: ['M-a curentat, frate!', 'E rece. Ca promisiunea că plec.', 'Las’ că îl întorc eu.', 'M-a ras. Cu tot cu speranțe.', 'E setat. Pe luat.', 'Băga-mi-aș picioarele!', 'Ultima sută. Celebră vorbă.'],
  win: ['Am simțit, băi, am simțit!', 'Mamă, ce linie!', 'Bine mă! Dă și el ceva.', 'Așa mai merge!', 'Am știut eu! Ziceam și data trecută.'],
};
const nicknames = ['Dorel', 'Gigel', 'Gogu', 'Mișu', 'Bebe', 'Costică', 'Fănel', 'Neluțu', 'Sandu', 'Vio', 'Puiu', 'Marcel', 'Elvis', 'Vali', 'Sorinel'];
function say(value) {
  $('banter').textContent = value;
  document.querySelector('.banter-credit').textContent = `— ${pick(nicknames)}, ${1990 + Math.floor(Math.random() * 37)}`;
}
function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
function sync() {
  $('credit').textContent = format.format(game.credit); $('bet-value').textContent = game.bet;
  $('bet').setAttribute('aria-label', `Schimbă miza, acum ${game.bet} lei`);
  const delta = game.credit - START_CREDIT;
  $('balance').textContent = delta === 0 ? 'Pe zero. Deocamdată.' : delta > 0 ? `Pe plus cu ${format.format(delta)} lei.` : `Pe minus cu ${format.format(-delta)} lei.`;
  $('balance').style.color = delta > 0 ? '#c8c191' : '';
  $('spin').disabled = !ready || !!game.pending;
  $('bet').disabled = !!game.pending;
  $('cashout').disabled = !!game.pending;
  $('spin-label').textContent = game.pending ? 'Hai cu șeptarii…' : game.credit < BETS[0] ? 'Mai bag o fisă' : 'Mai dă o gheară';
  document.body.dataset.phase = game.pending ? 'spinning' : 'idle';
}
async function spin() {
  if (!ready || game.pending || document.querySelector('dialog[open]')) return;
  await sound.unlock().catch(() => {});
  // Recheck after audio unlock: rapid clicks must never charge two spins.
  if (game.pending) return;
  if (game.credit < BETS[0]) { showReceipt('Aparatul ți-a curățat buzunarul. Virtual.'); return; }
  if (game.credit < game.bet) {
    while (game.credit < game.bet) game.cycleBet();
    sync(); say(`Miza a coborât la ${game.bet}. Buzunarul a decis.`); return;
  }
  const result = game.spin(); if (!result) return;
  startedWallTime ??= Date.now();
  scene.press(); sound.startSpin(); screen.start(result, performance.now(), reducedMotion);
  say(pick(quips.spin)); $('machine-state').textContent = '„Hai, dă-o!”'; sync();
}
async function bet() {
  if (!ready || game.pending) return;
  await sound.unlock().catch(() => {}); if (!game.cycleBet()) return;
  sound.clack(); scene.press(scene.buttons[0]);
  say(game.bet === 50 ? 'Bagă mare! Sunt bani desenați.' : `Miza: ${game.bet} lei. Curaj imaginar.`);
  sync(); screen.draw(performance.now(), game);
}
function finishSpin() {
  const result = game.settle(); if (!result) return;
  sound.stopSpin();
  if (result.payout) {
    sound.win(result.jackpot || result.bonus > 0); winningUntil = performance.now() + 3500;
    say(result.jackpot ? 'L-am spart! Am spart banca!' : result.bonus ? 'Mi-a dat speciala!' : pick(quips.win));
    $('machine-state').textContent = `+${format.format(result.payout)} lei imaginari`;
  } else { sound.lose(); say(pick(quips.lose)); $('machine-state').textContent = '„E rece.”'; }
  sync(); screen.draw(performance.now(), game);
  $('outcome').textContent = `Gheara ${game.spins}. ${result.payout ? `Câștig: ${result.payout} lei imaginari.` : 'Nicio combinație câștigătoare.'} Credit rămas: ${game.credit} lei imaginari.`;
  if (pendingCashout) { pendingCashout = false; showReceipt(); }
  else if (!sessionNudgeShown && startedWallTime && Date.now() - startedWallTime >= 120000) {
    sessionNudgeShown = true; showReceipt('Au trecut două minute. Ultima chiar poate fi ultima.');
  } else if (game.credit < BETS[0]) {
    say('M-a curățat. Bine că erau imaginari.'); $('machine-state').textContent = '„M-a ras.”';
  }
}
function showReceipt(comment) {
  if (game.pending) { pendingCashout = true; return; }
  const elapsed = startedWallTime ? Math.max(1, Math.round((Date.now() - startedWallTime) / 1000)) : 0;
  $('receipt-spins').textContent = game.spins;
  $('receipt-time').textContent = elapsed < 60 ? `${elapsed} sec` : `${Math.floor(elapsed / 60)} min ${elapsed % 60} sec`;
  $('receipt-credit').textContent = `${format.format(game.credit)} lei imaginari`;
  $('receipt-comment').textContent = comment || (game.credit > START_CREDIT ? 'Pe plus în joc. În viață, tot cu banii tăi.' : game.spins === 0 ? 'Ai plecat înainte să începi. Ai câștigat timp.' : 'Bine că n-au fost bani adevărați.');
  $('receipt-title').innerHTML = game.spins === 0 ? 'Ai câștigat<br><em>timp.</em>' : 'Ai spart<br><em>timpul.</em>';
  if (!$('receipt-dialog').open) $('receipt-dialog').showModal();
  sound.receipt();
}
async function toggleSound() {
  sound.setEnabled(!sound.enabled); await sound.unlock().catch(() => {});
  $('sound').setAttribute('aria-pressed', String(sound.enabled));
  $('sound').setAttribute('aria-label', sound.enabled ? 'Oprește sunetul' : 'Pornește sunetul');
}
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else $('experience').classList.toggle('fullscreen-fallback');
  } catch { $('experience').classList.toggle('fullscreen-fallback'); }
  updateFullscreen(); scene?.resize();
}
function updateFullscreen() {
  const active = !!document.fullscreenElement || $('experience').classList.contains('fullscreen-fallback');
  $('fullscreen').setAttribute('aria-label', active ? 'Ieși din ecran complet' : 'Ecran complet');
  $('fullscreen').setAttribute('aria-pressed', String(active));
}
$('spin').addEventListener('click', spin); $('bet').addEventListener('click', bet);
$('cashout').addEventListener('click', () => showReceipt());
$('sound').addEventListener('click', toggleSound); $('fullscreen').addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', updateFullscreen);
$('info').addEventListener('click', () => $('about-dialog').showModal());
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  const rect = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
}));
$('restart').addEventListener('click', () => {
  game.reset(); startedWallTime = null; sessionNudgeShown = false; winningUntil = 0;
  screen.result = null; $('receipt-dialog').close();
  say('Mai bag o fisă. De data asta sigur plec.'); $('machine-state').textContent = '„Stă să dea.”'; sync(); screen.draw(performance.now(), game);
});
document.addEventListener('keydown', event => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.code === 'Escape' && $('experience').classList.contains('fullscreen-fallback')) { $('experience').classList.remove('fullscreen-fallback'); updateFullscreen(); scene?.resize(); return; }
  if (document.querySelector('dialog[open]') || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(event.target.tagName)) return;
  if (event.code === 'Space') { event.preventDefault(); spin(); }
  if (event.code === 'KeyM') toggleSound();
  if (event.code === 'KeyF') toggleFullscreen();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) sound.context?.suspend().catch(() => {});
  else if (sound.context && sound.enabled) sound.context.resume().catch(() => {});
});
function frame(now) {
  requestAnimationFrame(frame);
  if (!ready || document.hidden || scene.lost) return;
  if (screen.animation && now - lastPaint > (scene.mobile ? 28 : 16)) {
    lastPaint = now;
    if (screen.draw(now, game, index => sound.reelStop(index))) finishSpin();
  }
  scene.render(now, now < winningUntil);
}
async function init() {
  say($('banter').textContent);
  try {
    screen = new Screen(); screen.draw(0, game);
    scene = new CabinetScene($('scene'), screen, { reducedMotion, onAction: action => ({ spin, bet, cashout: showReceipt })[action]?.() });
    await scene.renderer.compileAsync(scene.scene, scene.camera);
    scene.render(performance.now()); ready = true; sync();
    $('loading').classList.add('done'); $('loading').setAttribute('aria-hidden', 'true');
    setTimeout(() => $('loading').remove(), reducedMotion ? 0 : 800);
    requestAnimationFrame(frame);
    // Read-only diagnostics support render/performance and physical-button QA.
    Object.defineProperty(window, '__pacanele', { value: {
      get state() { return { credit: game.credit, bet: game.bet, spins: game.spins, lastWin: game.lastWin, totalBet: game.totalBet, totalWon: game.totalWon, pending: !!game.pending, grid: screen.grid, result: screen.result, sound: sound.enabled, audioState: sound.context?.state, ready, drawCalls: scene.renderer.info.render.calls, pixelRatio: scene.renderer.getPixelRatio(), reducedMotion }; },
      buttonPoints() { return scene.buttons.map(button => { const p = button.getWorldPosition(new THREE.Vector3()); p.project(scene.camera); return { action: button.userData.action, x: (p.x + 1) * .5 * scene.container.clientWidth, y: (1 - p.y) * .5 * scene.container.clientHeight }; }); },
    } });
  } catch (error) {
    console.error('Aparatul nu a pornit:', error); $('loading')?.remove(); $('webgl-error').hidden = false; $('spin-label').textContent = 'Aparatul e rece';
  }
}
init();
