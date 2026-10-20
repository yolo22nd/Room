import * as THREE from 'three';
import {
  Room, CELLS, SIDES, SIDE_NAMES, CELL_NAMES, cellCenter, cellAt, sideMatrix, sideRot,
  HALF, WALL_H, GAP_W, ANNEX_W, ANNEX_D, WALL_T,
} from './room.js';
import { CATALOG, buildObject, buildDoor, buildTV, makeLantern, makeGhostKey } from './models.js';
import { RADIUS } from './player.js';
import { FX } from './fx.js';
import { glowSprite } from './textures.js';
import * as ui from './ui.js';
import { sfx, playAmbience, setHeartbeat } from './audio.js';
import { unlock } from './save.js';
import { BOOKS, DREAM, TV_BROADCAST, KITCHEN_NOTE, MIRROR_LINES, PC_SURF, PC_MAIL, WITCH_DIARY } from './story.js';

const HUG = new Set(['bed', 'sofa', 'shelf', 'closet', 'shoerack', 'showcase', 'table']);
const SEATS = { bed: 0.95, sofa: 1.0, chair: 1.1, cushion: 0.75, dine: 1.05, table: 1.1 };
const ROT_FRONT = (r) => new THREE.Vector3(Math.sin(r * Math.PI / 2), 0, Math.cos(r * Math.PI / 2));
const SIDE_FRONT_ROT = { s: 0, e: 1, n: 2, w: 3 }; // rotation index whose front faces that wall

export function seededRandom(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}

export function todaySeed() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** mode: 'normal' | 'hard' | 'daily'. The daily room is seeded by date. */
export function freshRoomState(mode = 'normal', seed = null) {
  const hearts = mode === 'hard' ? 1 : 3;
  const st = {
    mode, seed,
    placed: {},                 // key -> { type, slot, rot }
    lamp: null,                 // 'hand' | {x, z} | null
    lampOn: false,
    hearts, maxHearts: hearts,
    shoes: 'none', clothes: 'old',
    flags: { books: [] },
    player: { x: 0, z: 0, yaw: 0 },
  };
  if (mode === 'daily') {
    // some furniture is already here, and the invisible key hides in a random cell
    const rnd = seededRandom('room-' + seed);
    const pool = ['bed', 'sofa', 'chair', 'table', 'dine', 'shelf', 'closet', 'shoerack'];
    const cells = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];
    const pick = (arr) => arr.splice(Math.floor(rnd() * arr.length), 1)[0];
    for (let i = 0; i < 4; i++) {
      const type = pick(pool), slot = pick(cells);
      st.placed[type] = { type, slot, rot: 0, auto: true };
    }
    st.flags.keyCell = ['nw', 'n', 'ne', 'w', 'm', 'e', 'sw', 's', 'se'][Math.floor(rnd() * 9)];
  }
  return st;
}

