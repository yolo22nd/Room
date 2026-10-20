import { test, expect } from '@playwright/test';
import { boot, roomSave, level } from './helpers.js';

test('an anvil dropped on the showcase smashes the glass', async ({ page }) => {
  await boot(page, { save: roomSave('room', { placed: { showcase: { type: 'showcase', slot: 'e', rot: 3 } } }) });
  await page.click('#t-continue');
  await page.waitForFunction(() => window.__room.engine.level && window.__room.engine.level.entities.has('showcase'));
  await level(page, (L) => { const r = L.entities.get('showcase').rect; return L.dropJunk('anvil', { x: (r.minX + r.maxX) / 2, y: 0, z: (r.minZ + r.maxZ) / 2 }); });
  await page.waitForFunction(() => window.__room.engine.level.state.flags.showcaseSmashed === true, null, { timeout: 60_000 });
  expect(await level(page, (L) => L.state.flags.showcaseOpen)).toBe(true);
});
