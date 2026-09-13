import { test, expect } from '@playwright/test';

const empty = () => [[0, 1, 2], [1, 2, 3], [2, 3, 4], [3, 4, 0], [4, 0, 1]];
const line = (symbol, count) => {
  const grid = empty();
  for (let column = 0; column < count; column++) grid[column][0] = symbol;
  // A fourth seven is followed by a different symbol for the 25× case.
  if (count < 5) grid[count][0] = (symbol + 1) % 5;
  return grid;
};
const special = empty(); special[0][1] = 5; special[2][0] = 5; special[4][2] = 5;

async function ready(page, grids) {
  await page.addInitScript(grids => {
    let draw = 0;
    const values = [.1, .3, .5, .7, .85, .99];
    const symbols = grids.flat(2);
    crypto.getRandomValues = buffer => {
      for (let index = 0; index < buffer.length; index++) buffer[index] = Math.floor(values[symbols[draw++ % symbols.length]] * 4294967296);
      return buffer;
    };
  }, grids);
  await page.goto('/');
  await page.waitForFunction(() => window.__pacanele?.state.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
}
async function spin(page) {
  const previous = await page.evaluate(() => window.__pacanele.state.spins);
  await page.locator('#spin').click();
  await expect(page.locator('#payout-float')).toBeHidden();
  await page.waitForFunction(previous => window.__pacanele.state.spins === previous + 1 && !window.__pacanele.state.pending, previous);
}

test('payout tiers, losses and Speciala have distinct effects that expire and never block controls', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await ready(page, [empty(), line(0, 3), line(0, 4), line(4, 3), line(4, 4), line(4, 5), special]);
  const expected = [
    ['loss', '−10', 0, 0], ['spark', '+20', 0, 0], ['shower', '+50', 0, 0],
    ['rays', '+100', 3, 0], ['super', '+250', 5, 0], ['jackpot', '+1.000', 7, 0], ['speciala', '+50', 5, 20],
  ];
  for (const [tier, amount, rays, stars] of expected) {
    await spin(page);
    const payout = page.locator('#payout-float');
    await expect(payout).toHaveAttribute('data-tier', tier);
    await expect(page.locator('.payout-amount')).toHaveText(amount);
    await expect(page.locator('#spin')).toBeEnabled();
    const effects = await page.evaluate(() => window.__pacanele.state.effects);
    expect(effects.rays).toBe(rays); expect(effects.stars).toBe(stars);
    if (tier !== 'loss') expect(effects.particles).toBeGreaterThan(0);
    await page.waitForFunction(() => Number(getComputedStyle(document.getElementById('payout-float')).opacity) > .9);
    await page.screenshot({ path: `test-results/effect-${tier}.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/effect-speciala-mobile.png' });
  await expect(page.locator('#payout-float')).toBeHidden({ timeout: 6500 });
  expect(await page.evaluate(() => window.__pacanele.state.effects)).toEqual({ active: false, tier: null, stars: 0, rays: 0, particles: 0, coins: 0 });
  await spin(page);
  await page.locator('#cashout').click();
  await expect(page.locator('#receipt-dialog')).toBeVisible();
  await expect(page.locator('#payout-float')).toBeHidden();
  await page.locator('#restart').click();
  expect(await page.evaluate(() => window.__pacanele.state.effects.active)).toBe(false);
  expect(errors).toEqual([]);
});

test('reduced motion keeps the payout readable without particles, rays or flying stars', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 568 });
  await ready(page, [special]);
  await spin(page);
  const payout = page.locator('#payout-float');
  await expect(payout).toHaveAttribute('data-tier', 'speciala');
  await expect(page.locator('.payout-amount')).toHaveText('+50');
  const effects = await page.evaluate(() => window.__pacanele.state.effects);
  expect(effects.stars + effects.rays + effects.particles + effects.coins).toBe(0);
  await page.waitForFunction(() => Number(getComputedStyle(document.getElementById('payout-float')).opacity) > .9);
  const bounds = await page.locator('.payout-card').boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  await page.screenshot({ path: 'test-results/effect-reduced-motion.png' });
  await expect(payout).toBeHidden({ timeout: 3000 });
});

test('the largest payout fits a narrow phone and the next spin immediately clears its celebration', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  try {
    const page = await context.newPage();
    await ready(page, [Array.from({ length: 5 }, () => [4, 4, 4])]);
    await page.locator('#bet').tap(); await page.locator('#bet').tap();
    await spin(page);
    await expect(page.locator('.payout-amount')).toHaveText('+15.000');
    await page.waitForFunction(() => Number(getComputedStyle(document.getElementById('payout-float')).opacity) > .9);
    const bounds = await page.locator('.payout-amount').boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
    const effects = await page.evaluate(() => window.__pacanele.state.effects);
    expect(effects.particles).toBeLessThan(420); expect(effects.coins).toBeLessThan(100);
    await page.screenshot({ path: 'test-results/effect-jackpot-mobile.png' });
    await page.locator('#spin').tap();
    await expect(page.locator('#payout-float')).toBeHidden();
    expect(await page.evaluate(() => window.__pacanele.state.effects.active)).toBe(false);
  } finally { await context.close(); }
});
