import { test, expect } from '@playwright/test';

async function ready(page) {
  await page.addInitScript(() => {
    let draw = 0;
    const values = [.1, .3, .5, .7, .85];
    crypto.getRandomValues = buffer => {
      for (let i = 0; i < buffer.length; i++) buffer[i] = Math.floor(values[draw++ % 5] * 4294967296);
      return buffer;
    };
  });
  await page.goto('/');
  await page.waitForFunction(() => window.__pacanele?.state.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
}
const state = page => page.evaluate(() => window.__pacanele.state);
const sleep = page => page.waitForFunction(() => !window.__pacanele.state.rendering.scheduled);

test('the renderer sleeps at idle, caches static depth and shadows during spins, and wakes for input', async ({ page }) => {
  await ready(page); await sleep(page);
  const initial = (await state(page)).rendering;
  await page.waitForTimeout(650);
  expect((await state(page)).rendering).toEqual(initial);
  expect(await page.locator('.film-grain').evaluate(layer => getComputedStyle(layer).animationName)).toBe('film-grain');
  await page.locator('#spin').click();
  // The button has returned to rest; reels change color without changing depth.
  await page.waitForTimeout(600);
  const spinning = (await state(page)).rendering;
  await page.waitForTimeout(450);
  const later = (await state(page)).rendering;
  expect(later.renders).toBeGreaterThan(spinning.renders);
  expect(later.depths).toBe(spinning.depths); expect(later.shadows).toBe(spinning.shadows);
  expect(later.reflections).toBe(later.renders);
  await page.waitForFunction(() => !window.__pacanele.state.pending);
  const settled = (await state(page)).rendering.renders;
  // The red number still floats, but the unchanged room doesn't redraw.
  await page.waitForTimeout(400);
  expect((await state(page)).rendering.renders).toBe(settled);
  await sleep(page);
  await page.waitForFunction(() => window.__pacanele.state.audioState === 'suspended');
  await page.locator('#bet').click();
  await page.waitForFunction(previous => window.__pacanele.state.rendering.renders > previous, settled);
  await sleep(page);
  await page.mouse.move(1050, 410); await page.mouse.down(); await page.mouse.move(1160, 425, { steps: 8 }); await page.mouse.up();
  await sleep(page);
  const moved = (await state(page)).rendering;
  expect(moved.yaw).toBe(moved.targetYaw); expect(moved.yaw).not.toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(previous => window.__pacanele.state.rendering.renders > previous, moved.renders);
  await sleep(page);
  const resized = (await state(page)).rendering;
  await page.waitForTimeout(400);
  expect((await state(page)).rendering).toEqual(resized);
  // Printing a receipt must also wake an audio context that has gone to sleep.
  await page.waitForFunction(() => window.__pacanele.state.audioState === 'suspended');
  await page.locator('#cashout').click();
  await page.waitForFunction(() => window.__pacanele.state.audioState === 'running');
  await expect(page.locator('#receipt-dialog')).toBeVisible();
});

test('visibility changes cancel scheduled rendering and resume an unfinished spin', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  await page.locator('#spin').click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const hidden = (await state(page)).rendering;
  expect(hidden.scheduled).toBe(false);
  await page.waitForTimeout(3000);
  expect((await state(page)).rendering).toEqual(hidden);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(() => !window.__pacanele.state.pending);
  await expect(page.locator('#credit')).toHaveText('190');
  await sleep(page);
  expect(errors).toEqual([]);
});
