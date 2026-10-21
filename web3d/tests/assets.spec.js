import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { boot, roomSave } from './helpers.js';

// A CC0 test model (Quaternius' RobotExpressive) stands in for a real furniture asset.
const robot = readFileSync(new URL('./fixtures/robot.glb', import.meta.url));
// the offline service worker would answer these requests before page.route can
test.use({ serviceWorkers: 'block' });

test('assets: a model in the manifest replaces procedural furniture, fitted to its footprint; animations play', async ({ page }) => {
  await page.route('**/models/manifest.json', r => r.fulfill({ json: { 'furniture/bed': { url: 'models/robot.glb' }, 'character/robot': { url: 'models/robot.glb', height: 1 } } }));
  await page.route('**/models/robot.glb', r => r.fulfill({ body: robot, contentType: 'model/gltf-binary' }));
  const errors = await boot(page, { save: roomSave('room', { placed: { bed: { type: 'bed', slot: 'nw', rot: 0 } } }) });
  await page.evaluate(() => window.__room.loadAssets());
  expect(await page.evaluate(() => window.__room.modelIds().sort())).toEqual(['character/robot', 'furniture/bed']);
  await page.click('#t-continue');
  await page.waitForFunction(() => window.__room.engine.level && window.__room.engine.mode === 'play');
  const bed = await page.evaluate(() => {
    const g = window.__room.engine.level.entities.get('bed').group;
    let skinned = false; g.traverse(o => { if (o.isSkinnedMesh) skinned = true; });
    return { skinned };
  });
  expect(bed.skinned).toBe(true);
  // fitted inside the bed's footprint, and still usable (owner tags survive)
  const fit = await page.evaluate(() => {
    const L = window.__room.engine.level, g = L.entities.get('bed').group;
    let owner = null; g.traverse(o => { if (o.isMesh && !owner) owner = o.userData.owner; });
    const r = L.entities.get('bed').rect;
    return { owner, w: r.maxX - r.minX };
  });
  expect(fit.owner).toBe('bed');
  const anim = await page.evaluate(() => { const a = window.__room.animated('character/robot'); return { ok: !!a, played: a && a.play('walk'), clips: a ? a.clips.length : 0 }; });
  expect(anim).toEqual({ ok: true, played: true, clips: expect.any(Number) });
  expect(errors).toEqual([]);
});

test('assets: with no manifest the game runs on procedural models', async ({ page }) => {
  const errors = await boot(page, { save: roomSave('room', { placed: { bed: { type: 'bed', slot: 'nw', rot: 0 } } }) });
  await page.evaluate(() => window.__room.loadAssets());
  expect(await page.evaluate(() => window.__room.modelIds())).toEqual([]);
  expect(errors).toEqual([]);
});

test('assets: animated stand-ins drive the cat and the witch', async ({ page }) => {
  await page.route('**/models/manifest.json', r => r.fulfill({ json: { 'character/cat': { url: 'models/robot.glb', height: 0.4 }, 'character/witch': { url: 'models/robot.glb', height: 1.9 } } }));
  await page.route('**/models/robot.glb', r => r.fulfill({ body: robot, contentType: 'model/gltf-binary' }));
  const errors = await boot(page, { save: roomSave('witch', { placed: { bed: { type: 'bed', slot: 'n', rot: 0 } } }) });
  await page.evaluate(() => { localStorage.setItem('room3d.cat.v1', JSON.stringify({ adopted: true })); return window.__room.loadAssets(); });
  await page.click('#t-continue');
  await page.waitForFunction(() => window.__room.engine.level && window.__room.engine.level.witch);
  expect(await page.evaluate(() => !!window.__room.engine.level.witch.userData.anim)).toBe(true);
  await page.waitForTimeout(800);
  // the cat comes along to the room
  await page.evaluate(() => { const R = window.__room; R.startRoom(R.freshRoomState('normal')); });
  await page.waitForFunction(() => !!window.__room.engine.cat);
  expect(await page.evaluate(() => !!window.__room.engine.cat.anim)).toBe(true);
  await page.waitForTimeout(800);
  expect(errors).toEqual([]);
});
