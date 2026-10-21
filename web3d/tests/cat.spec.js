import { test, expect } from '@playwright/test';
import { boot, roomSave, level } from './helpers.js';

test('cat: summoned from the spellbook, follows, notices secrets, can be petted, comes back next time', async ({ page }) => {
  const errors = await boot(page, { save: roomSave('room', { placed: { shelf: { type: 'shelf', slot: 'n', rot: 0 } } }) });
  await page.click('#t-continue');
  await page.waitForFunction(() => window.__room.engine.level && window.__room.engine.mode === 'play');
  await page.keyboard.press('KeyQ');
  await page.click('[data-familiar]');
  await page.waitForFunction(() => !!window.__room.engine.cat);
  await expect(page.locator('#log')).toContainText('cat');
  // it follows the player across the room
  await level(page, (L, R) => { R.engine.player.pos.set(-3, 0, 3); R.engine.cat.g.position.set(3, 0, -3); });
  await page.waitForFunction(() => { const c = window.__room.engine.cat.g.position, p = window.__room.engine.player.pos; return Math.hypot(c.x - p.x, c.z - p.z) < 2; }, null, { timeout: 30_000 });
  // walking near the bookshelf with the wand unfound: the cat stares at it
  await level(page, (L, R) => { const s = L.entities.get('shelf').group.position; R.engine.player.pos.set(s.x, 0, s.z + 1.6); });
  await expect(page.locator('#log')).toContainText('crooked', { timeout: 30_000 });
  await level(page, (L, R) => R.engine.cat.pet());
  const ach = await page.evaluate(() => localStorage.getItem('room3d.achievements.v1'));
  expect(ach).toContain('familiar'); expect(ach).toContain('petcat');
  // adopted: it is there again after going back to the title and continuing
  await page.evaluate(() => window.__room.showTitle());
  await page.click('#t-continue');
  await page.waitForFunction(() => window.__room.engine.mode === 'play' && !!window.__room.engine.cat);
  // sent off: it stays away
  await page.evaluate(() => window.__room.engine.toggleCat());
  expect(await page.evaluate(() => !!window.__room.engine.cat)).toBe(false);
  expect(errors).toEqual([]);
});
