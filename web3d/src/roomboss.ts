import * as THREE from 'three';
import { COL } from './a11y';
import { buildObject, CATALOG } from './models';
import { FX, disposeTree } from './fx';
import { BossLevel } from './bosslevel';
import { Room, HALF, WALL_H } from './room';
import { manaCost, knows, castShrink, castBlink, SPELLS } from './spells';
import { RADIUS } from './player';
import { glowSprite } from './textures';
import * as ui from './ui';
import { sfx, playAmbience } from './audio';
import { unlock } from './save';

// Act 5: the room you started in wakes up. Its ceiling stomps, its
// furniture rebels, its walls close in, and its eyes open in the floor.
const CELLS = [-3, 0, 3];
const G = 30;
const TAUNTS = ['"OW. That was my good eye."', '"You don\'t even pay rent!"', '"I GAVE you a lamp!"', '"Do you know how long it takes to grow an eye?"', '"Tenants these days."'];

export class RoomBossLevel extends BossLevel {
  constructor(engine, state) {
    super();
    this.engine = engine;
    this.player = engine.player;
    this.camera = engine.camera;
    this.state = state;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050307);
    this.scene.fog = new THREE.Fog(0x050307, 7, 18);
    this.fx = new FX(this.scene);
    this.time = 0;
    this.raycaster = new THREE.Raycaster();
    this.drops = []; this.stomps = []; this.hoppers = []; this.eyes = [];
    this.hard = state.mode === 'hard' || state.mode === 'ngplus';
    this.maxHp = this.hard ? 8 : 6;
    this.hp = this.maxHp;
    this.phase = 'intro';
    this.cooldown = 0;
    this.spell = 'furniture';
    this.shield = state.flags.cloak ? 1 : 0;
    this.hitsTaken = 0;
    this.inset = 0; this.insetTarget = 0;
    this.attackT = 2.5; this.eyeT = 2; this.hopT = 5;
    this.build();
    this.player.walkable = (x, z) => this.walkable(x, z);
    this.player.canMove = () => true;
    this.player.onBlocked = null;
    this.player.onGrow = null;
  }

  // the room hurls everything it ever let you conjure
  ammoTypes() { return Object.keys(CATALOG).filter(t => CATALOG[t].kind === 'floor' && t !== 'pc'); }

  walkable(x, z) { const lim = HALF - this.inset - RADIUS - 0.1; return Math.abs(x) < lim && Math.abs(z) < lim; }

  build() {
    this.room = new Room(this.scene);
    this.room.setCandles(true);
    this.hemi = new THREE.HemisphereLight(0x9a7080, 0x200810, 0.7); this.scene.add(this.hemi);
    this.red = new THREE.PointLight(0xff3a30, 5, 14, 1.6); this.red.position.set(0, 2.9, 0); this.scene.add(this.red);
    this.lamp = new THREE.PointLight(0xffb469, 5, 9, 1.6); this.lamp.position.set(0.2, -0.2, -0.3);
    // the walls that close in during phase 2
    this.pressers = [0, 1, 2, 3].map(i => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, WALL_H, 0.5), this.room.wallMat);
      m.rotation.y = i * Math.PI / 2; m.visible = false; this.scene.add(m);
      return m;
    });
    this.blockMat = new THREE.MeshStandardMaterial({ color: 0xd8cbb0, roughness: 1 });
    this.aimRing = this.marker(new THREE.Vector3(), 1.1, COL.mine, 0.9);
  }

  activate() {
    this.scene.add(this.camera);
    this.camera.add(this.lamp);
    this.player.place(0, 3, 0);
    this.player.speed = 4.2;
    playAmbience('landlord');
    ui.setVignette('');
    this.refreshHUD();
    ui.log('The floor has eyes now. Drop furniture on an OPEN eye. Dodge the ceiling.', 'lore');
  }
  deactivate() { this.camera.remove(this.lamp); this.scene.remove(this.camera); ui.setBoss(null); disposeTree(this.scene); }

  // --------------------------------------------------------------- input
  handleAction(a) {
    switch (a) {
      case 'cast': case 'use': case 'enter': this.cast(); break;
      case 'book': case 'rotate': { const l = this.spellList(); this.setSpell(l[(l.indexOf(this.spell) + 1) % l.length]); break; }
      case 'n1': this.setSpell('furniture'); break;
      case 'n3': if (knows(this.state, 'blink')) this.setSpell('blink'); break;
      case 'n4': case 'search': if (knows(this.state, 'shrink')) castShrink(this.engine); break;
    }
  }
  spellList() { return ['furniture', ...(knows(this.state, 'blink') ? ['blink'] : [])]; }
  setSpell(s) {
    if (this.spell === s) return;
    this.spell = s; sfx.click();
    ui.log(s === 'blink' ? 'Spell: Blink — teleport where you aim.' : 'Spell: falling furniture.');
    this.refreshHUD();
  }

  aimPoint() {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const ray = this.raycaster.ray;
    if (ray.direction.y > -0.02) return null;
    const t = -ray.origin.y / ray.direction.y;
    const p = ray.origin.clone().addScaledVector(ray.direction, t);
    const lim = HALF - this.inset - 0.3;
    return Math.abs(p.x) < lim && Math.abs(p.z) < lim ? p : null;
  }

  cast() {
    if (this.phase !== 'fight') return;
    const p = this.aimPoint();
    if (!p) { ui.log('Aim at the floor.', 'warn'); return; }
    if (this.spell === 'blink') { castBlink(this.engine, this.fx, p); return; }
    if (this.cooldown > 0) { sfx.locked(); return; }
    if (!this.engine.spend(manaCost('furniture'))) return;
    this.cooldown = this.state.flags.wand ? 0.45 : 0.9;
    sfx.conjure();
    const types = this.ammoTypes();
    const type = types[Math.floor(Math.random() * types.length)];
    const obj = buildObject(type); obj.scale.setScalar(0.8); obj.rotation.y = Math.random() * 6;
    obj.position.set(p.x, WALL_H - 0.3, p.z); this.scene.add(obj);
    this.drops.push({ obj, target: p.clone(), vy: 0, type, marker: this.marker(p, 1.0, COL.mine) });
    this.engine.stats.conjured++;
  }

  // --------------------------------------------------------------- the room's attacks
  stage() { const f = this.hp / this.maxHp; return f > 0.67 ? 1 : f > 0.34 ? 2 : 3; }
  speed() { return this.hard ? 0.8 : 1; }
  cellOf(x, z) { return [CELLS.reduce((a, b) => Math.abs(b - x) < Math.abs(a - x) ? b : a), CELLS.reduce((a, b) => Math.abs(b - z) < Math.abs(a - z) ? b : a)]; }

  stomp(x, z) {
    if (this.stomps.some(s => s.x === x && s.z === z)) return;
    const warn = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), new THREE.MeshBasicMaterial({ color: COL.danger, transparent: true, opacity: 0.15, depthWrite: false }));
    warn.rotation.x = -Math.PI / 2; warn.position.set(x, 0.03, z); this.scene.add(warn);
    const block = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.5, 2.8), this.blockMat);
    block.position.set(x, WALL_H + 0.3, z); block.castShadow = true; this.scene.add(block);
    this.stomps.push({ x, z, warn, block, t: 0, windup: 1.05 * this.speed(), hit: false });
    sfx.creak();
  }

  updateStomps(dt) {
    for (let i = this.stomps.length - 1; i >= 0; i--) {
      const s = this.stomps[i];
      s.t += dt;
      if (s.t < s.windup) { s.warn.material.opacity = 0.1 + 0.18 * Math.abs(Math.sin(s.t * 10)); s.block.position.y = WALL_H + 0.3 - s.t / s.windup * 0.35; continue; }
      const k = s.t - s.windup;
      if (k < 0.12) { s.block.position.y = Math.max(0.25, WALL_H - (k / 0.12) * WALL_H); continue; }
      if (!s.hit) {
        s.hit = true; s.block.position.y = 0.25;
        sfx.slam(); this.fx.dust(new THREE.Vector3(s.x, 0, s.z), 1.4);
        const p = this.player.pos;
        const dx = Math.abs(p.x - s.x), dz = Math.abs(p.z - s.z);
        this.player.addShake(Math.max(0.2, 0.9 - Math.hypot(dx, dz) / 8));
        if (dx < 1.55 && dz < 1.55 && this.player.shrunk <= 0) this.hurt(1, 'stomped flat by the ceiling');
        // a stomp squashes any rebel furniture under it
        for (const h of [...this.hoppers]) if (Math.abs(h.obj.position.x - s.x) < 1.5 && Math.abs(h.obj.position.z - s.z) < 1.5) this.popHopper(h, false);
        this.scene.remove(s.warn);
      }
      if (k > 0.7) s.block.position.y = 0.25 + (k - 0.7) * 8;
      if (k > 1.2) { this.scene.remove(s.block); this.stomps.splice(i, 1); }
    }
  }

  spawnHopper() {
    const types = Object.keys(CATALOG).filter(t => CATALOG[t].kind === 'floor' && t !== 'pc' && t !== 'closet');
    const type = types[Math.floor(Math.random() * types.length)];
    const obj = buildObject(type); obj.scale.setScalar(0.55);
    const lim = HALF - this.inset - 0.8, a = Math.random() * Math.PI * 2;
    obj.position.set(Math.cos(a) * lim, 0, Math.sin(a) * lim); this.scene.add(obj);
    this.hoppers.push({ obj, type, hops: 0, t: 0, from: obj.position.clone(), to: obj.position.clone(), marker: null });
    ui.log(`The ${CATALOG[type].name.toLowerCase()} you conjured on day one turns on you!`, 'warn');
  }

  updateHoppers(dt) {
    for (const h of [...this.hoppers]) {
      h.t += dt;
      if (h.t < 0.45) { h.obj.position.y = 0; h.obj.scale.y = 0.55 * (1 - Math.sin(h.t / 0.45 * Math.PI) * 0.25); continue; }
      if (!h.marker) {
        // pick the next landing spot toward the player
        const p = this.player.pos, o = h.obj.position;
        const d = Math.hypot(p.x - o.x, p.z - o.z), step = Math.min(2.4, d);
        h.from = o.clone(); h.to = new THREE.Vector3(o.x + (p.x - o.x) / (d || 1) * step, 0, o.z + (p.z - o.z) / (d || 1) * step);
        h.marker = this.marker(h.to, 0.9, COL.danger);
      }
      const k = Math.min(1, (h.t - 0.45) / (0.6 * this.speed()));
      h.obj.position.lerpVectors(h.from, h.to, k); h.obj.position.y = Math.sin(k * Math.PI) * 1.6;
      h.obj.rotation.y += dt * 4;
      if (k >= 1) {
        this.scene.remove(h.marker); h.marker = null; h.t = 0; h.hops++;
        sfx.thud(0.7); this.fx.dust(h.to, 0.6);
        if (Math.hypot(this.player.pos.x - h.to.x, this.player.pos.z - h.to.z) < (this.player.shrunk > 0 ? 0.6 : 1.1)) this.hurt(1, `body-slammed by a ${CATALOG[h.type].name.toLowerCase()}`);
        if (h.hops >= 4) this.popHopper(h, false);
      }
    }
  }

  popHopper(h, byMe) {
    if (h.marker) this.scene.remove(h.marker);
    this.fx.burst(h.obj.position.clone().setY(0.6), { count: 18, color: '#d0a070', size: 0.4, speed: 3 });
    this.scene.remove(h.obj); this.hoppers.splice(this.hoppers.indexOf(h), 1);
    if (byMe) ui.log(`You flatten the rebellious ${CATALOG[h.type].name.toLowerCase()}.`, 'good');
  }

  makeEye(real) {
    const g = new THREE.Group();
    const flesh = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.18, 10, 24), new THREE.MeshStandardMaterial({ color: 0x6a1a24, roughness: 0.7 }));
    flesh.rotation.x = -Math.PI / 2; flesh.position.y = 0.08; g.add(flesh);
    const lid = new THREE.Group(); g.add(lid);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.62, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf2ecdc, roughness: 0.25, emissive: 0x2a2018 }));
    lid.add(ball);
    const iris = new THREE.Group(); iris.position.y = 0.6; lid.add(iris);
    const irisM = new THREE.Mesh(new THREE.CircleGeometry(0.26, 22), new THREE.MeshBasicMaterial({ color: 0xffa020 }));
    irisM.rotation.x = -Math.PI / 2; iris.add(irisM);
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), new THREE.MeshBasicMaterial({ color: 0x050505 }));
    pupil.rotation.x = -Math.PI / 2; pupil.position.y = 0.005; iris.add(pupil);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite('#ffb040'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.3 }));
    glow.scale.setScalar(1.3); glow.position.y = 0.6; g.add(glow);
    lid.scale.y = 0.01;
    g.userData = { lid, iris, pupil, real };
    return g;
  }

  openEyes() {
    const st = this.stage();
    const count = st === 1 ? 1 : st === 2 ? 2 : 3;
    const pc = this.cellOf(this.player.pos.x, this.player.pos.z);
    const lim = HALF - this.inset - 0.9;
    const cells = [];
    for (const x of CELLS) for (const z of CELLS) if (Math.abs(x) <= lim + 0.01 && Math.abs(z) <= lim + 0.01 && !(x === pc[0] && z === pc[1])) cells.push([x, z]);
    cells.sort(() => Math.random() - 0.5);
    const dur = (st === 1 ? 4.2 : st === 2 ? 3.6 : 3.2) * this.speed();
    for (let i = 0; i < Math.min(count, cells.length); i++) {
      const g = this.makeEye(i === 0);
      g.position.set(cells[i][0], 0, cells[i][1]); this.scene.add(g);
      this.eyes.push({ g, real: i === 0, t: 0, dur });
      this.fx.burst(g.position.clone().setY(0.3), { count: 10, color: '#a02030', size: 0.35, speed: 1.5 });
    }
    if (count > 1 && !this.toldFakes) { this.toldFakes = true; ui.log('The witch\'s portrait hisses: "Only the real eye follows you. The fakes just stare."', 'lore'); }
    sfx.whisper();
  }

  closeEyes() {
    for (const e of this.eyes) this.scene.remove(e.g);
    this.eyes = [];
    this.eyeT = 2.4 * this.speed();
  }

  updateEyes(dt) {
    if (!this.eyes.length) {
      this.eyeT -= dt;
      if (this.eyeT <= 0) this.openEyes();
      return;
    }
    let left = false;
    for (const e of this.eyes) {
      e.t += dt;
      const u = e.g.userData;
      const open = e.t < 0.3 ? e.t / 0.3 : e.t > e.dur - 0.3 ? Math.max(0, (e.dur - e.t) / 0.3) : 1;
      // the real eye blinks now and then and its pupil follows you
      const blink = u.real && (e.t % 1.3) > 1.15 ? 0.15 : 1;
      u.lid.scale.y = Math.max(0.01, open * blink);
      if (u.real) {
        const p = this.player.pos, o = e.g.position;
        const d = Math.hypot(p.x - o.x, p.z - o.z) || 1;
        u.iris.position.x = (p.x - o.x) / d * 0.14; u.iris.position.z = (p.z - o.z) / d * 0.14;
      }
      if (e.t < e.dur) left = true;
    }
    if (!left) this.closeEyes();
  }

  updateDrops(dt) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      if (d.landedT !== undefined) {
        d.landedT += dt;
        if (d.landedT > 1.2) { this.scene.remove(d.obj); this.fx.burst(d.obj.position.clone().setY(0.5), { count: 8, color: '#b58cff', size: 0.35 }); this.drops.splice(i, 1); }
        continue;
      }
      d.vy -= G * dt;
      d.obj.position.y += d.vy * dt;
      if (d.obj.position.y <= 0) { d.obj.position.y = 0; this.scene.remove(d.marker); d.landedT = 0; this.landed(d); }
    }
  }

  landed(d) {
    sfx.thud(1);
    this.fx.dust(d.target, 0.9);
    const pd = Math.hypot(this.player.pos.x - d.target.x, this.player.pos.z - d.target.z);
    if (pd < (this.player.shrunk > 0 ? 0.5 : 0.8)) this.hurt(1, 'crushed by your own ' + (CATALOG[d.type] ? CATALOG[d.type].name.toLowerCase() : 'furniture'));
    for (const h of [...this.hoppers]) if (Math.hypot(h.obj.position.x - d.target.x, h.obj.position.z - d.target.z) < 1.3) { this.popHopper(h, true); return; }
    for (const e of [...this.eyes]) {
      if (e.g.userData.lid.scale.y < 0.5 || Math.hypot(e.g.position.x - d.target.x, e.g.position.z - d.target.z) > 1.3) continue;
      if (e.real) { this.hitEye(e); return; }
      // a fake: it pops, and the room retaliates
      this.fx.burst(e.g.position.clone().setY(0.5), { count: 20, color: '#ff4040', size: 0.4, speed: 3 });
      this.scene.remove(e.g); this.eyes.splice(this.eyes.indexOf(e), 1);
      ui.log('POP. A fake eye. The ceiling is not amused.', 'warn');
      const c = this.cellOf(this.player.pos.x, this.player.pos.z); this.stomp(c[0], c[1]);
      return;
    }
  }

  hitEye(e) {
    this.hp--;
    sfx.hurt(); sfx.roar();
    ui.flash('#ff6040', 0.45, 500);
    this.player.addShake(0.8);
    this.fx.burst(e.g.position.clone().setY(0.6), { count: 30, color: '#ffd080', speed: 4, size: 0.5 });
    this.closeEyes();
    if (this.hp <= 0) { this.defeat(); return; }
    ui.log(TAUNTS[Math.floor(Math.random() * TAUNTS.length)], 'lore');
    const st = this.stage();
    if (st >= 2 && !this.closing) { this.closing = true; this.insetTarget = 1.25; ui.log('The walls lurch inward with a groan. Mind your elbows.', 'warn'); this.hopT = 1.5; }
    if (st >= 3 && !this.dark) {
      this.dark = true; this.room.setCandles(false);
      ui.log('The candles gutter out. "Lights out, tenant."', 'warn');
    }
    this.refreshHUD();
  }

  defeat() {
    this.phase = 'won';
    for (const s of this.stomps) { this.scene.remove(s.warn); this.scene.remove(s.block); }
    for (const h of [...this.hoppers]) this.popHopper(h, false);
    this.stomps = [];
    unlock('landlord');
    if (this.hitsTaken === 0) unlock('landlordflawless');
    this.engine.split('The Room');
    ui.setBoss(null);
    ui.flash('#fff4d0', 1, 2500);
    this.insetTarget = -0.6;
    ui.log('The room shudders, sighs, and the walls fall open like the pages of a book.', 'good');
    playAmbience('ending');
    setTimeout(() => { if (this.engine.level === this) this.engine.roomBossDone(); }, 3500);
  }

  hurt(n, why) {
    if (this.phase !== 'fight') return;
    if (this.absorbWithCloak()) return;
    this.hitsTaken++;
    this.engine.damage(n, why);
  }

  // --------------------------------------------------------------- frame
  update(dt) {
    this.time += dt;
    this.fx.update(dt);
    this.room.update(dt, this.time, this.camera.getWorldPosition(new THREE.Vector3()));
    this.cooldown = Math.max(0, this.cooldown - dt);
    ui.setCooldown(this.cooldown / (this.state.flags.wand ? 0.45 : 0.9));
    // walls closing in (or falling away at the end)
    this.inset += (this.insetTarget - this.inset) * Math.min(1, dt * 1.5);
    const d = HALF - this.inset + 0.25;
    this.pressers.forEach((m, i) => { const a = i * Math.PI / 2; m.visible = this.inset > 0.02; m.position.set(Math.sin(a) * d, WALL_H / 2, -Math.cos(a) * d); });
    const p = this.player.pos, lim = HALF - this.inset - RADIUS - 0.12;
    if (this.inset > 0) { p.x = Math.max(-lim, Math.min(lim, p.x)); p.z = Math.max(-lim, Math.min(lim, p.z)); }
    // lights: dimmer each stage, a red pulse when it's angry
    const st = this.stage();
    this.hemi.intensity += ((this.dark ? 0.06 : st === 2 ? 0.45 : 0.7) - this.hemi.intensity) * Math.min(1, dt * 2);
    this.red.intensity = (this.dark ? 2 : 5) + Math.sin(this.time * (2 + st)) * 1.2;
    if (this.phase === 'fight') {
      this.attackT -= dt;
      if (this.attackT <= 0) {
        this.attackT = (st === 1 ? 2.6 : st === 2 ? 2.1 : 1.7) * this.speed();
        const c = Math.random() < 0.7 ? this.cellOf(p.x, p.z) : [CELLS[Math.floor(Math.random() * 3)], CELLS[Math.floor(Math.random() * 3)]];
        const eyeHere = this.eyes.some(e => e.real && Math.abs(e.g.position.x - c[0]) < 0.1 && Math.abs(e.g.position.z - c[1]) < 0.1);
        if (!eyeHere) this.stomp(c[0], c[1]);
        if (st === 3) { const c2 = [CELLS[Math.floor(Math.random() * 3)], CELLS[Math.floor(Math.random() * 3)]]; if (c2[0] !== c[0] || c2[1] !== c[1]) this.stomp(c2[0], c2[1]); }
      }
      if (st >= 2) {
        this.hopT -= dt;
        if (this.hopT <= 0 && this.hoppers.length < st - 1) { this.spawnHopper(); this.hopT = (st === 2 ? 7 : 5) * this.speed(); }
      }
      this.updateEyes(dt);
    }
    this.updateStomps(dt);
    this.updateHoppers(dt);
    this.updateDrops(dt);
    const a = this.phase === 'fight' && this.spell !== 'none' ? this.aimPoint() : null;
    this.aimRing.visible = !!a;
    if (a) { this.aimRing.position.set(a.x, 0.04, a.z); this.aimRing.material.color.set(COL.mine); }
    ui.setPrompt(null);
    ui.setBoss(this.phase === 'fight' ? { name: 'The Room', frac: this.hp / this.maxHp } : null);
  }

  intensity() { return this.phase === 'fight' ? 0.3 + (this.stage() - 1) * 0.3 + (this.state.hearts <= 1 ? 0.3 : 0) : 0; }
  surface() { return 'wood'; }

  refreshHUD() {
    const s = this.state;
    ui.setHearts(s.hearts, s.maxHearts);
    const inv = [`<b>${this.spell === 'furniture' ? '▶' : ''} 1</b> Furniture`];
    if (knows(s, 'blink')) inv.push(`<b>${this.spell === 'blink' ? '▶' : ''} 3</b> ${SPELLS.blink.icon} Blink`);
    if (knows(s, 'shrink')) inv.push(`<b>4</b> ${SPELLS.shrink.icon} Shrink${this.engine.touch ? ' (Shrink button)' : ''}`);
    if (this.shield) inv.push('🧥 <b>Cloak</b> ready');
    if (s.flags.wand) inv.push('🪄 <b>Ember Wand</b>');
    ui.setInventory(inv);
    const st = this.stage();
    ui.setObjective(st === 1 ? 'Drop furniture on the eye when it opens in the floor. Dodge the ceiling.' : st === 2 ? 'Hit the REAL eye — it follows you. Squash rebel furniture.' : 'In the dark: find the eye that follows you, and finish this.');
  }
}
