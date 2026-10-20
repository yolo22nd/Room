import { test, expect } from '@playwright/test';
import { boot, level } from './helpers.js';

test('endless: every generated room is solvable for many seeds and depths', async ({ page }) => {
  await boot(page);
  await page.click('#t-endless');
  await page.click('button:has-text("New run")');
  await page.waitForFunction(() => window.__room.engine.level && window.__room.engine.run);
  const problems = await level(page, (L, R) => {
    const out = [];
    const RogueRoom = L.constructor;
    const WEIGHT = { cushion: 1, chair: 1, shoerack: 2, table: 2, shelf: 3, showcase: 3, sofa: 3, dine: 4, closet: 4, bed: 5 };
    for (let s = 0; s < 12; s++) for (let d = 0; d < 12; d++) {
      const run = { ...R.engine.run, seed: 'seed' + s, depth: d };
      const room = new RogueRoom(R.engine, R.engine.roomState, run);
      if (room.runes) {
        const keys = room.runes.map(r => room.cellKey(r.cell));
        if (new Set(keys).size !== keys.length) out.push(`dup rune cells ${s}/${d}`);
        const types = room.runes.map(r => r.type);
        if (new Set(types).size !== types.length) out.push(`dup rune types ${s}/${d}`);
      }
      if (room.plates && room.plates.some(p => p.need > 5)) out.push(`impossible plate ${s}/${d}`);
      if (room.kind === 'hunt' && (!room.keyIn || room.hidden.length < 2)) out.push(`bad hunt ${s}/${d}`);
      room.deactivate && room.scene.clear();
    }
    return out;
  });
  expect(problems).toEqual([]);
});

test('endless: clear a room, pick an upgrade, then die and see the leaderboard', async ({ page }) => {
  await boot(page);
  await page.click('#t-endless');
  await page.click('button:has-text("New run")');
  await page.waitForFunction(() => window.__room.engine.level && window.__room.engine.level.runes);
  await level(page, (L, R) => { R.engine.roomState.mana = 999; for (const r of L.runes) L.conjure(r.type, r.cell); });
  await page.waitForFunction(() => window.__room.engine.level.drops.length === 0);
  expect(await level(page, (L) => L.exit.locked)).toBe(false);
  await level(page, (L) => L.useExit());
  await expect(page.locator('.dialog h2')).toHaveText('Room 1 cleared!');
  await page.locator('.dialog .actions button').first().click();
  await page.waitForFunction(() => window.__room.engine.run && window.__room.engine.run.depth === 1 && window.__room.engine.level.run.depth === 1);
  expect(await page.evaluate(() => window.__room.engine.run.upgrades.length)).toBe(1);
  await page.evaluate(() => { const e = window.__room.engine; e.roomState.hearts = 1; e.damage(1, 'test'); });
  await expect(page.locator('#screen h1')).toHaveText('Run over');
  await expect(page.locator('#screen .splits')).toContainText('1 rooms');
});
