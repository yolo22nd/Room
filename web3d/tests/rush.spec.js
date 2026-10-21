import { test, expect } from '@playwright/test';
import { boot, level } from './helpers.js';

test('boss rush: locked until the kraken falls; kraken then witch; a time on the board', async ({ page }) => {
  const errors = await boot(page);
  await page.click('#t-rush');
  await expect(page.locator('button:has-text("Start the rush")')).toBeDisabled();
  await page.click('.dialog button:has-text("Back")');
  await page.evaluate(() => localStorage.setItem('room3d.chapters.v1', JSON.stringify(['room', 'hell'])));
  await page.click('#t-rush');
  await page.click('button:has-text("Start the rush")');
  await page.waitForFunction(() => window.__room.engine.level && window.__room.engine.level.tentacles && window.__room.engine.level.phase === 'fight');
  await expect(page.locator('#timer')).toBeVisible();
  // a campaign save is never written by the rush
  expect(await page.evaluate(() => localStorage.getItem('room3d.save.v1'))).toBeNull();
  await level(page, (L, R) => { R.engine.roomState.hearts = 2; L.win(); });
  await page.waitForFunction(() => window.__room.engine.level.phase === 'won', null, { timeout: 60_000 });
  await level(page, (L, R) => R.engine.player.pos.set(L.exit.position.x, 0, L.exit.position.z));
  await page.waitForFunction(() => window.__room.engine.level && window.__room.engine.level.witch, null, { timeout: 30_000 });
  expect(await page.evaluate(() => window.__room.engine.roomState.hearts)).toBe(3);
  for (let i = 0; i < 6; i++) await level(page, (L) => { L.w.state = 'cast'; L.hitWitch(); });
  await page.waitForSelector('#screen h1:has-text("Rush cleared")', { timeout: 30_000 });
  await expect(page.locator('#screen tr.mine')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('room3d.achievements.v1'))).toContain('"rush"');
  expect(await page.evaluate(() => localStorage.getItem('room3d.save.v1'))).toBeNull();
  expect(errors).toEqual([]);
});

test('boss rush: dying ends the rush with a retry', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => localStorage.setItem('room3d.chapters.v1', JSON.stringify(['room', 'hell'])));
  await page.evaluate(() => window.__room.engine.startRush());
  await page.waitForFunction(() => window.__room.engine.level && window.__room.engine.level.tentacles);
  await page.evaluate(() => window.__room.engine.damage(9, 'testing'));
  await expect(page.locator('#screen h1')).toHaveText('Rush over');
  await page.click('#r-again');
  await page.waitForFunction(() => window.__room.engine.rush && window.__room.engine.level.tentacles);
});
