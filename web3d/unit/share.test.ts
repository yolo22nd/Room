import { describe, it, expect } from 'vitest';
import { encodeRoom, decodeRoom } from '../src/share';

const placed = {
  bed: { type: 'bed', slot: 'ne', rot: 0 },
  sofa: { type: 'sofa', slot: 's', rot: 2 },
  door_w: { type: 'door', slot: 'w', rot: 0 },
  kitchen: { type: 'kitchen', slot: 'e', rot: 0 },
};
const custom = { title: 'Sofa Secrets ✨', note: 'Comfy places hide things.', keyIn: 'sofa', exit: 'w' };

describe('room share codec', () => {
  it('round-trips layout, unicode title, key and exit', () => {
    const code = encodeRoom(placed, custom);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    const d = decodeRoom(code);
    expect(d.placed).toEqual(placed);
    expect(d.custom).toEqual(custom);
  });
  it('rejects garbage', () => {
    expect(decodeRoom('not-a-room')).toBeNull();
    expect(decodeRoom('')).toBeNull();
  });
  it('drops unknown types and clamps text', () => {
    const json = JSON.stringify({ v: 1, t: 'x'.repeat(200), n: '', p: [[999, 'n', 0], [0, 'm', 7]], k: null, x: null });
    const code = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const d = decodeRoom(code);
    expect(d.custom.title).toHaveLength(60);
    expect(Object.values<any>(d.placed)).toHaveLength(1);
    expect(Object.values<any>(d.placed)[0].rot).toBeLessThan(4);
  });
});
