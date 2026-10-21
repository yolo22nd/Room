import * as THREE from 'three';
import { COL } from './a11y';
import {
  Room, CELLS, SIDES, SIDE_NAMES, CELL_NAMES, cellCenter, cellAt, sideMatrix, sideRot,
  HALF, WALL_H, GAP_W, ANNEX_W, ANNEX_D, WALL_T,
} from './room';
import { CATALOG, buildObject, buildDoor, buildTV, makeLantern, makeGhostKey, buildJunk } from './models';
import { loadPhysics, PhysicsWorld } from './physics';
import { SPELLS, manaCost, learn, knows, castShrink, castBlink } from './spells';
import { ring } from './textures';
import { RADIUS } from './player';
import { FX, disposeTree } from './fx';
import { glowSprite } from './textures';
import * as ui from './ui';
import { sfx, playAmbience, setHeartbeat } from './audio';
import { unlock } from './save';
import { BOOKS, DREAM, TV_BROADCAST, KITCHEN_NOTE, MIRROR_LINES, PC_SURF, PC_MAIL, WITCH_DIARY } from './story';

import { HUG, SEATS, ROT_FRONT, SIDE_FRONT_ROT } from './roomlevel/shared';
import { placementMethods } from './roomlevel/placement';
import { physicsMethods } from './roomlevel/physics';
import { consoleMethods } from './roomlevel/console';
import { interactionsMethods } from './roomlevel/interactions';
import { searchMethods } from './roomlevel/search';

export { seededRandom, todaySeed, freshRoomState } from './state';

