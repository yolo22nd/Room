import * as THREE from 'three';
import { glowSprite } from './textures';
import * as ui from './ui';
import { sfx } from './audio';
import { unlock } from './save';

// The cat familiar: follows you around, naps on soft furniture, stares at
// secrets, can be petted, and has opinions.
const CAT_KEY = 'room3d.cat.v1';
export function catAdopted() { try { return !!JSON.parse(localStorage.getItem(CAT_KEY) || 'null'); } catch (e) { return false; } }
export function catSettings(): any { try { return JSON.parse(localStorage.getItem(CAT_KEY) || 'null') || {}; } catch (e) { return {}; } }
export function saveCat(v) { try { localStorage.setItem(CAT_KEY, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }

const PET_LINES = ['Purrrr.', 'The cat leans into your hand and purrs like a tiny engine.', 'The cat allows this. Briefly.', 'The cat headbutts your knee. You have been chosen.', 'Purr. Then a gentle bite. Then more purring.'];
const JUDGE_LINES = ['The cat watches you get hurt. It does not blink.', 'Somewhere behind you, the cat sighs.', 'The cat licks a paw, unimpressed.'];

function catModel() {
  const g = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: 0xb8692a, roughness: 0.95 });
  const pale = new THREE.MeshStandardMaterial({ color: 0xd8c4a4, roughness: 0.95 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.26, 4, 10), fur);
  body.rotation.x = Math.PI / 2; body.position.y = 0.2; g.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), pale); belly.scale.set(0.9, 0.7, 1.6); belly.position.set(0, 0.15, 0); g.add(belly);
  const head = new THREE.Group(); head.position.set(0, 0.32, 0.22); g.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), fur));
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), pale); muzzle.position.set(0, -0.03, 0.08); head.add(muzzle);
  for (const x of [-0.055, 0.055]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.08, 4), fur); ear.position.set(x, 0.09, -0.01); ear.rotation.z = -x * 3; head.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), new THREE.MeshBasicMaterial({ color: 0x9aff6a })); eye.position.set(x * 0.8, 0.02, 0.085); head.add(eye);
  }
  const legs = [];
  for (const [x, z] of [[-0.06, 0.13], [0.06, 0.13], [-0.06, -0.13], [0.06, -0.13]]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.022, 0.14, 6), fur); l.position.set(x, 0.07, z); g.add(l); legs.push(l);
  }
  const tail = new THREE.Group(); tail.position.set(0, 0.24, -0.22); g.add(tail);
  const segs = [];
  let parent: THREE.Object3D = tail;
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Group(); s.position.y = i ? 0.06 : 0; parent.add(s);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.02 - i * 0.002, 0.022 - i * 0.002, 0.065, 6), i === 4 ? pale : fur); m.position.y = 0.03; s.add(m);
    segs.push(s); parent = s;
  }
  tail.rotation.x = -0.9;
  const zzz = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite('#cfe0ff'), transparent: true, opacity: 0, depthWrite: false }));
  zzz.scale.setScalar(0.12); zzz.position.set(0, 0.5, 0.2); g.add(zzz);
  g.traverse((o: any) => { if (o.isMesh) o.castShadow = true; });
  g.userData = { head, legs, segs, body, zzz };
  return g;
}

export class Cat {
  [key: string]: any;
  constructor(engine, level) {
    this.engine = engine; this.level = level;
    this.g = catModel();
    const p = engine.player.pos;
    this.g.position.set(p.x - 0.8, 0, p.z + 0.8);
    level.scene.add(this.g);
    this.state = 'follow'; this.t = 0; this.idleT = 0; this.walkPhase = 0;
    this.noticed = new Set();
    // usable both by the room (owner -> use_cat) and by chambers (userData.use)
    const use = { label: 'Pet the cat', fn: () => this.pet() };
    this.meshes = [];
    this.g.traverse((o: any) => { if (o.isMesh) { o.userData.owner = 'cat'; o.userData.use = use; this.meshes.push(o); } });
    if (level.usables) level.usables.push(...this.meshes);
    this.pets = 0;
  }

  pet() {
    this.pets++;
    sfx.purr();
    this.level.fx && this.level.fx.burst(this.g.position.clone().setY(0.45), { count: 6, color: '#ff8ab0', size: 0.15, speed: 0.6, up: 1 });
    ui.log(PET_LINES[Math.floor(Math.random() * PET_LINES.length)], 'good');
    unlock('petcat');
    if (this.state === 'nap') { this.state = 'follow'; ui.log('The cat wakes up, stretches, and forgives you. Mostly.'); }
  }

