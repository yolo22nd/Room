import { test, expect } from '@playwright/test';
import { boot, roomSave, level, waitGame } from './helpers.js';

test('the witch portrait whispers when you stare at it in the dark', async ({ page }) => {
  await boot(page, { save: roomSave('room', { lampOn: false, player: { x: -2.9, z: 2.2, yaw: Math.PI } }) });
  await page.click('#t-continue');
  await page.waitForFunction(() => window.__room.engine.level && window.__room.engine.mode === 'play');
  await level(page, (L, R) => { R.engine.player.yaw = Math.PI; R.engine.player.pitch = 0.05; });
  await page.waitForFunction(() => window.__room.engine.level.state.flags.portrait === true, null, { timeout: 60_000 });
  await expect(page.locator('#log')).toContainText('lemons');
});

test('knocking three times on the void window; xyzzy at the command line', async ({ page }) => {
  await boot(page, { save: roomSave('room') });
  await page.click('#t-continue');
  await page.waitForFunction(() => window.__room.engine.level && window.__room.engine.mode === 'play');
  await level(page, (L, R) => {
    const p = new L.room.voidPane.position.constructor(); L.room.voidPane.getWorldPosition(p);
    const pl = R.engine.player; pl.pos.set(p.x - 1.4, 0, p.z); pl.yaw = -Math.PI / 2; pl.pitch = 0.05;
  });
  await page.waitForFunction(() => { const f = window.__room.engine.level.focus; return f && f.owner === 'voidwindow'; });
  for (let i = 0; i < 3; i++) await level(page, (L) => L.use());
  await expect(page.locator('#log')).toContainText('tiny wizard');
  await level(page, (L) => L.runCommand('xyzzy'));
  await expect(page.locator('#log')).toContainText('hollow voice');
  const ach = await page.evaluate(() => localStorage.getItem('room3d.achievements.v1'));
  expect(ach).toContain('knock'); expect(ach).toContain('xyzzy');
});
