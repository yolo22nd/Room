// Searching the floor, custom-room keys and the Hell portal.
import * as THREE from 'three';
import { COL } from '../a11y';
import {
  Room, CELLS, SIDES, SIDE_NAMES, CELL_NAMES, cellCenter, cellAt, sideMatrix, sideRot,
  HALF, WALL_H, GAP_W, ANNEX_W, ANNEX_D, WALL_T,
} from '../room';
import { CATALOG, buildObject, buildDoor, buildTV, makeLantern, makeGhostKey, buildJunk } from '../models';
import { loadPhysics, PhysicsWorld } from '../physics';
import { SPELLS, manaCost, learn, knows, castShrink, castBlink } from '../spells';
import { ring } from '../textures';
import { RADIUS } from '../player';
import { FX } from '../fx';
import { glowSprite } from '../textures';
import * as ui from '../ui';
import { sfx, playAmbience, setHeartbeat } from '../audio';
import { unlock } from '../save';
import { BOOKS, DREAM, TV_BROADCAST, KITCHEN_NOTE, MIRROR_LINES, PC_SURF, PC_MAIL, WITCH_DIARY } from '../story';

import { HUG, SEATS, ROT_FRONT, SIDE_FRONT_ROT } from './shared';

export const searchMethods = {
  search(this: any) {
    const fl = this.state.flags;
    if (this.player.sitting && this.player.sitting !== 'cushion') { ui.log('You need to stand (or sit on the floor) to search.'); return; }
    if (this.state.mode === 'custom' || this.state.mode === 'editor') { this.searchCustom(); return; }
    const pc = this.entities.get('pc');
    const here = cellAt(this.player.pos.x, this.player.pos.z);
    ui.log('You start searching, placing your hands on the floor around you...');
    const bed = this.entities.get('bed');
    if (this.player.shrunk > 0 && bed && !fl.crystal) {
      const r = bed.rect, p = this.player.pos;
      if (p.x > r.minX && p.x < r.maxX && p.z > r.minZ && p.z < r.maxZ) {
        setTimeout(() => {
      if (this.engine.level !== this) return;
          fl.crystal = true; sfx.key();
          const s = this.state; s.maxMana = (s.maxMana || 100) + 25; s.mana = s.maxMana;
          ui.log('Under the bed, at mouse height, a glowing blue crystal is wedged between the floorboards. (+25 max mana)', 'good');
          unlock('crystal'); this.refreshHUD(); this.engine.autosave();
        }, 700);
        return;
      }
    }
    setTimeout(() => {
      if (this.engine.level !== this) return;
      const keyHere = fl.keyCell ? (fl.pcWon && fl.keyCell === here) : (pc && pc.slot === here);
      if (keyHere && !fl.showKey) {
        fl.showKey = true;
        sfx.key();
        const k = makeGhostKey(); k.position.set(this.player.pos.x + this.player.forward().x * 0.6, 0.3, this.player.pos.z + this.player.forward().z * 0.6);
        this.scene.add(k); this.ghostKeyFx = { obj: k, t: 0 };
        ui.log('After a few minutes of searching, you find an INVISIBLE KEY! You pick it up.', 'good');
        unlock('invisible'); this.engine.split('Invisible key');
        this.refreshHUD(); this.engine.autosave();
      } else {
        ui.log('After a few minutes of searching, you find nothing... you quit searching.');
      }
    }, 900);
  },

  nearestEntity(this: any) {
    let best = null, bd = Infinity;
    const p = this.player.pos;
    for (const e of this.entities.values()) {
      if (CATALOG[e.type].kind !== 'floor') continue;
      const r = e.rect || this.footprint('cushion', e.slot, 0);
      const dx = Math.max(r.minX - p.x, 0, p.x - r.maxX), dz = Math.max(r.minZ - p.z, 0, p.z - r.maxZ);
      const d = Math.hypot(dx, dz);
      if (d < bd) { bd = d; best = e; }
    }
    return bd < 1.4 ? best : null;
  },

  searchCustom(this: any) {
    const c = this.state.custom, fl = this.state.flags;
    const e = this.nearestEntity();
    if (!e) { ui.log('You search the bare floor. Nothing. Try searching next to the furniture.'); return; }
    sfx.click();
    ui.log(`You search around the ${CATALOG[e.type].name.toLowerCase()}...`);
    setTimeout(() => {
      if (this.engine.level !== this) return;
      if (this.state.mode === 'editor') { ui.log(c.keyIn === e.key ? 'This is where your key is hidden.' : 'Nothing here. (Editor: pick the key spot from the Esc menu.)'); return; }
      if (fl.customKey) { ui.log('You already found the key.'); return; }
      if (c.keyIn === e.key) {
        fl.customKey = true; sfx.key();
        const k = makeGhostKey(); k.position.set(this.player.pos.x + this.player.forward().x * 0.6, 0.3, this.player.pos.z + this.player.forward().z * 0.6);
        this.scene.add(k); this.ghostKeyFx = { obj: k, t: 0 };
        ui.log(`Hidden in the ${CATALOG[e.type].name.toLowerCase()}: THE KEY! Now find the exit door.`, 'good');
        this.refreshHUD();
      } else {
        const lines = ['Dust bunnies. Lots of them.', 'A single sock. Not yours.', 'Nothing but a note: "nope :)"', 'Cobwebs. A disappointed spider.', 'Nothing here.'];
        ui.log(lines[Math.floor(Math.random() * lines.length)]);
      }
    }, 700);
  },

  enterPortal(this: any) {
    if (this.enteringHell) return;
    if (this.state.mode === 'editor' || this.state.mode === 'custom') {
      if (this.time - (this.portalMsgT || -9) > 4) { this.portalMsgT = this.time; ui.log('In a custom room, Hell is just decoration. (Phew.)', 'lore'); }
      return;
    }
    this.enteringHell = true;
    if (this.engine.stats.conjured <= 8) unlock('minimalist');
    this.engine.enterHell();
  },
};
