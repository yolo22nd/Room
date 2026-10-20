import * as THREE from 'three';
import { ChamberLevel } from './chamber';
import { CATALOG, buildObject, box, cyl, materials as M } from './models';
import { glowSprite, tiles, brick } from './textures';
import { RADIUS } from './player';
import * as ui from './ui';
import { sfx } from './audio';
import { unlock } from './save';

const FLOOR_TYPES = () => Object.keys(CATALOG).filter(t => CATALOG[t].kind === 'floor' && t !== 'pc');

function iconPanel(type, size) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(20,10,40,0.85)'; g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#b58cff'; g.lineWidth = 6; g.stroke();
  g.font = '56px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(CATALOG[type].icon, 64, 54);
  g.fillStyle = '#e8d8ff'; g.font = 'bold 15px sans-serif'; g.fillText(CATALOG[type].name.toUpperCase(), 64, 100);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide }));
  return m;
}

// ============================================================ Lesson 1
/** The Upside-Down Room: everything you conjure falls UP. */
export class UpsideLevel extends ChamberLevel {
  constructor(engine, state) {
    super(engine, state, { gravity: 1, h: 3.4, fog: 0x0b0716 });
    this.chapterId = 'upside';
    this.addCrystalBall(-3.6, 3.6);
    this.intro = 'The witch\'s voice: "Lesson one. Up is the new down. Match the runes on the ceiling."';
    this.addExit('n', 'Exit door');
    this.lockedHint = () => `The door won't budge. Match the ceiling runes (${this.runes.filter(r => r.done).length}/3).`;
    // three runes on distinct ceiling cells, each asking for a furniture type
    const cells = [];
    for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) if (!(c === 1 && r === 2)) cells.push([c, r]);
    cells.sort(() => Math.random() - 0.5);
    const types = FLOOR_TYPES().sort(() => Math.random() - 0.5);
    this.runes = [0, 1, 2].map(i => {
      const cell = cells[i], type = types[i];
      const p = this.cellCenter(cell);
      const panel = iconPanel(type, 1.3);
      panel.rotation.x = Math.PI / 2; panel.position.set(p.x, this.cfg.h - 0.03, p.z);
      this.root.add(panel);
      const glow = new THREE.PointLight(0xb58cff, 2, 4, 2); glow.position.set(p.x, this.cfg.h - 0.5, p.z); this.root.add(glow);
      return { cell, type, panel, glow, done: false };
    });
    // upside-down decor on the ceiling
    const decor = buildObject('chair'); decor.rotation.x = Math.PI; decor.position.set(3, this.cfg.h, -3); this.root.add(decor);
    const lamp = buildObject('table'); lamp.rotation.x = Math.PI; lamp.position.set(-3, this.cfg.h, 3.2); this.root.add(lamp);
    this.motes = this.makeMotes();
  }

  makeMotes() {
    const n = 140, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 9; pos[i * 3 + 1] = Math.random() * 3.4; pos[i * 3 + 2] = (Math.random() - 0.5) * 9; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const p = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.05, map: glowSprite('#c8b0ff'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.root.add(p); return p;
  }

  onLanded() { this.checkRunes(); }
  checkRunes() {
    let done = 0;
    for (const r of this.runes) {
      const o = this.objects.get(r.type);
      r.done = !!o && this.cellKey(o.cell) === this.cellKey(r.cell);
      r.glow.color.set(r.done ? 0x7dffb2 : 0xb58cff);
      if (r.done) done++;
    }
    if (done === 3 && this.exit.locked) { this.unlockExit(); ui.log('"Hm. Not bad," says the ceiling.', 'lore'); }
    this.refreshHUD();
  }

  updateChamber(dt) {
    const p = this.motes.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { let y = p.getY(i) + dt * 0.25; if (y > 3.4) y = 0; p.setY(i, y); }
    p.needsUpdate = true;
  }

  objective() { return `Conjure the furniture each ceiling rune shows, onto that rune's cell. Things fall UP here. (${this.runes.filter(r => r.done).length}/3)`; }
  inventory() { return this.runes.map(r => `${r.done ? '✅' : '⬜'} <b>${CATALOG[r.type].name}</b>`); }
}

