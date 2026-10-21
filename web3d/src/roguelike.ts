import * as THREE from 'three';
import { ChamberLevel } from './chamber';
import { CATALOG, buildObject, cyl } from './models';
import { seededRandom } from './state';
import { RADIUS } from './player';
import * as ui from './ui';
import { sfx } from './audio';
import { COL } from './a11y';

// Endless mode: procedurally generated rooms, upgrades between them.

const FLOOR = () => Object.keys(CATALOG).filter(t => CATALOG[t].kind === 'floor' && t !== 'pc');
// how heavy each piece is, for pressure plates
export const WEIGHT = { cushion: 1, chair: 1, shoerack: 2, table: 2, shelf: 3, showcase: 3, sofa: 3, dine: 4, closet: 4, bed: 5, pc: 1 };

export const UPGRADES = [
  { id: 'heart', icon: '❤️', name: 'Extra heart', desc: '+1 max heart (and heal).', apply: (r) => { r.maxHearts++; r.hearts = r.maxHearts; } },
  { id: 'heal', icon: '🩹', name: 'Patch up', desc: 'Heal to full.', apply: (r) => { r.hearts = r.maxHearts; } },
  { id: 'mana', icon: '💠', name: 'Deeper well', desc: '+30 max mana.', apply: (r) => { r.maxMana += 30; } },
  { id: 'regen', icon: '🌀', name: 'Quick channel', desc: 'Mana refills 40% faster.', apply: (r) => { r.regen *= 1.4; } },
  { id: 'thrift', icon: '🪙', name: 'Thrifty conjurer', desc: 'Conjuring costs 20% less.', apply: (r) => { r.costMul *= 0.8; } },
  { id: 'nose', icon: '👃', name: 'Keen nose', desc: 'Key hunts tell you if you\'re warm or cold.', apply: (r) => { r.nose = true; } },
  { id: 'umbrella', icon: '☂️', name: 'Umbrella', desc: 'Falling hazards hurt only half the time.', apply: (r) => { r.umbrella = true; } },
];

export function newRun(daily = false, seed = null) {
  return {
    daily, seed: seed || String(Math.floor(Math.random() * 1e9)),
    depth: 0, hearts: 3, maxHearts: 3, maxMana: 100, regen: 1, costMul: 1,
    upgrades: [], nose: false, umbrella: false, time: 0,
  };
}

const KINDS = ['runes', 'upside', 'hunt', 'plates'];
const PALETTES = [0x2a2040, 0x203040, 0x302018, 0x183028, 0x40202a, 0x2a2a2a];

