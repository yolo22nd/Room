import { test, expect } from '@playwright/test';
import { boot, roomSave } from './helpers.js';

// Deterministic frames: seeded Math.random and frozen game time. Small
// tolerances absorb lamp flicker and GPU rounding differences.
async function deterministic(page) {
  await page.addInitScript(() => {
    let s = 1234567;
    Math.random = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x80000000; };
    window.__freeze = true;
  });
}
const shot = { maxDiffPixelRatio: 0.03, threshold: 0.25, animations: 'disabled' };

test('visual: title scene', async ({ page }) => {
  await deterministic(page);
  await boot(page);
  await page.evaluate(() => document.getElementById('screen').classList.add('hidden'));
  await page.waitForTimeout(800);
  await expect(page).toHaveScreenshot('title-scene.png', shot);
});

test('visual: furnished room', async ({ page }) => {
  await deterministic(page);
  const placed = {
    bed: { type: 'bed', slot: 'nw', rot: 0 }, shelf: { type: 'shelf', slot: 'n', rot: 0 }, sofa: { type: 'sofa', slot: 's', rot: 2 },
    cushion: { type: 'cushion', slot: 'w', rot: 1 }, pc: { type: 'pc', slot: 'w', rot: 1 }, showcase: { type: 'showcase', slot: 'e', rot: 3 },
  };
  await boot(page, { save: roomSave('room', { placed, player: { x: 0, z: 2.5, yaw: 0 } }) });
  await page.click('#t-continue');
  await page.waitForFunction(() => window.__room.engine.level && window.__room.engine.level.entities.size >= 6);
  await page.evaluate(() => { document.getElementById('hud').classList.add('hidden'); const p = window.__room.engine.player; p.pitch = -0.2; });
  await page.waitForTimeout(800);
  await expect(page).toHaveScreenshot('room.png', shot);
});

test('visual: hell arena', async ({ page }) => {
  await deterministic(page);
  await boot(page, { save: roomSave('hell') });
  await page.click('#t-continue');
  await page.waitForFunction(() => window.__room.engine.level && window.__room.engine.level.tentacles);
  await page.evaluate(() => document.getElementById('hud').classList.add('hidden'));
  await page.waitForTimeout(800);
  await expect(page).toHaveScreenshot('hell.png', shot);
});
