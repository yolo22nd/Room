import { test, expect } from '@playwright/test';
import { boot, level, advanceStory, waitGame } from './helpers.js';

test('act 1 puzzle chain: lamp, cushion+PC, rock-paper-scissors, keys, fossil', async ({ page }) => {
  const errors = await boot(page);
  await page.click('#t-new');
  await page.click('button:has-text("Normal")');
  await advanceStory(page);
  await expect(page.locator('#hud')).toBeVisible();

  // too scared to move without a lamp
  expect(await level(page, (L) => L.canMove())).toBe('nolamp');
  await level(page, (L) => { L.conjureLamp(); L.toggleLamp(); });
  expect(await level(page, (L) => L.canMove())).toBe(true);

  // a PC on the bare floor shatters; on a cushion it survives
  await level(page, (L) => L.conjureAt('pc', 'nw'));
  await page.waitForFunction(() => window.__room.engine.level.drops.length === 0);
  expect(await level(page, (L) => L.entities.has('pc'))).toBe(false);
  await level(page, (L) => L.conjureAt('cushion', 'w'));
  await page.waitForFunction(() => window.__room.engine.level.drops.length === 0);
  await level(page, (L) => L.conjureAt('pc', 'w'));
  await page.waitForFunction(() => window.__room.engine.level.drops.length === 0);
  expect(await level(page, (L) => L.entities.has('pc'))).toBe(true);

  // conjuring onto yourself hurts
  await level(page, (L) => L.conjureAt('sofa', 'm'));
  await page.waitForFunction(() => window.__room.engine.level.drops.length === 0);
  expect(await level(page, (L) => L.state.hearts)).toBe(2);

  // beat the PC at rock-paper-scissors through the real dialog
  await level(page, (L) => L.use_pc());
  await page.click('button:has-text("Play a game")');
  for (let i = 0; i < 80 && !(await page.locator('text=YOU WON!!!').count()); i++) {
    if (await page.locator('button:has-text("Rematch")').count()) { await page.click('button:has-text("Rematch")'); continue; }
    await page.click('[data-m="rock"]');
  }
  await page.click('button:has-text("Close the PC")');
  expect(await level(page, (L) => L.state.flags.pcWon)).toBe(true);

  // search where the PC stands
  await level(page, (L, R) => { R.engine.player.pos.set(-2, 0, 0); L.search(); });
  await page.waitForFunction(() => window.__room.engine.level.state.flags.showKey === true);

  // showcase: open with the invisible key, take the H key, learn the nail
  await level(page, (L, R) => { R.engine.roomState.mana = 100; L.conjureAt('showcase', 'e'); });
  await page.waitForFunction(() => window.__room.engine.level.drops.length === 0);
  await level(page, (L) => L.use_showcase());
  await page.click('button:has-text("Take the key")');
  await level(page, (L) => L.use_showcase());
  await page.click('button:has-text("Study the nail fossil")');
  await page.click('button:has-text("Got it")');
  const fl = await level(page, (L) => L.state.flags);
  expect(fl.hellKeyTaken && fl.nailKnown && fl.showcaseOpen).toBe(true);

  // the door beside hell locks itself without... and opens with the H key
  await level(page, (L, R) => { R.engine.roomState.mana = 100; L.conjureAt('hell', 'n'); L.conjureAt('door', 'n'); });
  await page.waitForFunction(() => window.__room.engine.level.drops.length === 0);
  await level(page, (L) => L.use_door({ key: 'door_n' }));
  expect(await level(page, (L) => L.state.flags.door_n)).toBe(true);
  await waitGame(page, 0.5);
  expect(errors).toEqual([]);
});

test('classic command line', async ({ page }) => {
  await boot(page);
  await page.click('#t-new');
  await page.click('button:has-text("Normal")');
  await advanceStory(page);
  for (const cmd of ['create lamp', 'turn lamp', 'create bed north east', 'create door w']) {
    await page.keyboard.press('Slash');
    await page.locator('#cli').fill(cmd);
    await page.locator('#cli').press('Enter');
  }
  await page.waitForFunction(() => window.__room.engine.level.drops.length === 0);
  const placed = await level(page, (L) => Object.keys(L.state.placed));
  expect(placed).toEqual(expect.arrayContaining(['bed', 'door_w']));
});

test('secrets: crooked book, closet panel, vault, lemon', async ({ page }) => {
  const { roomSave } = await import('./helpers.js');
  await boot(page, { save: roomSave('room', { placed: { shelf: { type: 'shelf', slot: 'n', rot: 0 }, closet: { type: 'closet', slot: 'nw', rot: 0 }, cushion: { type: 'cushion', slot: 'w', rot: 1 }, pc: { type: 'pc', slot: 'w', rot: 1 }, kitchen: { type: 'kitchen', slot: 'e', rot: 0 } } }) });
  await page.click('#t-continue');
  await level(page, (L) => L.readBook({ id: 'diary', title: 'x', text: '' }));
  await page.keyboard.press('Escape');
  await level(page, (L) => { L.pullBook(); });
  await page.keyboard.press('Escape');
  await level(page, (L) => { L.state.clothes = 'new'; L.state.flags.books.push('witch'); L.knockPanel(); });
  await page.keyboard.press('Escape');
  await level(page, (L) => L.use_pc());
  await page.click('button:has-text("vault.exe")');
  await page.locator('#vcode').fill('556');
  await page.locator('#vcode').press('Enter');
  await expect(page.locator('.dialog h2')).toHaveText('ACCESS GRANTED');
  const fl = await level(page, (L) => L.state.flags);
  expect(fl.wand && fl.cloak && fl.diary).toBe(true);
});
