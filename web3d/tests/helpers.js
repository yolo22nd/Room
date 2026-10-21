import { expect } from '@playwright/test';

/** Low quality, no audio, and an optional save/editor state injected before load. */
export async function boot(page, { save = null, editor = null, hash = '', firstRun = false } = {}) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(([save, editor, firstRun]) => {
    localStorage.clear();
    if (!firstRun) localStorage.setItem('room3d.onboard.v1', '1'); // skip the first-game controls card
    localStorage.setItem('room3d.settings.v1', JSON.stringify({ quality: 'low', music: 0, sfx: 0, autoRes: false }));
    if (save) localStorage.setItem('room3d.save.v1', JSON.stringify(save));
    if (editor) localStorage.setItem('room3d.editor.v1', JSON.stringify(editor));
  }, [save, editor, firstRun]);
  await page.goto('/' + hash);
  await expect(page.locator('#screen .title-wrap h1')).toHaveText('ROOM');
  return errors;
}

export function roomSave(act, room = {}, flags = {}) {
  return {
    version: 1, act,
    room: {
      mode: 'normal', placed: {}, lamp: 'hand', lampOn: true, hearts: 3, maxHearts: 3,
      shoes: 'shoes', clothes: 'old', player: { x: 0, z: 0, yaw: 0 }, ...room,
      flags: { books: [], ...flags },
    },
    stats: { time: 10, deaths: 0, conjured: 0, splits: {} },
  };
}

export const level = (page, fn, arg) => page.evaluate(([src, arg]) => {
  const L = window.__room.engine.level;
  return new Function('L', 'R', 'arg', src)(L, window.__room, arg);
}, [`return (${fn.toString()})(L, R, arg)`, arg]);

/** Waits for in-game time to pass (frames are slow under software GL). */
export async function waitGame(page, seconds) {
  await page.waitForFunction(([t]) => {
    const L = window.__room.engine.level;
    if (!window.__t0) window.__t0 = L.time;
    if (L.time - window.__t0 >= t) { window.__t0 = 0; return true; }
    return false;
  }, [seconds], { timeout: 90_000, polling: 100 });
}

export async function advanceStory(page, maxPages = 8) {
  for (let i = 0; i < maxPages; i++) {
    if (await page.locator('#screen .story').count() === 0) return;
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
  }
}
