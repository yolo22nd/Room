import * as THREE from 'three';
import { input, moveVector } from './input';
import { sfx } from './audio';
import { A11Y } from './a11y';

export const RADIUS = 0.3;
const EYE = 1.62;

export class Player {
  [key: string]: any;
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3(0, 0, 0);
    this.yaw = 0; this.pitch = 0;
    this.height = EYE; this.targetHeight = EYE;
    this.sitting = null;          // name of what we sit on, or null
    this.walkable = () => true;   // (x, z) => bool, supplied by the active level
    this.canMove = () => true;    // returns true, or a string explaining why not
    this.onBlocked = null;
    this.speed = 3.0;
    this.sensitivity = 1; this.invertY = false;
    this.bob = 0; this.stepTimer = 0;
    this.shake = 0;
    this.moving = false;
    this.shrunk = 0;
  }

  place(x, z, yaw = this.yaw) { this.pos.set(x, 0, z); this.yaw = yaw; this.pitch = 0; this.stand(true); }

  eye() { return this.shrunk > 0 ? 0.45 : EYE; }

  sit(what, height = 1.05) { this.sitting = what; this.targetHeight = height; }
  lie() { this.sitting = 'lying'; this.targetHeight = 0.7; }
  stand(instant = false) {
    this.sitting = null; this.targetHeight = this.eye();
    if (instant) this.height = this.targetHeight;
  }

  addShake(a) { if (!A11Y.reducedMotion) this.shake = Math.max(this.shake, a); }

  forward() { return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }

  update(dt) {
    // look
    if (input.enabled) {
      const s = 0.0022 * this.sensitivity;
      this.yaw -= input.lookDX * s;
      this.pitch -= input.lookDY * s * (this.invertY ? -1 : 1);
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    }
    input.lookDX = 0; input.lookDY = 0;

    // move
    const mv = input.enabled ? moveVector() : { x: 0, y: 0, run: false };
    this.moving = false;
    if (mv.x || mv.y) {
      if (this.sitting) { this.stand(); }
      const why = this.canMove();
      if (why !== true) {
        if (this.onBlocked) this.onBlocked(why);
      } else {
        const speed = this.speed * (mv.run ? 1.6 : 1) * (this.shrunk > 0 ? 0.75 : 1);
        const f = this.forward();
        const r = new THREE.Vector3(-f.z, 0, f.x);
        const d = f.multiplyScalar(mv.y).add(r.multiplyScalar(mv.x)).multiplyScalar(speed * dt);
        this.tryMove(d.x, d.z);
        this.moving = true;
        this.bob += dt * speed * 2.6;
        this.stepTimer -= dt * speed;
        if (this.stepTimer <= 0) { sfx.step(); this.stepTimer = 1.6; }
      }
    }

    if (this.shrunk > 0) {
      this.shrunk = Math.max(0, this.shrunk - dt);
      if (!this.sitting) this.targetHeight = this.eye();
      if (this.shrunk === 0 && this.onGrow) this.onGrow();
    }
    this.height += (this.targetHeight - this.height) * Math.min(1, dt * 6);
    const bobY = this.moving && !A11Y.reducedMotion ? Math.sin(this.bob) * 0.04 : 0;
    this.shake = Math.max(0, this.shake - dt * 1.8);
    const sh = this.shake * this.shake;
    this.camera.position.set(
      this.pos.x + (Math.random() - 0.5) * sh * 0.3,
      this.pos.y + this.height + bobY + (Math.random() - 0.5) * sh * 0.3,
      this.pos.z + (Math.random() - 0.5) * sh * 0.3,
    );
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  tryMove(dx, dz) {
    const x = this.pos.x, z = this.pos.z;
    if (this.walkable(x + dx, z + dz, x, z)) { this.pos.x += dx; this.pos.z += dz; return; }
    if (this.walkable(x + dx, z, x, z)) { this.pos.x += dx; return; }
    if (this.walkable(x, z + dz, x, z)) { this.pos.z += dz; }
  }
}
