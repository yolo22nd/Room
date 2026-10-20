import { test, expect } from '@playwright/test';
import { readdirSync, statSync } from 'node:fs';
import { boot, roomSave } from './helpers.js';

test('bundle size budget', async () => {
  const dir = new URL('../dist/assets/', import.meta.url);
  const files = readdirSync(dir).filter(f => f.endsWith('.js'));
  const size = (f) => statSync(new URL(f, dir)).size;
  const main = files.filter(f => f.startsWith('index-')).map(size).reduce((a, b) => a + b, 0);
  const physics = files.filter(f => f.startsWith('rapier')).map(size).reduce((a, b) => a + b, 0);
  expect(main, 'main bundle bytes').toBeLessThan(950_000);
  expect(physics, 'lazy physics chunk bytes').toBeLessThan(2_300_000);
});

const BUDGET = { room: 120, hell: 120, witch: 80, library: 120 };
for (const [name, save] of [['room', roomSave('room', { placed: { bed: { type: 'bed', slot: 'nw', rot: 0 }, sofa: { type: 'sofa', slot: 's', rot: 2 }, shelf: { type: 'shelf', slot: 'n', rot: 0 }, bathroom: { type: 'bathroom', slot: 'w', rot: 0 } } })], ['hell', roomSave('hell')], ['witch', roomSave('witch')], ['library', { ...roomSave('lesson'), lesson: 'library' }]]) {
  test(`draw-call budget: ${name}`, async ({ page }) => {
    await boot(page, { save });
    await page.click('#t-continue');
    await page.waitForFunction(() => window.__room.engine.level && window.__room.engine.mode === 'play');
    await page.waitForTimeout(1000);
    const per = await page.evaluate(async () => {
      const e = window.__room.engine; const info = e.renderer.info;
      info.autoReset = false; info.reset();
      const f0 = e.frames;
      await new Promise(r => setTimeout(r, 1500));
      const frames = e.frames - f0;
      const res = { calls: info.render.calls / frames, tris: info.render.triangles / frames };
      info.autoReset = true;
      return res;
    });
    console.log(name, JSON.stringify(per));
    expect(per.calls, 'draw calls per frame').toBeLessThan(BUDGET[name]);
    expect(per.tris, 'triangles per frame').toBeLessThan(1_500_000);
  });
}