// ============================================================ Lesson 2
/** The Flooded Library: the water rises and floats you up; grab books in time. */
export class LibraryLevel extends ChamberLevel {
  constructor(engine, state) {
    super(engine, state, {
      w: 12, d: 12, h: 7, cols: 4, rows: 4, fog: 0x07121c,
      floorTex: () => tiles('#6a6050').clone(),
      wallMat: new THREE.MeshStandardMaterial({ map: brick(), color: 0x8899aa, roughness: 0.9 }),
    });
    this.chapterId = 'library';
    this.addCrystalBall(-1.5, 5.2);
    this.intro = '"Lesson two. Libraries flood. Save my six glowing books before the water reaches the ceiling — and remember, everything you conjure takes up space."';
    this.water = 0;
    this.rate = state.mode === 'hard' ? 0.032 : 0.024;
    this.start = [0, 4.8, 0];
    this.light.position.y = 6.2; this.light.intensity = 30; this.light.distance = 40;
    // tall shelves on the walls
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x4a2c1a, roughness: 0.8 });
    for (const [x, z, ry] of [[-5.9, -2, Math.PI / 2], [-5.9, 2.5, Math.PI / 2], [5.9, -2, -Math.PI / 2], [5.9, 2.5, -Math.PI / 2], [-2.5, -5.9, 0], [2.5, -5.9, 0]]) {
      const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = ry; this.root.add(s);
      box(3, 6.6, 0.4, shelfMat, 0, 3.3, 0, s);
      for (let i = 0; i < 7; i++) {
        box(3, 0.06, 0.45, shelfMat, 0, 0.3 + i * 0.95, 0.05, s);
        for (let k = 0; k < 12; k++) {
          const h = 0.5 + Math.random() * 0.3;
          box(0.18, h, 0.3, new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.45, 0.3), roughness: 0.8 }), -1.35 + k * 0.23, 0.33 + i * 0.95 + h / 2, 0.08, s).castShadow = false;
        }
      }
    }
    // water
    this.waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ color: 0x2a6a9a, transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.2, emissive: 0x0a2030, depthWrite: false, side: THREE.DoubleSide }));
    this.waterMesh.rotation.x = -Math.PI / 2; this.root.add(this.waterMesh);
    // six glowing books, low ones near the start
    const spots = [[3.2, 5.6, 0.45], [-3.2, 5.6, 1.1], [5.6, 0.2, 2.0], [-5.6, 0.2, 3.0], [2.5, -5.6, 4.1], [-2.5, -5.6, 5.3]];
    this.books = spots.map(([x, z, y]) => {
      const g = new THREE.Group(); g.position.set(x, y, z); this.root.add(g);
      const mat = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffa020, emissiveIntensity: 1.6 });
      const b = box(0.35, 0.45, 0.12, mat, 0, 0, 0, g);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite('#ffcc66'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.scale.setScalar(1.4); g.add(sp);
      const book = { g, mat, y, got: false, lost: false };
      b.userData.use = { label: 'Glowing book', fn: () => this.takeBook(book) };
      this.usables.push(b);
      return book;
    });
    // the hatch in the ceiling
    this.hatch = new THREE.Mesh(new THREE.CircleGeometry(1.2, 32), new THREE.MeshBasicMaterial({ color: 0x222233, side: THREE.DoubleSide }));
    this.hatch.rotation.x = Math.PI / 2; this.hatch.position.set(0, 6.98, 0); this.root.add(this.hatch);
  }

  takeBook(book) {
    if (book.got || book.lost) return;
    const eye = this.player.pos.clone(); eye.y += this.player.height;
    if (eye.distanceTo(book.g.position) > 2.6) { ui.log('Out of reach. (The water will lift you... eventually.)', 'warn'); return; }
    book.got = true; book.g.visible = false;
    sfx.pickup();
    const n = this.books.filter(b => b.got).length;
    ui.log(`You save a glowing book (${n}/6).`, 'good');
    if (n === 6) {
      this.hatch.material.color.set(0x7dffb2);
      this.rate *= 5;
      ui.log('All six! The ceiling hatch glows — the water will carry you up to it.', 'good');
    }
    this.refreshHUD();
  }

  floorY() { return 0; }
  surface() { return this.water > 0.3 ? 'water' : 'tile'; }
  onLanded(obj) {
    // Archimedes: conjured furniture displaces water
    this.water += 0.18;
    sfx.splash();
    ui.log(`The ${CATALOG[obj.type].name.toLowerCase()} splashes down. The water rises a little.`);
  }
  obstacles() { return this.water > 0.6 ? [] : super.obstacles(); }

  updateChamber(dt) {
    if (this.phase !== 'play') return;
    this.water = Math.min(this.cfg.h, this.water + this.rate * dt);
    this.waterMesh.position.y = this.water;
    this.waterMesh.material.opacity = 0.5 + Math.sin(this.time * 2) * 0.05;
    // float the player and the furniture
    const floatY = Math.max(0, this.water - 1.3);
    this.player.pos.y += (floatY - this.player.pos.y) * Math.min(1, dt * 3);
    this.player.speed = this.water > 1.3 ? 2.3 : 3;
    for (const o of this.objects.values()) if (!this.drops.some(d => d.obj === o)) o.group.position.y = Math.max(0, this.water - 0.35 + Math.sin(this.time * 2 + o.cell[0]) * 0.04);
    for (const b of this.books) {
      if (b.got || b.lost) continue;
      b.g.rotation.y += dt;
      if (this.water > b.y + 0.3) {
        b.lost = true; b.mat.emissiveIntensity = 0.05; sfx.sizzle();
        ui.log('A glowing book sinks under the water and goes dark. The lesson starts over...', 'warn');
        this.fail();
        return;
      }
    }
    const done = this.books.every(b => b.got);
    if (done && this.player.pos.y + this.player.height > this.cfg.h - 0.7 && Math.hypot(this.player.pos.x, this.player.pos.z) < 1.8) {
      this.phase = 'done';
      sfx.win();
      setTimeout(() => this.engine.chapterDone(this.chapterId), 400);
    } else if (!done && this.water > this.cfg.h - 0.6) {
      ui.log('The water reaches the ceiling...', 'warn');
      this.fail();
    }
  }

  fail() {
    if (this.phase !== 'play') return;
    this.phase = 'failed';
    setTimeout(() => this.engine.retryChapter(this.chapterId), 1500);
  }

  objective() { return `Save the six glowing books before they sink. The water floats you up. (${this.books.filter(b => b.got).length}/6)`; }
  inventory() { return [`🌊 water <b>${this.water.toFixed(1)} m</b>`, `📚 <b>${this.books.filter(b => b.got).length}/6</b>`]; }
  update(dt) { super.update(dt); if (Math.floor(this.time * 2) !== this._hudT) { this._hudT = Math.floor(this.time * 2); ui.setInventory(this.inventory()); } }
}

