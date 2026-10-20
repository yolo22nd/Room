import * as THREE from 'three';
import { COL } from './a11y';
import { ring, glowSprite } from './textures';
import { CATALOG, buildObject, box, cyl } from './models';
import { FX, disposeTree } from './fx';
import { BossLevel } from './bosslevel';
import { manaCost, knows, castShrink, castBlink, SPELLS } from './spells';
import { RADIUS } from './player';
import * as ui from './ui';
import { sfx, playAmbience } from './audio';
import { unlock } from './save';
import { WITCH_TAUNTS } from './story';

// Part 3: the rematch in the witch's garden.
const ARENA_R = 15;
const STONE_R = 12;
const STONES = 10;
const G = 22;

function canvasTex(w, h, draw, repeat?) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
}

function makeWitchModel() {
  const g = new THREE.Group();
  const robe = new THREE.MeshStandardMaterial({ color: 0x2a1240, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe8cfae, roughness: 0.7 });
  const hatM = new THREE.MeshStandardMaterial({ color: 0x140818, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.5, 16), robe); body.position.y = 0.95; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), skin); head.position.y = 1.9; g.add(head);
  for (const x of [-0.09, 0.09]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: 0x7bff7b })); e.position.set(x, 1.93, 0.22); g.add(e); }
  const brim = cyl(0.55, 0.55, 0.04, hatM, 0, 2.08, 0, g, 24);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.9, 16), hatM); hat.position.set(0, 2.5, -0.05); hat.rotation.x = -0.25; g.add(hat);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.5), new THREE.MeshStandardMaterial({ color: 0x8a1a2a, roughness: 0.9 }));
  hair.position.y = 1.88; g.add(hair);
  // broom under her
  const broom = new THREE.Group(); broom.position.y = 0.7; g.add(broom);
  const stick = cyl(0.04, 0.04, 2.2, new THREE.MeshStandardMaterial({ color: 0x6b4226 }), 0, 0, 0, broom, 8); stick.rotation.x = Math.PI / 2;
  const bristles = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 10), new THREE.MeshStandardMaterial({ color: 0xc9a050, roughness: 1 }));
  bristles.rotation.x = -Math.PI / 2; bristles.position.z = -1.3; broom.add(bristles);
  g.userData.broom = broom; g.userData.brim = brim;
  g.traverse((o: any) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export class WitchLevel extends BossLevel {
  constructor(engine, state) {
    super();
    this.engine = engine;
    this.player = engine.player;
    this.camera = engine.camera;
    this.state = state;
    this.scene = new THREE.Scene();
    this.fx = new FX(this.scene);
    this.time = 0;
    this.raycaster = new THREE.Raycaster();
    this.drops = [];
    this.attacks = [];
    this.clones = [];
    this.hard = state.mode === 'hard';
    this.maxHp = this.hard ? 8 : 6;
    this.hp = this.maxHp;
    this.phase = 'intro';
    this.cooldown = 0;
    this.lemonCooldown = 0;
    this.spell = 'furniture';
    this.shield = state.flags.cloak ? 1 : 0;
    this.hitsTaken = 0;
    this.build();
    this.player.walkable = (x, z) => Math.hypot(x, z) < ARENA_R - RADIUS;
    this.player.canMove = () => true;
    this.player.onBlocked = null;
    this.player.onGrow = null;
  }

  build() {
    const s = this.scene;
    s.background = canvasTex(4, 256, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#0d0a2a'); grd.addColorStop(0.45, '#3a1f5a'); grd.addColorStop(0.75, '#c2546a'); grd.addColorStop(1, '#f2a65a');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
    });
    s.fog = new THREE.Fog(0x4a2a5a, 25, 70);
    s.add(new THREE.HemisphereLight(0xb090ff, 0x203018, 0.9));
    const sun = new THREE.DirectionalLight(0xffb27a, 1.6);
    sun.position.set(-20, 14, -25); sun.castShadow = this.engine.quality === 'high';
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 80 });
    s.add(sun);

    const grass = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#2c4a24'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 4000; i++) { g.fillStyle = `hsla(${90 + Math.random() * 30}, 40%, ${15 + Math.random() * 20}%, 0.6)`; g.fillRect(Math.random() * w, Math.random() * h, 1, 3 + Math.random() * 4); }
    }, 12);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 48), new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; s.add(ground);

    // standing stones
    this.stones = [];
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x7a7480, roughness: 1, flatShading: true });
    for (let i = 0; i < STONES; i++) {
      const a = i / STONES * Math.PI * 2;
      const p = new THREE.Vector3(Math.cos(a) * STONE_R, 0, Math.sin(a) * STONE_R);
      const st = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.6 + (i % 3) * 0.5, 0.7), stoneMat);
      st.position.set(Math.cos(a) * (STONE_R + 1.6), 1.3, Math.sin(a) * (STONE_R + 1.6)); st.lookAt(0, 1.3, 0); st.castShadow = st.receiveShadow = true; s.add(st);
      // glowing rune where she lands
      const rune = new THREE.Mesh(new THREE.CircleGeometry(1.1, 24), new THREE.MeshBasicMaterial({ map: ring(), color: 0x9a7aff, transparent: true, opacity: 0.35, depthWrite: false }));
      rune.rotation.x = -Math.PI / 2; rune.position.set(p.x, 0.02, p.z); s.add(rune);
      this.stones.push(p);
    }
    // the witch's cottage and some trees on the horizon
    const cottage = new THREE.Group(); cottage.position.set(0, 0, -32); s.add(cottage);
    box(7, 4, 5, new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 1 }), 0, 2, 0, cottage);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5.5, 4, 4), new THREE.MeshStandardMaterial({ color: 0x3a1a2a, roughness: 1 })); roof.position.y = 6; roof.rotation.y = Math.PI / 4; cottage.add(roof);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1), new THREE.MeshBasicMaterial({ color: 0xffc070 })); win.position.set(1.6, 2.2, 2.51); cottage.add(win);
    const treeM = new THREE.MeshStandardMaterial({ color: 0x1a2a1a, roughness: 1, flatShading: true });
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2, r = 24 + Math.random() * 18;
      if (Math.abs(a - Math.PI * 1.5) < 0.25) continue;
      const t = new THREE.Mesh(new THREE.ConeGeometry(1.5 + Math.random(), 6 + Math.random() * 5, 7), treeM);
      t.position.set(Math.cos(a) * r, 3.5, Math.sin(a) * r); s.add(t);
    }
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite('#fff4dd'), transparent: true, depthWrite: false }));
    moon.scale.set(12, 12, 1); moon.position.set(25, 32, -50); s.add(moon);
    // fireflies
    const n = 160, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 40; pos[i * 3 + 1] = 0.3 + Math.random() * 3; pos[i * 3 + 2] = (Math.random() - 0.5) * 40; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.flies = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.18, map: glowSprite('#d8ff7a'), color: 0xd8ff7a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.add(this.flies);

    // the witch
    this.witch = makeWitchModel(); s.add(this.witch);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.8, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = 0.03; s.add(this.shadow);
    this.bubble = new THREE.Mesh(new THREE.SphereGeometry(1.5, 24, 16), new THREE.MeshStandardMaterial({ color: 0xb58cff, emissive: 0x7a4aff, emissiveIntensity: 0.8, transparent: true, opacity: 0.22, depthWrite: false }));
    this.witch.add(this.bubble); this.bubble.position.y = 1.4;
    this.witchLight = new THREE.PointLight(0xb58cff, 8, 10, 1.6); this.witchLight.position.y = 2; this.witch.add(this.witchLight);
    this.w = { state: 'fly', t: 0, ang: Math.PI / 2, pos: new THREE.Vector3(0, 4, -8), from: new THREE.Vector3(), to: new THREE.Vector3(), castAt: 0 };
    this.witch.position.copy(this.w.pos);

    this.aimRing = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: ring(), color: COL.mine, transparent: true, depthWrite: false }));
    this.aimRing.rotation.x = -Math.PI / 2; this.aimRing.position.y = 0.04; s.add(this.aimRing);
  }

  activate() {
    this.scene.add(this.camera);
    this.player.place(0, 9, 0);
    this.player.speed = 4.4;
    playAmbience('witch');
    ui.setVignette('');
    this.phase = 'fight';
    if (this.state.talk && !this.talkApplied) this.applyTalk(this.state.talk);
    this.refreshHUD();
    ui.log('She only drops her shield when she lands to cast. Drop furniture on her then!', 'lore');
    if (this.state.flags.lemon) ui.log('Your lemon twitches in your pocket. (2 / Q to ready it, cast to throw.)', 'lore');
  }
  deactivate() { this.scene.remove(this.camera); ui.setBoss(null); disposeTree(this.scene); }

  // --------------------------------------------------------------- input
  handleAction(a) {
    switch (a) {
      case 'cast': case 'use': case 'enter': this.cast(); break;
      case 'book': case 'rotate': { const l = this.spellList(); this.setSpell(l[(l.indexOf(this.spell) + 1) % l.length]); break; }
      case 'n1': this.setSpell('furniture'); break;
      case 'n2': if (this.state.flags.lemon) this.setSpell('lemon'); break;
      case 'n3': if (knows(this.state, 'blink')) this.setSpell('blink'); break;
      case 'n4': case 'search': if (knows(this.state, 'shrink')) castShrink(this.engine); break;
    }
  }
  spellList() { return ['furniture', ...(this.state.flags.lemon ? ['lemon'] : []), ...(knows(this.state, 'blink') ? ['blink'] : [])]; }
  setSpell(s) {
    if (this.spell === s) return;
    if (s === 'blink') { this.spell = s; sfx.click(); ui.log('Spell: Blink — teleport where you aim.'); this.refreshHUD(); return; }
    this.spell = s; sfx.click();
    ui.log(s === 'lemon' ? 'You ready the lemon. It judges her now, instead of you.' : 'Spell: falling furniture.');
    this.refreshHUD();
  }

  aimPoint() {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const ray = this.raycaster.ray;
    if (ray.direction.y > -0.02) return null;
    const t = -ray.origin.y / ray.direction.y;
    if (t > 32) return null;
    return ray.origin.clone().addScaledVector(ray.direction, t);
  }

  cast() {
    if (this.phase !== 'fight') return;
    if (this.spell === 'lemon') { this.throwLemon(); return; }
    const p = this.aimPoint();
    if (!p) { ui.log('Aim at the ground.', 'warn'); return; }
    if (this.spell === 'blink') { castBlink(this.engine, this.fx, p); return; }
    if (this.cooldown > 0) { sfx.locked(); return; }
    if (!this.engine.spend(manaCost('furniture'))) return;
    this.cooldown = this.state.flags.wand ? 0.45 : 0.9;
    sfx.conjure();
    const types = this.ammoTypes();
    const type = types[Math.floor(Math.random() * types.length)];
    const obj = buildObject(type); obj.scale.setScalar(1.2); obj.rotation.y = Math.random() * 6;
    obj.position.set(p.x, 16, p.z); this.scene.add(obj);
    this.drops.push({ obj, target: p.clone(), vy: 0, type, marker: this.marker(p, 1.4, COL.mine), mine: true });
    this.engine.stats.conjured++;
  }

  throwLemon() {
    if (this.lemonCooldown > 0) { sfx.locked(); ui.log('The lemon is still rolling back to you.'); return; }
    this.lemonCooldown = 10;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffe14a, emissive: 0x504000, roughness: 0.4 }));
    m.scale.set(1.25, 1, 1); m.position.copy(this.camera.position).addScaledVector(dir, 0.6);
    this.scene.add(m);
    this.lemon = { obj: m, vel: dir.multiplyScalar(26), t: 0 };
    sfx.whoosh();
    sfx.click();
  }

  // --------------------------------------------------------------- witch AI
  stage() { const f = this.hp / this.maxHp; return f > 0.67 ? 1 : f > 0.34 ? 2 : 3; }
  vulnerable() { return this.w.state === 'cast' || this.w.state === 'stunned'; }

  updateWitch(dt) {
    const w = this.w;
    w.t += dt;
    const stage = this.stage();
    switch (w.state) {
      case 'fly': {
        w.ang += dt * (stage === 3 ? 0.7 : 0.45);
        w.pos.set(Math.cos(w.ang) * 9, 4 + Math.sin(this.time * 1.7) * 0.6, Math.sin(w.ang) * 9);
        if (w.t > (stage === 3 ? 2.2 : 3.4) * (this.slow || 1) * (this.hard ? 0.75 : 1)) this.descend();
        break;
      }
      case 'descend': {
        const k = Math.min(1, w.t / 0.9);
        w.pos.lerpVectors(w.from, w.to, k * (2 - k));
        if (k >= 1) { w.state = 'cast'; w.t = 0; w.castAt = 0; this.startCast(); }
        break;
      }
      case 'cast': {
        w.pos.copy(w.to); w.pos.y = 0.15 + Math.sin(this.time * 6) * 0.05;
        const dur = (stage === 3 ? 2.0 : 2.8) * (this.hard ? 0.7 : 1);
        if (w.t > dur) this.ascend();
        break;
      }
      case 'ascend': {
        const k = Math.min(1, w.t / 0.7);
        w.pos.lerpVectors(w.from, w.to, k);
        if (k >= 1) { w.state = 'fly'; w.t = 0; w.ang = Math.atan2(w.pos.z, w.pos.x); }
        break;
      }
      case 'stunned': {
        w.pos.y = 0.1;
        this.witch.rotation.z = Math.sin(this.time * 10) * 0.2;
        if (w.t > 4.5) { this.witch.rotation.z = 0; this.ascend(); ui.log('She shakes off the lemon fumes. "UGH. Citrus."', 'lore'); }
        break;
      }
      case 'teleport': {
        if (w.t > 0.6) { w.state = 'fly'; w.t = 0; w.ang = Math.random() * Math.PI * 2; this.witch.visible = true; this.fx.burst(this.witch.position.clone().setY(4), { count: 24, color: '#b58cff', size: 0.6 }); }
        break;
      }
      case 'defeated': {
        w.pos.y = Math.max(0.1, w.pos.y - dt * 2);
        break;
      }
    }
    this.witch.position.copy(w.pos);
    // face the player
    this.witch.rotation.y = Math.atan2(this.player.pos.x - w.pos.x, this.player.pos.z - w.pos.z);
    this.shadow.position.set(w.pos.x, 0.03, w.pos.z);
    this.shadow.scale.setScalar(Math.max(0.5, 1.4 - w.pos.y * 0.15));
    this.bubble.visible = !this.vulnerable() && w.state !== 'defeated';
    this.bubble.material.opacity = 0.18 + Math.sin(this.time * 4) * 0.05;
    this.witch.userData.broom.rotation.z = Math.sin(this.time * 3) * 0.1;
    // clones mirror her pose
    for (const c of this.clones) { c.obj.rotation.y = Math.atan2(this.player.pos.x - c.obj.position.x, this.player.pos.z - c.obj.position.z); c.obj.position.y = this.witch.position.y; }
  }

  descend() {
    const w = this.w;
    w.state = 'descend'; w.t = 0;
    w.from.copy(w.pos);
    // land on a stone that isn't right on top of the player
    const opts = this.stones.filter(s => s.distanceTo(new THREE.Vector3(this.player.pos.x, 0, this.player.pos.z)) > 5);
    const pick = opts[Math.floor(Math.random() * opts.length)] || this.stones[0];
    w.to.copy(pick);
    if (this.stage() >= 2) this.spawnClones(pick);
    if (Math.random() < 0.5) ui.log(WITCH_TAUNTS[Math.floor(Math.random() * WITCH_TAUNTS.length)], 'lore');
  }

  ascend() {
    const w = this.w;
    w.state = 'ascend'; w.t = 0;
    w.from.copy(w.pos);
    w.to.set(w.pos.x * 0.75, 4, w.pos.z * 0.75);
    this.clearClones();
  }

  spawnClones(real) {
    this.clearClones();
    const others = this.stones.filter(s => s !== real).sort(() => Math.random() - 0.5).slice(0, this.stage() === 3 ? 3 : 2);
    for (const s of others) {
      const obj = makeWitchModel();
      obj.position.set(s.x, 4, s.z);
      obj.traverse((o: any) => { if (o.isMesh) o.castShadow = false; });
      this.scene.add(obj);
      const c: any = { obj, stone: s };
      // clones glide down alongside her
      c.from = obj.position.clone(); c.to = s.clone();
      this.clones.push(c);
    }
    if (!this.cloneHinted) { this.cloneHinted = true; ui.log('"Mirror, mirror..." — she splits into copies! Only the real witch casts a shadow.', 'warn'); }
  }
  clearClones() {
    for (const c of this.clones) { this.fx.burst(c.obj.position.clone().setY(1.2), { count: 14, color: '#b58cff', size: 0.5 }); this.scene.remove(c.obj); }
    this.clones = [];
  }

  applyTalk(effects) {
    this.talkApplied = true;
    if (effects.includes('easy')) this.slow = 1.25;
    if (effects.includes('rattled')) { this.hp = Math.max(1, this.hp - 1); ui.log('She\'s rattled: one hit already counts against her.', 'good'); }
  }

  startCast() {
    const stage = this.stage();
    sfx.whisper();
    const pp = () => new THREE.Vector3(this.player.pos.x, 0, this.player.pos.z);
    const k = (this.slow || 1) * (this.hard ? 0.8 : 1);
    if (stage === 1) this.queueAttack(pp(), 0.9 * k);
    else if (stage === 2) { this.queueAttack(pp(), 0.8 * k); this.queueAttack(null, 1.6 * k); }
    else { this.queueAttack(null, 0.5 * k); this.queueAttack(null, 1.1 * k); this.queueAttack(null, 1.7 * k); }
  }

  // target null = wherever the player is when it fires
  queueAttack(target, delay) { this.attacks.push({ target, delay }); }

  fireAttack(target) {
    const kinds = ['pumpkin', 'cauldron'];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    let obj;
    if (kind === 'pumpkin') {
      obj = new THREE.Group();
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.6, emissive: 0x401000 }));
      p.scale.y = 0.8; obj.add(p);
      const stem = cyl(0.06, 0.08, 0.3, new THREE.MeshStandardMaterial({ color: 0x3a5a1a }), 0, 0.65, 0, obj, 6);
      stem.castShadow = true;
    } else {
      obj = new THREE.Group();
      cyl(0.7, 0.55, 0.9, new THREE.MeshStandardMaterial({ color: 0x15131a, roughness: 0.4, metalness: 0.6 }), 0, 0, 0, obj, 16);
      const goo = new THREE.Mesh(new THREE.CircleGeometry(0.62, 16), new THREE.MeshBasicMaterial({ color: 0x7bff4a })); goo.rotation.x = -Math.PI / 2; goo.position.y = 0.44; obj.add(goo);
    }
    obj.position.set(target.x, 15, target.z); this.scene.add(obj);
    this.drops.push({ obj, target: target.clone(), vy: -4, type: kind, marker: this.marker(target, 1.5, COL.danger), mine: false });
    sfx.warn();
  }

  // --------------------------------------------------------------- drops
  updateDrops(dt) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      if (d.landedT !== undefined) {
        d.landedT += dt;
        if (d.landedT > 1.6) { this.scene.remove(d.obj); this.fx.burst(d.obj.position.clone().setY(0.6), { count: 8, color: d.mine ? '#b58cff' : '#ff8040', size: 0.4 }); this.drops.splice(i, 1); }
        continue;
      }
      d.vy -= G * dt;
      d.obj.position.y += d.vy * dt;
      if (d.reflected) {
        d.obj.position.x += (d.target.x - d.obj.position.x) * Math.min(1, dt * 2.5);
        d.obj.position.z += (d.target.z - d.obj.position.z) * Math.min(1, dt * 2.5);
      }
      d.marker.scale.setScalar(Math.max(0.35, 1 - d.obj.position.y / 18));
      // my furniture meets her shield on the way down
      if (d.mine && !d.reflected && !this.vulnerable() && this.w.state !== 'defeated' && d.obj.position.distanceTo(this.witch.position.clone().setY(this.witch.position.y + 1.4)) < 1.9) {
        sfx.close(); this.fx.burst(d.obj.position.clone(), { count: 16, color: '#c9a8ff', size: 0.5 });
        if (this.stage() === 3) {
          // reflected back at you
          d.reflected = true; d.mine = false; d.vy = 6;
          d.target.set(this.player.pos.x, 0, this.player.pos.z);
          this.scene.remove(d.marker); d.marker = this.marker(d.target, 1.5, COL.danger);
          ui.log('Her shield flings it straight back at you!', 'warn');
        } else {
          this.scene.remove(d.obj); this.scene.remove(d.marker); this.drops.splice(i, 1);
          ui.log('Her shield deflects it. Wait until she lands!', 'warn');
          continue;
        }
      }
      if (d.obj.position.y <= 0) {
        d.obj.position.y = 0;
        this.scene.remove(d.marker);
        this.landed(d);
        d.landedT = 0;
      }
    }
  }

  landed(d) {
    sfx.thud(1.2);
    this.fx.dust(d.target, 1.2);
    const pd = Math.hypot(this.player.pos.x - d.target.x, this.player.pos.z - d.target.z);
    this.player.addShake(Math.max(0, 0.7 - pd / 12));
    if (!d.mine) {
      if (pd < (this.player.shrunk > 0 ? 0.9 : 1.5)) this.hurt(1, d.type === 'pumpkin' ? 'squashed by a pumpkin' : 'hit by a flying cauldron');
      return;
    }
    if (pd < (this.player.shrunk > 0 ? 0.6 : 1.0)) this.hurt(1, 'crushed by your own ' + (CATALOG[d.type] ? CATALOG[d.type].name.toLowerCase() : 'furniture'));
    // clones pop
    for (const c of [...this.clones]) {
      if (Math.hypot(c.obj.position.x - d.target.x, c.obj.position.z - d.target.z) < 1.8 && this.w.state === 'cast') {
        this.fx.burst(c.obj.position.clone().setY(1.2), { count: 24, color: '#b58cff', size: 0.6 });
        this.scene.remove(c.obj); this.clones.splice(this.clones.indexOf(c), 1);
        ui.log('POOF — a clone! "Wrong one, newbie." (Look for the shadow.)', 'warn');
        this.queueAttack(null, 0.3);
        return;
      }
    }
    const wp = this.witch.position;
    if (this.vulnerable() && Math.hypot(wp.x - d.target.x, wp.z - d.target.z) < 1.9) this.hitWitch();
  }

  hitWitch() {
    this.hp--;
    sfx.hurt(); sfx.roar();
    ui.flash('#b58cff', 0.5, 500);
    this.fx.burst(this.witch.position.clone().setY(1.5), { count: 30, color: '#ffd0ff', speed: 4, size: 0.5 });
    this.attacks = [];
    this.clearClones();
    if (this.hp <= 0) { this.defeat(); return; }
    const lines = ['"OW! My hat!"', '"Lucky shot!"', '"Fine, no more holding back!"', '"Who taught you that? ...Oh. Me."', '"That was a family heirloom!"'];
    ui.log(lines[Math.floor(Math.random() * lines.length)], 'lore');
    if (this.stage() === 3 && !this.enraged) { this.enraged = true; ui.log('Her shield turns mirror-bright. Anything that hits it now comes right back!', 'warn'); }
    this.w.state = 'teleport'; this.w.t = 0; this.witch.visible = false;
    this.refreshHUD();
  }

  defeat() {
    this.phase = 'won';
    this.w.state = 'defeated';
    this.witch.visible = true;
    unlock('witch');
    if (this.hitsTaken === 0) unlock('witchflawless');
    this.engine.split('Witch');
    ui.setBoss(null);
    ui.log('The witch tumbles off her broom and lands in a heap, laughing.', 'good');
    playAmbience('ending');
    setTimeout(() => { if (this.engine.level === this) this.engine.finale(); }, 3500);
  }

  updateLemon(dt) {
    this.lemonCooldown = Math.max(0, this.lemonCooldown - dt);
    const l = this.lemon;
    if (!l) return;
    l.t += dt;
    l.vel.y -= 4 * dt;
    l.obj.position.addScaledVector(l.vel, dt);
    l.obj.rotation.x += dt * 12;
    const wp = this.witch.position.clone(); wp.y += 1.5;
    if (this.w.state !== 'defeated' && this.w.state !== 'teleport' && l.obj.position.distanceTo(wp) < 1.8) {
      this.scene.remove(l.obj); this.lemon = null;
      this.w.state = 'stunned'; this.w.t = 0; this.w.pos.y = 0.1;
      this.attacks = [];
      sfx.hurt();
      this.fx.burst(wp, { count: 26, color: '#ffe14a', size: 0.5, speed: 3 });
      ui.log('"LEMON?! NOT THE LEMON!" She drops her broom, coughing. Her shield is down!', 'good');
      unlock('lemon');
      return;
    }
    if (l.obj.position.y < 0 || l.t > 3) { this.scene.remove(l.obj); this.lemon = null; ui.log('The lemon rolls away. It will be back, judging.'); }
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
    this.cooldown = Math.max(0, this.cooldown - dt);
    ui.setCooldown(this.spell === 'lemon' ? this.lemonCooldown / 10 : this.cooldown / (this.state.flags.wand ? 0.45 : 0.9));
    const fp = this.flies.geometry.attributes.position;
    for (let i = 0; i < fp.count; i++) fp.setY(i, fp.getY(i) + Math.sin(this.time * 2 + i) * dt * 0.3);
    fp.needsUpdate = true;
    if (this.phase === 'fight' || this.phase === 'won') this.updateWitch(dt);
    // clone glide
    for (const c of this.clones) if (this.w.state === 'descend') c.obj.position.lerpVectors(c.from, c.to, Math.min(1, this.w.t / 0.9));
    for (let i = this.attacks.length - 1; i >= 0; i--) {
      const a = this.attacks[i]; a.delay -= dt;
      if (a.delay <= 0) { this.attacks.splice(i, 1); this.fireAttack(a.target || new THREE.Vector3(this.player.pos.x, 0, this.player.pos.z)); }
    }
    this.updateDrops(dt);
    this.updateLemon(dt);
    const p = this.phase === 'fight' && this.spell !== 'lemon' ? this.aimPoint() : null;
    this.aimRing.visible = !!p;
    if (p) { this.aimRing.position.set(p.x, 0.04, p.z); this.aimRing.material.color.set(COL.mine); }
    ui.setPrompt(null);
    ui.setBoss(this.phase === 'fight' ? { name: 'The Witch of Ember Hollow', frac: this.hp / this.maxHp } : null);
  }

  intensity() { return this.phase === 'fight' ? 0.2 + (this.stage() - 1) * 0.3 + (this.state.hearts <= 1 ? 0.3 : 0) : 0; }
  surface() { return 'grass'; }

  refreshHUD() {
    const s = this.state;
    ui.setHearts(s.hearts, s.maxHearts);
    const inv = [`<b>${this.spell === 'furniture' ? '▶' : ''} 1</b> Furniture`];
    if (s.flags.lemon) inv.push(`<b>${this.spell === 'lemon' ? '▶' : ''} 2</b> 🍋 Lemon`);
    if (knows(s, 'blink')) inv.push(`<b>${this.spell === 'blink' ? '▶' : ''} 3</b> ${SPELLS.blink.icon} Blink`);
    if (knows(s, 'shrink')) inv.push(`<b>4</b> ${SPELLS.shrink.icon} Shrink${this.engine.touch ? ' (Search)' : ''}`);
    if (this.shield) inv.push('🧥 <b>Cloak</b> ready');
    if (s.flags.wand) inv.push('🪄 <b>Ember Wand</b>');
    ui.setInventory(inv);
    const st = this.stage();
    ui.setObjective(st === 1 ? 'Drop furniture on the witch while she has landed to cast.' : st === 2 ? 'Find the real witch — only she casts a shadow.' : 'Finish it! Don\'t hit her shield — it reflects now.');
  }
}
