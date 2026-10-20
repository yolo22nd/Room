import * as THREE from 'three';

// Thin wrapper around Rapier. The engine (~2 MB with its wasm) is loaded
// lazily the first time a level needs physics.

let RAPIER = null;
let loading = null;
export function loadPhysics() {
  if (RAPIER) return Promise.resolve(RAPIER);
  if (!loading) {
    loading = import('@dimforge/rapier3d-compat').then(async (m) => {
      const R = m.default || m;
      await R.init();
      RAPIER = R;
      return R;
    });
  }
  return loading;
}
export const physicsReady = () => !!RAPIER;

const STEP = 1 / 60;
const _q = new THREE.Quaternion();

export class PhysicsWorld {
  constructor(gravity = -20) {
    const R = RAPIER;
    this.R = R;
    this.world = new R.World({ x: 0, y: gravity, z: 0 });
    this.items = [];          // { body, mesh, ... }
    this.acc = 0;
  }

  addStaticBox(cx, cy, cz, hx, hy, hz) {
    const R = this.R;
    const body = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(cx, cy, cz));
    this.world.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setFriction(0.8), body);
    return body;
  }

  addStaticCylinder(cx, cy, cz, halfHeight, radius) {
    const R = this.R;
    const body = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(cx, cy, cz));
    this.world.createCollider(R.ColliderDesc.cylinder(halfHeight, radius).setFriction(0.9), body);
    return body;
  }

  /** shape: { box: [hx,hy,hz] } | { ball: r }. The mesh is synced to the body each step. */
  addDynamic(mesh, shape, { mass = 1, restitution = 0.25, friction = 0.6, velocity = null, spin = null, ccd = false } = {}) {
    const R = this.R;
    const desc = R.RigidBodyDesc.dynamic()
      .setTranslation(mesh.position.x, mesh.position.y, mesh.position.z)
      .setRotation({ x: mesh.quaternion.x, y: mesh.quaternion.y, z: mesh.quaternion.z, w: mesh.quaternion.w })
      .setLinearDamping(0.15).setAngularDamping(0.3)
      .setCcdEnabled(ccd);
    const body = this.world.createRigidBody(desc);
    const cd = shape.ball ? R.ColliderDesc.ball(shape.ball) : R.ColliderDesc.cuboid(...shape.box);
    cd.setRestitution(restitution).setFriction(friction).setMass(mass);
    if (shape.offset) cd.setTranslation(...shape.offset);
    this.world.createCollider(cd, body);
    if (velocity) body.setLinvel(velocity, true);
    if (spin) body.setAngvel(spin, true);
    const item = { body, mesh, prevVy: 0, impact: 0 };
    this.items.push(item);
    return item;
  }

  addKinematicBall(r) {
    const R = this.R;
    const body = this.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased());
    this.world.createCollider(R.ColliderDesc.ball(r), body);
    return body;
  }

  remove(item) {
    const i = this.items.indexOf(item);
    if (i >= 0) this.items.splice(i, 1);
    this.world.removeRigidBody(item.body);
  }
  removeBody(body) { this.world.removeRigidBody(body); }

  impulseAt(p, radius, strength) {
    for (const it of this.items) {
      const t = it.body.translation();
      const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
      if (d > radius) continue;
      const k = strength * (1 - d / radius) * it.body.mass();
      it.body.applyImpulse({ x: (dx / (d || 1)) * k, y: k * 0.9, z: (dz / (d || 1)) * k }, true);
      it.body.applyTorqueImpulse({ x: (Math.random() - 0.5) * k * 0.3, y: (Math.random() - 0.5) * k * 0.3, z: (Math.random() - 0.5) * k * 0.3 }, true);
    }
  }

  /** Steps at a fixed rate; returns items whose fall was just stopped hard (impacts). */
  step(dt) {
    this.acc = Math.min(this.acc + dt, STEP * 5);
    const impacts = [];
    while (this.acc >= STEP) {
      this.world.step();
      this.acc -= STEP;
      for (const it of this.items) {
        const vy = it.body.linvel().y;
        if (it.prevVy < -2.5 && vy > it.prevVy + 2) impacts.push({ item: it, speed: -it.prevVy });
        it.prevVy = vy;
      }
    }
    for (const it of this.items) {
      const t = it.body.translation(), r = it.body.rotation();
      it.mesh.position.set(t.x, t.y, t.z);
      it.mesh.quaternion.copy(_q.set(r.x, r.y, r.z, r.w));
    }
    return impacts;
  }

  dispose() { this.world.free(); this.items = []; }
}