export class RoomLevel {
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
    this.camera.remove(this.wand);
    this.lantern.removeFromParent();
    this.scene.remove(this.camera);
    setHeartbeat(0);
  }

  restore() {
    for (const [key, p] of Object.entries(this.state.placed)) {
      if (p.auto) { p.rot = this.defaultRot(p.type, p.slot); delete p.auto; }
      this.spawn(p.type, p.slot, p.rot, { instant: true, key });
    }
    this.placeLantern();
    const s = this.state.flags;
    if (s.showcaseOpen) this.openShowcaseVisual(true);
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
      group.traverse(o => { if (o.isMesh) o.userData.key = key; });
      this.scene.add(group);
      if (type === 'door') this.room.setPlug(slot, false);
    } else if (kind === 'beyond') {
      annex = this.room.addAnnex(type, slot);
      group = annex.group;
      annex.group.traverse(o => { if (o.isMesh) o.userData.side = slot; });
      if (type === 'bathroom') {
        // the toilet becomes interactive
        annex.group.children.filter(c => c.isGroup).forEach(c => c.traverse(o => { if (o.isMesh && !o.userData.owner) o.userData.owner = 'toilet'; }));
        annex.group.traverse(o => { if (o.isMesh && o.userData.owner === 'toilet') annex.interactives.push(o); });
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
    const pos = e.annex ? e.annex.portalWorld || new THREE.Vector3().setFromMatrixPosition(sideMatrix(e.slot)) : e.group.position;
    this.fx.burst(pos.clone().setY(1), { count: 18, color: '#b58cff', speed: 2, life: 0.8, size: 0.4 });
  }

  riftAt(pos) {
    sfx.rift();
    this.fx.burst(pos, { count: 26, color: '#c9a8ff', speed: 1.8, life: 0.7, size: 0.35, up: -0.3 });
  }

  // ------------------------------------------------------------- conjuring
  openSpellbook() {
    if (this.placing) { this.cancelPlacing(); return; }
    const groups = { hand: 'In your hand', floor: 'Floor — lands on the cell you aim at', wall: 'Wall — the wall you face', beyond: 'Beyond — outside the wall you face' };
    let html = this.engine.touch
      ? '<p class="muted">Pick something to conjure. It will fall from the sky. Aim, then tap <b>Cast</b>. <b>Use</b> rotates, <b>Spells</b> cancels.</p>'
      : '<p class="muted">Pick something to conjure. It will fall from the sky. <kbd>R</kbd> rotates, click or <kbd>E</kbd> casts, <kbd>Q</kbd> / right-click cancels.</p>';
    for (const k of Object.keys(groups)) {
      html += `<div class="section-label">${groups[k]}</div><div class="spell-grid">`;
      for (const [type, c] of Object.entries(CATALOG)) {
        if (c.kind !== k) continue;
        const placed = type === 'door' ? SIDES.some(s => this.entities.has('door_' + s)) : (type === 'lamp' ? !!this.state.lamp : this.entities.has(type));
        html += `<button class="spell${placed ? ' placed' : ''}" data-type="${type}"><span class="ico">${c.icon}</span><span class="nm">${c.name}</span>${placed ? '<span class="ty">placed</span>' : ''}</button>`;
      }
      html += '</div>';
    }
    if (this.state.flags.nailKnown) html += '<div class="section-label">Forbidden</div><div class="spell-grid"><button class="spell locked" data-type="nail"><span class="ico">📌</span><span class="nm">Giant Nail</span><span class="ty">too big for a room</span></button></div>';
    const box = ui.dialog({ title: '📖 Spellbook', html, wide: true });
    box.querySelectorAll('.spell').forEach(b => b.addEventListener('click', () => {
      const t = b.dataset.type;
      if (t === 'nail') { ui.log('The Giant Nail is far too big to conjure in here. It needs a worthy target.', 'warn'); return; }
      ui.closeDialog();
      this.startPlacing(t);
    }));
  }

  startPlacing(type) {
    this.cancelPlacing();
    sfx.click();
    if (type === 'lamp') { this.conjureLamp(); return; }
    const kind = CATALOG[type].kind;
    let ghost;
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
    ghost.traverse(o => { if (o.isMesh) { o.material = this.ghostMat; o.castShadow = false; o.receiveShadow = false; o.userData.owner = null; } });
    ghost.matrixAutoUpdate = true;
    this.scene.add(ghost);
    this.placing = { type, kind, ghost, rot: null, target: null };
    ui.log(`Aim and cast to conjure the ${CATALOG[type].name.toLowerCase()}.`);
  }

  cancelPlacing() {
    if (!this.placing) return;
    this.scene.remove(this.placing.ghost);
    this.placing = null;
  }

  aimTarget() {
    const kind = this.placing.kind;
    const cam = this.camera;
    if (kind === 'floor') {
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      let p;
      if (dir.y < -0.05) {
        const t = -cam.position.y / dir.y;
        p = cam.position.clone().addScaledVector(dir, Math.min(t, 9));
      } else {
        p = cam.position.clone().addScaledVector(new THREE.Vector3(dir.x, 0, dir.z).normalize(), 2.5);
      }
      p.x = Math.max(-HALF + 0.01, Math.min(HALF - 0.01, p.x));
      p.z = Math.max(-HALF + 0.01, Math.min(HALF - 0.01, p.z));
      return cellAt(p.x, p.z);
    }
    // walls / beyond: the side we face most
    const f = this.player.forward();
    if (Math.abs(f.x) > Math.abs(f.z)) return f.x > 0 ? 'e' : 'w';
    return f.z > 0 ? 's' : 'n';
  }

  updatePlacing() {
    const pl = this.placing;
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
  }

  placementError(type, slot) {
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
  }

  entityAt(slot, type) {
    for (const e of this.entities.values()) if (e.slot === slot && e.type === type) return e;
    return null;
  }

  rotatePlacing() {
    if (!this.placing || this.placing.kind !== 'floor') return;
    this.placing.rot = (this.placing.rot + 1) % 4; sfx.click();
  }

  castPlacing() {
    const pl = this.placing;
    if (!pl || !pl.target) return;
    if (this.conjureAt(pl.type, pl.target, pl.rot)) this.cancelPlacing();
  }

  conjureAt(type, slot, rot = this.defaultRot(type, slot)) {
    const err = this.placementError(type, slot);
    if (err) { sfx.locked(); ui.log(err, 'warn'); return false; }
    const key = this.keyFor(type, slot);
    if (this.entities.has(key)) {
      ui.log(`Your old ${CATALOG[type].name.toLowerCase()} vanishes in a puff of smoke.`);
      if (type === 'showcase') { this.state.flags.showcaseOpen = false; }
      this.despawn(key);
      if (type === 'cushion') { const pc = this.entities.get('pc'); if (pc) { ui.log('With the cushion gone, the PC crashes to the floor and shatters!', 'warn'); this.shatterPC(pc); } }
    }
    sfx.conjure();
    this.spawn(type, slot, rot);
    this.engine.stats.conjured++;
    return true;
  }

  // ------------------------------------------------- the classic CLI console
  openConsole() {
    this.cancelPlacing();
    const box = ui.dialog({
      title: '&gt;_ Command line',
      html: `<p class="muted">The original way to play. Try <b>create bed north east</b>, <b>create door w</b>, <b>go sw</b>, <b>locate</b>, <b>turn lamp</b>, <b>search</b>, <b>key</b>.</p>
        <input id="cli" autocomplete="off" spellcheck="false" style="width:100%;font:16px var(--mono);padding:10px 12px;border-radius:8px;border:1px solid #45355e;background:#0d0a12;color:#7dffb2;outline:none" placeholder="what would you like to do ???">`,
      buttons: [],
    });
    const el = box.querySelector('#cli');
    setTimeout(() => el.focus(), 30);
    el.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { const v = el.value; ui.closeDialog(); this.runCommand(v); }
      if (e.key === 'Escape') ui.closeDialog();
    });
  }

  runCommand(text) {
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
    } else if (verb === 'end') {
      ui.log('Are you sure you want to end this simulation? (Use the pause menu to quit to title.)');
    } else if (['open', 'sit', 'sleep', 'turn', 'close', 'use'].includes(verb)) {
      ui.log(`Walk up to it and press ${this.engine.touch ? 'Use' : 'E'} — the 3D world handles "${verb}" for you.`);
    } else {
      ui.log('Whatever you typed was not registered. You were supposed to type \'create\', \'go\', etc.', 'warn');
    }
  }

  conjureLamp() {
    sfx.conjure();
    if (this.state.lamp === 'hand') { ui.log('You already hold a lamp.'); return; }
    this.state.lamp = 'hand';
    this.placeLantern();
    this.fx.burst(this.camera.position.clone().add(this.player.forward().multiplyScalar(1.4)).setY(this.camera.position.y + 0.6), { count: 14, color: '#ffd080', size: 0.12, speed: 1.2, up: -0.4 });
    ui.log('Mysteriously, a lamp drops from the sky and falls right into your hands. You catch it. It\'s made of glass — be careful.');
    if (!this.state.lampOn) ui.log('Press F (or the Lamp button) to turn it on.');
    this.refreshHUD();
    this.engine.autosave();
  }

  // ------------------------------------------------------------ drop update
  updateDrops(dt) {
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
  }

  landed(ent) {
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
      if (p.x > r.minX - RADIUS && p.x < r.maxX + RADIUS && p.z > r.minZ - RADIUS && p.z < r.maxZ + RADIUS) {
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
    const floorCount = [...this.entities.values()].filter(e => CATALOG[e.type].kind === 'floor').length;
    if (floorCount >= 12) unlock('designer');
    this.refreshHUD();
    this.engine.autosave();
  }

  shatterPC(ent) {
    sfx.shatter();
    this.fx.debris(ent.group.position.clone().setY(0.3), { count: 26 });
    this.scene.remove(ent.group);
    if (this.entities.get(ent.key) === ent) { this.entities.delete(ent.key); delete this.state.placed[ent.key]; }
    ui.log('The PC breaks from the impact with the ground. Its pieces are everywhere. Maybe keeping something soft below it would help.', 'warn');
    unlock('pcbroke');
  }

  pushOut(r) {
    const p = this.player.pos;
    const cands = [
      [r.minX - RADIUS - 0.05, p.z], [r.maxX + RADIUS + 0.05, p.z], [p.x, r.minZ - RADIUS - 0.05], [p.x, r.maxZ + RADIUS + 0.05],
    ].sort((a, b) => Math.hypot(a[0] - p.x, a[1] - p.z) - Math.hypot(b[0] - p.x, b[1] - p.z));
    for (const [x, z] of cands) if (this.walkable(x, z, x, z)) { p.x = x; p.z = z; return; }
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
    for (const e of this.entities.values()) if (e.rect) list.push(e.rect);
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
      else e.group.traverse(o => { if (o.isMesh) list.push(o); });
    }
    if (this.state.lamp && this.state.lamp !== 'hand') this.lantern.traverse(o => { if (o.isMesh) list.push(o); });
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
    const names = { tap: 'Sink', shower: 'Shower', toilet: 'Toilet', stove: 'Stove', knives: 'Knife block', fridge: 'Fridge', portal: 'Portal to Hell', lamp: 'Lamp' };
    return names[f.owner] || (CATALOG[f.owner] ? CATALOG[f.owner].name : f.owner);
  }

  use() {
    if (this.placing) { this.engine.touch ? this.rotatePlacing() : this.castPlacing(); return; }
    const f = this.focus;
    if (!f) { if (this.player.sitting) { this.player.stand(); ui.log('You stood up.'); } return; }
    sfx.click();
    const fn = this['use_' + f.owner];
    if (fn) fn.call(this, f);
  }

  menu(title, text, items) {
    ui.dialog({
      title, html: text ? `<p>${text}</p>` : '',
      buttons: [...items.filter(Boolean), { label: 'Never mind', cls: 'danger' }],
    });
  }

  sitOn(type, ent) {
    if (this.player.sitting) { ui.log('You are already sitting.'); return; }
    const p = ent.group.position;
    const front = ROT_FRONT(ent.rot);
    if (type === 'chair' || type === 'cushion') { this.player.pos.set(p.x, 0, p.z); }
    else {
      // perch on the front edge
      const fp = CATALOG[type].fp;
      const target = p.clone().addScaledVector(front, type === 'bed' ? fp[1] - 0.6 : fp[1] * 0.3);
      this.player.pos.set(target.x, 0, target.z);
    }
    this.player.yaw = Math.atan2(-front.x, -front.z);
    this.player.pitch = 0;
    this.player.sit(type, SEATS[type] || 1.0);
    ui.log(`You sat on the ${CATALOG[type].name.toLowerCase()}. (Move to stand up.)`);
    if (type === 'chair') this.checkTV();
  }

  sleepOn(type, ent) {
    const fl = this.state.flags;
    if (fl.showered) { ui.log('You had just taken a shower. You\'re too fresh to sleep.'); return; }
    if (fl.slept) { ui.log('You have already slept enough. You are not feeling sleepy.'); return; }
    fl.slept = true;
    this.player.lie();
    sfx.whisper();
    ui.story(DREAM, { clear: true }).then(() => {
      this.sitOn(type, ent);
      unlock('dream'); this.engine.autosave();
    });
  }

  use_bed(f) { const e = this.entities.get('bed'); this.menu('Bed', 'A conjured bed. Suspiciously comfortable.', [{ label: 'Sit', onClick: () => this.sitOn('bed', e) }, { label: 'Sleep', onClick: () => this.sleepOn('bed', e) }]); }
  use_sofa(f) { const e = this.entities.get('sofa'); this.menu('Sofa', '', [{ label: 'Sit', onClick: () => this.sitOn('sofa', e) }, { label: 'Nap', onClick: () => this.sleepOn('sofa', e) }]); }
  use_cushion(f) { const e = this.entities.get('cushion'); if (this.entityAt(e.slot, 'pc')) { this.use_pc(); return; } this.menu('Cushion', 'Soft. Purple. Ideal for sitting, or for catching falling things.', [{ label: 'Sit', onClick: () => this.sitOn('cushion', e) }]); }
  use_dine() {
    const e = this.entities.get('dine');
    const fl = this.state.flags;
    this.menu('Dining Table', 'A long table set for guests who will never come.', [
      { label: 'Sit', onClick: () => this.sitOn('dine', e) },
      fl.stewCooked && !fl.stewEaten ? { label: 'Eat the ember stew', onClick: () => this.eatStew(e) } : null,
    ]);
  }
  use_table() {
    const e = this.entities.get('table');
    this.menu('Study Table', 'Papers, an inkwell, a quill. Someone has scribbled notes.', [
      { label: 'Sit', onClick: () => this.sitOn('table', e) },
      { label: 'Read the notes', onClick: () => ui.dialog({ title: 'Scribbled notes', html: `<div class="book">Things I know:
• Conjured things fall from the sky. Don't stand under them.
• Floor things land on the cell you look at. Doors and TVs go on the wall you face. Whole rooms go beyond it.
• R rotates what I'm about to conjure.
• Chairs can be turned. Why would I want that? (TV?)
• G to search the floor. F for the lamp.</div>`, buttons: [{ label: 'Close' }] }) },
    ]);
  }
  use_chair() {
    const e = this.entities.get('chair');
    this.menu('Chair', `It is facing ${SIDE_NAMES[Object.keys(SIDE_FRONT_ROT).find(k => SIDE_FRONT_ROT[k] === e.rot)]}.`, [
      { label: 'Sit', onClick: () => this.sitOn('chair', e) },
      { label: 'Turn clockwise', onClick: () => this.turnChair(1) },
      { label: 'Turn anti-clockwise', onClick: () => this.turnChair(-1) },
    ]);
  }
  turnChair(d) {
    const e = this.entities.get('chair');
    e.rot = (e.rot + (d > 0 ? 3 : 1)) % 4; // clockwise seen from above
    e.group.rotation.y = e.rot * Math.PI / 2;
    this.state.placed.chair.rot = e.rot;
    e.rect = this.footprint('chair', e.slot, e.rot);
    sfx.click();
    const facing = Object.keys(SIDE_FRONT_ROT).find(k => SIDE_FRONT_ROT[k] === e.rot);
    const tv = this.entities.get('tv');
    ui.log(`The chair is now facing ${SIDE_NAMES[facing]}${tv && tv.slot === facing ? ' — right at the TV.' : '.'}`);
  }

  checkTV() {
    const tv = this.entities.get('tv'); const ch = this.entities.get('chair');
    if (!tv || !ch || SIDE_FRONT_ROT[tv.slot] !== ch.rot) return;
    this.playBroadcast();
  }

  playBroadcast() {
    const tv = this.entities.get('tv');
    tv.group.userData.screenMesh.material.emissiveIntensity = 1;
    this.tvOn = true;
    sfx.whisper();
    ui.story(TV_BROADCAST.map(t => `📺\n\n${t}`), { clear: true }).then(() => {
      this.tvOn = false;
      this.state.flags.tvSeen = true;
      tv.group.userData.screenMesh.material.emissiveIntensity = 0.15;
      unlock('couch'); this.engine.autosave();
    });
  }

  use_tv() {
    this.menu('TV', 'An old television with a single channel.', [
      { label: 'Turn it on', onClick: () => {
        const tv = this.entities.get('tv');
        tv.group.userData.screenMesh.material.emissiveIntensity = 0.6; this.tvStatic = 2.5;
        ui.log('Static. A voice crackles: "...sit... down... and... pay... attention..."', 'lore');
      } },
    ]);
  }

  use_shelf() {
    const fl = this.state.flags;
    const read = fl.books;
    this.menu('Bookshelf', `There are plenty of (${BOOKS.length}) books in here to read.`, [
      ...BOOKS.map(b => ({ label: `${read.includes(b.id) ? '✓ ' : ''}${b.title}`, onClick: () => this.readBook(b) })),
      read.includes('diary') && !fl.wand ? { label: '📕 Pull the crooked book', onClick: () => this.pullBook() } : null,
    ]);
  }
  pullBook() {
    const fl = this.state.flags;
    fl.wand = true; sfx.key();
    const e = this.entities.get('shelf');
    if (e) this.fx.burst(e.group.position.clone().setY(1.3), { count: 20, color: '#ff9a50', size: 0.25 });
    ui.dialog({ title: 'A hidden compartment', html: '<p>The crooked book is a lever. Something clicks, and a slim drawer slides out of the shelf.</p><p>Inside lies a wand of black wood with a glowing ember core.</p><p class="muted">Found: <b>Ember Wand</b> — your falling-furniture spell recharges twice as fast in battle.</p>', buttons: [{ label: 'Take it' }] });
    this.secretFound(); this.refreshHUD(); this.engine.autosave();
  }
  secretFound() {
    const fl = this.state.flags;
    if (fl.wand && fl.cloak && fl.diary) unlock('secrets');
  }
  readBook(b) {
    const read = this.state.flags.books;
    if (!read.includes(b.id)) read.push(b.id);
    if (read.length >= BOOKS.length) unlock('bookworm');
    sfx.open();
    ui.dialog({ title: b.title, html: `<div class="book">${ui.escapeHtml(b.text)}</div>`, buttons: [{ label: 'Back to the shelf', onClick: () => this.use_shelf() }, { label: 'Close' }] });
  }

  use_closet() {
    const fl = this.state.flags;
    this.menu('Closet', 'You can change your clothes here, or view yourself in the mirror.', [
      { label: 'Change clothes', onClick: () => { if (this.state.clothes === 'new') ui.log('You are already in a new pair of clothes.'); else { this.state.clothes = 'new'; sfx.open(); ui.log('You wear a new pair of clothes. Very wizardly.'); } } },
      { label: 'Look in the mirror', onClick: () => { fl.mirror = (fl.mirror || 0) + 1; ui.log(MIRROR_LINES[Math.min(fl.mirror - 1, MIRROR_LINES.length - 1)]); unlock('fabulous'); } },
      this.state.clothes === 'new' && !fl.cloak ? { label: 'Knock on the back panel', onClick: () => this.knockPanel() } : null,
    ]);
  }
  knockPanel() {
    const fl = this.state.flags;
    fl.knocks = (fl.knocks || 0) + 1;
    if (!fl.books.includes('witch') && fl.knocks < 3) { sfx.close(); ui.log('Knock knock. The panel sounds... hollow? You\'re not sure what you\'re looking for.'); return; }
    fl.cloak = true; sfx.key();
    ui.dialog({ title: 'A false back', html: '<p>The panel behind your old clothes is hollow. It swings open on a hidden hinge.</p><p>Hanging inside: a midnight-purple cloak that smells faintly of smoke and roses.</p><p class="muted">Found: <b>Witch\'s Cloak</b> — absorbs the first hit you take in each boss fight.</p>', buttons: [{ label: 'Wear it' }] });
    this.secretFound(); this.refreshHUD(); this.engine.autosave();
  }

  use_shoerack() {
    const s = this.state.shoes;
    this.menu('Shoe Rack', `Here you can wear shoes and slippers. A label reads: "please wear shoes before going out of the house".\nYou are wearing: ${s === 'none' ? 'nothing on your feet' : s}.`, [
      s !== 'shoes' ? { label: 'Wear shoes', onClick: () => { this.state.shoes = 'shoes'; sfx.pickup(); ui.log('You wore shoes. Sturdy soles.'); this.refreshHUD(); } } : null,
      s !== 'slippers' ? { label: 'Wear slippers', onClick: () => { this.state.shoes = 'slippers'; sfx.pickup(); ui.log('You wore slippers. Comfy. Probably flammable.'); this.refreshHUD(); } } : null,
      s !== 'none' ? { label: 'Take them off', onClick: () => { ui.log(`You took off the ${this.state.shoes}.`); this.state.shoes = 'none'; this.refreshHUD(); } } : null,
    ]);
  }

  use_showcase() {
    const fl = this.state.flags;
    const e = this.entities.get('showcase');
    if (!fl.showcaseOpen) {
      if (!fl.showKey) {
        sfx.locked();
        this.menu('Showcase', fl.hellKeyTaken ? 'The glass case is locked again. Your H key doesn\'t fit — it wants the invisible one.' : 'A locked glass case. Inside you can make out a skeleton, a stone slab and a glint of red metal. The keyhole glows faintly cyan.', []);
        return;
      }
      sfx.key();
      fl.showcaseOpen = true;
      this.openShowcaseVisual(false);
      ui.log('The invisible key turns. The showcase is unlocked and swings open.', 'good');
      unlock('fossil');
      this.engine.autosave();
    }
    this.menu('Showcase', 'Inside, the skeleton of the legendary hell monster Kraken. It\'s smaller than you imagined. Below it, a fossil with the impression of some kind of giant nail.', [
      { label: 'Study the skeleton', onClick: () => ui.log('Five arms, one enormous eye socket. The arms end in flat pads — as if made for slamming.', 'lore') },
      { label: fl.nailKnown ? 'Study the fossil again' : 'Study the nail fossil', onClick: () => this.studyFossil() },
      !fl.hellKeyTaken ? { label: 'Take the key with an "H" on it', onClick: () => { fl.hellKeyTaken = true; this.engine.split('H key'); e.group.userData.hkey.visible = false; sfx.key(); ui.log('You took the key with an "H" inscribed on it.', 'good'); this.refreshHUD(); this.engine.autosave(); } } : null,
    ]);
  }
  studyFossil() {
    const fl = this.state.flags;
    if (!fl.nailKnown) {
      fl.nailKnown = true; sfx.conjure();
      ui.dialog({ title: 'The Nail Fossil', html: '<p>You trace the impression with your fingers: a shaft as wide as a tree, a head like a cart wheel. Something like this once fell from the sky — and pinned the first Kraken to the floor of hell.</p><p>The shape burns itself into your memory.</p><p class="muted">New spell learned: <b>Giant Nail</b>. Far too big for this room. It needs a worthy target.</p>', buttons: [{ label: 'Got it' }] });
      this.engine.autosave();
    } else ui.log('The nail shape is already burned into your memory.', 'lore');
  }
  openShowcaseVisual(instant) {
    const e = this.entities.get('showcase');
    if (!e) return;
    e.group.userData.keyhole.material.color.set(0x335555);
    if (instant) e.group.userData.door.rotation.y = -1.9;
    else this.anim = { obj: e.group.userData.door, prop: 'y', to: -1.9 };
  }

  use_pc() {
    const fl = this.state.flags;
    const pcMenu = () => ui.dialog({
      title: '💻 WIZ-DOS 3.1',
      html: '<div class="pc-screen">Power button pressed.\nHome screen opened.\n\nC:\\&gt; _</div>',
      buttons: [
        { label: '🎮 Play a game', onClick: () => this.rps() },
        { label: '🌐 Surf', onClick: () => ui.dialog({ title: 'WizNet', html: `<div class="pc-screen">${PC_SURF}</div>`, buttons: [{ label: 'Back', onClick: pcMenu }] }) },
        { label: '✉️ Messages', onClick: () => ui.dialog({ title: 'Mail', html: `<div class="pc-screen">${PC_MAIL}</div>`, buttons: [{ label: 'Back', onClick: pcMenu }] }) },
        { label: this.state.flags.diary ? '📓 vault.exe (open)' : '🔒 vault.exe', onClick: () => this.vault(pcMenu) },
        { label: 'Shut down', cls: 'danger', onClick: () => ui.log('PC closed.') },
      ],
    });
    pcMenu();
  }

  vault(back) {
    const fl = this.state.flags;
    if (fl.diary) { ui.dialog({ title: 'Vault', html: `<div class="book">${ui.escapeHtml(WITCH_DIARY)}</div>`, buttons: [{ label: 'Back', onClick: back }, { label: 'Close' }] }); return; }
    const box = ui.dialog({
      title: '🔒 vault.exe',
      html: `<div class="pc-screen">PROPERTY OF THE WITCH.\nENTER 3-DIGIT CODE:</div><input id="vcode" inputmode="numeric" maxlength="3" autocomplete="off" style="margin-top:10px;width:100%;font:22px var(--mono);letter-spacing:.4em;text-align:center;padding:8px;border-radius:8px;border:1px solid #1d4d2a;background:#031207;color:#59ff8a">`,
      buttons: [{ label: 'Enter', cls: 'primary', keep: true, onClick: () => check() }, { label: 'Back', onClick: back }],
    });
    const inp = box.querySelector('#vcode');
    setTimeout(() => inp.focus(), 30);
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') check(); });
    const check = () => {
      if (inp.value.replace(/\D/g, '') === '556') {
        fl.diary = true; sfx.key(); unlock('vault');
        ui.dialog({ title: 'ACCESS GRANTED', html: `<div class="book">${ui.escapeHtml(WITCH_DIARY)}</div>`, buttons: [{ label: 'Close the vault' }] });
        this.secretFound(); this.refreshHUD(); this.engine.autosave();
      } else { sfx.locked(); inp.value = ''; inp.placeholder = 'WRONG'; }
    };
  }

  rps() {
    let you = 0, comp = 0, last = 'First to 3 wins.\nType... er, click rock, paper or scissors when ready.';
    const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
    const icon = { rock: '🪨', paper: '📄', scissors: '✂️' };
    const render = () => {
      const box = ui.dialog({
        title: 'Rock · Paper · Scissors',
        html: `<div class="pc-screen">${last}\n\nYOU ${you}  —  ${comp} PC</div><div class="rps-row"><button class="btn" data-m="rock">🪨</button><button class="btn" data-m="paper">📄</button><button class="btn" data-m="scissors">✂️</button></div>`,
        buttons: [{ label: 'Quit game', cls: 'danger' }],
      });
      box.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => play(b.dataset.m)));
    };
    const play = (m) => {
      const c = ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)];
      let res;
      if (m === c) res = 'Tie!';
      else if (beats[m] === c) { you++; res = 'You win the round!'; sfx.win(); }
      else { comp++; res = 'PC wins the round. It looks smug.'; sfx.lose(); }
      last = `1!, 2!!, 3!!! GO!!!!!\n\nyou: ${icon[m]}   pc: ${icon[c]}\n${res}`;
      if (you >= 3 || comp >= 3) return finish(you >= 3);
      render();
    };
    const finish = (won) => {
      const fl = this.state.flags;
      if (won) {
        fl.pcWon = true; unlock('rps');
        const tip = fl.keyCell ? `"Close the PC and SEARCH the floor in the ${CELL_NAMES[fl.keyCell].toUpperCase()} part of the room."` : '"Close the PC and SEARCH the floor before moving from this spot."';
        ui.dialog({ title: 'YOU WON!!!', html: `<div class="pc-screen">Congratulations,\nyou have cleared the first half of the game...\n\nNow here is your secret tip:\n\n${tip}</div>`, buttons: [{ label: 'Close the PC' }] });
        this.engine.autosave();
      } else {
        ui.dialog({ title: 'You lost!', html: '<div class="pc-screen">PC wins 3 rounds.\nIt plays a little victory jingle.</div>', buttons: [{ label: 'Rematch', onClick: () => this.rps() }, { label: 'Close' }] });
      }
    };
    render();
  }

  use_door(f) {
    const side = f.key.split('_')[1];
    const open = !!this.state.flags[f.key];
    if (open) { this.setDoor(side, false); ui.log('You closed the door.'); return; }
    const a = this.room.annexes[side];
    if (a && a.type === 'hell' && !this.state.flags.hellKeyTaken) {
      sfx.locked();
      ui.log(this.state.flags.showKey ? 'The door is locked. You try the invisible key, but it does not fit. Maybe it goes into something else.' : 'The door is locked. You don\'t have its key. The keyhole is shaped like... a letter?', 'warn');
      return;
    }
    this.setDoor(side, true);
    if (a && a.type === 'hell') ui.log('The H key turns. Heat pours through the doorway.', 'good');
    else ui.log('You opened the door.');
    if (!a) ui.log('Beyond the door: nothing. A flat black void. Maybe conjure something out there.', 'lore');
  }

  setDoor(side, open) {
    const key = 'door_' + side;
    const e = this.entities.get(key);
    if (!e) return;
    this.state.flags[key] = open;
    open ? sfx.open() : sfx.close();
    this.anim = { obj: e.group.userData.pivot, prop: 'y', to: open ? -1.6 : 0 };
  }

  use_lamp() { this.menu('Lamp', '', [{ label: 'Pick it up', onClick: () => this.pickLamp() }, { label: this.state.lampOn ? 'Turn off' : 'Turn on', onClick: () => this.toggleLamp() }]); }

  use_tap() {
    const fl = this.state.flags;
    const a = this.annexOfType('bathroom');
    this.menu('Sink', fl.tapOn ? 'Water is flowing.' : 'The tap is off.', [
      { label: fl.tapOn ? 'Turn the tap off' : 'Turn the tap on', onClick: () => { fl.tapOn = !fl.tapOn; a.water.visible = fl.tapOn; sfx.water(fl.tapOn); ui.log(fl.tapOn ? 'You turned the tap. Water is flowing.' : 'You turned the tap. Water stopped flowing.'); } },
      { label: 'Wash your face', onClick: () => { if (fl.tapOn) { ui.log('You washed your face. Please remember to turn off the tap.'); fl.washed = true; } else ui.log('Please turn the tap on to wash your face.'); } },
      { label: 'Look in the mirror', onClick: () => { unlock('fabulous'); ui.log('A tired but fabulous wizard looks back at you.'); } },
    ]);
  }
  use_toilet() { const fl = this.state.flags; if (!fl.peed) { fl.peed = true; ui.log('You peed. Magic does not solve everything.'); } else ui.log('You were not able to pee anymore.'); }
  use_shower() {
    const fl = this.state.flags;
    const a = this.annexOfType('bathroom');
    this.menu('Shower', 'Do you want to take a shower?', [{
      label: 'Yes', onClick: () => {
        fl.showered = true; this.state.clothes = 'new';
        a.drops.visible = true; sfx.water(true);
        setTimeout(() => { a.drops.visible = false; }, 3500);
        ui.log('You keep your lamp aside, take off your soiled clothes and take a hot shower. You wear a new pair of clothes. You feel fresh and active.', 'good');
        unlock('hygiene'); this.engine.autosave();
      },
    }]);
  }
  use_stove() {
    const fl = this.state.flags;
    if (fl.stewCooked) { ui.log(fl.stewEaten ? 'The cauldron is empty. The witch did say ONE stew.' : 'Your bowl of ember stew is waiting. Eat it at a proper table.'); return; }
    ui.dialog({ title: 'Stove', html: `<div class="book">${ui.escapeHtml(KITCHEN_NOTE)}</div>`, buttons: [{ label: 'Cook the ember stew', onClick: () => {
      fl.stewCooked = true; const a = this.annexOfType('kitchen'); a.stew.visible = false;
      sfx.sizzle(); unlock('chef');
      ui.log('You ladle the glowing stew into a bowl. The witch would insist you eat it at a dining table.', 'good');
      this.refreshHUD(); this.engine.autosave();
    } }, { label: 'Leave it' }] });
  }
  eatStew() {
    const fl = this.state.flags;
    fl.stewEaten = true;
    this.state.maxHearts += 1; this.state.hearts = this.state.maxHearts;
    sfx.pickup();
    ui.log('You sit down properly and eat the ember stew. Warmth spreads through your chest. (+1 max heart, fully healed.)', 'good');
    this.refreshHUD(); this.engine.autosave();
  }
  use_knives() { ui.log('You reach for the knives. A voice in your head says: "NO."', 'lore'); }
  use_fridge() {
    const fl = this.state.flags;
    sfx.open();
    if (fl.lemon) { ui.log('Empty. Even the lemon left you.'); return; }
    this.menu('Fridge', 'Empty, except for a single, judgmental lemon.', [{ label: 'Take the lemon', onClick: () => { fl.lemon = true; sfx.pickup(); ui.log('You pocket the lemon. It judges you from inside your pocket.'); this.refreshHUD(); this.engine.autosave(); } }]);
  }
  use_portal() { this.enterPortal(); }

  annexOfType(type) { for (const s of SIDES) if (this.room.annexes[s] && this.room.annexes[s].type === type) return this.room.annexes[s]; return null; }

  search() {
    const fl = this.state.flags;
    if (this.player.sitting && this.player.sitting !== 'cushion') { ui.log('You need to stand (or sit on the floor) to search.'); return; }
    const pc = this.entities.get('pc');
    const here = cellAt(this.player.pos.x, this.player.pos.z);
    ui.log('You start searching, placing your hands on the floor around you...');
    setTimeout(() => {
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
  }

  enterPortal() {
    if (this.enteringHell) return;
    this.enteringHell = true;
    if (this.engine.stats.conjured <= 8) unlock('minimalist');
    this.engine.enterHell();
  }

  // -------------------------------------------------------------- per frame
  handleAction(a) {
    switch (a) {
      case 'use': case 'enter': this.use(); break;
      case 'cast': if (this.placing) this.castPlacing(); break;
      case 'book': this.openSpellbook(); break;
      case 'cancel': this.cancelPlacing(); break;
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
    else {
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

  updateObjective() {
    const s = this.state, fl = s.flags;
    let o;
    if (!s.lamp) o = 'It\'s pitch dark. Open your spellbook (Q) and conjure a lamp.';
    else if (s.lamp !== 'hand') o = 'Pick your lamp back up.';
    else if (!s.lampOn) o = 'Turn on the lamp (F).';
    else if (!fl.showKey && !fl.pcWon) o = 'Find a way out. Conjure things — the books, or a PC, might know something.';
    else if (!fl.showKey) o = fl.keyCell ? `Search the floor in the ${CELL_NAMES[fl.keyCell]} part of the room (G).` : 'Search the floor where the PC stands (G).';
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
    if (fl.wand) inv.push('🪄 <b>Ember Wand</b>');
    if (fl.cloak) inv.push('🧥 <b>Cloak</b>');
    if (fl.diary) inv.push('📓 <b>Diary</b>');
    if (fl.lemon) inv.push('🍋 <b>Lemon</b>');
    if (s.shoes !== 'none') inv.push(`👟 <b>${s.shoes}</b>`);
    ui.setInventory(inv);
  }
}
