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
