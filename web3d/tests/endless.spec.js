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
      if (room.plates) {
        // plates must be satisfiable with distinct furniture types
        const caps = Object.values(WEIGHT).sort((a, b) => b - a);
        const needs = room.plates.map(p => p.need).sort((a, b) => b - a);
        if (needs.some((n, i) => n > caps[i])) out.push(`impossible plates ${s}/${d}: ${needs}`);
      }
      if (room.kind === 'hunt' && new Set(room.hidden.map(o => o.type)).size !== room.hidden.length) out.push(`duplicate hunt types ${s}/${d}`);
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

test('endless: memory runes fade, peek costs mana, solving from memory opens the exit', async ({ page }) => {
  await boot(page);
  await page.click('#t-endless');
  await page.click('button:has-text("New run")');
  await page.waitForFunction(() => window.__room.engine.level && window.__room.engine.run);
  await page.evaluate(() => { const e = window.__room.engine; e.run.depth = 3; e.run.forceKind = 'memory'; e.nextRunRoom(); });
  await page.waitForFunction(() => window.__room.engine.level.kind === 'memory');
  expect(await level(page, (L) => L.runes.every(r => r.panel.visible))).toBe(true);
  await level(page, (L) => { L.memT = 0.2; L.hazardT = 999; });
  await page.waitForFunction(() => window.__room.engine.level.runes.every(r => !r.panel.visible));
  await expect(page.locator('#objective')).toContainText('Memory runes');
  const before = await page.evaluate(() => window.__room.engine.roomState.mana);
  await level(page, (L) => L.onAction('search'));
  expect(await page.evaluate(() => window.__room.engine.roomState.mana)).toBeLessThan(before - 20);
  await page.waitForFunction(() => window.__room.engine.level.runes.every(r => r.panel.visible));
  await level(page, (L, R) => { R.engine.roomState.mana = 999; for (const r of L.runes) L.conjureInstant(r.type, r.cell); L.check(); });
  await page.waitForFunction(() => !window.__room.engine.level.exit.locked);
});