export class RoomLevel {
  [key: string]: any;
  constructor(engine, state) {
    this.engine = engine;
    this.player = engine.player;
    this.camera = engine.camera;
    this.state = state;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = new THREE.Fog(0x000000, 3, 16);
    this.room = new Room(this.scene);
    this.fx = new FX(this.scene);
    this.entities = new Map();   // key -> { type, slot, rot, group, rect }
    this.drops = [];
    this.placing = null;
    this.raycaster = new THREE.Raycaster();
    this.blockedMsgT = 0;
    this.time = 0;
    this.focus = null;

    this.hemi = new THREE.HemisphereLight(0x3a2c4a, 0x0a0610, 0.12);
    this.scene.add(this.hemi);
    // faint wand glow so the dark is not a black screen
    this.wand = new THREE.PointLight(0x8a70ff, 0.6, 3.2, 2);
    this.camera.add(this.wand); this.wand.position.set(0.2, -0.3, -0.3);

    // the lantern: held by the camera or standing on the floor
    this.lantern = makeLantern();
    this.lampLight = new THREE.PointLight(0xffb469, 14, 16, 1.4);
    this.lampLight.castShadow = engine.quality === 'high';
    this.lampLight.shadow.mapSize.set(512, 512);
    this.lampLight.shadow.bias = -0.004;
    this.lampLight.position.set(0, 0.15, 0);
    this.lantern.add(this.lampLight);
    this.lantern.visible = false;

    // shimmer that betrays the invisible key, only visible in the dark
    this.glimmer = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite('#7ffcff'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.glimmer.scale.setScalar(0.35); this.glimmer.visible = false; this.scene.add(this.glimmer);

    this.ghostMat = new THREE.MeshBasicMaterial({ color: 0xb58cff, transparent: true, opacity: 0.28, depthWrite: false });
    this.ghostEdge = new THREE.LineBasicMaterial({ color: 0xd9c4ff, transparent: true, opacity: 0.8 });

    this.player.walkable = (x, z, ox, oz) => this.walkable(x, z, ox, oz);
    this.player.canMove = () => this.canMove();
    this.player.onBlocked = (why) => this.blocked(why);
    this.player.onGrow = () => {
      ui.log('You grow back to your normal size.');
      for (const R of this.obstacles()) {
        const p = this.player.pos;
        if (p.x > R.minX - RADIUS && p.x < R.maxX + RADIUS && p.z > R.minZ - RADIUS && p.z < R.maxZ + RADIUS) { this.pushOut(R); break; }
      }
    };

    this.restore();
  }

  // ------------------------------------------------------------------ setup
  activate() {
    this.scene.add(this.camera);
    const p = this.state.player;
    this.player.place(p.x, p.z, p.yaw);
    this.refreshLighting();
    this.refreshHUD();
  }

  deactivate() {
    if (this.phys) { this.junk.forEach(j => this.scene.remove(j.mesh)); this.phys.dispose(); this.phys = null; this.physLoading = null; }
    this.camera.remove(this.wand);
    this.lantern.removeFromParent();
    this.scene.remove(this.camera);
    setHeartbeat(0);
    this.gone = true;
    disposeTree(this.scene);
  }

  restore() {
    for (const [key, p] of Object.entries<any>(this.state.placed)) {
      if (p.auto) { p.rot = this.defaultRot(p.type, p.slot); delete p.auto; }
      this.spawn(p.type, p.slot, p.rot, { instant: true, key });
    }
    this.placeLantern();
    const s = this.state.flags;
    if (s.showcaseOpen) this.openShowcaseVisual(true);
    if (s.showcaseSmashed && this.entities.get('showcase')) this.hideShowcaseGlass(this.entities.get('showcase'));
    if (s.hellKeyTaken) { const sc = this.entities.get('showcase'); if (sc) sc.group.userData.hkey.visible = false; }
    for (const side of SIDES) {
      const e = this.entities.get('door_' + side);
      if (e && s['door_' + side]) e.group.userData.pivot.rotation.y = -1.6;
    }
  }

  // --------------------------------------------------------------- spawning
  slotPosition(type, slot, rot) {
    const kind = CATALOG[type].kind;
    if (kind === 'floor') {
      const c = cellCenter(slot);
      if (HUG.has(type) && slot.length === 2) {
        const back = ROT_FRONT(rot).multiplyScalar(-1);
        const edge = c.clone().addScaledVector(back, 1.5);
        if (Math.abs(edge.x) >= HALF - 0.01 || Math.abs(edge.z) >= HALF - 0.01) {
          const fp = CATALOG[type].fp;
          c.addScaledVector(back, 1.5 - fp[1] - 0.12);
        }
      }
      return c;
    }
    return new THREE.Vector3().setFromMatrixPosition(sideMatrix(slot));
  }

  footprint(type, slot, rot) {
    const c = this.slotPosition(type, slot, rot);
    let [hx, hz] = CATALOG[type].fp;
    if (rot % 2) [hx, hz] = [hz, hx];
    return { minX: c.x - hx, maxX: c.x + hx, minZ: c.z - hz, maxZ: c.z + hz };
  }

  defaultRot(type, slot) {
    if (CATALOG[type].kind !== 'floor') return 0;
    const row = slot.startsWith('n') ? -1 : slot.startsWith('s') ? 1 : 0;
    const col = slot.includes('w') ? -1 : slot.includes('e') ? 1 : 0;
    if (row === -1) return 0;
    if (row === 1) return 2;
    if (col === -1) return 1;
    if (col === 1) return 3;
    return 0;
  }

  keyFor(type, slot) { return type === 'door' ? 'door_' + slot : type; }

  spawn(type, slot, rot, { instant = false, key = this.keyFor(type, slot) } = {}) {
    const kind = CATALOG[type].kind;
    let group, rect = null, annex = null;
    if (kind === 'floor') {
      group = buildObject(type);
      group.position.copy(this.slotPosition(type, slot, rot));
      group.rotation.y = rot * Math.PI / 2;
      rect = this.footprint(type, slot, rot);
      if (type === 'pc') { rect = null; } // the PC rides on the cushion's footprint
      this.scene.add(group);
    } else if (kind === 'wall') {
      group = type === 'door' ? buildDoor() : buildTV();
      group.applyMatrix4(sideMatrix(slot));
      if (type === 'tv') group.translateY(1.65).translateZ(0.07);
      group.traverse((o: any) => { if (o.isMesh) o.userData.key = key; });
      this.scene.add(group);
      if (type === 'door') this.room.setPlug(slot, false);
    } else if (kind === 'beyond') {
      annex = this.room.addAnnex(type, slot);
      group = annex.group;
      annex.group.traverse((o: any) => { if (o.isMesh) o.userData.side = slot; });
      if (type === 'bathroom') {
        // the toilet becomes interactive
        annex.group.children.filter(c => c.isGroup).forEach(c => c.traverse((o: any) => { if (o.isMesh && !o.userData.owner) o.userData.owner = 'toilet'; }));
        annex.group.traverse((o: any) => { if (o.isMesh && o.userData.owner === 'toilet') annex.interactives.push(o); });
        if (this.state.flags.tapOn) { annex.water.visible = true; }
      }
      if (type === 'kitchen' && this.state.flags.stewCooked) annex.stew.visible = false;
    }
    const ent = { type, slot, rot, group, rect, annex, key };
    this.entities.set(key, ent);
    this.state.placed[key] = { type, slot, rot };
    if (!instant) {
      if (kind === 'beyond') {
        // annexes fade in from below
        group.position.y -= 3.5;
        this.drops.push({ ent, y0: group.position.y, target: group.position.y + 3.5, rise: true, t: 0 });
      } else {
        const target = group.position.y;
        group.position.y = WALL_H - 0.4 + (kind === 'wall' ? 0 : 0);
        group.scale.setScalar(0.01);
        this.drops.push({ ent, target, vy: 0, t: 0 });
        this.riftAt(new THREE.Vector3(group.position.x, WALL_H - 0.05, group.position.z));
      }
    }
    return ent;
  }

  despawn(key) {
    const e = this.entities.get(key);
    if (!e) return;
    this.drops = this.drops.filter(d => d.ent !== e);
    if (e.annex) this.room.removeAnnex(e.slot);
    else this.scene.remove(e.group);
    if (e.type === 'door') { this.room.setPlug(e.slot, true); delete this.state.flags[key]; }
    this.entities.delete(key);
    delete this.state.placed[key];
    this.syncStatics();
    const pos = e.annex ? e.annex.portalWorld || new THREE.Vector3().setFromMatrixPosition(sideMatrix(e.slot)) : e.group.position;
    this.fx.burst(pos.clone().setY(1), { count: 18, color: '#b58cff', speed: 2, life: 0.8, size: 0.4 });
  }

  riftAt(pos) {
    sfx.rift();
    this.fx.burst(pos, { count: 26, color: '#c9a8ff', speed: 1.8, life: 0.7, size: 0.35, up: -0.3 });
  }


























  // --------------------------------------------------------------- movement
  canMove() {
    if (this.state.lamp !== 'hand') return 'nolamp';
    if (!this.state.lampOn) return 'dark';
    return true;
  }

  blocked(why) {
    if (this.time - this.blockedMsgT < 3) return;
    this.blockedMsgT = this.time;
    if (why === 'nolamp') ui.log(this.state.lamp ? 'You are too scared to go anywhere without your lamp. Pick it up.' : 'You are too scared to go anywhere without a lamp. Maybe conjuring something might help. [Q]', 'warn');
    if (why === 'dark') ui.log('You are too scared to go anywhere without light. Turn on the lamp. [F]', 'warn');
  }

  obstacles() {
    const list = [];
    const tiny = this.player.shrunk > 0;
    const SOLID = new Set(['closet', 'shelf', 'showcase', 'shoerack', 'cushion', 'sofa']);
    for (const e of this.entities.values()) if (e.rect && (!tiny || SOLID.has(e.type))) list.push(e.rect);
    for (const s of SIDES) { const a = this.room.annexes[s]; if (a) list.push(...a.obstacles); }
    return list;
  }

  walkable(x, z, ox = x, oz = z) {
    const r = RADIUS;
    const inRect = (R, px, pz, m = 0) => px >= R.minX + m && px <= R.maxX - m && pz >= R.minZ + m && pz <= R.maxZ - m;
    let ok = Math.abs(x) <= HALF - r && Math.abs(z) <= HALF - r;
    if (!ok) {
      for (const s of SIDES) {
        const a = this.room.annexes[s];
        if (!a) continue;
        if (inRect(a.rect, x, z, r)) { ok = true; break; }
        if (!this.state.flags['door_' + s] || !this.entities.has('door_' + s)) continue;
        // the doorway is narrow along the wall and deep across it
        const g = a.gapRect;
        const gapOk = (s === 'n' || s === 's')
          ? (x >= g.minX + r && x <= g.maxX - r && z >= g.minZ && z <= g.maxZ)
          : (z >= g.minZ + r && z <= g.maxZ - r && x >= g.minX && x <= g.maxX);
        if (gapOk) { ok = true; break; }
      }
    }
    if (!ok) return false;
    // can't leave the bathroom with the tap running (house rules)
    const fromA = this.room.annexAt(ox, oz);
    if (fromA && fromA.type === 'bathroom' && this.state.flags.tapOn && !this.room.annexAt(x, z)) {
      if (this.time - this.blockedMsgT > 3) { this.blockedMsgT = this.time; ui.log('You have to turn the tap off before leaving the bathroom.', 'warn'); }
      return false;
    }
    for (const R of this.obstacles()) {
      const pad = { minX: R.minX - r, maxX: R.maxX + r, minZ: R.minZ - r, maxZ: R.maxZ + r };
      if (inRect(pad, x, z) && !inRect(pad, ox, oz)) return false;
    }
    return true;
  }

  // --------------------------------------------------------------- lantern
  placeLantern() {
    const l = this.state.lamp;
    this.lantern.removeFromParent();
    if (l === 'hand') {
      this.camera.add(this.lantern);
      this.lantern.position.set(0.3, -0.36, -0.62);
      this.lantern.rotation.set(0, 0, 0);
      this.lantern.scale.setScalar(0.6);
      this.lantern.visible = true;
    } else if (l) {
      this.scene.add(this.lantern);
      this.lantern.position.set(l.x, 0.02, l.z);
      this.lantern.scale.setScalar(1);
      this.lantern.visible = true;
    } else this.lantern.visible = false;
    this.refreshLighting();
  }

  toggleLamp() {
    const l = this.state.lamp;
    if (!l) { ui.log('You have no lamp. Conjure one from your spellbook. [Q]'); return; }
    if (l !== 'hand' && this.player.pos.distanceTo(new THREE.Vector3(l.x, 0, l.z)) > 2) { ui.log('You need to stay beside the lamp to turn it on or off.'); return; }
    this.state.lampOn = !this.state.lampOn;
    this.state.lampOn ? sfx.lampOn() : sfx.lampOff();
    ui.log(this.state.lampOn ? 'You turned on the lamp.' : 'You turned off the lamp.');
    if (this.state.lampOn) { unlock('light'); this.engine.split('Light'); }
    this.refreshLighting(); this.refreshHUD();
  }

  dropLamp() {
    if (this.state.lamp !== 'hand') return;
    this.state.lamp = { x: this.player.pos.x + this.player.forward().x * 0.5, z: this.player.pos.z + this.player.forward().z * 0.5 };
    sfx.close(); ui.log('You put the lamp down on the floor.');
    this.placeLantern(); this.refreshHUD();
  }

  pickLamp() {
    this.state.lamp = 'hand'; sfx.pickup(); ui.log('You picked up the lamp.');
    this.placeLantern(); this.refreshHUD();
  }

  refreshLighting() {
    const on = !!this.state.lamp && this.state.lampOn;
    this.lampLight.visible = on;
    if (this.lantern.userData.glass) this.lantern.userData.glass.emissiveIntensity = on ? 2.2 : 0.05;
    this.hemi.intensity = on ? 0.35 : 0.06;
    this.room.setCandles(on);
    this.scene.fog.far = on ? 18 : 7;
    const scared = this.state.lamp !== 'hand' || !on;
    ui.setVignette(scared ? 'fear' : '');
    setHeartbeat(scared ? 70 : 0);
    playAmbience(on ? 'room' : 'dark');
  }

  // ----------------------------------------------------------- interaction
  interactives() {
    const list = [];
    for (const e of this.entities.values()) {
      if (e.annex) list.push(...e.annex.interactives);
      else e.group.traverse((o: any) => { if (o.isMesh) list.push(o); });
    }
    if (this.state.lamp && this.state.lamp !== 'hand') this.lantern.traverse((o: any) => { if (o.isMesh) list.push(o); });
    if (this.room.voidPane) list.push(this.room.voidPane);
    return list;
  }

  findFocus() {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.raycaster.far = 2.8;
    const hits = this.raycaster.intersectObjects(this.interactives(), false);
    for (const h of hits) {
      const owner = h.object.userData.owner;
      if (!owner) continue;
      return { owner, key: h.object.userData.key || owner, side: h.object.userData.side, point: h.point };
    }
    return null;
  }

  focusLabel(f) {
    const names = { tap: 'Sink', shower: 'Shower', toilet: 'Toilet', stove: 'Stove', knives: 'Knife block', fridge: 'Fridge', portal: 'Portal to Hell', lamp: 'Lamp', voidwindow: 'Window onto the void' };
    return names[f.owner] || (CATALOG[f.owner] ? CATALOG[f.owner].name : f.owner);
  }
























  // -------------------------------------------------------------- per frame
  handleAction(a) {
    switch (a) {
      case 'use': case 'enter': this.use(); break;
      case 'cast': if (this.placing) this.castPlacing(); else if (this.lev) this.levCast(); break;
      case 'book': if (this.lev) { this.lev = false; break; } this.openSpellbook(); break;
      case 'cancel': this.cancelPlacing(); this.lev = false; break;
      case 'rotate': this.rotatePlacing(); break;
      case 'lamp': this.toggleLamp(); break;
      case 'search': this.search(); break;
      case 'stand': if (this.player.sitting) { this.player.stand(); ui.log('You stood up.'); } break;
      case 'drop': this.dropLamp(); break;
      case 'console': this.openConsole(); break;
    }
  }

  update(dt) {
    this.time += dt;
    this.updateDrops(dt);
    this.room.update(dt, this.time, this.camera.position);
    if (this.phys) {
      const pp = this.player.pos;
      this.playerBody.setNextKinematicTranslation({ x: pp.x, y: 0.4, z: pp.z });
      this.headBody.setNextKinematicTranslation({ x: pp.x, y: this.player.height - 0.1, z: pp.z });
      for (const hit of this.phys.step(dt)) this.junkImpact(hit.item, hit.speed);
    }
    this.fx.update(dt);

    if (this.anim) {
      const a = this.anim;
      const cur = a.obj.rotation[a.prop];
      const next = cur + (a.to - cur) * Math.min(1, dt * 6);
      a.obj.rotation[a.prop] = next;
      if (Math.abs(a.to - next) < 0.01) { a.obj.rotation[a.prop] = a.to; this.anim = null; }
    }

    // lantern sway + flicker
    if (this.state.lamp === 'hand') {
      this.lantern.rotation.z = Math.sin(this.time * 2) * 0.05 + (this.player.moving ? Math.sin(this.player.bob) * 0.08 : 0);
      this.lantern.position.y = -0.36 + (this.player.moving ? Math.abs(Math.sin(this.player.bob)) * 0.03 : 0);
    }
    if (this.lampLight.visible) this.lampLight.intensity = 14 + Math.sin(this.time * 13) * 0.4 + (Math.random() - 0.5) * 0.6;

    // the witch's portrait wakes up in the dark
    if (!(this.state.lamp && this.state.lampOn) && this.room.portrait && this.state.mode !== 'custom') {
      const pp = new THREE.Vector3(); this.room.portrait.getWorldPosition(pp);
      const toP = pp.clone().sub(this.camera.position);
      const d = toP.length(); toP.normalize();
      const look = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      const watching = d < 5 && look.dot(toP) > 0.93;
      this.room.pupilMat.color.set(watching ? 0x7bff7b : 0x103010);
      if (watching) {
        this.portraitT = (this.portraitT || 0) + dt;
        if (this.portraitT > 1.5 && !this.state.flags.portrait) {
          this.state.flags.portrait = true;
          sfx.whisper();
          ui.log('The portrait\'s eyes glow green. A whisper: "...lemons. Never tell anyone about the lemons..."', 'lore');
          unlock('portrait');
        }
      } else this.portraitT = 0;
    } else if (this.room.pupilMat) this.room.pupilMat.color.set(0x103010);

    // invisible key glimmer: only in the dark, only before it's found
    const pc = this.entities.get('pc');
    const show = pc && !this.state.flags.showKey && !(this.state.lamp && this.state.lampOn);
    this.glimmer.visible = !!show;
    if (show) {
      const c = cellCenter(pc.slot);
      this.glimmer.position.set(c.x + 0.9, 0.08, c.z + 0.6);
      this.glimmer.material.opacity = 0.4 + Math.sin(this.time * 3) * 0.3;
    }
    if (this.ghostKeyFx) {
      const g = this.ghostKeyFx; g.t += dt;
      g.obj.position.y = 0.3 + g.t * 0.5; g.obj.rotation.y += dt * 4;
      g.obj.children.forEach(c => { c.material.opacity = Math.max(0, 0.6 - g.t * 0.4); });
      if (g.t > 1.6) { this.scene.remove(g.obj); this.ghostKeyFx = null; }
    }
    // TV static
    const tv = this.entities.get('tv');
    if (tv && (this.tvOn || this.tvStatic > 0)) {
      this.tvStatic = Math.max(0, (this.tvStatic || 0) - dt);
      const scr = tv.group.userData.screen; const g = scr.ctx;
      if (this.tvOn) {
        g.fillStyle = '#1a0614'; g.fillRect(0, 0, 320, 200);
        // the witch: a hat and two eyes
        g.fillStyle = '#2b0a2a'; g.beginPath(); g.moveTo(160, 20); g.lineTo(110, 95); g.lineTo(210, 95); g.fill();
        g.fillRect(85, 92, 150, 10);
        g.fillStyle = '#e8d0b0'; g.beginPath(); g.arc(160, 135, 42, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#7bff7b'; const blink = Math.sin(this.time * 2) > 0.95 ? 1 : 6;
        g.fillRect(140, 125, 8, blink); g.fillRect(172, 125, 8, blink);
        g.fillStyle = '#802030'; g.fillRect(150, 152 + Math.sin(this.time * 12) * 2, 20, 4);
      }
      for (let i = 0; i < (this.tvOn ? 300 : 1400); i++) { const v = Math.random() * 255 | 0; g.fillStyle = `rgba(${v},${v},${v},${this.tvOn ? 0.25 : 0.9})`; g.fillRect(Math.random() * 320, Math.random() * 200, 2, 2); }
      scr.tex.needsUpdate = true;
      if (!this.tvOn && this.tvStatic <= 0) tv.group.userData.screenMesh.material.emissiveIntensity = 0;
    }

    if (this.autoWalk) {
      const w = this.autoWalk; w.t += dt;
      const dx = w.x - this.player.pos.x, dz = w.z - this.player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.08 || w.t > 6) {
        if (d < 0.6) ui.log(`You went to the ${w.name} of the room.`); else ui.log('Something is in the way.', 'warn');
        this.autoWalk = null;
      } else {
        const step = Math.min(d, this.player.speed * dt);
        const bx = this.player.pos.x, bz = this.player.pos.z;
        this.player.tryMove(dx / d * step, dz / d * step);
        this.player.moving = true; this.player.bob += dt * 8;
        if (Math.hypot(this.player.pos.x - bx, this.player.pos.z - bz) < step * 0.2) w.t += dt * 4; // stuck
      }
    }

    // placement ghost or interaction focus
    if (this.placing) this.updatePlacing();
    else if (this.lev) {
      const f = this.findFocus();
      const e = f && this.entities.get(f.owner);
      ui.setPrompt(e && CATALOG[e.type].kind === 'floor' ? `<kbd>${this.engine.touch ? 'Cast' : 'Click'}</kbd>Lift the ${CATALOG[e.type].name.toLowerCase()}` : 'Levitate: look at a piece of furniture');
    } else {
      this.focus = ui.isDialogOpen() ? null : this.findFocus();
      if (this.focus) ui.setPrompt(`<kbd>${this.engine.touch ? 'Use' : 'E'}</kbd>${this.focusLabel(this.focus)}`);
      else ui.setPrompt(null);
    }

    // walking into the hell portal
    const ha = this.annexOfType('hell');
    if (ha && !this.enteringHell) {
      const d = Math.hypot(this.player.pos.x - ha.portalWorld.x, this.player.pos.z - ha.portalWorld.z);
      if (d < 1.3) this.enterPortal();
    }

    // remember where we are
    const ps = this.state.player;
    ps.x = this.player.pos.x; ps.z = this.player.pos.z; ps.yaw = this.player.yaw;
    this.updateObjective();
  }

  /** Blink can't pass through closed walls into an annex. */
  blinkBlocked(point) {
    const to = this.room.annexAt(point.x, point.z);
    const from = this.room.annexAt(this.player.pos.x, this.player.pos.z);
    if (!to || to === from) return false;
    return !(this.state.flags['door_' + to.side] && this.entities.has('door_' + to.side));
  }

  surface() {
    const a = this.room.annexAt(this.player.pos.x, this.player.pos.z);
    return a ? (a.type === 'hell' ? 'stone' : 'tile') : 'wood';
  }

  updateObjective() {
    const s = this.state, fl = s.flags;
    let o;
    if (s.mode === 'editor') {
      const c = s.custom;
      o = !c.keyIn ? 'EDITOR: build your room, then hide the key (Esc menu).' : !c.exit ? 'EDITOR: conjure a door and mark it as the exit (Esc menu).' : 'EDITOR: ready! Test play or share it from the Esc menu.';
    } else if (s.mode === 'custom') {
      o = fl.customKey ? 'Find the exit door and open it.' : `"${s.custom.title}" — find the hidden key (search near furniture with G).`;
    } else if (!s.lamp) o = 'It\'s pitch dark. Open your spellbook (Q) and conjure a lamp.';
    else if (s.lamp !== 'hand') o = 'Pick your lamp back up.';
    else if (!s.lampOn) o = 'Turn on the lamp (F).';
    else if (!fl.hellKeyTaken && !fl.showKey && !fl.pcWon) o = 'Find a way out. Conjure things — the books, or a PC, might know something.';
    else if (!fl.hellKeyTaken && !fl.showKey) o = fl.keyCell ? `Search the floor in the ${CELL_NAMES[fl.keyCell]} part of the room (G).` : 'Search the floor where the PC stands (G).';
    else if (!fl.hellKeyTaken) o = 'The invisible key opens something made of glass.';
    else if (!fl.nailKnown) o = 'Study the nail fossil in the showcase.';
    else {
      const ha = this.annexOfType('hell');
      if (!ha) o = 'Conjure Hell beyond one of the walls.';
      else if (!this.entities.has('door_' + ha.side)) o = `Conjure a door on the ${SIDE_NAMES[ha.side]} wall.`;
      else o = 'Open the door and GO TO HELL! (Shoes recommended.)';
    }
    if (o !== this._obj) { this._obj = o; ui.setObjective(o); }
  }

  refreshHUD() {
    const s = this.state, fl = s.flags;
    ui.setHearts(s.hearts, s.maxHearts);
    const inv = [];
    if (s.lamp) inv.push(`🏮 <b>Lamp</b> ${s.lamp === 'hand' ? (s.lampOn ? 'on' : 'off') : 'on floor'}`);
    if (fl.showKey) inv.push('👻 <b>Invisible key</b>');
    if (fl.hellKeyTaken) inv.push('🗝️ <b>H key</b>');
    if (fl.nailKnown) inv.push('📌 <b>Giant Nail</b> spell');
    if (fl.stewCooked && !fl.stewEaten) inv.push('🍲 <b>Ember stew</b>');
    if (fl.customKey) inv.push('🗝️ <b>Exit key</b>');
    if (s.mode === 'editor' && s.custom) inv.push(`🔑 key: <b>${s.custom.keyIn ? CATALOG[(s.placed[s.custom.keyIn] || {}).type]?.name || '?' : 'not hidden'}</b>`, `🚪 exit: <b>${s.custom.exit ? SIDE_NAMES[s.custom.exit] + ' door' : 'none'}</b>`);
    if (fl.wand) inv.push('🪄 <b>Ember Wand</b>');
    if (fl.cloak) inv.push('🧥 <b>Cloak</b>');
    if (fl.diary) inv.push('📓 <b>Diary</b>');
    if (fl.lemon) inv.push('🍋 <b>Lemon</b>');
    if (s.shoes !== 'none') inv.push(`👟 <b>${s.shoes}</b>`);
    ui.setInventory(inv);
  }
}

// The level is split across modules; their methods are installed here.
Object.assign(RoomLevel.prototype, placementMethods, physicsMethods, consoleMethods, interactionsMethods, searchMethods);
