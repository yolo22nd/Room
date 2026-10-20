import { test, expect } from '@playwright/test';
import { boot, roomSave, level, advanceStory } from './helpers.js';

const lessonSave = (id) => ({ ...roomSave('lesson'), lesson: id });

test('lesson 1: things fall up; matching the ceiling runes opens the door', async ({ page }) => {
  const errors = await boot(page, { save: lessonSave('upside') });
  await page.click('#t-continue');
  await page.waitForFunction(() => window.__room.engine.level && window.__room.engine.level.runes);
  const runes = await level(page, (L) => L.runes.map(r => ({ cell: r.cell, type: r.type })));
  // the first conjure rises to the ceiling
  await level(page, (L, R, r) => { R.engine.roomState.mana = 999; L.conjure(r.type, r.cell); }, runes[0]);
  await page.waitForFunction(() => window.__room.engine.level.drops.length === 0);
  expect(await level(page, (L, R, r) => L.objects.get(r.type).group.position.y, runes[0])).toBeCloseTo(3.4);
  expect(await level(page, (L) => L.exit.locked)).toBe(true);
  for (const r of runes.slice(1)) await level(page, (L, R, r) => L.conjure(r.type, r.cell), r);
  await page.waitForFunction(() => window.__room.engine.level.drops.length === 0);
  expect(await level(page, (L) => L.exit.locked)).toBe(false);
  await level(page, (L) => L.useExit());
  await expect(page.locator('.dialog h2')).toHaveText('Lesson complete!', { timeout: 20_000 });
  expect(errors).toEqual([]);
});

test('lesson 2: water floats you; conjuring displaces it; books are collected', async ({ page }) => {
  await boot(page, { save: lessonSave('library') });
  await page.click('#t-continue');
  await page.waitForFunction(() => window.__room.engine.level && window.__room.engine.level.books);
  const w0 = await level(page, (L) => L.water);
  await level(page, (L, R) => { R.engine.roomState.mana = 999; L.conjure('crate' in {} ? 'crate' : 'chair', [1, 1]); });
  await page.waitForFunction(() => window.__room.engine.level.drops.length === 0);
  expect(await level(page, (L) => L.water)).toBeGreaterThan(w0 + 0.15);
  // collect every book by standing next to it at the right height
  for (let i = 0; i < 6; i++) {
    await level(page, (L, R, i) => { const b = L.books[i]; L.water = Math.max(L.water, b.y - 0.5); R.engine.player.pos.set(b.g.position.x * 0.8, Math.max(0, b.y - 1.5), b.g.position.z * 0.8); L.takeBook(b); }, i);
  }
  expect(await level(page, (L) => L.books.every(b => b.got))).toBe(true);
  await level(page, (L, R) => { L.water = 6.8; R.engine.player.pos.set(0, 5.6, 0); });
  await expect(page.locator('.dialog h2')).toHaveText('Lesson complete!', { timeout: 20_000 });
});

test('lesson 3: the tower turns; jamming it aligned lets you cross', async ({ page }) => {
  await boot(page, { save: lessonSave('clockwork') });
  await page.click('#t-continue');
  await page.waitForFunction(() => window.__room.engine.level && window.__room.engine.level.pendulums);
  await page.waitForFunction(() => window.__room.engine.level.k >= 1, null, { timeout: 60_000 }); // it turned at least once
  await page.waitForFunction(() => window.__room.engine.level.aligned(), null, { timeout: 90_000 });
  await level(page, (L, R) => { R.engine.roomState.mana = 999; L.turnT = -999; L.conjure('chair', [1, 1]); });
  await page.waitForFunction(() => window.__room.engine.level.jammed);
  expect(await level(page, (L) => L.aligned())).toBe(true);
  await level(page, (L) => L.useExit());
  // walk out over the bridge
  for (let z = -3.8; z > -17.2; z -= 0.4) {
    const ok = await level(page, (L, R, z) => { const p = R.engine.player; if (!L.walkable(0, z, p.pos.x, p.pos.z)) return false; p.pos.set(0, 0, z); return true; }, z);
    if (!ok) throw new Error('blocked at ' + z);
  }
  await page.waitForSelector('#screen .story', { timeout: 20_000 });
  await advanceStory(page, 6);
  await expect(page.locator('#screen h1')).toHaveText('Three for Three');
});
