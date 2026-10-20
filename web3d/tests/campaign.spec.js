import { test, expect } from '@playwright/test';
import { boot, level } from './helpers.js';

test('campaign: chapters unlock, Hell opens with a skippable cutscene', async ({ page }) => {
  await boot(page);
  await page.click('#t-campaign');
  await expect(page.locator('.chapter').nth(1)).toBeDisabled();
  await page.evaluate(() => localStorage.setItem('room3d.chapters.v1', JSON.stringify(['room', 'hell'])));
  await page.click('button:has-text("Back")');
  await page.click('#t-campaign');
  await expect(page.locator('.chapter').nth(1)).toBeEnabled();
  await page.locator('.chapter').nth(1).click();
  // HELL_ENTRY story pages, then the cutscene
  for (let i = 0; i < 4 && !(await page.evaluate(() => !!window.__room.engine.cutscene)); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(400); }
  await page.waitForFunction(() => !!window.__room.engine.cutscene);
  await expect(page.locator('#letterbox')).toHaveClass(/on/);
  expect(await level(page, (L) => L.phase)).toBe('intro');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__room.engine.cutscene);
  expect(await level(page, (L) => L.phase)).toBe('fight');
});

test('campaign: the witch talks before the fight and your answer matters', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    localStorage.setItem('room3d.chapters.v1', JSON.stringify(['room', 'hell']));
    localStorage.setItem('room3d.profile.v1', JSON.stringify({ flags: { diary: true, books: [] }, maxHearts: 3, maxMana: 100, placed: { bed: { type: 'bed', slot: 'n', rot: 0 } } }));
  });
  await page.click('#t-campaign');
  await page.locator('.chapter').nth(2).click();
  await page.waitForFunction(() => !!window.__room.engine.cutscene || document.querySelector('#screen .story'));
  for (let i = 0; i < 6 && !(await page.locator('text=any last words').count()); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(400); }
  await expect(page.locator('.dialog')).toContainText('any last words');
  await page.click('button:has-text("Your diary says you hate lemons")');
  await page.click('button:has-text("Everyone, apparently")');
  await page.click('button:has-text("Fight!")');
  await page.waitForFunction(() => window.__room.engine.level.phase === 'fight');
  expect(await level(page, (L) => L.hp)).toBe(5);
});
