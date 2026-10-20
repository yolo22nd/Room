import { test, expect } from '@playwright/test';
import { boot, roomSave } from './helpers.js';

test('photo mode: free camera, filter, capture', async ({ page }) => {
  await boot(page, { save: roomSave('room', { placed: { bed: { type: 'bed', slot: 'n', rot: 0 } } }) });
  await page.click('#t-continue');
  await page.waitForFunction(() => window.__room.engine.level && window.__room.input.enabled);
  await page.evaluate(() => window.__room.enterPhoto());
  await expect(page.locator('#photo')).toBeVisible();
  await expect(page.locator('#hearts')).toBeHidden();
  const t0 = await page.evaluate(() => window.__room.engine.level.time);
  await page.click('[data-f="noir"]');
  await page.keyboard.down('KeyE'); await page.waitForTimeout(800); await page.keyboard.up('KeyE');
  expect(await page.evaluate(() => window.__room.engine.camera.position.y)).toBeGreaterThan(1.7);
  expect(await page.evaluate(() => window.__room.engine.level.time)).toBe(t0); // game frozen
  await page.click('#ph-shot');
  await expect(page.locator('#ph-preview img')).toHaveAttribute('src', /^data:image\/png;base64,/);
  await page.click('#ph-exit');
  await expect(page.locator('#photo')).toBeHidden();
  await expect(page.locator('#hearts')).toBeVisible();
});
