import { describe, it, expect, beforeEach } from 'vitest';

const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k) : null),
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
};
const save = await import('../src/save');

describe('personal bests', () => {
  beforeEach(() => store.clear());
  it('records only faster runs, per mode and per daily seed', () => {
    expect(save.recordRun('normal', null, 300, {})).toBe(true);
    expect(save.recordRun('normal', null, 320, {})).toBe(false);
    expect(save.recordRun('normal', null, 250, { Light: 5 })).toBe(true);
    expect(save.bestFor('normal').total).toBe(250);
    expect(save.recordRun('daily', '2026-10-20', 400, {})).toBe(true);
    expect(save.bestFor('daily', '2026-10-21')).toBeUndefined();
    expect(save.bestFor('hard')).toBeUndefined();
  });
});

describe('achievements', () => {
  it('unlock once and notify', () => {
    const seen: string[] = [];
    save.setAchievementListener((a) => seen.push(a.id));
    expect(save.unlock('light')).toBe(true);
    expect(save.unlock('light')).toBe(false);
    expect(save.unlock('not-a-real-id')).toBe(false);
    expect(seen).toEqual(['light']);
  });
  it('have unique ids', () => {
    const ids = save.ACHIEVEMENTS.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
