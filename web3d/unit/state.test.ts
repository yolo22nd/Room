import { describe, it, expect } from 'vitest';
import { seededRandom, freshRoomState } from '../src/state';

describe('seededRandom', () => {
  it('is deterministic per seed and in [0, 1)', () => {
    const a = seededRandom('x'), b = seededRandom('x'), c = seededRandom('y');
    const sa = Array.from({ length: 50 }, a), sb = Array.from({ length: 50 }, b), sc = Array.from({ length: 50 }, c);
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
    expect(sa.every(v => v >= 0 && v < 1)).toBe(true);
  });
});

describe('freshRoomState', () => {
  it('normal starts dark with three hearts', () => {
    const s = freshRoomState();
    expect(s.lamp).toBeNull();
    expect(s.hearts).toBe(3);
    expect(Object.keys(s.placed)).toHaveLength(0);
  });
  it('hard has one heart', () => {
    expect(freshRoomState('hard').maxHearts).toBe(1);
  });
  it('daily is the same room for the same date, with four pre-built items on distinct cells', () => {
    const a = freshRoomState('daily', '2026-10-20'), b = freshRoomState('daily', '2026-10-20');
    expect(a.placed).toEqual(b.placed);
    expect(a.flags.keyCell).toBe(b.flags.keyCell);
    const slots = Object.values<any>(a.placed).map(p => p.slot);
    expect(slots).toHaveLength(4);
    expect(new Set(slots).size).toBe(4);
    expect(slots).not.toContain('m');
  });
  it('different dates give different rooms (usually)', () => {
    const days = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'].map(d => JSON.stringify(freshRoomState('daily', d).placed));
    expect(new Set(days).size).toBeGreaterThan(1);
  });
  it('editor and custom start lit with a custom block', () => {
    const e = freshRoomState('editor');
    expect(e.lamp).toBe('hand'); expect(e.lampOn).toBe(true);
    expect(e.custom).toMatchObject({ keyIn: null, exit: null });
  });
});
