import { test, expect } from '@playwright/test';
import { boot, level, advanceStory } from './helpers.js';

async function startAct5(page) {
  await page.evaluate(() => {
    localStorage.setItem('room3d.chapters.v1', JSON.stringify(['room', 'hell', 'witch']));
    localStorage.setItem('room3d.lessons.v1', JSON.stringify(['upside', 'library', 'clockwork']));
  });
  await page.click('#t-campaign');
  await page.click('.chapter:has-text("Checkout Time")');
  for (let i = 0; i < 12; i++) {
    if (await page.evaluate(() => { const e = window.__room.engine; return e.level && e.level.eyes && e.level.phase === 'fight' && !e.cutscene; })) break;
    await page.keyboard.press('Enter'); await page.waitForTimeout(500);
  }
  await page.waitForFunction(() => { const e = window.__room.engine; return e.level && e.level.eyes && e.level.phase === 'fight' && !e.cutscene; }, null, { timeout: 60_000 });
}

test('act 5: the room stomps, its real eye takes hits, fakes retaliate, and it lets you go', async ({ page }) => {
  const errors = await boot(page);
  await startAct5(page);
  await expect(page.locator('#boss-name')).toHaveText('The Room');
  // the ceiling stomps where you stand
  await level(page, (L, R) => { R.engine.roomState.hearts = 3; L.attackT = 999; const p = R.engine.player.pos; L.stomp(L.cellOf(p.x, p.z)[0], L.cellOf(p.x, p.z)[1]); });
  await page.waitForFunction(() => window.__room.engine.roomState.hearts === 2, null, { timeout: 20_000 });
  // open eyes in stage 2: one real, one fake; dropping on the real one hurts the room
  await level(page, (L, R) => { R.engine.roomState.hearts = 99; L.hp = 4; L.closeEyes(); L.openEyes(); for (const e of L.eyes) e.t = 0.5; });
  expect(await level(page, (L) => L.eyes.filter(e => e.real).length)).toBe(1);
  expect(await level(page, (L) => L.eyes.length)).toBe(2);
  await level(page, (L) => { const e = L.eyes.find(x => x.real); e.g.userData.lid.scale.y = 1; L.landed({ target: e.g.position.clone(), type: 'chair' }); });
  expect(await level(page, (L) => L.hp)).toBe(3);
  // finish it
  await level(page, (L) => { L.hp = 1; L.closeEyes(); L.openEyes(); const e = L.eyes.find(x => x.real); e.t = 0.5; e.g.userData.lid.scale.y = 1; L.landed({ target: e.g.position.clone(), type: 'bed' }); });
  expect(await level(page, (L) => L.phase)).toBe('won');
  await page.waitForSelector('#screen .story', { timeout: 30_000 });
  await advanceStory(page, 8);
  await expect(page.locator('#screen h1')).toHaveText('Checkout Time');
  expect(await page.evaluate(() => localStorage.getItem('room3d.achievements.v1'))).toContain('landlord');
  expect(await page.evaluate(() => localStorage.getItem('room3d.chapters.v1'))).toContain('landlord');
  expect(errors).toEqual([]);
});

test('act 5: dying offers a retry of the fight from the checkpoint', async ({ page }) => {
  await boot(page);
  await startAct5(page);
  await page.evaluate(() => window.__room.engine.damage(99, 'testing'));
  await expect(page.locator('#retry')).toHaveText('Retry the fight');
  await page.click('#retry');
  await page.waitForFunction(() => { const e = window.__room.engine; return e.level && e.level.eyes && e.level.phase === 'fight'; });
});
