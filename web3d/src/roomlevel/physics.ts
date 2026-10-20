// Physics junk, the anvil and the smashed showcase.
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

export const physicsMethods = {
  async ensurePhysics(this: any) {
    if (this.phys) return this.phys;
    if (!this.physLoading) {
      ui.log('Warming up the laws of physics...');
      this.physLoading = loadPhysics().then(() => {
        const ph = new PhysicsWorld(-20);
        ph.addStaticBox(0, -0.5, 0, HALF + 6, 0.5, HALF + 6);                // floor (incl. annexes)
        ph.addStaticBox(0, WALL_H + 0.5, 0, HALF + 6, 0.5, HALF + 6);        // ceiling
        for (const s of SIDES) {
          const p = new THREE.Vector3(0, WALL_H / 2, -0.35).applyMatrix4(sideMatrix(s));
          const alongX = s === 'n' || s === 's';
          ph.addStaticBox(p.x, p.y, p.z, alongX ? HALF + 1 : 0.35, WALL_H / 2, alongX ? 0.35 : HALF + 1);
        }
        this.playerBody = ph.addKinematicBall(0.38);
        this.headBody = ph.addKinematicBall(0.3);
        this.furnitureBodies = new Map();
        this.junk = [];
        this.phys = ph;
        this.syncStatics();
        return ph;
      });
    }
    return this.physLoading;
  },

  syncStatics(this: any) {
    const ph = this.phys;
    if (!ph) return;
    for (const b of this.furnitureBodies.values()) ph.removeBody(b);
    this.furnitureBodies.clear();
    for (const e of this.entities.values()) {
      if (!e.rect || CATALOG[e.type].kind !== 'floor') continue;
      const h = new THREE.Box3().setFromObject(e.group).max.y;
      const r = e.rect;
      this.furnitureBodies.set(e.key, ph.addStaticBox((r.minX + r.maxX) / 2, h / 2, (r.minZ + r.maxZ) / 2, (r.maxX - r.minX) / 2, h / 2, (r.maxZ - r.minZ) / 2));
    }
  },

  async dropJunk(this: any, type, p) {
    if (!this.engine.spend(manaCost(type))) return;
    sfx.conjure();
    const ph = await this.ensurePhysics();
    const c = CATALOG[type];
    const mesh = buildJunk(type);
    mesh.position.set(p.x, WALL_H - 0.45, p.z);
    mesh.rotation.set(Math.random(), Math.random() * 6, Math.random());
    this.scene.add(mesh);
    this.riftAt(new THREE.Vector3(p.x, WALL_H - 0.05, p.z));
    const it = ph.addDynamic(mesh, c.shape, { mass: c.mass, restitution: c.bounce || 0.2, velocity: { x: 0, y: -2, z: 0 }, spin: { x: Math.random() * 4 - 2, y: 0, z: Math.random() * 4 - 2 }, ccd: type === 'anvil' });
    it.type = type;
    this.junk.push(it);
    this.engine.stats.conjured++;
    if (this.junk.length > 24) { const old = this.junk.shift(); ph.remove(old); this.scene.remove(old.mesh); }
  },

  junkImpact(this: any, it, speed) {
    const p = it.mesh.position;
    if (speed > 5) sfx.thud(it.type === 'anvil' ? 1.6 : it.type === 'ball' ? 0.3 : 0.8);
    if (it.type !== 'anvil' || speed < 3) return;
    this.player.addShake(Math.max(0, 0.6 - this.player.pos.distanceTo(new THREE.Vector3(p.x, 0, p.z)) / 8));
    const inRect = (r, m = 0) => r && p.x > r.minX - m && p.x < r.maxX + m && p.z > r.minZ - m && p.z < r.maxZ + m;
    const sc = this.entities.get('showcase');
    if (sc && !this.state.flags.showcaseSmashed && inRect(sc.rect, 0.1) && p.y > 1.4) { this.smashShowcase(); return; }
    const pc = this.entities.get('pc');
    const cu = this.entities.get('cushion');
    if (pc && cu && inRect(cu.rect) && p.y > 0.4) { ui.log('The anvil lands on the PC. It does not survive.', 'warn'); this.shatterPC(pc); return; }
    const d = Math.hypot(p.x - this.player.pos.x, p.z - this.player.pos.z);
    if (d < 0.7 && p.y > 0.8) {
      ui.log('An anvil. On your head. Classic.', 'warn');
      unlock('crushed');
      this.engine.damage(1, 'flattened by an anvil, cartoon-style');
    }
  },

  smashShowcase(this: any) {
    const fl = this.state.flags;
    const sc = this.entities.get('showcase');
    fl.showcaseSmashed = true; fl.showcaseOpen = true;
    sfx.shatter(); sfx.thud(1.5);
    this.fx.debris(sc.group.position.clone().setY(1.6), { count: 30, color: 0xbfe6ff, size: 0.07, speed: 5 });
    this.hideShowcaseGlass(sc);
    ui.log('The anvil smashes straight through the showcase\'s glass! Who needs keys anyway?', 'good');
    unlock('smash');
    this.engine.autosave();
  },

  hideShowcaseGlass(this: any, sc) {
    sc.group.userData.door.visible = false;
    sc.group.traverse((o: any) => { if (o.isMesh && o.material && o.material.opacity < 0.5 && o.material.transparent) o.visible = false; });
  },
};
