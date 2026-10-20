import { test, expect } from '@playwright/test';
import { boot, roomSave, level, advanceStory } from './helpers.js';

const allSecrets = { wand: true, cloak: true, diary: true, books: ['conjuring', 'bestiary', 'diary', 'witch', 'rps', 'hitlist'] };

test('true ending unlocks with every secret; the gallery records it', async ({ page }) => {
  await boot(page, { save: roomSave('witch', {}, allSecrets) });
  await page.click('#t-continue');
  await page.waitForFunction(() => window.__room.engine.level && window.__room.engine.level.witch);
  for (let i = 0; i < 6; i++) await level(page, (L) => { L.w.state = 'cast'; L.hitWitch(); });
  await page.waitForSelector('#screen .story', { timeout: 30_000 });
  await advanceStory(page, 3);
  await page.click('button:has-text("Give back everything")');
  await advanceStory(page, 8);
  await expect(page.locator('#screen h1')).toHaveText('The Truth');
  await page.click('#e-end');
  await expect(page.locator('.dialog')).toContainText('The Truth');
});

test('redecorator: sleep with the H key in a fully furnished room', async ({ page }) => {
  const types = ['cushion', 'pc', 'bed', 'sofa', 'chair', 'table', 'dine', 'shelf', 'closet', 'shoerack', 'showcase'];
  const cells = ['w', 'w', 'nw', 's', 'sw', 'se', 'e', 'n', 'ne', 'm', 'm'];
  const placed = {};
  types.forEach((t, i) => { placed[t] = { type: t, slot: cells[i], rot: 0 }; });
  await boot(page, { save: roomSave('room', { placed }, { hellKeyTaken: true }) });
  await page.click('#t-continue');
  await page.waitForFunction(() => window.__room.engine.level && window.__room.engine.level.entities.size >= 11);
  // fewer than 12 kinds: a normal nap
  expect(await level(page, (L) => [...L.entities.values()].length)).toBe(11);
  await level(page, (L) => { L.spawn('closet', 'ne', 0, { instant: true }); });
  await level(page, (L) => { L.state.placed.closet = { type: 'closet', slot: 'ne', rot: 0 }; L.spawn('shoerack', 'm', 0, { instant: true, key: 'shoerack2' }); L.state.placed.shoerack2 = { type: 'shoerack', slot: 'm', rot: 0 }; });
  await level(page, (L) => L.sleepOn('bed', L.entities.get('bed')));
  await page.click('button:has-text("Stay forever")');
  await advanceStory(page, 8);
  await expect(page.locator('#screen h1')).toHaveText('The Redecorator');
});
