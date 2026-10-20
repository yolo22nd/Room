import * as THREE from 'three';
import { basalt, lava, ring, glowSprite, portal } from './textures.js';
import { CATALOG, buildObject, makeGiantNail } from './models.js';
import { FX } from './fx.js';
import { RADIUS } from './player.js';
import * as ui from './ui.js';
import { sfx, playAmbience } from './audio.js';
import { unlock } from './save.js';

const ARENA_C = new THREE.Vector3(0, 0, 4);
const ARENA_R = 16;
const KRAKEN_POS = new THREE.Vector3(0, 0, -15);
const TENTACLES = 5;
const PINS_NEEDED = 4;
const SEGMENTS = 14;
const G = 22;

function bezier(p0, p1, p2, p3, t, out) {
  const u = 1 - t;
  out.set(0, 0, 0)
    .addScaledVector(p0, u * u * u)
    .addScaledVector(p1, 3 * u * u * t)
    .addScaledVector(p2, 3 * u * t * t)
    .addScaledVector(p3, t * t * t);
  return out;
}

export class HellLevel {
  constructor(engine, state) {
    this.engine = engine;
    this.player = engine.player;
    this.camera = engine.camera;
    this.state = state;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x160302);
    this.scene.fog = new THREE.Fog(0x220503, 18, 75);
    this.fx = new FX(this.scene);
    this.time = 0;
    this.raycaster = new THREE.Raycaster();
    this.drops = [];
    this.tentacles = [];
    this.pins = 0;
    this.phase = 'intro';    // intro | fight | exposed | dying | won
    this.attackT = 3;
    this.fireT = 8;
    this.cooldown = 0; this.nailCooldown = 0;
    this.spell = 'furniture';
    this.recoveries = 0;
    this.hitsTaken = 0;
    this.burnT = 0; this.slipperT = 0;
    this.projectiles = [];
    this.build();

