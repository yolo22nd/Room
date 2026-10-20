import { test, expect } from '@playwright/test';
import { boot, roomSave, level } from './helpers.js';

test('remapped keys, captions, reduced motion and the colour-blind palette', async ({ page }) => {
  await boot(page, { save: roomSave('room') });
  await page.click('#t-settings');
  await page.check('#s-cap');
  await page.check('#s-motion');
  await page.selectOption('#s-pal', 'safe');
  await page.click('#s-keys');
  await page.click('.keybind[data-a="forward"]');
  await page.keyboard.press('KeyI');
  await expect(page.locator('.keybind[data-a="forward"]')).toHaveText('I');
  await page.click('button:has-text("Back")');
  await page.click('button:has-text("Done")');
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('room3d.settings.v1')));
  expect(s.keys.forward).toBe('KeyI');
  expect(s.reducedMotion && s.captions && s.palette === 'safe').toBe(true);

  await page.click('#t-continue');
  await page.waitForFunction(() => window.__room.engine.level && window.__room.input.enabled);
  await page.keyboard.down('KeyI');
  await page.waitForFunction(() => window.__room.engine.player.pos.z < -0.3);
  await page.keyboard.up('KeyI');

  // captions show sound cues; reduced motion ignores camera shake
  await level(page, (L, R) => { L.riftAt(R.engine.player.pos.clone()); R.engine.player.addShake(1); });
  await expect(page.locator('#log .line.cap')).toContainText('[a rift opens above]');
  expect(await page.evaluate(() => window.__room.engine.player.shake)).toBe(0);
});