  judge() { if (Math.random() < 0.3) ui.log(JUDGE_LINES[Math.floor(Math.random() * JUDGE_LINES.length)], 'lore'); }

  /** Something interesting near the cat: { key, pos, msg } from the level. */
  interest() { return this.level.catInterest ? this.level.catInterest() : null; }

  update(dt) {
    const g = this.g, u = g.userData, pl = this.engine.player;
    this.t += dt;
    const lp = this.lastPos || pl.pos.clone();
    const moving = dt > 0 && Math.hypot(pl.pos.x - lp.x, pl.pos.z - lp.z) / dt > 0.2;
    this.lastPos = pl.pos.clone();
    this.idleT = moving ? 0 : this.idleT + dt;
    // what does the cat want?
    let target = null, speed = 2.6;
    const it = this.interest();
    if (it && !this.noticed.has(it.key) && Math.hypot(it.pos.x - pl.pos.x, it.pos.z - pl.pos.z) < 3.5) {
      target = it.pos; this.state = 'stare';
      if (Math.hypot(it.pos.x - g.position.x, it.pos.z - g.position.z) < 0.9) { this.noticed.add(it.key); ui.log(it.msg, 'lore'); sfx.hiss(); this.state = 'follow'; }
    } else if (this.state === 'nap') {
      if (moving && Math.hypot(pl.pos.x - g.position.x, pl.pos.z - g.position.z) > 4) this.state = 'follow';
    } else if (this.idleT > 8 && this.level.napSpot && this.level.napSpot()) {
      target = this.level.napSpot(); speed = 1.4;
      if (Math.hypot(target.x - g.position.x, target.z - g.position.z) < 0.3) { this.state = 'nap'; g.position.y = target.y || 0; }
    } else {
      // trot along a little behind and to the side of the player
      const yaw = pl.yaw;
      target = new THREE.Vector3(pl.pos.x + Math.sin(yaw) * 0.9 - Math.cos(yaw) * 0.6, 0, pl.pos.z + Math.cos(yaw) * 0.9 + Math.sin(yaw) * 0.6);
      if (Math.hypot(target.x - g.position.x, target.z - g.position.z) < 0.5) target = null;
      if (this.state !== 'stare') this.state = target ? 'follow' : 'sit';
    }
    let walking = false;
    if (target && this.state !== 'nap') {
      const dx = target.x - g.position.x, dz = target.z - g.position.z, d = Math.hypot(dx, dz);
      const far = Math.hypot(pl.pos.x - g.position.x, pl.pos.z - g.position.z);
      // teleport-catch-up if it got stuck far away (cats do that)
      if (far > 9) { g.position.set(pl.pos.x - 0.6, 0, pl.pos.z + 0.6); return; }
      const step = Math.min(d, (far > 3 ? speed * 1.6 : speed) * dt);
      const nx = g.position.x + dx / d * step, nz = g.position.z + dz / d * step;
      const ok = !pl.walkable || pl.walkable(nx, nz, g.position.x, g.position.z) || (target.y || 0) > 0;
      if (ok) { g.position.x = nx; g.position.z = nz; walking = step > 0.001; }
      g.rotation.y += ((Math.atan2(dx, dz) - g.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 8);
      if (this.state !== 'nap' && !(target.y > 0)) g.position.y = 0;
    }
    // animation
    this.walkPhase += dt * (walking ? 14 : 0);
    u.legs.forEach((l, i) => { l.rotation.x = walking ? Math.sin(this.walkPhase + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.6 : 0; });
    const sit = this.state === 'sit' || this.state === 'stare';
    const nap = this.state === 'nap';
    u.body.rotation.x = Math.PI / 2 + (sit ? -0.5 : 0); u.body.position.y = nap ? 0.12 : sit ? 0.22 : 0.2;
    u.head.position.y = nap ? 0.16 : sit ? 0.4 : 0.32;
    u.head.rotation.x = nap ? 0.5 : this.state === 'stare' ? -0.2 : Math.sin(this.t * 0.7) * 0.1;
    u.segs.forEach((s, i) => { s.rotation.z = Math.sin(this.t * (this.state === 'stare' ? 9 : 2.5) - i * 0.6) * (nap ? 0.05 : 0.25); });
    u.zzz.material.opacity = nap ? 0.5 + Math.sin(this.t * 2) * 0.3 : 0;
    u.zzz.position.y = 0.45 + (this.t % 2) * 0.12;
  }

  dispose() { if (this.level.usables) this.level.usables = this.level.usables.filter(m => !this.meshes.includes(m)); this.g.removeFromParent(); }
}