    this.player.walkable = (x, z) => Math.hypot(x - ARENA_C.x, z - ARENA_C.z) < ARENA_R - 0.8 - RADIUS && !(Math.hypot(x - KRAKEN_POS.x, z - KRAKEN_POS.z) < 6.5);
    this.player.canMove = () => true;
    this.player.onBlocked = null;
  }

  build() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xff7040, 0x1a0000, 0.9));
    const key = new THREE.DirectionalLight(0xffa070, 1.4);
    key.position.set(10, 20, 15); key.castShadow = this.engine.quality === 'high';
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 60 });
    s.add(key);
    this.krakenLight = new THREE.PointLight(0xff3010, 60, 40, 1.2);
    this.krakenLight.position.set(0, 6, -10); s.add(this.krakenLight);

    // lava sea
    this.lavaTex = lava().clone(); this.lavaTex.needsUpdate = true; this.lavaTex.repeat.set(16, 16);
    this.lavaMat = new THREE.MeshBasicMaterial({ map: this.lavaTex, color: 0xffffff });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), this.lavaMat);
    sea.rotation.x = -Math.PI / 2; sea.position.y = -1.6; s.add(sea);

    // basalt platform
    const bt = basalt().clone(); bt.needsUpdate = true; bt.repeat.set(5, 5);
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(ARENA_R, ARENA_R + 1.5, 3, 48), new THREE.MeshStandardMaterial({ map: bt, roughness: 0.95, emissive: 0x220500, emissiveMap: bt, emissiveIntensity: 0.6 }));
    plat.position.set(ARENA_C.x, -1.5, ARENA_C.z); plat.receiveShadow = true; s.add(plat);
    this.platform = plat;

    // jagged rocks around the rim
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x241818, roughness: 1, flatShading: true });
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * Math.PI * 2 + Math.random() * 0.1;
      if (Math.abs(Math.sin(a) + 1) < 0.35) continue; // keep the kraken's side open
      const r = ARENA_R + 3 + Math.random() * 10;
      const h = 3 + Math.random() * 9;
      const rock = new THREE.Mesh(new THREE.ConeGeometry(1 + Math.random() * 2, h, 5), rockMat);
      rock.position.set(ARENA_C.x + Math.cos(a) * r, h / 2 - 1.6, ARENA_C.z + Math.sin(a) * r);
      rock.rotation.y = Math.random() * 3; s.add(rock);
    }
    // embers
    const n = 400, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 70; pos[i * 3 + 1] = Math.random() * 20; pos[i * 3 + 2] = (Math.random() - 0.5) * 70; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.embers = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.25, map: glowSprite('#ff9040'), color: 0xff9040, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.add(this.embers);

    this.buildKraken();

    // aim ring
    const ringMat = new THREE.MeshBasicMaterial({ map: ring(), color: 0xc9a8ff, transparent: true, depthWrite: false });
    this.aimRing = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), ringMat);
    this.aimRing.rotation.x = -Math.PI / 2; this.aimRing.position.y = 0.04; s.add(this.aimRing);
  }

  buildKraken() {
    const k = new THREE.Group(); k.position.copy(KRAKEN_POS); this.scene.add(k);
    this.kraken = k;
    const skin = new THREE.MeshStandardMaterial({ color: 0x5a1830, roughness: 0.5, metalness: 0.1, emissive: 0x200008 });
    this.skin = skin;
    const head = new THREE.Group(); head.position.set(0, 5, 0); k.add(head);
    this.head = head;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(5, 32, 24), skin); dome.scale.set(1, 1.35, 1); dome.castShadow = true; head.add(dome);
    // spots
    const spotMat = new THREE.MeshStandardMaterial({ color: 0x8a2a40, roughness: 0.6 });
    for (let i = 0; i < 18; i++) {
      const sp = new THREE.Mesh(new THREE.SphereGeometry(0.4 + Math.random() * 0.5, 10, 8), spotMat);
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI * 0.7;
      sp.position.set(Math.sin(b) * Math.cos(a) * 4.9, Math.cos(b) * 6.5, Math.sin(b) * Math.sin(a) * 4.9);
      sp.scale.z = 0.3; sp.lookAt(0, 0, 0); head.add(sp);
    }
    // the big eye (and a smaller one) facing the arena (+z)
    this.eyeMat = new THREE.MeshStandardMaterial({ color: 0xffdd55, emissive: 0xff8800, emissiveIntensity: 1.5, roughness: 0.2 });
    const eye = new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 16), this.eyeMat); eye.position.set(-1.4, -1.2, 4.1); head.add(eye);
    const eye2 = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), this.eyeMat); eye2.position.set(2.3, -0.7, 4.0); head.add(eye2);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.pupils = [];
    for (const [e, r] of [[eye, 1.6], [eye2, 0.9]]) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(r * 0.45, 12, 8), pupilMat);
      p.scale.set(0.35, 1, 0.4); p.position.z = r * 0.85; e.add(p); this.pupils.push(p);
    }
    this.eye = eye;
    const eg = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite('#ffaa22'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 }));
    eg.scale.set(6, 6, 1); eg.position.copy(eye.position).add(new THREE.Vector3(0, 0, 0.8)); head.add(eg); this.eyeGlow = eg;
    // a crown of jagged horns: it's version 2.0 after all
    const hornMat = new THREE.MeshStandardMaterial({ color: 0x1a0a0a, roughness: 0.4 });
    for (let i = 0; i < 7; i++) {
      const h = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6, 6), hornMat);
      const a = -Math.PI / 2 + (i - 3) * 0.32;
      h.position.set(Math.cos(a) * 3, 6.2, Math.sin(a) * 3 - 0.5); h.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4); head.add(h);
    }

    // tentacles
    const tipMat = new THREE.MeshStandardMaterial({ color: 0xff7040, emissive: 0xff3000, emissiveIntensity: 0 });
    for (let i = 0; i < TENTACLES; i++) {
      const ang = Math.PI * (0.18 + i * 0.16); // spread across the front
      const root = new THREE.Vector3(Math.cos(ang) * 4.5, 0.2, Math.sin(ang) * 3.5).add(KRAKEN_POS);
      const segs = [];
      for (let k2 = 0; k2 < SEGMENTS; k2++) {
        const r = 1.0 * (1 - k2 / SEGMENTS) + 0.22;
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), k2 === SEGMENTS - 1 ? tipMat.clone() : skin);
        m.castShadow = true; this.scene.add(m); segs.push(m);
      }
      this.tentacles.push({
        i, root, segs, state: 'idle', t: Math.random() * 5, timer: 0,
        tip: new THREE.Vector3(), target: new THREE.Vector3(), from: new THREE.Vector3(),
        phase: Math.random() * 10, pinObj: null, ang,
      });
    }
  }

  activate() {
    this.scene.add(this.camera);
    this.player.place(0, 13, 0);
    this.player.speed = 4.2;
    playAmbience('hell');
    ui.setVignette('');
    this.refreshHUD();
    const sh = this.state.shoes;
    if (sh === 'shoes') { unlock('dresscode'); ui.log('Your sturdy shoes hiss against the hot stone. Good call.', 'good'); }
    else if (sh === 'slippers') ui.log('Your slippers start to smoke. They won\'t last long.', 'warn');
    else { unlock('hotfeet'); ui.log('The floor is HOT. "Please wear shoes before going out of the house," you remember. Too late.', 'warn'); }
    this.phase = 'fight';
    setTimeout(() => sfx.roar(), 300);
    ui.log('Aim at the ground and cast to drop furniture from the sky. Pin its arms while they rest on the stone!', 'lore');
  }

  deactivate() { this.scene.remove(this.camera); }

  // ------------------------------------------------------------ actions
  handleAction(a) {
    switch (a) {
      case 'cast': case 'use': case 'enter': this.cast(); break;
      case 'book': case 'rotate': this.toggleSpell(); break;
      case 'n1': this.setSpell('furniture'); break;
      case 'n2': this.setSpell('nail'); break;
    }
  }

  toggleSpell() { this.setSpell(this.spell === 'furniture' ? 'nail' : 'furniture'); }
  setSpell(s) {
    if (this.spell === s) return;
    this.spell = s; sfx.click();
    ui.log(s === 'nail' ? 'Spell: GIANT NAIL. It needs a worthy target.' : 'Spell: falling furniture.');
    this.refreshHUD();
  }

  aimPoint() {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const ray = this.raycaster.ray;
    if (ray.direction.y > -0.02) return null;
    const t = -ray.origin.y / ray.direction.y;
    if (t > 34) return null;
    const p = ray.origin.clone().addScaledVector(ray.direction, t);
    if (Math.hypot(p.x - ARENA_C.x, p.z - ARENA_C.z) > ARENA_R + 6) return null;
    return p;
  }

  ammoTypes() {
    const types = Object.values(this.state.placed).map(p => p.type).filter(t => CATALOG[t] && CATALOG[t].kind === 'floor');
    return types.length ? [...new Set(types)] : ['cushion'];
  }

  cast() {
    if (this.phase !== 'fight' && this.phase !== 'exposed') {
      if (this.phase === 'won') return;
      return;
    }
    const p = this.aimPoint();
    if (!p) { ui.log('Aim at the ground.', 'warn'); return; }
    if (this.spell === 'nail') {
      if (this.nailCooldown > 0) { sfx.locked(); return; }
      this.nailCooldown = 5;
      sfx.conjure();
      const nail = makeGiantNail(0.9);
      nail.position.set(p.x, 40, p.z);
      this.scene.add(nail);
      this.drops.push({ obj: nail, target: p.clone(), vy: -10, nail: true, marker: this.marker(p, 3.2, 0xffe0a0) });
    } else {
      if (this.cooldown > 0) { sfx.locked(); return; }
      this.cooldown = 0.9;
      sfx.conjure();
      const types = this.ammoTypes();
      const type = types[Math.floor(Math.random() * types.length)];
      const obj = buildObject(type);
      obj.scale.setScalar(1.3);
      obj.rotation.y = Math.random() * Math.PI * 2;
      obj.position.set(p.x, 16, p.z);
      this.scene.add(obj);
      this.drops.push({ obj, target: p.clone(), vy: 0, type, marker: this.marker(p, 1.6, 0xc9a8ff) });
      this.engine.stats.conjured++;
    }
    this.refreshHUD();
  }

  marker(p, size, color) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size * 2, size * 2), new THREE.MeshBasicMaterial({ map: ring(), color, transparent: true, depthWrite: false, opacity: 0.8 }));
    m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.05, p.z); this.scene.add(m);
    return m;
  }

  // ------------------------------------------------------------ tentacles
  tentacleCurve(T, tip, lift = 0) {
    const r = T.root;
    const mid = r.clone().lerp(tip, 0.5);
    const p1 = r.clone().add(new THREE.Vector3(0, 4 + lift, 0)).lerp(mid, 0.3);
    const p2 = mid.clone().add(new THREE.Vector3(0, 2 + lift * 0.6, 0));
    return [r, p1, p2, tip];
  }

  layoutTentacle(T) {
    let tip, lift = 0;
    const sway = (k) => Math.sin(this.time * 1.4 + T.phase + k) ;
    const restTip = T.root.clone().add(new THREE.Vector3(Math.cos(T.ang) * 5 + sway(0) * 1.5, 7 + sway(1.3) * 1.5, Math.sin(T.ang) * 5 + 3));
    switch (T.state) {
      case 'idle': tip = restTip; break;
      case 'windup': {
        const k = Math.min(1, T.timer / T.windup);
        const high = T.target.clone().add(new THREE.Vector3(0, 9, -2));
        tip = restTip.clone().lerp(high, k * k);
        lift = 3 * k;
        break;
      }
      case 'slam': {
        const k = Math.min(1, T.timer / 0.22);
        const high = T.target.clone().add(new THREE.Vector3(0, 9, -2));
        tip = high.lerp(T.target, k * k);
        lift = 3 * (1 - k);
        break;
      }
      case 'down': case 'pinned': {
        tip = T.target.clone();
        lift = -3.6;
        if (T.state === 'pinned') tip.y += Math.abs(Math.sin(this.time * 9 + T.phase)) * 0.15;
        break;
      }
      case 'retract': {
        const k = Math.min(1, T.timer / 0.7);
        tip = T.target.clone().lerp(restTip, k);
        lift = -3.6 * (1 - k);
        break;
      }
      case 'limp': {
        tip = T.target.clone(); tip.y = -2 - T.timer; lift = -3; break;
      }
    }
    T.tip.copy(tip);
    const [p0, p1, p2, p3] = this.tentacleCurve(T, tip, lift);
    const v = new THREE.Vector3();
    T.segs.forEach((m, k) => {
      const t = k / (SEGMENTS - 1);
      bezier(p0, p1, p2, p3, t, v);
      if (T.state === 'down' || T.state === 'pinned' || T.state === 'limp') v.y = Math.max(T.state === 'limp' ? -5 : 0.5 * (1 - t) + 0.25, v.y * (1 - t * 0.9));
      m.position.copy(v);
    });
    const tipMat = T.segs[SEGMENTS - 1].material;
    tipMat.emissiveIntensity = T.state === 'down' ? 1.5 + Math.sin(this.time * 10) * 0.8 : (T.state === 'pinned' ? 0.3 : 0);
  }

  distToTentacle(T, p) {
    let best = Infinity;
    for (let k = Math.floor(SEGMENTS * 0.35); k < SEGMENTS; k++) {
      const m = T.segs[k].position;
      best = Math.min(best, Math.hypot(m.x - p.x, m.z - p.z));
    }
    return best;
  }

  startAttack() {
    const free = this.tentacles.filter(T => T.state === 'idle');
    if (!free.length) return;
    // prefer the tentacle closest to the player's side
    const pp = this.player.pos;
    free.sort((a, b) => a.root.distanceTo(pp) - b.root.distanceTo(pp) + (Math.random() - 0.5) * 6);
    const T = free[0];
    T.state = 'windup'; T.timer = 0;
    T.windup = this.phase === 'exposed' ? 1.5 : Math.max(0.9, 1.35 - this.recoveries * 0.15);
    T.target.set(pp.x, 0, pp.z);
    // keep the target on the platform and out of the kraken's body
    const off = new THREE.Vector3(T.target.x - ARENA_C.x, 0, T.target.z - ARENA_C.z);
    if (off.length() > ARENA_R - 1) off.setLength(ARENA_R - 1);
    T.target.set(ARENA_C.x + off.x, 0, ARENA_C.z + off.z);
    T.warn = this.marker(T.target, 1.9, 0xff3030);
    T.warn.material.opacity = 0.2;
    sfx.warn();
  }

  updateTentacle(T, dt) {
    T.timer += dt;
    switch (T.state) {
      case 'windup':
        if (T.warn) { T.warn.material.opacity = 0.2 + 0.7 * Math.min(1, T.timer / T.windup); T.warn.scale.setScalar(0.6 + 0.4 * Math.min(1, T.timer / T.windup)); }
        if (T.timer >= T.windup) { T.state = 'slam'; T.timer = 0; }
        break;
      case 'slam':
        if (T.timer >= 0.22) {
          T.state = 'down'; T.timer = 0;
          if (T.warn) { this.scene.remove(T.warn); T.warn = null; }
          sfx.slam();
          this.fx.dust(T.target, 1.6);
          this.fx.burst(T.target.clone().setY(0.3), { count: 14, color: '#ff7a30', speed: 4, life: 0.6, size: 0.4 });
          const d = Math.hypot(this.player.pos.x - T.target.x, this.player.pos.z - T.target.z);
          this.player.addShake(Math.max(0.25, 1.2 - d / 10));
          if (d < 1.9) this.hurt(1, 'flattened by a tentacle');
        }
        break;
      case 'down':
        if (T.timer >= 2.8) { T.state = 'retract'; T.timer = 0; }
        break;
      case 'retract':
        if (T.timer >= 0.7) { T.state = 'idle'; T.timer = 0; }
        break;
      case 'limp':
        break;
    }
    this.layoutTentacle(T);
    if (T.pinObj) T.pinObj.position.set(T.target.x, T.pinObj.userData.baseY + T.segs[SEGMENTS - 1].position.y * 0.3, T.target.z);
  }

  // ------------------------------------------------------------ drops
  updateDrops(dt) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      if (d.landedT !== undefined) {
        d.landedT += dt;
        if (d.landedT > (d.nail ? 2.5 : 3)) {
          this.scene.remove(d.obj);
          this.fx.burst(d.obj.position.clone().setY(0.5), { count: 10, color: '#b58cff', size: 0.4 });
          this.drops.splice(i, 1);
        } else if (d.nail) d.obj.position.y -= dt * 3;
        continue;
      }
      d.vy -= G * dt;
      d.obj.position.y += d.vy * dt;
      d.marker.scale.setScalar(Math.max(0.3, 1 - (d.obj.position.y / 40)));
      if (d.obj.position.y <= 0) {
        d.obj.position.y = 0;
        this.scene.remove(d.marker);
        if (d.nail) this.nailLanded(d, i); else this.furnitureLanded(d, i);
      }
    }
  }

  furnitureLanded(d, i) {
    sfx.thud(1.3);
    this.fx.dust(d.target, 1.2);
    const pd = Math.hypot(this.player.pos.x - d.target.x, this.player.pos.z - d.target.z);
    this.player.addShake(Math.max(0, 0.6 - pd / 15));
    if (pd < 1.0) this.hurt(1, 'crushed by your own ' + CATALOG[d.type].name.toLowerCase());
    if (pd < 1.9) {
      // shove the player clear so the camera never ends up inside the furniture
      const away = new THREE.Vector3(this.player.pos.x - d.target.x, 0, this.player.pos.z - d.target.z);
      if (away.lengthSq() < 1e-4) away.set(0, 0, 1);
      away.setLength(1.9);
      const nx = d.target.x + away.x, nz = d.target.z + away.z;
      if (this.player.walkable(nx, nz)) this.player.pos.set(nx, 0, nz);
    }
    // pin a resting tentacle?
    for (const T of this.tentacles) {
      if (T.state !== 'down') continue;
      if (this.distToTentacle(T, d.target) < 1.7) {
        T.state = 'pinned'; T.pinObj = d.obj; d.obj.userData.baseY = 0;
        // move the object onto the tip so the pin reads clearly
        this.pins++;
        this.drops.splice(i, 1);
        sfx.roar();
        unlock('pin');
        ui.log(`The ${CATALOG[d.type].name.toLowerCase()} pins a tentacle to the stone! (${this.pins}/${PINS_NEEDED})`, 'good');
        this.fx.burst(d.target.clone().setY(1), { count: 20, color: '#c9a8ff', speed: 3, size: 0.5 });
        if (this.pins >= PINS_NEEDED && this.phase === 'fight') this.expose();
        this.refreshHUD();
        return;
      }
    }
    d.landedT = 0;
  }

  nailLanded(d, i) {
    sfx.nail();
    this.player.addShake(1.2);
    this.fx.dust(d.target, 3);
    const headGround = this.headGroundPoint();
    const hit = this.phase === 'exposed' && Math.hypot(d.target.x - headGround.x, d.target.z - headGround.z) < 4.2;
    if (hit) {
      this.drops.splice(i, 1);
      d.obj.position.set(headGround.x, this.head.position.y + KRAKEN_POS.y - 1, headGround.z);
      this.nailObj = d.obj;
      this.win();
      return;
    }
    if (Math.hypot(this.player.pos.x - d.target.x, this.player.pos.z - d.target.z) < 2) this.hurt(1, 'impaled by your own nail');
    ui.log(this.phase === 'exposed' ? 'The nail misses! Aim right under its eye!' : 'CLANG. The nail needs a worthy target. Pin the arms first, so the head comes down.', 'warn');
    d.landedT = 0;
  }

  headGroundPoint() {
    const p = new THREE.Vector3();
    this.eye.getWorldPosition(p);
    return new THREE.Vector3(p.x, 0, p.z);
  }

  expose() {
    this.phase = 'exposed';
    this.exposeT = 10;
    sfx.roar();
    this.player.addShake(1);
    ui.log('KRAKEN 2.0 howls and slumps forward — its great eye hangs over the stone! Switch to the GIANT NAIL (Q / 2) and drop it on its head!', 'good');
    if (this.spell !== 'nail') this.setSpell('nail');
    this.refreshHUD();
  }

  recover() {
    this.phase = 'fight';
    this.recoveries++;
    sfx.roar();
    ui.log('The Kraken recovers and rips two arms free! It\'s getting angrier...', 'warn');
    let freed = 0;
    for (const T of this.tentacles) {
      if (T.state === 'pinned' && freed < 2) {
        freed++;
        const o = T.pinObj; T.pinObj = null;
        this.fx.burst(o.position.clone().setY(1), { count: 16, color: '#ff8040', size: 0.5 });
        this.scene.remove(o);
        T.state = 'retract'; T.timer = 0;
        this.pins--;
      }
    }
    this.setSpell('furniture');
    this.refreshHUD();
  }

  win() {
    this.phase = 'dying';
    this.dieT = 0;
    ui.flash('#ffffff', 0.9, 900);
    sfx.roar();
    ui.log('The giant nail drives home. KRAKEN 2.0 shudders...', 'good');
    unlock('kraken');
    if (this.hitsTaken === 0) unlock('flawless');
    this.tentacles.forEach(T => { T.state = 'limp'; T.timer = 0; if (T.warn) { this.scene.remove(T.warn); T.warn = null; } });
    this.projectiles.forEach(p => { this.scene.remove(p.obj); this.scene.remove(p.marker); });
    this.projectiles = [];
    this.refreshHUD();
  }

  // ------------------------------------------------------------ fireballs
  spitFireball() {
    const from = new THREE.Vector3(); this.eye.getWorldPosition(from); from.y -= 1;
    const to = new THREE.Vector3(this.player.pos.x, 0, this.player.pos.z);
    const obj = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffa030 }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite('#ff6010'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(3, 3, 1); obj.add(glow);
    obj.position.copy(from); this.scene.add(obj);
    const marker = this.marker(to, 1.6, 0xff6020);
    this.projectiles.push({ obj, from, to, t: 0, dur: 1.6, marker });
    sfx.fireball();
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.t += dt;
      const k = Math.min(1, p.t / p.dur);
      p.obj.position.lerpVectors(p.from, p.to, k);
      p.obj.position.y += Math.sin(k * Math.PI) * 8;
      if (Math.random() < 0.5) this.fx.burst(p.obj.position, { count: 1, color: '#ff8030', size: 0.6, life: 0.4, speed: 0.3 });
      if (k >= 1) {
        this.scene.remove(p.obj); this.scene.remove(p.marker);
        this.projectiles.splice(i, 1);
        sfx.thud(1.5);
        this.fx.burst(p.to.clone().setY(0.3), { count: 24, color: '#ff6a20', speed: 5, size: 0.6, life: 0.7 });
        if (Math.hypot(this.player.pos.x - p.to.x, this.player.pos.z - p.to.z) < 1.7) this.hurt(1, 'roasted by a fireball');
      }
    }
  }

  hurt(n, why) {
    if (this.phase === 'dying' || this.phase === 'won') return;
    this.hitsTaken++;
    this.engine.damage(n, why);
  }

  // ------------------------------------------------------------ frame
  update(dt) {
    this.time += dt;
    this.lavaTex.offset.x += dt * 0.01; this.lavaTex.offset.y += dt * 0.006;
    const ep = this.embers.geometry.attributes.position;
    for (let i = 0; i < ep.count; i++) { let y = ep.getY(i) + dt * (0.6 + (i % 7) * 0.15); if (y > 20) y = -1; ep.setY(i, y); }
    ep.needsUpdate = true;
    this.fx.update(dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.nailCooldown = Math.max(0, this.nailCooldown - dt);
    ui.setCooldown(this.spell === 'nail' ? this.nailCooldown / 5 : this.cooldown / 0.9);

    // head motion
    const exposed = this.phase === 'exposed';
    const targetY = exposed ? 4.5 : (this.phase === 'dying' || this.phase === 'won' ? -12 : 5 + Math.sin(this.time * 0.8) * 0.4);
    const targetZ = exposed ? 6.5 : 0;
    const targetTilt = exposed ? 0.5 : 0;
    const k = Math.min(1, dt * (this.phase === 'dying' ? 0.35 : 2));
    this.head.position.y += (targetY - this.head.position.y) * k;
    this.head.position.z += (targetZ - this.head.position.z) * k;
    this.head.rotation.x += (targetTilt - this.head.rotation.x) * k;
    // eyes track the player
    const eyeW = new THREE.Vector3(); this.eye.getWorldPosition(eyeW);
    const look = this.camera.position.clone().sub(eyeW).normalize();
    this.pupils.forEach(p => { p.position.x = look.x * 0.4; p.position.y = look.y * 0.4; });
    this.eyeMat.emissiveIntensity = exposed ? 3 + Math.sin(this.time * 8) : 1.5;
    this.eyeGlow.material.opacity = exposed ? 0.9 : 0.5;
    this.krakenLight.intensity = 50 + Math.sin(this.time * 5) * 10;

    if (this.phase === 'fight' || exposed) {
      this.attackT -= dt;
      const busy = this.tentacles.filter(T => ['windup', 'slam'].includes(T.state)).length;
      if (this.attackT <= 0 && busy < 1 + Math.min(1, this.recoveries)) {
        this.startAttack();
        this.attackT = exposed ? 3.2 : Math.max(1.3, 2.4 - this.recoveries * 0.4 - this.pins * 0.1);
      }
      if (this.recoveries > 0 || this.pins >= 2) {
        this.fireT -= dt;
        if (this.fireT <= 0 && !exposed) { this.spitFireball(); this.fireT = Math.max(3.5, 7 - this.recoveries); }
      }
      if (exposed) {
        this.exposeT -= dt;
        if (this.exposeT <= 0) this.recover();
      }
      this.updateBurn(dt);
    }
    if (this.phase === 'dying') {
      this.dieT += dt;
      this.player.addShake(0.4);
      if (this.nailObj) { this.nailObj.position.y = this.head.position.y + KRAKEN_POS.y - 1; this.nailObj.position.z = KRAKEN_POS.z + this.head.position.z + 4; }
      // lava cools to obsidian
      const c = Math.max(0.18, 1 - this.dieT / 5);
      this.lavaMat.color.setRGB(c, c * 0.9, c);
      if (this.dieT > 5) this.openExit();
    }
    if (this.phase === 'won' && this.exit) {
      this.exit.rotation.z += dt;
      if (Math.hypot(this.player.pos.x - this.exit.position.x, this.player.pos.z - this.exit.position.z) < 1.4 && !this.leaving) {
        this.leaving = true; this.engine.ending();
      }
    }
    this.tentacles.forEach(T => this.updateTentacle(T, dt));
    this.updateDrops(dt);
    this.updateProjectiles(dt);

    // aim ring
    const p = (this.phase === 'fight' || exposed) ? this.aimPoint() : null;
    this.aimRing.visible = !!p;
    if (p) {
      this.aimRing.position.set(p.x, 0.04, p.z);
      const s = this.spell === 'nail' ? 3.4 : 1.4;
      this.aimRing.scale.setScalar(s);
      this.aimRing.material.color.set(this.spell === 'nail' ? 0xffe0a0 : 0xc9a8ff);
    }
    ui.setPrompt(null);
  }

  updateBurn(dt) {
    const sh = this.state.shoes;
    if (sh === 'shoes') { ui.setVignette(''); return; }
    if (sh === 'slippers') {
      this.slipperT += dt;
      if (this.slipperT > 18) { this.state.shoes = 'none'; ui.log('Your slippers melt into a sad puddle.', 'warn'); sfx.sizzle(); this.refreshHUD(); }
      return;
    }
    ui.setVignette('burn');
    this.burnT += dt;
    if (this.burnT > 9) { this.burnT = 0; sfx.sizzle(); this.hurt(1, 'burnt feet'); ui.log('Ow! Hot floor! (Shoes would have helped.)', 'warn'); }
  }

  openExit() {
    this.phase = 'won';
    playAmbience('ending');
    ui.setVignette('');
    const mat = new THREE.MeshBasicMaterial({ map: portal(50, 200), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    this.exit = new THREE.Mesh(new THREE.CircleGeometry(1.6, 40), mat);
    this.exit.position.set(0, 1.7, 2); this.scene.add(this.exit);
    const l = new THREE.PointLight(0xfff0d0, 30, 20, 1.5); l.position.copy(this.exit.position); this.scene.add(l);
    this.fx.burst(this.exit.position, { count: 40, color: '#fff4d0', speed: 4, size: 0.6, life: 1.2 });
    ui.log('KRAKEN 2.0 sinks beneath the cooling lava. A white door opens in the air. Walk through it.', 'good');
    ui.setObjective('Walk through the white door.');
    this.refreshHUD();
  }

  refreshHUD() {
    const s = this.state;
    ui.setHearts(s.hearts, s.maxHearts);
    const inv = [
      `<b>${this.spell === 'furniture' ? '▶' : ''} 1</b> Furniture`,
      `<b>${this.spell === 'nail' ? '▶' : ''} 2</b> Giant Nail`,
      `📌 Pinned <b>${this.pins}/${PINS_NEEDED}</b>`,
    ];
    if (s.shoes !== 'none') inv.push(`👟 <b>${s.shoes}</b>`);
    ui.setInventory(inv);
    if (this.phase === 'fight') ui.setObjective(`Pin ${PINS_NEEDED} arms with falling furniture while they rest on the stone (${this.pins}/${PINS_NEEDED}).`);
    if (this.phase === 'exposed') ui.setObjective('Drop the GIANT NAIL right under its eye!');
    if (this.phase === 'dying') ui.setObjective('...');
  }
}