export class RogueRoom extends ChamberLevel {
  constructor(engine, state, run) {
    const rnd = seededRandom(run.seed + ':' + run.depth);
    // memory runes join the pool from room 3
    const pool = run.depth >= 2 ? [...KINDS, 'memory', 'mirror', 'levers'] : KINDS;
    // now and then from room 4: a treasure room with a free upgrade
    const treasure = run.depth >= 3 && rnd() < 0.08;
    const kind = run.forceKind || (run.depth === 0 ? 'runes' : treasure ? 'treasure' : pool[Math.floor(rnd() * pool.length)]);
    const big = run.depth >= 4 && rnd() < 0.5;
    // from room 4 on, rooms may roll a modifier
    const mod = run.depth >= 3 ? ['none', 'none', 'dark', 'cramped', 'stormy'][Math.floor(rnd() * 5)] : 'none';
    const size = mod === 'cramped' ? 6 : big ? 12 : 9, grid = mod === 'cramped' ? 2 : big ? 4 : 3;
    super(engine, state, {
      ambience: 'endless',
      gravity: kind === 'upside' ? 1 : -1,
      w: size, d: size, cols: grid, rows: grid,
      fog: 0x06050a,
      wallMat: new THREE.MeshStandardMaterial({ color: PALETTES[Math.floor(rnd() * PALETTES.length)], roughness: 0.9 }),
    });
    this.rnd = rnd; this.run = run; this.kind = kind; this.mod = mod;
    if (mod === 'dark') {
      this.light.intensity = 2.5; this.light.distance = 7;
      this.scene.fog.near = 2; this.scene.fog.far = 11;
      this.scene.traverse((o: any) => { if (o.isHemisphereLight) o.intensity = 0.08; });
    }
    if (mod === 'cramped') this.start = [this.cellCenter([1, 1]).x, size / 2 - 1.2, 0];
    this.chapterId = 'rogue';
    this.addExit('n', 'Exit door');
    this.hazardT = Math.max(1.5, 6 - run.depth * 0.4);
    const cells = [];
    for (let c = 0; c < this.cfg.cols; c++) for (let r = 0; r < this.cfg.rows; r++) cells.push([c, r]);
    // keep the start cell (south middle) free
    const startKey = this.cellKey([Math.floor(this.cfg.cols / 2), this.cfg.rows - 1]);
    this.freeCells = cells.filter(c => this.cellKey(c) !== startKey).sort(() => rnd() - 0.5);
    // deeper rooms keep growing: past room 8 a fifth rune or a fourth plate
    const n = Math.min(2 + Math.floor(run.depth / 2), (kind === 'plates' ? 3 : 4) + (run.depth >= 8 ? 1 : 0));
    if (kind === 'runes' || kind === 'upside' || kind === 'memory' || kind === 'mirror') this.setupRunes(n);
    if (kind === 'levers') this.setupLevers(Math.min(3 + Math.floor(run.depth / 4), 5));
    if (kind === 'treasure') this.setupTreasure();
    if (kind === 'hunt') this.setupHunt(Math.min(3 + run.depth, this.freeCells.length - 1, FLOOR().length));
    if (kind === 'plates') this.setupPlates(n);
    const modText = { dark: ' It is very dark in here.', cramped: ' It is very cramped.', stormy: ' The ceiling is in a terrible mood.' }[mod] || '';
    this.intro = { runes: 'Floor runes: conjure what each rune shows, onto it.', upside: 'Upside runes: gravity is reversed. Match the ceiling.', memory: 'Memory runes: look closely. They fade in a few seconds.', mirror: 'Mirror runes: each rune wants its furniture on the opposite side of the room.', levers: 'Levers: watch the lights, then pull the levers in the same order.', treasure: 'A treasure room! Open the chest, then move on.', hunt: 'Key hunt: the key hides in one piece of furniture. Search next to them (G). Wrong guesses anger the ceiling.', plates: 'Pressure plates: drop something heavy enough onto every plate.' }[kind] + modText;
  }

