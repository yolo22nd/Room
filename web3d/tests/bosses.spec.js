import { test, expect } from '@playwright/test';
import { boot, roomSave, level, waitGame, advanceStory } from './helpers.js';

test('kraken: pins expose the head, the nail wins, the exit offers the rematch', async ({ page }) => {
  const errors = await boot(page, { save: roomSave('hell', { placed: { sofa: { type: 'sofa', slot: 's', rot: 2 } } }) });
  await page.click('#t-continue');
  await page.waitForFunction(() => window.__room.engine.level && window.__room.engine.level.tentacles);
  await level(page, (L, R) => { R.engine.roomState.hearts = 99; L.pins = L.pinsNeeded; L.expose(); });
  await waitGame(page, 1.5);
  // aim the nail under the eye
  await level(page, (L, R) => {
    const g = L.headGroundPoint(); const p = R.engine.player; const c = R.engine.camera;
    const dx = g.x - p.pos.x, dz = g.z - p.pos.z; p.yaw = Math.atan2(-dx, -dz); p.pitch = -Math.atan2(c.position.y, Math.hypot(dx, dz));
  });
  await waitGame(page, 0.3);
  await level(page, (L) => L.cast());
  await page.waitForFunction(() => ['dying', 'won'].includes(window.__room.engine.level.phase), null, { timeout: 90_000 });
  await page.waitForFunction(() => window.__room.engine.level.phase === 'won', null, { timeout: 90_000 });
  await level(page, (L, R) => R.engine.player.pos.set(L.exit.position.x, 0, L.exit.position.z));
  await page.waitForSelector('#screen .story', { timeout: 30_000 });
  await advanceStory(page, 10);
  await expect(page.locator('.dialog h2')).toContainText('Rematch');
  expect(errors).toEqual([]);
});

test('witch: hits through her phases lead to the finale', async ({ page }) => {
  const errors = await boot(page, { save: roomSave('witch', { placed: { bed: { type: 'bed', slot: 'n', rot: 0 } } }, { lemon: true }) });
  await page.click('#t-continue');
  await page.waitForFunction(() => window.__room.engine.level && window.__room.engine.level.witch);
  // her shield deflects while flying; she is only hurt while grounded
  expect(await level(page, (L) => L.vulnerable())).toBe(false);
  for (let i = 0; i < 6; i++) await level(page, (L) => { L.w.state = 'cast'; L.hitWitch(); });
  expect(await level(page, (L) => L.phase)).toBe('won');
  await page.waitForSelector('#screen .story', { timeout: 30_000 });
  await advanceStory(page, 3);
  await expect(page.locator('button:has-text("??? (you don")')).toBeDisabled(); // no secrets: true ending locked
  await page.click('button:has-text("Offer her a hand")');
  await advanceStory(page, 8);
  await expect(page.locator('#screen h1')).toHaveText('The Apprentice');
  expect(errors).toEqual([]);
});
