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
    const kind = run.depth === 0 ? 'runes' : KINDS[Math.floor(rnd() * KINDS.length)];
    const big = run.depth >= 4 && rnd() < 0.5;
    super(engine, state, {
      gravity: kind === 'upside' ? 1 : -1,
      w: big ? 12 : 9, d: big ? 12 : 9, cols: big ? 4 : 3, rows: big ? 4 : 3,
      fog: 0x06050a,
      wallMat: new THREE.MeshStandardMaterial({ color: PALETTES[Math.floor(rnd() * PALETTES.length)], roughness: 0.9 }),
    });
    this.rnd = rnd; this.run = run; this.kind = kind;
    this.chapterId = 'rogue';
    this.addExit('n', 'Exit door');
    this.hazardT = 6;
    const cells = [];
    for (let c = 0; c < this.cfg.cols; c++) for (let r = 0; r < this.cfg.rows; r++) cells.push([c, r]);
    // keep the start cell (south middle) free
    const startKey = this.cellKey([Math.floor(this.cfg.cols / 2), this.cfg.rows - 1]);
    this.freeCells = cells.filter(c => this.cellKey(c) !== startKey).sort(() => rnd() - 0.5);
    const n = Math.min(2 + Math.floor(run.depth / 2), kind === 'plates' ? 3 : 4);
    if (kind === 'runes' || kind === 'upside') this.setupRunes(n);
    if (kind === 'hunt') this.setupHunt(Math.min(3 + run.depth, this.freeCells.length - 1));
    if (kind === 'plates') this.setupPlates(n);
    this.intro = { runes: 'Floor runes: conjure what each rune shows, onto it.', upside: 'Upside runes: gravity is reversed. Match the ceiling.', hunt: 'Key hunt: the key hides in one piece of furniture. Search next to them (G). Wrong guesses anger the ceiling.', plates: 'Pressure plates: drop something heavy enough onto every plate.' }[kind];
  }

  // ---------------------------------------------------------- puzzles
  setupRunes(n) {
    const up = this.kind === 'upside';
    const types = FLOOR().sort(() => this.rnd() - 0.5);
    this.runes = this.freeCells.slice(0, n).map((cell, i) => {
      const type = types[i % types.length];
      const p = this.cellCenter(cell);
      const panel = runePanel(type, Math.min(1.4, this.cellSize().cw * 0.6));
      panel.rotation.x = up ? Math.PI / 2 : -Math.PI / 2;
      panel.position.set(p.x, up ? this.cfg.h - 0.03 : 0.02, p.z);
      this.root.add(panel);
      return { cell, type, done: false, panel };
    });
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
    this.plates = this.freeCells.slice(0, n).map(cell => {
      // never more than the heaviest furniture (a bed weighs 5)
      const need = Math.min(5, 2 + Math.floor(this.rnd() * (2 + Math.min(3, this.run.depth))));
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
      for (const r of this.runes) { const o = this.objects.get(r.type); r.done = !!o && this.cellKey(o.cell) === this.cellKey(r.cell); }
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
    if (this.searched.has(best.type)) { ui.log('You already searched that one.'); return; }
    this.searched.add(best.type);
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
    // more pumpkins the deeper you go
    if (this.run.depth >= 2 && this.exit.locked) {
      this.hazardT -= dt;
      if (this.hazardT <= 0) { this.dropHazard(this.rnd() < 0.6 ? new THREE.Vector3(this.player.pos.x, 0, this.player.pos.z) : null); this.hazardT = Math.max(2.5, 8 - this.run.depth * 0.5); }
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
    setTimeout(() => this.engine.runRoomCleared(), 600);
  }

  objective() {
    const k = this.kind;
    if (!this.exit.locked) return 'Through the exit door!';
    if (k === 'runes' || k === 'upside') return `${k === 'upside' ? 'Ceiling' : 'Floor'} runes: conjure what each rune shows onto it (${this.runes.filter(r => r.done).length}/${this.runes.length}).`;
    if (k === 'hunt') return `Find the key: search next to furniture (G). ${this.searched.size} searched.`;
    return `Weigh down every plate: ${this.plates.filter(p => p.done).length}/${this.plates.length}. Heavier furniture counts more.`;
  }
  inventory() {
    const r = this.run;
    return [`🏚️ Room <b>${r.depth + 1}</b>`, ...r.upgrades.map(id => UPGRADES.find(u => u.id === id).icon)];
  }
}

function runePanel(type, size, text?) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(20,10,40,0.85)'; g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#b58cff'; g.lineWidth = 6; g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (type) { g.font = '54px serif'; g.fillText(CATALOG[type].icon, 64, 54); g.fillStyle = '#e8d8ff'; g.font = 'bold 14px sans-serif'; g.fillText(CATALOG[type].name.toUpperCase(), 64, 100); }
  else { g.fillStyle = '#e8d8ff'; g.font = 'bold 40px sans-serif'; g.fillText(text, 64, 66); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide }));
}
