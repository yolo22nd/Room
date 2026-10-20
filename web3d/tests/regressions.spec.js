import { test, expect } from '@playwright/test';
import { boot, roomSave, level } from './helpers.js';

test('starting endless keeps the campaign save; leaving modes leaks nothing', async ({ page }) => {
  await boot(page, { save: roomSave('room') });
  const lights0 = await page.evaluate(() => window.__room.engine.camera.children.length);
  // a few title -> game round trips must not pile up lights on the camera
  for (let i = 0; i < 3; i++) {
    await page.click('#t-continue');
    await page.waitForFunction(() => window.__room.engine.level && window.__room.engine.mode === 'play');
    await page.evaluate(() => window.__room.showTitle());
    await page.waitForSelector('#t-continue');
  }
  expect(await page.evaluate(() => window.__room.engine.camera.children.length)).toBe(lights0);
  await page.click('#t-endless');
  await page.click('button:has-text("New run")');
  await page.waitForFunction(() => window.__room.engine.run);
  await page.evaluate(() => window.__room.showTitle());
  await expect(page.locator('#t-continue')).toBeVisible();
  // boss speed doesn't carry into other levels
  await page.evaluate(() => { window.__room.engine.player.speed = 4.4; });
  await page.click('#t-continue');
  await page.waitForFunction(() => window.__room.engine.level && window.__room.engine.mode === 'play');
  expect(await page.evaluate(() => window.__room.engine.player.speed)).toBe(3);
});

test('campaign chapter 2 shows the HUD', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => localStorage.setItem('room3d.chapters.v1', JSON.stringify(['room'])));
  await page.click('#t-campaign');
  await page.locator('.chapter').nth(1).click();
  for (let i = 0; i < 12; i++) {
    if (await page.evaluate(() => { const e = window.__room.engine; return e.level && e.level.tentacles && e.level.phase === 'fight' && !e.cutscene; })) break;
    await page.keyboard.press('Enter'); await page.waitForTimeout(500);
  }
  await page.waitForFunction(() => window.__room.engine.level.phase === 'fight' && !window.__room.engine.cutscene);
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#hearts')).toBeVisible();
});

test('blink cannot pass through a closed wall into an annex', async ({ page }) => {
  await boot(page, { save: roomSave('room', { placed: { hell: { type: 'hell', slot: 'n', rot: 0 }, door_n: { type: 'door', slot: 'n', rot: 0 } } }, { spells: { blink: true } }) });
  await page.click('#t-continue');
  await page.waitForFunction(() => window.__room.engine.level && window.__room.engine.mode === 'play');
  const moved = await level(page, (L, R) => {
    R.engine.player.pos.set(0, 0, -3.5);
    L.castSpell('blink');
    L.placing.target = { x: 0, y: 0, z: -6.5 }; L.updatePlacing = () => {}; L.castPlacing(); delete L.updatePlacing;
    return R.engine.player.pos.z;
  });
  expect(moved).toBeCloseTo(-3.5);
});

test('photo mode keeps the held lamp lit; endless hides the lamp button; runs show their exact time', async ({ page }) => {
  await boot(page, { save: roomSave('room') });
  await page.click('#t-continue');
  await page.waitForFunction(() => window.__room.engine.level && window.__room.engine.mode === 'play');
  await page.evaluate(() => window.__room.enterPhoto());
  const lit = await page.evaluate(() => { let n = 0; window.__room.engine.camera.traverseVisible((o) => { if (o.isLight) n++; }); return n; });
  expect(lit).toBeGreaterThan(0);
  await page.evaluate(() => window.__room.exitPhoto());
  await page.evaluate(() => window.__room.showTitle());
  await page.click('#t-endless');
  await page.click('button:has-text("New run")');
  await page.waitForFunction(() => window.__room.engine.run);
  await expect(page.locator('#touch-buttons [data-act=lamp]')).toHaveClass(/hidden/);
  await page.evaluate(() => { const e = window.__room.engine; e.stats.time = 12.34; e.roomState.hearts = 1; e.damage(1, 'test'); });
  await page.waitForSelector('#screen h1');
  await expect(page.locator('#screen .stats')).toContainText('0:12.3');
  await expect(page.locator('#screen tr.mine')).toContainText('0:12.3');
});
