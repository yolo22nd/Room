import { test, expect } from '@playwright/test';
import { boot, roomSave, level } from './helpers.js';

test('mana: conjuring costs mana and refuses when empty', async ({ page }) => {
  await boot(page, { save: roomSave('room', { mana: 20, maxMana: 100 }) });
  await page.click('#t-continue');
  await page.waitForFunction(() => window.__room.engine.level && window.__room.input.enabled);
  expect(await level(page, (L, R) => { R.engine.roomState.mana = 20; return L.conjureAt('bed', 'n'); })).toBe(false); // bed costs 30
  expect(await level(page, (L, R) => { R.engine.roomState.mana = 40; return L.conjureAt('bed', 'n'); })).toBe(true);
  expect(await level(page, (L, R) => R.engine.roomState.mana)).toBeLessThan(15);
});

test('spells: learn levitate from the book, move furniture; shrink finds the crystal; blink teleports', async ({ page }) => {
  await boot(page, { save: roomSave('room', { placed: { bed: { type: 'bed', slot: 'ne', rot: 0 }, shelf: { type: 'shelf', slot: 'n', rot: 0 } } }) });
  await page.click('#t-continue');
  await page.waitForFunction(() => window.__room.engine.level && window.__room.input.enabled);
  await level(page, (L) => L.readBook({ id: 'conjuring', title: 'Conjuration for Newbies', text: '' }));
  await page.keyboard.press('Escape');
  expect(await level(page, (L) => L.state.flags.spells.levitate)).toBe(true);

  // levitate the bed from ne to sw
  await level(page, (L) => { L.castSpell('levitate'); });
  await level(page, (L, R) => { const p = R.engine.player; p.pos.set(3, 0, -0.8); p.yaw = 0; p.pitch = -0.5; });
  await page.waitForTimeout(400);
  await level(page, (L) => L.levCast());
  expect(await level(page, (L) => L.placing && L.placing.moveKey)).toBe('bed');
  await level(page, (L) => { L.placing.target = 'sw'; L.updatePlacing = () => {}; L.castPlacing(); delete L.updatePlacing; });
  await page.waitForFunction(() => window.__room.engine.level.drops.length === 0);
  expect(await level(page, (L) => L.entities.get('bed').slot)).toBe('sw');

  // shrink and search under the bed
  await level(page, (L, R) => { L.state.flags.spells.shrink = true; R.engine.roomState.mana = 100; L.castSpell('shrink'); const r = L.entities.get('bed').rect; R.engine.player.pos.set((r.minX + r.maxX) / 2, 0, (r.minZ + r.maxZ) / 2); L.search(); });
  await page.waitForFunction(() => window.__room.engine.level.state.flags.crystal === true);
  expect(await level(page, (L, R) => R.engine.roomState.maxMana)).toBe(125);

  // blink
  await level(page, (L, R) => { L.state.flags.spells.blink = true; R.engine.player.shrunk = 0; R.engine.player.pos.set(0, 0, 0); });
  await level(page, (L) => L.castSpell('blink'));
  await level(page, (L) => { L.placing.target = { x: 2.5, y: 0, z: 2.5 }; L.updatePlacing = () => {}; L.castPlacing(); delete L.updatePlacing; });
  const pos = await page.evaluate(() => window.__room.engine.player.pos.toArray());
  expect(pos[0]).toBeCloseTo(2.5); expect(pos[2]).toBeCloseTo(2.5);
});
