import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

// Same browser, viewport, deterministic reels and instrumentation for before/after runs.
const input = resolve(process.argv[2] || 'dist/index.html');
const output = resolve(process.argv[3] || 'test-results/performance.json');
await mkdir(dirname(output), { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.__measure = { raf: 0, draws: 0, uploads: 0 };
    const request = window.requestAnimationFrame;
    window.requestAnimationFrame = callback => request.call(window, now => { window.__measure.raf++; callback(now); });
    for (const method of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'texImage2D', 'texSubImage2D']) {
      const original = WebGL2RenderingContext.prototype[method];
      WebGL2RenderingContext.prototype[method] = function (...args) {
        window.__measure[method.startsWith('tex') ? 'uploads' : 'draws']++;
        return original.apply(this, args);
      };
    }
    // One small win, then Speciala, then losses. No production outcome hooks.
    let draw = 0;
    const grids = [[0,1,2,0,2,3,0,3,4,3,4,0,4,0,1], [0,5,2,1,2,3,5,3,4,3,4,0,4,0,5]];
    const values = [.1,.3,.5,.7,.85,.99];
    crypto.getRandomValues = buffer => {
      for (let i = 0; i < buffer.length; i++) {
        const spin = Math.floor(draw / 15), symbol = grids[spin]?.[draw % 15] ?? draw % 5;
        buffer[i] = Math.floor(values[symbol] * 4294967296); draw++;
      }
      return buffer;
    };
  });
  const client = await page.context().newCDPSession(page);
  await client.send('Performance.enable');
  await page.goto(pathToFileURL(input).href);
  await page.waitForFunction(() => window.__pacanele?.state.ready, { timeout: 60000 });
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.waitForTimeout(1800);
  const snapshot = async () => ({
    metrics: Object.fromEntries((await client.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value])),
    counts: await page.evaluate(() => ({ ...window.__measure })),
  });
  const report = { input, viewport: '1440×1000 @2x', phases: {}, errors };
  async function measure(name, action) {
    const before = await snapshot();
    const start = performance.now();
    await action();
    const after = await snapshot(), seconds = (performance.now() - start) / 1000;
    const result = { seconds: +seconds.toFixed(2) };
    for (const key of ['raf', 'draws', 'uploads']) result[key] = after.counts[key] - before.counts[key];
    for (const key of ['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration']) result[`${key}Ms`] = +((after.metrics[key] - before.metrics[key]) * 1000).toFixed(2);
    result.mainThreadBusyPercent = +(result.TaskDurationMs / (seconds * 10)).toFixed(2);
    result.jsHeapMB = +(after.metrics.JSHeapUsedSize / 1024 / 1024).toFixed(1);
    report.phases[name] = result; console.log(name, JSON.stringify(result));
  }
  await measure('idle', () => page.waitForTimeout(5000));
  await measure('spin', async () => {
    await page.locator('#spin').click();
    await page.waitForFunction(() => window.__pacanele.state.spins === 1 && !window.__pacanele.state.pending);
  });
  await page.waitForTimeout(3500);
  await measure('idleAfterSpin', () => page.waitForTimeout(5000));
  await measure('camera', async () => {
    await page.mouse.move(1050, 410); await page.mouse.down();
    await page.mouse.move(1150, 430, { steps: 30 }); await page.mouse.up();
    await page.waitForTimeout(1800);
  });
  await page.locator('#spin').click();
  await page.waitForFunction(() => window.__pacanele.state.spins === 2 && !window.__pacanele.state.pending);
  await measure('speciala', () => page.waitForTimeout(2500));
  await page.waitForTimeout(3000);
  await measure('idleAfterSpeciala', () => page.waitForTimeout(3000));
  report.state = await page.evaluate(() => window.__pacanele.state);
  await writeFile(output, JSON.stringify(report, null, 2));
  if (errors.length) throw new Error(errors.join('\n'));
} finally { await browser.close(); }