// ============================================================ Lesson 3
/** The Clockwork Tower: the room turns; jam the gear when the door faces the bridge. */
export class ClockworkLevel extends ChamberLevel {
  constructor(engine, state) {
    super(engine, state, { h: 3.6, fog: 0x0e1218, wallMat: new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.6, metalness: 0.3 }) });
    this.chapterId = 'clockwork';
    this.addCrystalBall(3.6, 3.6);
    this.intro = '"Lesson three. My tower never stops turning. Unless, of course, something gets stuck in the gears."';
    this.angle = 0; this.k = 0; this.turnT = 0; this.turning = null;
    this.jammed = null;
    this.start = [0, 3, Math.PI];
    // a doorway in the north wall
    this.root.remove(this.walls.n);
    const h = this.cfg.h;
    for (const sx of [-1, 1]) { const seg = new THREE.Mesh(new THREE.BoxGeometry(3.85, h, 0.2), this.wallMat); seg.position.set(sx * 2.725, h / 2, -4.6); this.root.add(seg); }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.6, h - 2.45, 0.2), this.wallMat); lintel.position.set(0, 2.45 + (h - 2.45) / 2, -4.6); this.root.add(lintel);
    this.addExit('n', 'Tower door');
    this.exit.locked = false; this.exit.lamp.color.set(0xffd27a);
    // the gear pit in the middle cell
    const gearMat = new THREE.MeshStandardMaterial({ color: 0xb08a3a, metalness: 0.9, roughness: 0.3 });
    this.gear = new THREE.Group(); this.root.add(this.gear);
    const disc = cyl(1.2, 1.2, 0.12, gearMat, 0, 0.06, 0, this.gear, 32);
    for (let i = 0; i < 12; i++) { const t = box(0.3, 0.12, 0.35, gearMat, 0, 0.06, 0, this.gear); const a = i / 12 * Math.PI * 2; t.position.set(Math.cos(a) * 1.3, 0.06, Math.sin(a) * 1.3); t.rotation.y = -a; }
    disc.receiveShadow = true;
    // two pendulums swinging across the room
    this.pendulums = [-1.6, 1.6].map((z, i) => {
      const pivot = new THREE.Group(); pivot.position.set(0, h - 0.05, z); this.root.add(pivot);
      cyl(0.03, 0.03, h - 0.9, M.metal, 0, -(h - 0.9) / 2, 0, pivot, 6);
      const bob = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), gearMat); bob.position.y = -(h - 0.7); bob.castShadow = true; pivot.add(bob);
      return { pivot, bob, phase: i * Math.PI, hitT: 0 };
    });
    // outside: sky, the fixed bridge and the goal platform
    this.scene.background = new THREE.Color(0x1a2030);
    const stone = new THREE.MeshStandardMaterial({ color: 0x6a6070, roughness: 0.95 });
    this.bridge = box(1.6, 0.2, 9, stone, 0, -0.1, -10, this.scene);
    const plat = box(5, 0.4, 4, stone, 0, -0.2, -16.5, this.scene);
    const goal = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.12, 12, 32), new THREE.MeshStandardMaterial({ color: 0x222, emissive: 0x7dffb2, emissiveIntensity: 2 }));
    goal.position.set(0, 1.5, -17.5); this.scene.add(goal); this.goal = goal;
    // tower walls far below (a sense of height)
    const tower = cyl(7, 8, 60, new THREE.MeshStandardMaterial({ color: 0x3a3440, roughness: 1 }), 0, -30.3, 0, this.scene, 24);
    tower.receiveShadow = true;
    this.scene.add(new THREE.DirectionalLight(0xffe0c0, 1.2));
    this.lockedHint = null;
  }

  // the room's local frame rotates about Y
  toWorld(v) { return v.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.angle); }
  toLocal(x, z) { const v = new THREE.Vector3(x, 0, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.angle); return v; }
  localPlayer() { return this.toLocal(this.player.pos.x, this.player.pos.z); }

  aimPoint() {
    const p = super.aimPoint();
    return p ? this.toLocal(p.x, p.z) : null;
  }
  aligned() { return !this.turning && ((this.k % 4) + 4) % 4 === 0; }

  walkable(x, z, ox, oz) {
    // the bridge and the platform are in world space
    const onBridge = Math.abs(x) < 0.8 - RADIUS * 0.5 && z < -4.4 && z > -14.6;
    const onPlat = Math.abs(x) < 2.5 - RADIUS && z <= -14.5 && z > -18.4;
    if (onBridge || onPlat) return this.aligned() && this.exit.opened;
    const l = this.toLocal(x, z), lo = this.toLocal(ox, oz);
    const inside = Math.abs(l.x) <= 4.5 - RADIUS && Math.abs(l.z) <= 4.5 - RADIUS;
    const inDoor = Math.abs(l.x) < 0.75 - RADIUS && l.z < -4.2 && l.z > -4.75 && this.exit.opened;
    if (!inside && !inDoor) return false;
    for (const R of this.obstacles()) {
      const pad = { minX: R.minX - RADIUS, maxX: R.maxX + RADIUS, minZ: R.minZ - RADIUS, maxZ: R.maxZ + RADIUS };
      if (l.x > pad.minX && l.x < pad.maxX && l.z > pad.minZ && l.z < pad.maxZ && !(lo.x > pad.minX && lo.x < pad.maxX && lo.z > pad.minZ && lo.z < pad.maxZ)) return false;
    }
    return true;
  }

  useExit() {
    if (this.exit.opened) { this.exit.opened = false; this.exit.door.userData.pivot.rotation.y = 0; sfx.close(); return; }
    this.exit.opened = true; sfx.open();
    this.exit.door.userData.pivot.rotation.y = -1.5;
    if (!this.aligned()) ui.log('Beyond the door: a sheer drop and a lot of sky. The bridge is somewhere else right now.', 'warn');
    else if (!this.jammed) ui.log('The bridge is right there — but the tower will turn again any second!', 'warn');
  }

  onLanded(obj) {
    if (this.cellKey(obj.cell) === '1,1') {
      this.jammed = obj;
      sfx.thud(1.6); sfx.locked();
      ui.log(`The ${CATALOG[obj.type].name.toLowerCase()} wedges into the gears. CLUNK. The tower stops turning.`, 'good');
      obj.group.traverse((o: any) => { if (o.isMesh) { o.userData.use = { label: 'Kick it out of the gears', fn: () => this.unjam() }; this.usables.push(o); } });
      if (!this.aligned()) ui.log('...but the door isn\'t facing the bridge. Kick it loose and try again.', 'warn');
      this.refreshHUD();
    }
  }
  unjam() {
    if (!this.jammed) return;
    this.removeObject(this.jammed);
    this.usables = this.usables.filter(m => m.userData.use && m.userData.use.label !== 'Kick it out of the gears');
    this.jammed = null;
    ui.log('You kick it free. The gears groan back into motion.');
    this.refreshHUD();
  }

  updateChamber(dt) {
    // turning schedule: every 5 s rotate 90 degrees, unless jammed
    if (this.turning) {
      const t = this.turning; t.t += dt;
      const k = Math.min(1, t.t / 1.2);
      const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const target = t.from + (Math.PI / 2) * ease;
      const delta = target - this.angle;
      this.angle = target;
      // the player rides the room
      const p = this.player.pos;
      if (Math.abs(p.x) < 5 && Math.abs(p.z) < 5) {
        const v = new THREE.Vector3(p.x, 0, p.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), delta);
        p.x = v.x; p.z = v.z; this.player.yaw += delta;
      }
      if (k >= 1) { this.turning = null; this.k++; this.turnT = 0; }
    } else if (!this.jammed && this.phase === 'play') {
      this.turnT += dt;
      if (Math.floor((this.turnT - dt) * 2) !== Math.floor(this.turnT * 2)) sfx.tick();
      if (this.turnT > 5) { this.turning = { from: this.angle, t: 0 }; sfx.thud(1.4); this.player.addShake(0.3); }
    }
    this.root.rotation.y = this.angle;
    this.gear.rotation.y = this.jammed ? this.gear.rotation.y : this.gear.rotation.y + dt * 0.8;
    // pendulums
    const pl = this.localPlayer();
    for (const pd of this.pendulums) {
      pd.pivot.rotation.z = Math.sin(this.time * 1.6 + pd.phase) * 1.0;
      pd.hitT = Math.max(0, pd.hitT - dt);
      const b = new THREE.Vector3(); pd.bob.getWorldPosition(b);
      const lb = this.toLocal(b.x, b.z);
      if (pd.hitT === 0 && Math.hypot(lb.x - pl.x, lb.z - pl.z) < 0.7 && this.player.height > 0.8) {
        pd.hitT = 1.5;
        this.engine.damage(1, 'swatted by a pendulum');
        // knock back across the swing
        const dir = Math.sign(pl.x - lb.x) || 1;
        const n = this.toWorld(new THREE.Vector3(pl.x + dir * 1.2, 0, pl.z));
        if (this.walkable(n.x, n.z, this.player.pos.x, this.player.pos.z)) this.player.pos.set(n.x, 0, n.z);
      }
    }
    this.goal.rotation.y += dt;
    if (this.phase === 'play' && this.player.pos.z < -16.4 && Math.abs(this.player.pos.x) < 2) {
      this.phase = 'done'; sfx.win();
      setTimeout(() => this.engine.chapterDone(this.chapterId), 400);
    }
    // falling off the bridge isn't possible (walkable), but the door can open onto air
  }

  objective() {
    if (this.jammed && this.aligned()) return 'Open the door and cross the bridge to the green ring.';
    if (this.jammed) return 'Jammed facing the wrong way — kick it loose (use it) and time it better.';
    return 'Conjure something into the gear pit (middle) exactly when the door faces the bridge.';
  }
  inventory() { return [`⚙️ ${this.jammed ? '<b>jammed</b>' : 'turning'}`, `🚪 ${this.aligned() ? '<b>facing the bridge</b>' : 'facing the sky'}`]; }
  update(dt) { super.update(dt); const s = this.aligned() + ':' + !!this.jammed; if (s !== this._hud) { this._hud = s; this.refreshHUD(); } }
}

export const LESSONS = {
  upside: { title: 'Lesson 1 — The Upside-Down Room', make: (e, s) => new UpsideLevel(e, s) },
  library: { title: 'Lesson 2 — The Flooded Library', make: (e, s) => new LibraryLevel(e, s) },
  clockwork: { title: 'Lesson 3 — The Clockwork Tower', make: (e, s) => new ClockworkLevel(e, s) },
};
export const LESSON_ORDER = ['upside', 'library', 'clockwork'];
