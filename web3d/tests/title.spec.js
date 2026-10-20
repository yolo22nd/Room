import { test, expect } from '@playwright/test';
import { boot } from './helpers.js';

test('title screen loads without errors and its dialogs work', async ({ page }) => {
  const errors = await boot(page);
  await page.click('#t-ach');
  await expect(page.locator('.dialog h2')).toContainText('Achievements');
  await page.click('button:has-text("Close")');
  await page.click('#t-settings');
  await expect(page.locator('.dialog h2')).toHaveText('Settings');
  await page.click('button:has-text("Done")');
  await page.click('#t-new');
  await expect(page.locator('.dialog')).toContainText('Daily room');
  expect(errors).toEqual([]);
});
