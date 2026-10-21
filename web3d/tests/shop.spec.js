import { test, expect } from '@playwright/test';
import { boot, roomSave } from './helpers.js';

test('shop: coins from achievements, buying and equipping a lantern flame changes the lamp', async ({ page }) => {
  const errors = await boot(page, { save: roomSave('room') });
  await page.evaluate(() => localStorage.setItem('room3d.shop.v1', JSON.stringify({ coins: 55, owned: ['amber', 'ginger'], equipped: { flame: 'amber', cat: 'ginger' } })));
  await page.click('#t-shop');
  await expect(page.locator('.dialog h2')).toContainText('55');
  // too poor for Witchfire (60)
  await page.click('[data-id="witchfire"]');
  await expect(page.locator('#toasts')).toContainText('Not enough');
  await page.evaluate(() => localStorage.setItem('room3d.shop.v1', JSON.stringify({ ...JSON.parse(localStorage.getItem('room3d.shop.v1')), coins: 65 })));
  await page.click('.dialog button:has-text("Back")');
  await page.click('#t-shop');
  await page.click('[data-id="witchfire"]');
  await expect(page.locator('[data-id="witchfire"]')).toContainText('equipped');
  // 65 - 60, plus 10 for the first-purchase achievement
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('room3d.shop.v1'))).coins).toBe(15);
  await page.click('.dialog button:has-text("Back")');
  await page.click('#t-continue');
  await page.waitForFunction(() => window.__room.engine.level && window.__room.engine.mode === 'play');
  expect(await page.evaluate(() => window.__room.engine.level.lampLight.color.getHex())).toBe(0x8aff7a);
  expect(errors).toEqual([]);
});
