import { test, expect } from '@playwright/test';
import { boot, level } from './helpers.js';

test('editor: build, share as a link, and escape the shared room', async ({ page, context }) => {
  await boot(page);
  await page.click('#t-editor');
  await page.waitForFunction(() => window.__room.engine.level && window.__room.engine.roomState.mode === 'editor');
  await level(page, (L) => { L.conjureAt('sofa', 's'); L.conjureAt('door', 'w'); });
  await page.waitForFunction(() => window.__room.engine.level.drops.length === 0);
  await level(page, (L, R) => { const c = R.engine.roomState.custom; c.keyIn = 'sofa'; c.exit = 'w'; c.title = 'Test Room'; });
  await page.keyboard.press('Escape');
  await page.click('button:has-text("Share link")');
  const url = await page.inputValue('#share-url');
  expect(url).toContain('#room=');

  const p2 = await context.newPage();
  await p2.goto(url);
  await p2.click('#t-shared');
  await p2.waitForFunction(() => window.__room.engine.roomState && window.__room.engine.roomState.mode === 'custom');
  await level(p2, (L) => L.use_door({ key: 'door_w' }));
  expect(await level(p2, (L) => L.state.flags.door_w)).toBeFalsy(); // locked without the key
  await level(p2, (L, R) => { R.engine.player.pos.set(0, 0, 2.2); L.search(); });
  await p2.waitForFunction(() => window.__room.engine.level.state.flags.customKey === true);
  await level(p2, (L) => L.use_door({ key: 'door_w' }));
  await expect(p2.locator('#screen h1')).toHaveText('Escaped!', { timeout: 20_000 });
});
