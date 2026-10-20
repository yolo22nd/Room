import * as THREE from 'three';
import { CATALOG, buildObject, buildDoor } from './models';
import { FX } from './fx';
import { RADIUS } from './player';
import { ring, woodFloor, plaster } from './textures';
import * as ui from './ui';
import { sfx, playAmbience } from './audio';
import { manaCost, knows, castShrink, castBlink, SPELLS } from './spells';
import { COL } from './a11y';

/**
 * Base for the Part 4 lesson chambers: a rectangular room with a cell grid,
 * conjuring (with a configurable gravity direction), an exit door and generic
 * interactables. Subclasses add the twist.
 */
export class ChamberLevel {
  [key: string]: any;

  constructor(engine, state, cfg) {
    this.engine = engine;
    this.player = engine.player;
    this.camera = engine.camera;
    this.state = state;
    this.cfg = { w: 9, d: 9, h: 3.4, cols: 3, rows: 3, gravity: -1, ambience: 'room', fog: 0x05040a, ...cfg };
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.cfg.fog);
    this.scene.fog = new THREE.Fog(this.cfg.fog, 8, 40);
    this.fx = new FX(this.scene);
    this.time = 0;
    this.raycaster = new THREE.Raycaster();
    this.objects = new Map();     // type -> { type, cell, group, rect }
    this.drops = [];
    this.usables = [];            // meshes with userData.use = { label, fn }
    this.placing = null;
    this.phase = 'play';
    this.player.walkable = (x, z, ox = x, oz = z) => this.walkable(x, z, ox, oz);
    this.player.canMove = () => true;
    this.player.onBlocked = null;
    this.player.onGrow = null;
    this.buildShell();
  }

  // ---------------------------------------------------------------- shell
  buildShell() {
    const { w, d, h } = this.cfg;
    const s = this.scene;
    this.root = new THREE.Group(); s.add(this.root);
    s.add(new THREE.HemisphereLight(0xc8b8ff, 0x201828, 0.55));
    const floorTex = this.cfg.floorTex ? this.cfg.floorTex() : woodFloor().clone();
    floorTex.needsUpdate = true; floorTex.repeat.set(w / 3, d / 3);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.root.add(floor);
    const ceilTex = plaster().clone(); ceilTex.needsUpdate = true;
    this.ceiling = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 1, side: THREE.DoubleSide }));
    this.ceiling.rotation.x = Math.PI / 2; this.ceiling.position.y = h; this.root.add(this.ceiling);
    const wallMat = this.cfg.wallMat || new THREE.MeshStandardMaterial({ color: 0x3a2a40, roughness: 0.9 });
    this.wallMat = wallMat;
    const mk = (W, x, z, ry) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(W, h, 0.2), wallMat);
      m.position.set(x, h / 2, z); m.rotation.y = ry; m.receiveShadow = true; this.root.add(m); return m;
    };
    this.walls = {
      n: mk(w + 0.4, 0, -d / 2 - 0.1, 0), s: mk(w + 0.4, 0, d / 2 + 0.1, 0),
      w: mk(d + 0.4, -w / 2 - 0.1, 0, Math.PI / 2), e: mk(d + 0.4, w / 2 + 0.1, 0, Math.PI / 2),
    };
    this.light = new THREE.PointLight(0xffc890, 18, 30, 1.3);
    this.light.position.set(0, h - 0.5, 0); this.light.castShadow = this.engine.quality === 'high';
    this.light.shadow.mapSize.set(512, 512);
    this.root.add(this.light);
    this.aimRing = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ring(), color: COL.mine, transparent: true, depthWrite: false }));
    this.aimRing.visible = false; s.add(this.aimRing);
  }

  /** An exit door on a wall side; locked until unlockExit(). */
  addExit(side = 'n', label = 'Exit door') {
    const { w, d } = this.cfg;
    const door = buildDoor();
    const pos = { n: [0, -d / 2], s: [0, d / 2], w: [-w / 2, 0], e: [w / 2, 0] }[side];
    door.position.set(pos[0], 0, pos[1]);
    door.rotation.y = { n: 0, s: Math.PI, w: Math.PI / 2, e: -Math.PI / 2 }[side];
    this.root.add(door);
    this.exit = { door, side, locked: true, label };
    door.traverse((o: any) => { if (o.isMesh) { o.userData.use = { label, fn: () => this.useExit() }; this.usables.push(o); } });
    const lamp = new THREE.PointLight(0xff4d5e, 3, 4, 2); lamp.position.set(0, 2.6, 0.4); door.add(lamp);
    this.exit.lamp = lamp;
    return door;
  }

  unlockExit() {
    if (!this.exit || !this.exit.locked) return;
    this.exit.locked = false;
    this.exit.lamp.color.set(0x7dffb2);
    sfx.key();
    ui.log('Somewhere, a lock clicks open. The exit door glows green.', 'good');
  }

  useExit() {
    if (this.exit.locked) { sfx.locked(); ui.log(this.lockedHint ? this.lockedHint() : 'The exit is locked.', 'warn'); return; }
    if (this.exit.opened) return;
    this.exit.opened = true;
    sfx.open();
    this.exit.door.userData.pivot.rotation.y = -1.5;
    this.phase = 'done';
    setTimeout(() => this.engine.chapterDone(this.chapterId), 700);
  }

  // ---------------------------------------------------------------- grid
  cellSize() { return { cw: this.cfg.w / this.cfg.cols, cd: this.cfg.d / this.cfg.rows }; }
  cellCenter(cell) {
    const { cw, cd } = this.cellSize();
    const [c, r] = cell;
    return new THREE.Vector3(-this.cfg.w / 2 + cw * (c + 0.5), 0, -this.cfg.d / 2 + cd * (r + 0.5));
  }
  cellAt(x, z) {
    const { cw, cd } = this.cellSize();
    const c = Math.floor((x + this.cfg.w / 2) / cw), r = Math.floor((z + this.cfg.d / 2) / cd);
    if (c < 0 || r < 0 || c >= this.cfg.cols || r >= this.cfg.rows) return null;
    return [c, r];
  }
  cellKey(cell) { return cell ? cell[0] + ',' + cell[1] : ''; }

  /** Converts a local point to world (chambers that move their room override). */
  toWorld(v) { return v; }

  // ---------------------------------------------------------------- conjuring
  openSpellbook() {
    if (this.placing) { this.cancelPlacing(); return; }
    const types = Object.keys(CATALOG).filter(t => CATALOG[t].kind === 'floor');
    let html = `<p class="muted">${this.cfg.gravity > 0 ? 'Gravity is upside down here: things fall to the CEILING. Aim up.' : 'Aim at a floor cell and cast.'}</p><div class="spell-grid">`;
    for (const t of types) html += `<button class="spell" data-type="${t}"><span class="ico">${CATALOG[t].icon}</span><span class="nm">${CATALOG[t].name}</span><span class="ty">${manaCost(t)} mana</span></button>`;
    html += '</div><div class="section-label">Spells</div><div class="spell-grid">';
    for (const [id, sp] of Object.entries<any>(SPELLS)) {
      if (id === 'levitate' || !knows(this.state, id)) continue;
      html += `<button class="spell" data-spell="${id}"><span class="ico">${sp.icon}</span><span class="nm">${sp.name}</span><span class="ty">${manaCost(id)} mana</span></button>`;
    }
    html += '</div>';
    const box = ui.dialog({ title: '📖 Spellbook', html, wide: true });
    box.querySelectorAll<any>('[data-type]').forEach(b => b.addEventListener('click', () => { ui.closeDialog(); this.startPlacing(b.dataset.type); }));
    box.querySelectorAll<any>('[data-spell]').forEach(b => b.addEventListener('click', () => {
      ui.closeDialog();
      if (b.dataset.spell === 'shrink') castShrink(this.engine);
      else this.startPlacing('blink');
    }));
  }

  startPlacing(type) {
    this.cancelPlacing();
    sfx.click();
    this.placing = { type, target: null };
    this.aimRing.visible = true;
  }
  cancelPlacing() { this.placing = null; this.aimRing.visible = false; }

  /** Ray hit on the floor (or ceiling when gravity points up). */
  aimPoint() {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const ray = this.raycaster.ray;
    const targetY = this.cfg.gravity > 0 && this.placing && this.placing.type !== 'blink' ? this.cfg.h : (this.floorY ? this.floorY() : 0);
    const dy = targetY - ray.origin.y;
    if (Math.abs(ray.direction.y) < 1e-3 || Math.sign(ray.direction.y) !== Math.sign(dy)) return null;
    const t = dy / ray.direction.y;
    if (t > 20) return null;
    return ray.origin.clone().addScaledVector(ray.direction, t);
  }

  placementError(type, cell) {
    if (!cell) return 'Aim at a cell.';
    for (const o of this.objects.values()) if (o.type !== type && this.cellKey(o.cell) === this.cellKey(cell)) return `That cell already has a ${CATALOG[o.type].name.toLowerCase()}.`;
    return this.cellBlocked ? this.cellBlocked(cell, type) : null;
  }

  castPlacing() {
    const pl = this.placing;
    if (!pl) return;
    const p = this.aimPoint();
    if (pl.type === 'blink') { if (castBlink(this.engine, this.fx, p && this.toWorld(p))) this.cancelPlacing(); return; }
    const cell = p && this.cellAt(p.x, p.z);
    const err = this.placementError(pl.type, cell);
    if (err) { sfx.locked(); ui.log(err, 'warn'); return; }
    if (!this.engine.spend(manaCost(pl.type))) return;
    this.conjure(pl.type, cell);
    this.cancelPlacing();
  }

  conjure(type, cell) {
    const old = this.objects.get(type);
    if (old) { this.removeObject(old); ui.log(`Your old ${CATALOG[type].name.toLowerCase()} vanishes.`); }
    sfx.conjure();
    const g = buildObject(type);
    const c = this.cellCenter(cell);
    const up = this.cfg.gravity > 0;
    g.position.set(c.x, up ? 0.1 : this.cfg.h - 0.4, c.z);
    if (up) g.rotation.x = Math.PI; // upside down, its feet toward the ceiling
    g.scale.setScalar(0.01);
    this.root.add(g);
    const fp = CATALOG[type].fp;
    const obj = { type, cell, group: g, rect: { minX: c.x - fp[0], maxX: c.x + fp[0], minZ: c.z - fp[1], maxZ: c.z + fp[1] } };
    this.objects.set(type, obj);
    this.drops.push({ obj, t: 0, v: 0, target: up ? this.cfg.h : 0 });
    this.fx.burst(this.toWorld(new THREE.Vector3(c.x, up ? 0.1 : this.cfg.h - 0.1, c.z)), { count: 20, color: '#c9a8ff', size: 0.35, up: up ? 1 : -0.3 });
    this.engine.stats.conjured++;
    return obj;
  }

  removeObject(o) {
    this.root.remove(o.group);
    this.objects.delete(o.type);
    this.drops = this.drops.filter(d => d.obj !== o);
  }

  updateDrops(dt) {
    const up = this.cfg.gravity > 0;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i], g = d.obj.group;
      d.t += dt;
      g.scale.setScalar(Math.min(1, d.t / 0.25));
      if (d.t < 0.25) continue;
      d.v += 22 * dt;
      g.position.y += (up ? 1 : -1) * d.v * dt;
      if ((up && g.position.y >= d.target) || (!up && g.position.y <= d.target)) {
        g.position.y = d.target; g.scale.setScalar(1);
        this.drops.splice(i, 1);
        sfx.thud(1);
        this.fx.dust(this.toWorld(new THREE.Vector3(g.position.x, up ? this.cfg.h - 0.1 : 0, g.position.z)), 1);
        // crushed (or launched into)?
        const r = d.obj.rect, p = this.localPlayer ? this.localPlayer() : this.player.pos;
        if (!up && p.x > r.minX - RADIUS && p.x < r.maxX + RADIUS && p.z > r.minZ - RADIUS && p.z < r.maxZ + RADIUS) this.engine.damage(1, 'crushed by your own ' + CATALOG[d.obj.type].name.toLowerCase());
        if (this.onLanded) this.onLanded(d.obj);
      } else if (up && d.v > 3 && !d.hitCheck) {
        // things falling up hit you on the way past
        d.hitCheck = true;
        const r = d.obj.rect, p = this.localPlayer ? this.localPlayer() : this.player.pos;
        if (p.x > r.minX - RADIUS && p.x < r.maxX + RADIUS && p.z > r.minZ - RADIUS && p.z < r.maxZ + RADIUS) {
          ui.log(`The ${CATALOG[d.obj.type].name.toLowerCase()} shoots up right through where you're standing. Ow.`, 'warn');
          this.engine.damage(1, 'uppercut by a ' + CATALOG[d.obj.type].name.toLowerCase());
        }
      }
    }
  }

  // ---------------------------------------------------------------- movement
  obstacles() {
    if (this.cfg.gravity > 0) return [];  // everything is on the ceiling
    return [...this.objects.values()].map(o => o.rect);
  }
  walkable(x, z, ox, oz) {
    const { w, d } = this.cfg;
    const inside = Math.abs(x) <= w / 2 - RADIUS && Math.abs(z) <= d / 2 - RADIUS;
    if (!inside && !(this.extraWalkable && this.extraWalkable(x, z))) return false;
    for (const R of this.obstacles()) {
      const pad = { minX: R.minX - RADIUS, maxX: R.maxX + RADIUS, minZ: R.minZ - RADIUS, maxZ: R.maxZ + RADIUS };
      const inN = x > pad.minX && x < pad.maxX && z > pad.minZ && z < pad.maxZ;
      const inO = ox > pad.minX && ox < pad.maxX && oz > pad.minZ && oz < pad.maxZ;
      if (inN && !inO) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------- frame
  focus() {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.raycaster.far = 3;
    const hits = this.raycaster.intersectObjects(this.usables, false);
    this.raycaster.far = Infinity;
    return hits.length ? hits[0].object.userData.use : null;
  }

  handleAction(a) {
    if (this.phase !== 'play') return;
    switch (a) {
      case 'use': case 'enter': {
        if (this.placing) { this.castPlacing(); break; }
        const f = this.focus(); if (f) { sfx.click(); f.fn(); }
        break;
      }
      case 'cast': if (this.placing) this.castPlacing(); break;
      case 'book': this.openSpellbook(); break;
      case 'cancel': this.cancelPlacing(); break;
      case 'search': if (knows(this.state, 'shrink')) castShrink(this.engine); break;
    }
    if (this.onAction) this.onAction(a);
  }

  activate() {
    this.scene.add(this.camera);
    const st = this.start || [0, this.cfg.d / 2 - 1.2, 0];
    this.player.place(st[0], st[1], st[2]);
    playAmbience(this.cfg.ambience);
    ui.setVignette('');
    this.refreshHUD();
    if (this.intro) ui.log(this.intro, 'lore');
  }
  deactivate() { this.scene.remove(this.camera); }

  update(dt) {
    this.time += dt;
    this.fx.update(dt);
    this.updateDrops(dt);
    if (this.updateChamber) this.updateChamber(dt);
    if (this.placing) {
      const p = this.aimPoint();
      const cell = p && this.placing.type !== 'blink' ? this.cellAt(p.x, p.z) : null;
      if (p) {
        const c = cell ? this.cellCenter(cell) : p;
        const y = this.cfg.gravity > 0 && this.placing.type !== 'blink' ? this.cfg.h - 0.02 : (this.floorY ? this.floorY() : 0) + 0.03;
        this.aimRing.position.copy(this.toWorld(new THREE.Vector3(c.x, y, c.z)));
        this.aimRing.rotation.set(this.cfg.gravity > 0 && this.placing.type !== 'blink' ? Math.PI / 2 : -Math.PI / 2, 0, 0);
        const { cw } = this.cellSize();
        this.aimRing.scale.setScalar(this.placing.type === 'blink' ? 1 : cw * 0.8);
        const err = this.placing.type === 'blink' ? null : this.placementError(this.placing.type, cell);
        this.aimRing.material.color.set(err ? COL.danger : COL.mine);
        this.aimRing.visible = true;
        ui.setPrompt(err ? `<span style="color:var(--danger)">${err}</span>` : `<kbd>${this.engine.touch ? 'Cast' : 'Click'}</kbd>${this.placing.type === 'blink' ? 'Blink here' : 'Conjure ' + CATALOG[this.placing.type].name}`);
      } else { this.aimRing.visible = false; ui.setPrompt(this.cfg.gravity > 0 ? 'Aim at the ceiling' : 'Aim at the floor'); }
    } else {
      const f = this.focus();
      ui.setPrompt(f ? `<kbd>${this.engine.touch ? 'Use' : 'E'}</kbd>${f.label}` : null);
    }
  }

  refreshHUD() {
    ui.setHearts(this.state.hearts, this.state.maxHearts);
    ui.setInventory(this.inventory ? this.inventory() : []);
    ui.setObjective(this.objective ? this.objective() : '');
  }
}
