// Conjuring: the spellbook, placement ghosts, drops and landings.
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

export const placementMethods = {
  openSpellbook(this: any) {
    if (this.placing) { this.cancelPlacing(); return; }
    if (this.state.mode === 'custom') { ui.log('No conjuring in someone else\'s room. Find the key!', 'warn'); return; }
    const groups = { hand: 'In your hand', floor: 'Floor — lands on the cell you aim at', wall: 'Wall — the wall you face', beyond: 'Beyond — outside the wall you face', junk: 'Junk — physics toys, land exactly where you aim (as many as you like)' };
    let html = this.engine.touch
      ? '<p class="muted">Pick something to conjure. It will fall from the sky. Aim, then tap <b>Cast</b>. <b>Use</b> rotates, <b>Spells</b> cancels.</p>'
      : '<p class="muted">Pick something to conjure. It will fall from the sky. <kbd>R</kbd> rotates, click or <kbd>E</kbd> casts, <kbd>Q</kbd> / right-click cancels.</p>';
    for (const k of Object.keys(groups)) {
      html += `<div class="section-label">${groups[k]}</div><div class="spell-grid">`;
      for (const [type, c] of Object.entries(CATALOG)) {
        if (c.kind !== k) continue;
        const placed = c.kind === 'junk' ? false : type === 'door' ? SIDES.some(s => this.entities.has('door_' + s)) : (type === 'lamp' ? !!this.state.lamp : this.entities.has(type));
        html += `<button class="spell${placed ? ' placed' : ''}" data-type="${type}"><span class="ico">${c.icon}</span><span class="nm">${c.name}</span><span class="ty">${placed ? 'placed · ' : ''}${this.state.mode === 'editor' ? 'free' : manaCost(type) + ' mana'}</span></button>`;
      }
      html += '</div>';
    }
    if (this.state.flags.nailKnown) html += '<div class="section-label">Forbidden</div><div class="spell-grid"><button class="spell locked" data-type="nail"><span class="ico">📌</span><span class="nm">Giant Nail</span><span class="ty">too big for a room</span></button></div>';
    html += '<div class="section-label">Spells</div><div class="spell-grid">';
    for (const [id, sp] of Object.entries(SPELLS)) {
      const k = knows(this.state, id);
      html += `<button class="spell${k ? '' : ' locked'}" data-spell="${id}" title="${k ? sp.desc : sp.learn}"><span class="ico">${k ? sp.icon : '❔'}</span><span class="nm">${k ? sp.name : '???'}</span><span class="ty">${k ? manaCost(id) + ' mana' : sp.learn}</span></button>`;
    }
    html += '</div>';
    const box = ui.dialog({ title: '📖 Spellbook', html, wide: true });
    box.querySelectorAll<any>('[data-spell]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.spell;
      if (!knows(this.state, id)) { ui.log(`You haven't learned that spell yet. Hint: ${SPELLS[id].learn}`, 'lore'); return; }
      ui.closeDialog();
      this.castSpell(id);
    }));
    box.querySelectorAll<any>('[data-type]').forEach(b => b.addEventListener('click', () => {
      const t = b.dataset.type;
      if (t === 'nail') { ui.log('The Giant Nail is far too big to conjure in here. It needs a worthy target.', 'warn'); return; }
      ui.closeDialog();
      this.startPlacing(t);
    }));
  },

  castSpell(this: any, id) {
    if (id === 'shrink') { castShrink(this.engine); return; }
    if (id === 'levitate') {
      this.cancelPlacing();
      this.lev = true;
      ui.log('Levitate: look at a piece of furniture and cast to lift it.');
      return;
    }
    if (id === 'blink') this.startPlacing('blink');
  },

  levCast(this: any) {
    const f = this.findFocus();
    const e = f && this.entities.get(f.owner);
    if (!e || CATALOG[e.type].kind !== 'floor') { sfx.locked(); ui.log('Aim at a piece of furniture to lift it.', 'warn'); return; }
    if (e.type === 'cushion' && this.entityAt(e.slot, 'pc')) { ui.log('The PC is sitting on that cushion. Lift the PC first.', 'warn'); return; }
    if (!this.engine.spend(manaCost('levitate'))) return;
    this.lev = false;
    sfx.whisper();
    this.startPlacing(e.type);
    this.placing.moveKey = e.key;
    this.placing.rot = e.rot;
    ui.log(`The ${CATALOG[e.type].name.toLowerCase()} floats up. Aim at a new spot and cast to set it down.`);
  },

  moveEntity(this: any, key, slot, rot) {
    const e = this.entities.get(key);
    const fl = this.state.flags;
    const keep = { open: fl.showcaseOpen, smashed: fl.showcaseSmashed };
    this.fx.burst(e.group.position.clone().setY(1), { count: 14, color: '#9fe8ff', size: 0.35 });
    this.despawn(key);
    this.spawn(e.type, slot, rot);
    if (e.type === 'showcase') {
      fl.showcaseOpen = keep.open; fl.showcaseSmashed = keep.smashed;
      if (keep.open) this.openShowcaseVisual(true);
      if (keep.smashed) this.hideShowcaseGlass(this.entities.get('showcase'));
    }
  },

  startPlacing(this: any, type) {
    this.cancelPlacing();
    this.lev = false;
    sfx.click();
    if (type === 'lamp') { this.conjureLamp(); return; }
    const kind = type === 'blink' ? 'blink' : CATALOG[type].kind;
    let ghost;
    if (type === 'blink') {
      ghost = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), new THREE.MeshBasicMaterial({ map: ring(), color: 0x9fe8ff, transparent: true, depthWrite: false }));
      ghost.rotation.x = -Math.PI / 2;
      this.scene.add(ghost);
      this.placing = { type, kind: 'blink', ghost, rot: 0, target: null };
      ui.log('Blink: aim at the floor and cast to teleport there.');
      return;
    }
    if (kind === 'junk') {
      ghost = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: ring(), color: COL.mine, transparent: true, depthWrite: false }));
      ghost.rotation.x = -Math.PI / 2;
      this.scene.add(ghost);
      this.placing = { type, kind, ghost, rot: 0, target: null };
      ui.log(`Aim and cast to drop a ${CATALOG[type].name.toLowerCase()}. Keep casting for more; ${this.engine.touch ? 'Spells' : 'Q'} to stop.`);
      return;
    }
    if (kind === 'floor') {
      ghost = buildObject(type);
    } else if (kind === 'wall') {
      ghost = type === 'door' ? buildDoor() : buildTV();
    } else {
      ghost = new THREE.Group();
      const b = new THREE.Mesh(new THREE.BoxGeometry(ANNEX_W, WALL_H, ANNEX_D), this.ghostMat);
      b.position.set(0, WALL_H / 2, -WALL_T - ANNEX_D / 2); ghost.add(b);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(b.geometry), this.ghostEdge); edges.position.copy(b.position); ghost.add(edges);
    }
    ghost.traverse((o: any) => { if (o.isMesh) { o.material = this.ghostMat; o.castShadow = false; o.receiveShadow = false; o.userData.owner = null; } });
    ghost.matrixAutoUpdate = true;
    this.scene.add(ghost);
    this.placing = { type, kind, ghost, rot: null, target: null };
    ui.log(`Aim and cast to conjure the ${CATALOG[type].name.toLowerCase()}.`);
  },

  cancelPlacing(this: any) {
    if (!this.placing) return;
    this.scene.remove(this.placing.ghost);
    this.placing = null;
  },

  aimTarget(this: any) {
    const kind = this.placing.kind;
    const cam = this.camera;
    if (kind === 'floor' || kind === 'junk' || kind === 'blink') {
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      let p;
      if (dir.y < -0.05) {
        const t = -cam.position.y / dir.y;
        p = cam.position.clone().addScaledVector(dir, Math.min(t, 9));
      } else {
        p = cam.position.clone().addScaledVector(new THREE.Vector3(dir.x, 0, dir.z).normalize(), 2.5);
      }
      if (kind === 'blink') { p.y = 0; return p; }
      p.x = Math.max(-HALF + 0.01, Math.min(HALF - 0.01, p.x));
      p.z = Math.max(-HALF + 0.01, Math.min(HALF - 0.01, p.z));
      if (kind === 'junk') { p.x = Math.max(-HALF + 0.4, Math.min(HALF - 0.4, p.x)); p.z = Math.max(-HALF + 0.4, Math.min(HALF - 0.4, p.z)); p.y = 0; return p; }
      return cellAt(p.x, p.z);
    }
    // walls / beyond: the side we face most
    const f = this.player.forward();
    if (Math.abs(f.x) > Math.abs(f.z)) return f.x > 0 ? 'e' : 'w';
    return f.z > 0 ? 's' : 'n';
  },

  updatePlacing(this: any) {
    const pl = this.placing;
    if (pl.kind === 'blink') {
      pl.target = this.aimTarget();
      pl.ghost.position.set(pl.target.x, 0.03, pl.target.z);
      const d = Math.hypot(pl.target.x - this.player.pos.x, pl.target.z - this.player.pos.z);
      const ok = d <= 8 && this.walkable(pl.target.x, pl.target.z, pl.target.x, pl.target.z);
      pl.ghost.material.color.set(ok ? 0x9fe8ff : 0xff4d5e);
      ui.setPrompt(ok ? `<kbd>${this.engine.touch ? 'Cast' : 'Click'}</kbd>Blink here` : '<span style="color:var(--danger)">Can\'t blink there</span>');
      return;
    }
    if (pl.kind === 'junk') {
      pl.target = this.aimTarget();
      pl.ghost.position.set(pl.target.x, 0.02, pl.target.z);
      const inAnnex = this.room.annexAt(this.player.pos.x, this.player.pos.z);
      ui.setPrompt(inAnnex ? '<span style="color:var(--danger)">Step back into the main room first.</span>' : `<kbd>${this.engine.touch ? 'Cast' : 'Click'}</kbd>Drop a ${CATALOG[pl.type].name.toLowerCase()}`);
      return;
    }
    const slot = this.aimTarget();
    if (slot !== pl.target) { pl.target = slot; pl.rot = this.defaultRot(pl.type, slot); }
    const g = pl.ghost;
    g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); g.scale.set(1, 1, 1);
    if (pl.kind === 'floor') {
      g.position.copy(this.slotPosition(pl.type, slot, pl.rot));
      g.rotation.y = pl.rot * Math.PI / 2;
    } else {
      const m = sideMatrix(slot);
      g.position.setFromMatrixPosition(m); g.rotation.y = sideRot(slot);
      if (pl.type === 'tv') { g.translateY(1.65); g.translateZ(0.07); }
    }
    const err = this.placementError(pl.type, slot);
    this.ghostMat.color.set(err ? 0xff4d5e : 0xb58cff);
    const where = pl.kind === 'floor' ? CELL_NAMES[slot] + ' cell' : (pl.kind === 'wall' ? SIDE_NAMES[slot] + ' wall' : 'beyond the ' + SIDE_NAMES[slot] + ' wall');
    const t = this.engine.touch;
    ui.setPrompt(err ? `<span style="color:var(--danger)">${err}</span>` : `<kbd>${t ? 'Cast' : 'Click'}</kbd>Conjure ${CATALOG[pl.type].name} — ${where}${pl.kind === 'floor' ? ` <kbd>${t ? 'Use' : 'R'}</kbd>rotate` : ''}`);
  },

  placementError(this: any, type, slot) {
    const kind = CATALOG[type].kind;
    if (kind === 'floor') {
      for (const e of this.entities.values()) {
        if (CATALOG[e.type].kind !== 'floor' || e.slot !== slot || e.type === type) continue;
        if (type === 'pc' && e.type === 'cushion' && !this.entityAt(slot, 'pc')) continue;
        return `The ${CELL_NAMES[slot]} cell is taken by the ${CATALOG[e.type].name.toLowerCase()}.`;
      }
      if (this.room.annexAt(this.player.pos.x, this.player.pos.z)) return 'You must be in the main room to conjure furniture.';
      return null;
    }
    if (kind === 'wall') {
      for (const e of this.entities.values()) {
        if (CATALOG[e.type].kind === 'wall' && e.slot === slot && e.key !== this.keyFor(type, slot)) return `The ${SIDE_NAMES[slot]} wall already has a ${CATALOG[e.type].name.toLowerCase()}.`;
      }
      return null;
    }
    const a = this.room.annexes[slot];
    if (a && a.type !== type) return `There is already a ${a.type} beyond the ${SIDE_NAMES[slot]} wall.`;
    const here = this.room.annexAt(this.player.pos.x, this.player.pos.z);
    if (here) return 'Step back into the main room first.';
    return null;
  },

  entityAt(this: any, slot, type) {
    for (const e of this.entities.values()) if (e.slot === slot && e.type === type) return e;
    return null;
  },

  rotatePlacing(this: any) {
    if (!this.placing || this.placing.kind !== 'floor') return;
    this.placing.rot = (this.placing.rot + 1) % 4; sfx.click();
  },

  castPlacing(this: any) {
    const pl = this.placing;
    if (!pl || !pl.target) return;
    if (pl.kind === 'blink') { if (castBlink(this.engine, this.fx, pl.target)) this.cancelPlacing(); return; }
    if (pl.moveKey) {
      const err = this.placementError(pl.type, pl.target);
      if (err) { sfx.locked(); ui.log(err, 'warn'); return; }
      this.moveEntity(pl.moveKey, pl.target, pl.rot);
      this.cancelPlacing();
      return;
    }
    if (pl.kind === 'junk') {
      if (this.room.annexAt(this.player.pos.x, this.player.pos.z)) { sfx.locked(); return; }
      if (this.time - (this.junkT || -9) < 0.25) return;
      this.junkT = this.time;
      this.dropJunk(pl.type, pl.target.clone());
      return;
    }
    if (this.conjureAt(pl.type, pl.target, pl.rot)) this.cancelPlacing();
  },

  conjureAt(this: any, type, slot, rot = this.defaultRot(type, slot)) {
    if (this.state.mode === 'custom') { ui.log('No conjuring in someone else\'s room.', 'warn'); return false; }
    const err = this.placementError(type, slot);
    if (err) { sfx.locked(); ui.log(err, 'warn'); return false; }
    if (!this.engine.spend(manaCost(type))) return false;
    const key = this.keyFor(type, slot);
    if (this.entities.has(key)) {
      ui.log(`Your old ${CATALOG[type].name.toLowerCase()} vanishes in a puff of smoke.`);
      if (type === 'showcase') { this.state.flags.showcaseOpen = false; this.state.flags.showcaseSmashed = false; }
      this.despawn(key);
      if (type === 'cushion') { const pc = this.entities.get('pc'); if (pc) { ui.log('With the cushion gone, the PC crashes to the floor and shatters!', 'warn'); this.shatterPC(pc); } }
    }
    sfx.conjure();
    this.spawn(type, slot, rot);
    this.engine.stats.conjured++;
    return true;
  },

  conjureLamp(this: any) {
    if (this.state.lamp === 'hand') { ui.log('You already hold a lamp.'); return; }
    if (!this.engine.spend(manaCost('lamp'))) return;
    sfx.conjure();
    this.state.lamp = 'hand';
    this.placeLantern();
    this.fx.burst(this.camera.position.clone().add(this.player.forward().multiplyScalar(1.4)).setY(this.camera.position.y + 0.6), { count: 14, color: '#ffd080', size: 0.12, speed: 1.2, up: -0.4 });
    ui.log('Mysteriously, a lamp drops from the sky and falls right into your hands. You catch it. It\'s made of glass — be careful.');
    if (!this.state.lampOn) ui.log('Press F (or the Lamp button) to turn it on.');
    this.refreshHUD();
    this.engine.autosave();
  },

  updateDrops(this: any, dt) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      const g = d.ent.group;
      d.t += dt;
      if (d.rise) {
        const k = Math.min(1, d.t / 0.9);
        g.position.y = d.y0 + (d.target - d.y0) * (1 - Math.pow(1 - k, 3));
        if (k >= 1) { this.drops.splice(i, 1); this.landed(d.ent); }
        continue;
      }
      g.scale.setScalar(Math.min(1, d.t / 0.25));
      if (d.t < 0.25) continue;
      d.vy -= 22 * dt;
      g.position.y += d.vy * dt;
      if (g.position.y <= d.target) {
        g.position.y = d.target; g.scale.setScalar(1);
        this.drops.splice(i, 1);
        this.landed(d.ent);
      }
    }
  },

  landed(this: any, ent) {
    const kind = CATALOG[ent.type].kind;
    const pos = ent.annex ? new THREE.Vector3().setFromMatrixPosition(sideMatrix(ent.slot)) : ent.group.position;
    const dist = this.player.pos.distanceTo(new THREE.Vector3(pos.x, 0, pos.z));
    sfx.thud(kind === 'beyond' ? 2 : 1);
    this.player.addShake(Math.max(0, 1 - dist / 8) * (kind === 'beyond' ? 1 : 0.6));
    if (kind === 'floor') this.fx.dust(pos, ent.type === 'cushion' || ent.type === 'chair' ? 0.6 : 1.1);
    const where = kind === 'floor' ? 'the ' + CELL_NAMES[ent.slot] + ' of the room' : (kind === 'wall' ? 'the ' + SIDE_NAMES[ent.slot] + ' wall' : 'beyond the ' + SIDE_NAMES[ent.slot] + ' wall');
    ui.log(`Mysteriously, a ${CATALOG[ent.type].name.toLowerCase()} drops from the sky and lands exactly on ${where}.`);

    if (ent.type === 'pc' && !this.entityAt(ent.slot, 'cushion')) { this.shatterPC(ent); return; }
    if (ent.type === 'pc') ui.log('It lands softly on the cushion. Its screen flickers to life.', 'good');

    // lamp lying here?
    if (kind === 'floor' && this.state.lamp && this.state.lamp !== 'hand') {
      const r = ent.rect || this.footprint('cushion', ent.slot, 0);
      const l = this.state.lamp;
      if (l.x > r.minX - 0.2 && l.x < r.maxX + 0.2 && l.z > r.minZ - 0.2 && l.z < r.maxZ + 0.2) {
        sfx.shatter(); this.fx.debris(new THREE.Vector3(l.x, 0.2, l.z), { color: 0xffd28a, count: 10, size: 0.05 });
        ui.log('Crunch. Your lamp was underneath. It\'s glass dust now. (Conjure another one.)', 'warn');
        this.state.lamp = null; this.state.lampOn = false; this.placeLantern(); this.refreshLighting();
      }
    }

    // crushed?
    if (kind === 'floor') {
      const r = ent.type === 'pc' ? this.footprint('cushion', ent.slot, 0) : ent.rect;
      const p = this.player.pos;
      if (this.state.mode !== 'editor' && p.x > r.minX - RADIUS && p.x < r.maxX + RADIUS && p.z > r.minZ - RADIUS && p.z < r.maxZ + RADIUS) {
        ui.log(`The ${CATALOG[ent.type].name.toLowerCase()} lands squarely on your head. You should really look up more.`, 'warn');
        unlock('crushed');
        this.pushOut(r);
        this.engine.damage(1, 'crushed by a ' + CATALOG[ent.type].name.toLowerCase());
      }
    }
    if (ent.type === 'hell') {
      ui.log('The wall glows red-hot for a moment. Something beyond it is very, very warm.', 'lore');
      const door = this.entities.get('door_' + ent.slot);
      if (door && this.state.flags['door_' + ent.slot]) {
        this.setDoor(ent.slot, false);
        ui.log('The door beside Hell slams shut and locks itself.', 'warn');
      }
    }
    if (ent.type === 'showcase' && this.state.flags.hellKeyTaken) ent.group.userData.hkey.visible = false;
    this.syncStatics();
    const floorCount = [...this.entities.values()].filter(e => CATALOG[e.type].kind === 'floor').length;
    if (floorCount >= 12) unlock('designer');
    this.refreshHUD();
    this.engine.autosave();
  },

  shatterPC(this: any, ent) {
    sfx.shatter();
    this.fx.debris(ent.group.position.clone().setY(0.3), { count: 26 });
    this.scene.remove(ent.group);
    if (this.entities.get(ent.key) === ent) { this.entities.delete(ent.key); delete this.state.placed[ent.key]; }
    ui.log('The PC breaks from the impact with the ground. Its pieces are everywhere. Maybe keeping something soft below it would help.', 'warn');
    unlock('pcbroke');
  },

  pushOut(this: any, r) {
    const p = this.player.pos;
    const cands = [
      [r.minX - RADIUS - 0.05, p.z], [r.maxX + RADIUS + 0.05, p.z], [p.x, r.minZ - RADIUS - 0.05], [p.x, r.maxZ + RADIUS + 0.05],
    ].sort((a, b) => Math.hypot(a[0] - p.x, a[1] - p.z) - Math.hypot(b[0] - p.x, b[1] - p.z));
    for (const [x, z] of cands) if (this.walkable(x, z, x, z)) { p.x = x; p.z = z; return; }
  },
};
