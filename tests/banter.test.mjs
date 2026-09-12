import test from 'node:test';
import assert from 'node:assert/strict';
import { attributionFor, NICKNAMES } from '../src/banter.js';

test('a phrase keeps its attribution regardless of other phrases, reloads, or Unicode normalization', async () => {
  const phrase = 'Mai dau o gheară și plec.';
  const original = attributionFor(phrase);
  for (let i = 0; i < 100; i++) attributionFor(`Altă replică ${i}`);
  assert.equal(attributionFor(phrase), original);
  assert.equal(attributionFor(phrase.normalize('NFD')), original);
  const freshModule = await import('../src/banter.js?fresh-session');
  assert.equal(freshModule.attributionFor(phrase), original);
});
test('the deterministic pool includes all fifteen nicknames and years from 1990 through 2026', () => {
  assert.deepEqual(NICKNAMES, ['Dorel', 'Gigel', 'Gogu', 'Mișu', 'Bebe', 'Costică', 'Fănel', 'Neluțu', 'Sandu', 'Vio', 'Puiu', 'Marcel', 'Elvis', 'Vali', 'Sorinel']);
  const names = new Set(), years = new Set();
  for (let i = 0; i < 1000; i++) {
    const match = /^— (.+), (\d{4})$/.exec(attributionFor(`Replică ${i}`));
    assert.ok(match); assert.ok(NICKNAMES.includes(match[1]));
    const year = Number(match[2]); assert.ok(year >= 1990 && year <= 2026);
    names.add(match[1]); years.add(year);
  }
  assert.deepEqual(names, new Set(NICKNAMES));
  assert.equal(Math.min(...years), 1990); assert.equal(Math.max(...years), 2026);
});