  // ---------------------------------------------------------- puzzles
  setupRunes(n) {
    const up = this.kind === 'upside';
    const types = FLOOR().sort(() => this.rnd() - 0.5);
    // mirror runes: the furniture belongs in the cell mirrored left-right
    const cols = this.cfg.cols, mid = cols % 2 ? (cols - 1) / 2 : -1;
    const startKey = this.cellKey([Math.floor(cols / 2), this.cfg.rows - 1]);
    let cells = this.freeCells.slice(0, n).map(c => [c, c]);
    if (this.kind === 'mirror') {
      const used = new Set(); cells = [];
      for (const c of this.freeCells) {
        if (cells.length >= n) break;
        const t = [cols - 1 - c[0], c[1]], ck = this.cellKey(c), tk = this.cellKey(t);
        if (c[0] === mid || tk === startKey || used.has(ck) || used.has(tk)) continue;
        used.add(ck); used.add(tk); cells.push([c, t]);
      }
    }
    this.runes = cells.map(([cell, target], i) => {
      const type = types[i % types.length];
      const p = this.cellCenter(cell);
      const panel = runePanel(type, Math.min(1.4, this.cellSize().cw * 0.6), undefined, this.kind === 'mirror' ? '⇄ MIRRORED' : undefined);
      panel.rotation.x = up ? Math.PI / 2 : -Math.PI / 2;
      panel.position.set(p.x, up ? this.cfg.h - 0.03 : 0.02, p.z);
      this.root.add(panel);
      if (this.kind === 'memory') {
        // a blank seal underneath; the picture fades away and you go from memory
        const blank = runePanel(null, Math.min(1.4, this.cellSize().cw * 0.6), '?');
        blank.rotation.x = -Math.PI / 2; blank.position.set(p.x, 0.012, p.z); this.root.add(blank);
        panel.position.y = 0.03; panel.material.depthWrite = false;
      }
      return { cell, target, type, done: false, panel };
    });
    this.memT = 3 + n * 1.2;
  }
  setupLevers(n) {
    const colors = [0xff5a5a, 0x5aa8ff, 0x7dff8a, 0xffd25a, 0xd08aff];
    // on the west wall, to your left as you come in
    const d = this.cfg.d, wx = -this.cfg.w / 2 + 0.12;
    const gap = Math.min(1.6, (d - 1.6) / Math.max(1, n - 1));
    const metal = new THREE.MeshStandardMaterial({ color: 0x55505a, metalness: 0.8, roughness: 0.4 });
    this.levers = Array.from({ length: n }, (_, i) => {
      const z = (i - (n - 1) / 2) * gap;
      const g = new THREE.Group(); g.position.set(wx, 0, z); g.rotation.y = -Math.PI / 2; this.root.add(g);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.08), metal); plate.position.set(0, 1.1, 0); g.add(plate);
      const arm = new THREE.Group(); arm.position.set(0, 1.1, -0.06); g.add(arm);
      const stick = cyl(0.03, 0.03, 0.45, metal, 0, 0.22, 0, arm, 8);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.4 })); knob.position.y = 0.46; arm.add(knob);
      arm.rotation.x = 0.5;
      const bulbMat = new THREE.MeshStandardMaterial({ color: colors[i], emissive: colors[i], emissiveIntensity: 0.05 });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), bulbMat); bulb.position.set(0, 2.1, -0.05); g.add(bulb);
      const lever = { i, arm, bulbMat };
      const use = { label: 'Pull the lever', fn: () => this.pullLever(lever) };
      for (const m of [plate, stick, knob, bulb]) { m.userData.use = use; this.usables.push(m); }
      return lever;
    });
    const order = this.levers.map(l => l.i).sort(() => this.rnd() - 0.5);
    this.seq = order; this.progress = 0;
    this.showSeq(1.2);
  }
  showSeq(delay = 0.4) { this.seqT = -delay; this.seqOn = true; }
  pullLever(l) {
    if (!this.exit.locked || this.seqOn) return;
    sfx.click(); l.arm.rotation.x = -0.5;
    setTimeout(() => { if (this.exit.locked) l.arm.rotation.x = 0.5; }, 350);
    if (this.seq[this.progress] === l.i) {
      this.progress++; l.bulbMat.emissiveIntensity = 1.6;
      if (this.progress === this.seq.length) { ui.log('Click, click, CLUNK. The exit unlocks.', 'good'); this.unlockExit(); }
      this.refreshHUD();
      return;
    }
    ui.log('Wrong lever! The ceiling disapproves.', 'warn');
    this.progress = 0;
    for (const x of this.levers) x.bulbMat.emissiveIntensity = 0.05;
    this.dropHazard(new THREE.Vector3(this.player.pos.x, 0, this.player.pos.z));
    this.refreshHUD();
  }
  setupTreasure() {
    const gold = new THREE.MeshStandardMaterial({ color: 0xd8a830, metalness: 0.9, roughness: 0.3, emissive: 0x302000 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x6a3a1a, roughness: 0.8 });
    const g = new THREE.Group(); const p = this.cellCenter(this.cfg.cols > 2 ? [Math.floor(this.cfg.cols / 2), Math.floor(this.cfg.rows / 2) - 1] : [0, 0]); g.position.set(p.x, 0, p.z); this.root.add(g);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.7), wood); body.position.y = 0.3; g.add(body);
    const lid = new THREE.Group(); lid.position.set(0, 0.6, -0.35); g.add(lid);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.1, 16, 1, false, 0, Math.PI), wood); top.rotation.z = Math.PI / 2; top.position.z = 0.35; lid.add(top);
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.08, 0.74), gold); band.position.y = 0.58; g.add(band);
    const glow = new THREE.PointLight(0xffc860, 3, 5, 2); glow.position.set(0, 1.6, 0.6); g.add(glow);
    this.chest = { g, lid, opened: false };
    const use = { label: 'Open the chest', fn: () => this.openChest() };
    for (const m of [body, top, band]) { m.userData.use = use; this.usables.push(m); }
    this.unlockExit();
  }
  openChest() {
    const c = this.chest;
    if (c.opened) { ui.log('Empty. You check twice anyway.'); return; }
    c.opened = true; c.lid.rotation.x = -1.9; sfx.win();
    this.fx.burst(c.g.position.clone().setY(0.9), { count: 30, color: '#ffd25a', size: 0.4, speed: 3 });
    const r = this.run, s = this.state;
    const pool = UPGRADES.filter(u => !(u.id === 'nose' && r.nose) && !(u.id === 'umbrella' && r.umbrella) && !(u.id === 'heal' && s.hearts >= s.maxHearts));
    const u = pool[Math.floor(this.rnd() * pool.length)];
    r.hearts = s.hearts; u.apply(r); r.upgrades.push(u.id);
    Object.assign(s, { hearts: r.hearts, maxHearts: r.maxHearts, maxMana: r.maxMana, regen: r.regen, costMul: r.costMul });
    ui.setHearts(s.hearts, s.maxHearts);
    ui.log(`Inside: ${u.icon} ${u.name}! ${u.desc}`, 'good');
    this.refreshHUD();
  }

  catInterest() {
    if (this.kind !== 'hunt' || !this.exit.locked || !this.keyIn) return null;
    return { key: 'key', pos: this.keyIn.group.position, msg: `The cat sniffs the ${CATALOG[this.keyIn.type].name.toLowerCase()} and sits down next to it, looking smug.` };
  }
  peek() {
    if (!this.exit.locked) return;
    if (!this.engine.spend(25)) return;
    this.memT = Math.max(this.memT, 1.8);
    sfx.whoosh();
    ui.log('You squint. The runes flicker back for a moment.', 'lore');
  }
  setupHunt(n) {
    const types = FLOOR().sort(() => this.rnd() - 0.5);
    this.hidden = [];
    for (let i = 0; i < n; i++) {
      const o = this.conjureInstant(types[i % types.length], this.freeCells[i]);
      if (o) this.hidden.push(o);
    }
    this.keyIn = this.hidden[Math.floor(this.rnd() * this.hidden.length)];
    this.searched = new Set();
  }
  setupPlates(n) {
    // each plate needs its own piece of furniture: the k-th heaviest plate can ask
    // at most the k-th heaviest weight among distinct furniture types (5, 4, 4, ...)
    const caps = Object.keys(WEIGHT).filter(t => t !== 'pc').map(t => WEIGHT[t]).sort((a, b) => b - a);
    const needs = Array.from({ length: n }, () => 2 + Math.floor(this.rnd() * (2 + Math.min(3, this.run.depth)))).sort((a, b) => b - a).map((v, i) => Math.min(v, caps[i]));
    this.plates = this.freeCells.slice(0, n).map((cell, i) => {
      const need = needs[i];
      const p = this.cellCenter(cell);
      const plate = cyl(0.9, 0.95, 0.06, new THREE.MeshStandardMaterial({ color: 0x777788, metalness: 0.7, roughness: 0.4 }), p.x, 0.03, p.z, this.root, 24);
      const label = runePanel(null, 1.1, `≥ ${need}`); label.rotation.x = -Math.PI / 2; label.position.set(p.x, 0.07, p.z); this.root.add(label);
      return { cell, need, plate, done: false };
    });
  }

  conjureInstant(type, cell) {
    const g = buildObject(type);
    const c = this.cellCenter(cell);
    g.position.copy(c); this.root.add(g);
    const fp = CATALOG[type].fp;
    const obj = { type, cell, group: g, rect: { minX: c.x - fp[0], maxX: c.x + fp[0], minZ: c.z - fp[1], maxZ: c.z + fp[1] }, fixed: true };
    this.objects.set(type, obj);
    return obj;
  }

  // ---------------------------------------------------------- rules
  placementError(type, cell) {
    if (this.kind === 'hunt') return 'No conjuring needed here — find the key (search with G).';
    return super.placementError(type, cell);
  }
  onLanded() { this.check(); }
  check() {
    let done = false;
    if (this.runes) {
      for (const r of this.runes) { const o = this.objects.get(r.type); r.done = !!o && this.cellKey(o.cell) === this.cellKey(r.target || r.cell); }
      done = this.runes.every(r => r.done);
    }
    if (this.plates) {
      for (const p of this.plates) {
        const o = [...this.objects.values()].find(x => this.cellKey(x.cell) === this.cellKey(p.cell));
        p.done = !!o && (WEIGHT[o.type] || 1) >= p.need;
        p.plate.material.color.set(p.done ? 0x7dffb2 : 0x777788);
      }
      done = this.plates.every(p => p.done);
    }
    if (done) this.unlockExit();
    this.refreshHUD();
  }

  onAction(a) {
    if (a === 'search' && this.kind === 'hunt') this.huntSearch();
    if (a === 'search' && this.kind === 'memory') this.peek();
    if (a === 'search' && this.kind === 'levers' && this.exit.locked && !this.seqOn && this.engine.spend(15)) { this.progress = 0; for (const x of this.levers) x.bulbMat.emissiveIntensity = 0.05; this.showSeq(); this.refreshHUD(); }
  }
  huntSearch() {
    if (!this.exit.locked) return;
    const p = this.player.pos;
    let best = null, bd = 1e9;
    for (const o of this.hidden) {
      const r = o.rect;
      const d = Math.hypot(Math.max(r.minX - p.x, 0, p.x - r.maxX), Math.max(r.minZ - p.z, 0, p.z - r.maxZ));
      if (d < bd) { bd = d; best = o; }
    }
    if (!best || bd > 1.3) { ui.log('Search next to a piece of furniture.'); return; }
    if (this.searched.has(best)) { ui.log('You already searched that one.'); return; }
    this.searched.add(best);
    if (best === this.keyIn) { ui.log(`The key was in the ${CATALOG[best.type].name.toLowerCase()}!`, 'good'); this.unlockExit(); return; }
    ui.log(`Nothing in the ${CATALOG[best.type].name.toLowerCase()}. The ceiling rumbles...`, 'warn');
    this.dropHazard(new THREE.Vector3(p.x, 0, p.z));
    if (this.run.nose) {
      const k = this.keyIn.group.position;
      const near = Math.hypot(k.x - p.x, k.z - p.z) < this.cfg.w / 2.5;
      ui.log(near ? '👃 Warm. The key is close.' : '👃 Cold. Try the other side.', 'lore');
    }
  }

  // ---------------------------------------------------------- hazards
  dropHazard(at) {
    const target = at || new THREE.Vector3((this.rnd() - 0.5) * (this.cfg.w - 2), 0, (this.rnd() - 0.5) * (this.cfg.d - 2));
    const pk = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0x401000 }));
    pk.scale.y = 0.8; pk.position.set(target.x, this.cfg.h - 0.3, target.z); this.root.add(pk);
    const mark = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.1, 32), new THREE.MeshBasicMaterial({ color: COL.danger, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    mark.rotation.x = -Math.PI / 2; mark.position.set(target.x, 0.04, target.z); this.root.add(mark);
    this.hazards = this.hazards || [];
    this.hazards.push({ pk, mark, target, t: 0 });
    sfx.warn();
  }

  updateChamber(dt) {
    if (this.phase !== 'play') return;
    if (this.seqOn) {
      // play the light sequence: each bulb flashes in order
      this.seqT += dt;
      const k = Math.floor(this.seqT / 0.8), lit = this.seqT >= 0 && this.seqT % 0.8 < 0.55 ? this.seq[k] : -1;
      for (const l of this.levers) l.bulbMat.emissiveIntensity = l.i === lit ? 2 : (l.i === this.seq[k] && this.seqT >= 0 ? 0.3 : 0.05);
      if (lit !== -1 && this.lastLit !== lit + ':' + k) { this.lastLit = lit + ':' + k; sfx.tick(); }
      if (k >= this.seq.length) { this.seqOn = false; for (const l of this.levers) l.bulbMat.emissiveIntensity = 0.05; }
    }
    if (this.kind === 'memory') {
      this.memT -= dt;
      const a = Math.max(0, Math.min(1, this.memT));
      for (const r of this.runes) { const o = r.done ? 1 : a; r.panel.material.opacity = o; r.panel.visible = o > 0.01; }
    }
    // more pumpkins the deeper you go
    if (this.run.depth >= 2 && this.exit.locked) {
      this.hazardT -= dt;
      if (this.hazardT <= 0) { this.dropHazard(this.rnd() < 0.6 ? new THREE.Vector3(this.player.pos.x, 0, this.player.pos.z) : null); this.hazardT = Math.max(2.5, 8 - this.run.depth * 0.5) * (this.mod === 'stormy' ? 0.5 : 1); }
    }
    for (let i = (this.hazards || []).length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.t += dt;
      if (h.t < 1.1) { h.mark.scale.setScalar(1 - h.t * 0.3); continue; }
      h.pk.position.y -= dt * 18;
      if (h.pk.position.y <= 0.4) {
        sfx.thud(1); this.fx.dust(h.target, 0.8);
        this.root.remove(h.pk); this.root.remove(h.mark); this.hazards.splice(i, 1);
        const pl = this.player.pos;
        if (Math.hypot(pl.x - h.target.x, pl.z - h.target.z) < 1.2 && !(this.run.umbrella && Math.random() < 0.5)) this.engine.damage(1, 'pumpkin to the head');
      }
    }
  }

  useExit() {
    if (this.exit.locked) { sfx.locked(); ui.log('Locked. Solve the room first.', 'warn'); return; }
    if (this.exit.opened) return;
    this.exit.opened = true; sfx.open();
    this.exit.door.userData.pivot.rotation.y = -1.5;
    this.phase = 'done';
    setTimeout(() => { if (this.engine.level === this) this.engine.runRoomCleared(); }, 600);
  }

  objective() {
    const k = this.kind;
    if (k === 'treasure' && !this.chest.opened) return 'Open the treasure chest! (Or don\'t. It\'s your run.)';
    if (!this.exit.locked) return 'Through the exit door!';
    if (k === 'runes' || k === 'upside') return `${k === 'upside' ? 'Ceiling' : 'Floor'} runes: conjure what each rune shows onto it (${this.runes.filter(r => r.done).length}/${this.runes.length}).`;
    if (k === 'mirror') return `Mirror runes: put each rune's furniture in the cell opposite it, left to right (${this.runes.filter(r => r.done).length}/${this.runes.length}).`;
    if (k === 'levers') return `Pull the levers in the order the lights flashed (${this.progress}/${this.seq.length}). Replay (${this.engine.touch ? 'Replay button' : 'G'}) costs 15 mana.`;
    if (k === 'memory') return `Memory runes: conjure what each rune showed onto it (${this.runes.filter(r => r.done).length}/${this.runes.length}). Peek (${this.engine.touch ? 'Peek button' : 'G'}) costs 25 mana.`;
    if (k === 'hunt') return `Find the key: search next to furniture (G). ${this.searched.size} searched.`;
    return `Weigh down every plate: ${this.plates.filter(p => p.done).length}/${this.plates.length}. Heavier furniture counts more.`;
  }
  inventory() {
    const r = this.run;
    const modIcon = { dark: '🌑 <b>Dark</b>', cramped: '📦 <b>Cramped</b>', stormy: '⛈️ <b>Stormy</b>' }[this.mod];
    return [`🏚️ Room <b>${r.depth + 1}</b>`, ...(modIcon ? [modIcon] : []), ...r.upgrades.map(id => UPGRADES.find(u => u.id === id).icon)];
  }
}

function runePanel(type, size, text?, sub?) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(20,10,40,0.85)'; g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#b58cff'; g.lineWidth = 6; g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (type) { g.font = '54px serif'; g.fillText(CATALOG[type].icon, 64, 54); g.fillStyle = '#e8d8ff'; g.font = 'bold 14px sans-serif'; g.fillText(sub || CATALOG[type].name.toUpperCase(), 64, 100); }
  else { g.fillStyle = '#e8d8ff'; g.font = 'bold 40px sans-serif'; g.fillText(text, 64, 66); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide }));
}
