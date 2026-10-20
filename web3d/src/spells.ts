import * as THREE from 'three';
import * as ui from './ui';
import { sfx } from './audio';

// Mana costs and the three learnable spells, shared by every level.
const COSTS = {
  lamp: 5, cushion: 8, chair: 8, ball: 4, crate: 8,
  pc: 18, table: 18, shoerack: 15, shelf: 22, closet: 22, showcase: 22, dine: 22,
  bed: 30, sofa: 30, anvil: 25, door: 15, tv: 15,
  bathroom: 40, kitchen: 40, hell: 45,
  furniture: 12, nail: 45, levitate: 15, shrink: 25, blink: 20,
};
export const manaCost = (k) => COSTS[k] ?? 15;

export const SPELLS = {
  levitate: { name: 'Levitate', icon: '🪶', desc: 'Lift a piece of furniture and set it down somewhere else.', learn: 'Read "Conjuration for Newbies".' },
  shrink: { name: 'Shrink', icon: '🐭', desc: 'Become tiny for 10 seconds: slip under furniture, and be a smaller target.', learn: 'Dream it.' },
  blink: { name: 'Blink', icon: '✨', desc: 'Teleport to the spot you aim at (up to 8 m).', learn: 'Pay attention to the witch\'s channel.' },
};

export function learn(state, id) {
  const sp = state.flags.spells || (state.flags.spells = {});
  if (sp[id]) return false;
  sp[id] = true;
  const s = SPELLS[id];
  sfx.achievement();
  ui.toast(`${s.icon} New spell: <b>${s.name}</b>`, s.desc);
  return true;
}
export const knows = (state, id) => !!(state.flags.spells && state.flags.spells[id]);

export function castShrink(engine) {
  const p = engine.player;
  if (!engine.spend(manaCost('shrink'))) return false;
  sfx.whisper();
  ui.log('You shrink to the size of a mouse! (10 seconds)', 'good');
  p.shrunk = 10;
  return true;
}

/** Teleports the player to `point` if it is walkable and within range. */
export function castBlink(engine, fx, point) {
  const p = engine.player;
  if (!point) { ui.log('Aim at the floor to blink.', 'warn'); return false; }
  const d = Math.hypot(point.x - p.pos.x, point.z - p.pos.z);
  if (d > 8) { ui.log('Too far to blink (8 m max).', 'warn'); return false; }
  const lv = engine.level;
  if (!p.walkable(point.x, point.z, p.pos.x, p.pos.z) || (lv && lv.blinkBlocked && lv.blinkBlocked(point))) { sfx.locked(); ui.log('You can\'t blink into that.', 'warn'); return false; }
  if (!engine.spend(manaCost('blink'))) return false;
  fx.burst(p.pos.clone().setY(1), { count: 18, color: '#9fe8ff', size: 0.4, speed: 2 });
  p.pos.set(point.x, 0, point.z);
  fx.burst(new THREE.Vector3(point.x, 1, point.z), { count: 22, color: '#9fe8ff', size: 0.45, speed: 2.5 });
  sfx.whoosh();
  return true;
}
