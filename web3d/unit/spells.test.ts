import { describe, it, expect } from 'vitest';
import { manaCost, SPELLS } from '../src/spells';

describe('mana costs', () => {
  it('scale with object size', () => {
    expect(manaCost('cushion')).toBeLessThan(manaCost('pc'));
    expect(manaCost('pc')).toBeLessThan(manaCost('bed'));
    expect(manaCost('bed')).toBeLessThan(manaCost('hell'));
  });
  it('the starting pool can afford the core puzzle path in pieces', () => {
    expect(manaCost('lamp') + manaCost('cushion') + manaCost('pc')).toBeLessThanOrEqual(100);
    expect(manaCost('hell') + manaCost('door')).toBeLessThanOrEqual(100);
  });
  it('every learnable spell has a cost and a hint', () => {
    for (const id of Object.keys(SPELLS)) {
      expect(manaCost(id)).toBeGreaterThan(0);
      expect(SPELLS[id].learn.length).toBeGreaterThan(0);
    }
  });
});
