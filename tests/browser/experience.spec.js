import { test, expect } from '@playwright/test';

async function ready(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.__pacanele?.state.ready, { timeout: 60000 });
  await expect(page.locator('#spin')).toBeEnabled();
  await expect(page.locator('#loading')).toHaveCount(0);
}
async function settled(page) {
  await page.waitForFunction(() => window.__pacanele.state.spins > 0 && !window.__pacanele.state.pending, { timeout: 30000 });
}
test('desktop renders, plays, locks during spins, reports results, and prints a receipt', async ({ page }) => {
  const errors = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!request.url().startsWith('http://localhost:4173') && !request.url().startsWith('data:')) external.push(request.url()); });
  await ready(page);
  await expect(page).toHaveTitle('Păcănele — Ultima gheară');
  await expect(page.locator('.free-note')).toHaveCount(0);
  await expect(page.locator('.maker-credit')).toHaveText('Facut la misto de @danmana si GPT Astra');
  await expect(page.locator('.maker-credit')).toHaveAttribute('href', 'https://x.com/danmana');
  await page.screenshot({ path: 'test-results/desktop.png' });
  await page.locator('#spin').click();
  await expect(page.locator('#spin')).toBeDisabled(); await expect(page.locator('#bet')).toBeDisabled();
  await expect(page.locator('#credit')).toHaveText('190');
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => window.__pacanele.state.spins)).toBe(1);
  await settled(page);
  const state = await page.evaluate(() => window.__pacanele.state);
  expect(state.credit).toBe(200 - state.totalBet + state.totalWon);
  expect(state.grid).toHaveLength(5); expect(state.audioState).toBe('running');
  await page.locator('#bet').click(); await expect(page.locator('#bet-value')).toHaveText('20');
  await page.locator('#sound').click(); await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#sound').click(); await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#cashout').click(); await expect(page.locator('#receipt-dialog')).toBeVisible();
  await expect(page.locator('#receipt-spins')).toHaveText('1'); await expect(page.locator('.receipt-total dd')).toHaveText('0 LEI');
  await page.screenshot({ path: 'test-results/receipt.png' });
  await page.locator('#restart').click(); await expect(page.locator('#credit')).toHaveText('200');
  expect(await page.evaluate(() => window.__pacanele.state.spins)).toBe(0);
  await page.locator('#info').click(); await expect(page.locator('#about-dialog')).toBeVisible();
  await page.keyboard.press('Space'); expect(await page.evaluate(() => window.__pacanele.state.spins)).toBe(0);
  await page.keyboard.press('Escape'); await expect(page.locator('#about-dialog')).not.toBeVisible();
  expect(errors).toEqual([]); expect(external).toEqual([]);
});
test('physical cabinet button, camera drag, fullscreen and keyboard work', async ({ page }) => {
  await ready(page);
  const button = await page.evaluate(() => window.__pacanele.buttonPoints().find(button => button.action === 'spin'));
  await page.mouse.click(button.x, button.y); await settled(page);
  expect(await page.evaluate(() => window.__pacanele.state.spins)).toBe(1);
  await page.mouse.move(1050, 410); await page.mouse.down(); await page.mouse.move(1130, 425, { steps: 8 }); await page.mouse.up();
  expect(await page.evaluate(() => window.__pacanele.state.spins)).toBe(1);
  await page.locator('#fullscreen').click();
  await expect(page.locator('#fullscreen')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#fullscreen').click();
  await expect(page.locator('#fullscreen')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('body').click({ position: { x: 15, y: 400 } });
  await page.keyboard.press('Space'); await settled(page);
  expect(await page.evaluate(() => window.__pacanele.state.spins)).toBe(2);
});
test('mobile portrait and landscape keep the controls usable and honor reduced motion', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  expect(await page.evaluate(() => window.__pacanele.state.reducedMotion)).toBe(true);
  await page.screenshot({ path: 'test-results/mobile.png' });
  await page.locator('#spin').tap(); await settled(page);
  await page.locator('#cashout').tap(); await expect(page.locator('#receipt-dialog')).toBeVisible();
  await page.locator('#restart').tap();
  for (const viewport of [{ width: 320, height: 568 }, { width: 768, height: 1024 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await expect(page.locator('#spin')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('#spin').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/layout-${viewport.width}.png` });
  }
  expect(errors).toEqual([]); await context.close();
});
test('self-contained build runs from disk with networking disabled', async ({ browser }) => {
  const context = await browser.newContext({ offline: true }); const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`file://${process.cwd()}/dist/index.html`);
  await page.waitForFunction(() => window.__pacanele?.state.ready, { timeout: 60000 });
  await page.locator('#spin').click(); await settled(page);
  expect(await page.evaluate(() => window.__pacanele.state.spins)).toBe(1);
  expect(errors).toEqual([]); await context.close();
});

test('winning lines and speciala keep playing past two minutes until the player leaves', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Control the entropy boundary in this test only. Production has no forced-outcome hooks.
  await page.addInitScript(() => {
    let draws = 0;
    crypto.getRandomValues = buffer => {
      for (let i = 0; i < buffer.length; i++) buffer[i] = draws++ < 15 ? 0 : 0xffffffff;
      return buffer;
    };
  });
  await ready(page);
  await page.locator('#spin').click(); await settled(page);
  await expect(page.locator('#credit')).toHaveText('550');
  expect(await page.evaluate(() => window.__pacanele.state.result.lines.length)).toBe(3);
  await expect(page.locator('#outcome')).toHaveText('Gheara 1. Câștig: 360 lei imaginari. Credit rămas: 550 lei imaginari.');
  await page.evaluate(() => { const future = Date.now() + 121000; Date.now = () => future; });
  await page.locator('#spin').click(); await settled(page);
  expect(await page.evaluate(() => window.__pacanele.state.result.bonus)).toBe(50);
  await expect(page.locator('#receipt-dialog')).not.toBeVisible();
  await page.evaluate(() => { const future = Date.now() + 3600000; Date.now = () => future; });
  await page.locator('#spin').click(); await settled(page);
  await expect(page.locator('#receipt-dialog')).not.toBeVisible();
  await expect(page.locator('#machine-state')).toHaveText('Cald');
  await page.locator('#cashout').click();
  await expect(page.locator('#receipt-dialog')).toBeVisible();
  await expect(page.locator('#receipt-spins')).toHaveText('3');
});

test('zero credits ends the session only after the last spin settles', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    let draws = 0;
    const losingDraws = [0, .3, .5, .7, .85];
    crypto.getRandomValues = buffer => {
      for (let i = 0; i < buffer.length; i++) buffer[i] = Math.floor(losingDraws[draws++ % losingDraws.length] * 4294967296);
      return buffer;
    };
  });
  await ready(page);
  await page.locator('#bet').click(); await page.locator('#bet').click();
  await expect(page.locator('#bet-value')).toHaveText('50');
  for (let spin = 1; spin <= 3; spin++) {
    await page.locator('#spin').click(); await settled(page);
    await expect(page.locator('#credit')).toHaveText(String(200 - spin * 50));
    await expect(page.locator('#receipt-dialog')).not.toBeVisible();
  }
  await expect(page.locator('#machine-state')).toHaveText('Rece');
  await page.locator('#spin').click();
  await expect(page.locator('#machine-state')).toHaveText('Rece');
  await expect(page.locator('#credit')).toHaveText('0');
  await expect(page.locator('#spin')).toBeDisabled();
  await expect(page.locator('#receipt-dialog')).not.toBeVisible();
  await settled(page);
  await expect(page.locator('#machine-state')).toHaveText('Înghețat');
  await expect(page.locator('#receipt-dialog')).toBeVisible();
  await expect(page.locator('#receipt-spins')).toHaveText('4');
  await expect(page.locator('#receipt-credit')).toHaveText('0 lei imaginari');
  await page.locator('#restart').click();
  await expect(page.locator('#credit')).toHaveText('200');
  await expect(page.locator('#receipt-dialog')).not.toBeVisible();
  await expect(page.locator('#machine-state')).toHaveText('În așteptare');
});

test('phrase attributions survive reloads and the maker link is tappable on mobile', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  const attribution = await page.locator('.banter-credit').textContent();
  await page.locator('#bet').click();
  const stakeAttribution = await page.locator('.banter-credit').textContent();
  await page.locator('#bet').click(); await page.locator('#bet').click(); await page.locator('#bet').click();
  await expect(page.locator('.banter-credit')).toHaveText(stakeAttribution);
  await page.reload(); await page.waitForFunction(() => window.__pacanele?.state.ready);
  await expect(page.locator('.banter-credit')).toHaveText(attribution);
  await context.route('https://x.com/danmana', route => route.fulfill({ contentType: 'text/html', body: '<p>Profil</p>' }));
  const popup = page.waitForEvent('popup');
  await page.locator('.maker-credit').click();
  const profile = await popup; await profile.waitForLoadState();
  expect(profile.url()).toBe('https://x.com/danmana');
  await profile.close();
});
