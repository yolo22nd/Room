import { test, expect } from '@playwright/test';
import { boot, roomSave, level } from './helpers.js';

test('onboarding: the first game shows a controls card once', async ({ page }) => {
  const errors = await boot(page, { firstRun: true });
  await page.click('#t-new');
  await page.click('button:has-text("Normal")');
  // skip the story one page at a time until the card shows (Enter would also dismiss it)
  for (let i = 0; i < 12 && !(await page.locator('.dialog h2:has-text("Quick controls")').count()); i++) { await page.keyboard.press('Space'); await page.waitForTimeout(400); }
  await expect(page.locator('.dialog h2')).toHaveText('Quick controls');
  await page.click('button:has-text("Got it")');
  await page.waitForFunction(() => window.__room.engine.mode === 'play');
  expect(await page.evaluate(() => localStorage.getItem('room3d.onboard.v1'))).toBe('1');
  expect(errors).toEqual([]);
});

test('onboarding: a hint appears when stuck on the same goal, and can be switched off', async ({ page }) => {
  await boot(page, { save: roomSave('room', { lamp: null, lampOn: false }) });
  await page.click('#t-continue');
  await page.waitForFunction(() => window.__room.engine.level && window.__room.engine.mode === 'play');
  await level(page, (L) => { L._objT = 80; });
  await expect(page.locator('#log')).toContainText('💡', { timeout: 10_000 });
  await expect(page.locator('#log')).toContainText('lamp');
  // off: no more hints
  await page.evaluate(() => { window.__room.engine.hintsOn = false; });
  await level(page, (L) => { L._objT = 500; });
  await page.waitForTimeout(500);
  expect(await level(page, (L) => L._objT)).toBe(500);
});
