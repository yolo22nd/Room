// The classic command line.
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

export const consoleMethods = {
  openConsole(this: any) {
    this.cancelPlacing();
    const box = ui.dialog({
      title: '&gt;_ Command line',
      html: `<p class="muted">The original way to play. Try <b>create bed north east</b>, <b>create door w</b>, <b>go sw</b>, <b>locate</b>, <b>turn lamp</b>, <b>search</b>, <b>key</b>.</p>
        <input id="cli" autocomplete="off" spellcheck="false" style="width:100%;font:16px var(--mono);padding:10px 12px;border-radius:8px;border:1px solid #45355e;background:#0d0a12;color:#7dffb2;outline:none" placeholder="what would you like to do ???">`,
      buttons: [],
    });
    const el = box.querySelector<any>('#cli');
    setTimeout(() => el.focus(), 30);
    el.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { const v = el.value; ui.closeDialog(); this.runCommand(v); }
      if (e.key === 'Escape') ui.closeDialog();
    });
  },

  runCommand(this: any, text) {
    const words = text.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!words.length) return;
    ui.log('> ' + words.join(' '));
    const aliases = { television: 'tv', study: 'table', desk: 'table', dining: 'dine', bookshelf: 'shelf', books: 'shelf', rack: 'shoerack', computer: 'pc', toilet: 'bathroom', lantern: 'lamp' };
    const dirWords = { north: 'n', south: 's', east: 'e', west: 'w', middle: 'm', mid: 'm', center: 'm', centre: 'm', northeast: 'ne', northwest: 'nw', southeast: 'se', southwest: 'sw' };
    let thing = null, ns = '', ew = '', mid = false;
    for (const w0 of words) {
      const w = aliases[w0] || w0;
      if (CATALOG[w]) thing = w;
      const d = dirWords[w] || (['n', 's', 'e', 'w', 'm', 'ne', 'nw', 'se', 'sw'].includes(w) ? w : null);
      if (d) {
        if (d === 'm') mid = true;
        else { if (d.includes('n')) ns = 'n'; if (d.includes('s')) ns = 's'; if (d.includes('e')) ew = 'e'; if (d.includes('w')) ew = 'w'; }
      }
    }
    const dir = (ns + ew) || (mid ? 'm' : null);
    const verb = words[0];
    if (verb === 'create' || verb === 'conjure') {
      if (!thing) { ui.log('What do you want to create? e.g. "create bed north".', 'warn'); return; }
      if (thing === 'lamp') { this.conjureLamp(); return; }
      const kind = CATALOG[thing].kind;
      if (!dir) { ui.log(`Where do you want to create the ${CATALOG[thing].name.toLowerCase()}? Add a direction.`, 'warn'); return; }
      if (kind !== 'floor' && !['n', 's', 'e', 'w'].includes(dir)) { ui.log(`You can create a ${CATALOG[thing].name.toLowerCase()} only to the north, south, east or west.`, 'warn'); return; }
      this.conjureAt(thing, dir);
    } else if (verb === 'go' || verb === 'walk') {
      if (!dir) { ui.log('Where do you want to go? Type N, NE, E, SE, S, SW, W, NW or middle.', 'warn'); return; }
      const why = this.canMove();
      if (why !== true) { this.blockedMsgT = -10; this.blocked(why); return; }
      if (this.player.sitting) this.player.stand();
      const cur = cellAt(this.player.pos.x, this.player.pos.z) || 'm';
      let target;
      if (dir === 'm') target = 'm';
      else {
        const c = cellCenter(cur);
        const dx = dir.includes('e') ? 3 : dir.includes('w') ? -3 : 0;
        const dz = dir.includes('s') ? 3 : dir.includes('n') ? -3 : 0;
        target = cellAt(Math.max(-3, Math.min(3, c.x + dx)), Math.max(-3, Math.min(3, c.z + dz)));
      }
      const t = cellCenter(target);
      this.autoWalk = { x: t.x, z: t.z, t: 0, name: CELL_NAMES[target] };
    } else if (verb === 'locate' || verb === 'where') {
      const c = this.room.annexAt(this.player.pos.x, this.player.pos.z);
      ui.log(c ? `You are in the ${c.type}, ${SIDE_NAMES[c.side]} of the main room.` : `You are in the ${CELL_NAMES[cellAt(this.player.pos.x, this.player.pos.z) || 'm']} part of the room.`);
    } else if (verb === 'turn' && (thing === 'lamp' || words.includes('lamp'))) {
      this.toggleLamp();
    } else if (verb === 'search') {
      this.search();
    } else if (verb === 'stand') {
      if (this.player.sitting) { this.player.stand(); ui.log('You stood up.'); } else ui.log('You are already standing.');
    } else if (verb === 'put' || verb === 'drop') {
      if (this.state.lamp === 'hand') this.dropLamp(); else ui.log('You don\'t have anything that you can put on the floor.');
    } else if (verb === 'pick') {
      const l = this.state.lamp;
      if (l && l !== 'hand' && this.player.pos.distanceTo(new THREE.Vector3(l.x, 0, l.z)) < 2) this.pickLamp(); else ui.log('You aren\'t close to anything you can pick up.');
    } else if (verb === 'key' || verb === 'help') {
      ui.log('create <thing> <direction> · go <direction> · locate · turn lamp · search · put / pick lamp · stand · end');
    } else if (verb === 'xyzzy' || verb === 'plugh') {
      ui.log('A hollow voice says "Fool." Then, after a pause: "...nice try, though. Wrong game, right spirit."', 'lore');
      unlock('xyzzy');
    } else if (verb === 'end') {
      ui.log('Are you sure you want to end this simulation? (Use the pause menu to quit to title.)');
    } else if (['open', 'sit', 'sleep', 'turn', 'close', 'use'].includes(verb)) {
      ui.log(`Walk up to it and press ${this.engine.touch ? 'Use' : 'E'} — the 3D world handles "${verb}" for you.`);
    } else {
      ui.log('Whatever you typed was not registered. You were supposed to type \'create\', \'go\', etc.', 'warn');
    }
  },
};
