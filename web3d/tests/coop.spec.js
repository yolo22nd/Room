import { test, expect } from '@playwright/test';
import { boot } from './helpers.js';

test('co-op: swap codes, see each other, solve the twin room together', async ({ browser }) => {
  const ctx = await browser.newContext();
  const host = await ctx.newPage(), guest = await ctx.newPage();
  await boot(host); await boot(guest);
  await host.click('#t-coop'); await host.click('button:has-text("Host a room")');
  await host.waitForSelector('#co-offer', { timeout: 20_000 });
  const offer = await host.inputValue('#co-offer');
  expect(offer.length).toBeGreaterThan(50);
  await guest.click('#t-coop'); await guest.click('button:has-text("Join a room")');
  await guest.fill('#co-offer', offer);
  await guest.click('button:has-text("Create my reply code")');
  await guest.waitForSelector('#co-answer', { timeout: 20_000 });
  const answer = await guest.inputValue('#co-answer');
  await host.fill('#co-answer', answer);
  await host.click('button:has-text("Connect")');
  for (const p of [host, guest]) await p.waitForFunction(() => window.__room.engine.level && window.__room.engine.level.chapterId === 'coop', null, { timeout: 30_000 });
  // the guest receives the host's runes
  await guest.waitForFunction(() => window.__room.engine.level.runes);
  const runes = await host.evaluate(() => window.__room.engine.level.runes.map(r => ({ cell: r.cell, type: r.type })));
  // the guest conjures one rune's furniture (through the host), the host the other
  await guest.evaluate((r) => window.__room.engine.level.conjure(r.type, r.cell), runes[0]);
  await host.waitForFunction((t) => window.__room.engine.level.objects.has(t), runes[0].type);
  await host.evaluate((r) => window.__room.engine.level.conjure(r.type, r.cell), runes[1]);
  await guest.waitForFunction((t) => window.__room.engine.level.objects.has(t), runes[1].type);
  await host.waitForFunction(() => window.__room.engine.level.runes.every(r => r.done) && window.__room.engine.level.drops.length === 0);
  // one plate each
  await host.evaluate(() => { const L = window.__room.engine.level; const c = L.cellCenter([0, 1]); window.__room.engine.player.pos.set(c.x, 0, c.z); });
  await guest.evaluate(() => { const L = window.__room.engine.level; const c = L.cellCenter([3, 1]); window.__room.engine.player.pos.set(c.x, 0, c.z); });
  await guest.waitForFunction(() => !window.__room.engine.level.exit.locked, null, { timeout: 30_000 });
  await guest.evaluate(() => window.__room.engine.level.useExit());
  for (const p of [host, guest]) await expect(p.locator('#screen h1')).toHaveText('Escaped together!', { timeout: 20_000 });
  await ctx.close();
});
