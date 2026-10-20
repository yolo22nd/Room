import * as THREE from 'three';
import { glowSprite } from './textures.js';

// Tiny particle/debris manager shared by the levels.
export class FX {
  constructor(scene) { this.scene = scene; this.items = []; }

  burst(pos, { count = 16, color = '#ffffff', speed = 2, life = 0.8, size = 0.25, gravity = 0, up = 0.5, additive = true, spread = 1 } = {}) {
    const tex = glowSprite(color);
    for (let i = 0; i < count; i++) {
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
      const s = new THREE.Sprite(m);
      s.position.copy(pos);
      s.scale.setScalar(size * (0.6 + Math.random() * 0.8));
      const a = Math.random() * Math.PI * 2;
      const v = new THREE.Vector3(Math.cos(a) * spread, up + Math.random() * up, Math.sin(a) * spread).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.6));
      this.scene.add(s);
      this.items.push({ obj: s, vel: v, life, max: life, gravity, sprite: true, size: s.scale.x });
    }
  }

  // Dust ring when something lands.
  dust(pos, radius = 1) {
    this.burst(new THREE.Vector3(pos.x, 0.1, pos.z), { count: 22, color: '#9c8a78', speed: 2.2 * radius, life: 0.9, size: 0.6 * radius, up: 0.05, additive: false });
  }

  debris(pos, { count = 14, color = 0xd6cfbd, size = 0.08, speed = 4 } = {}) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(size * (0.5 + Math.random()), size * (0.5 + Math.random()), size * (0.5 + Math.random())), mat);
      m.position.copy(pos); m.castShadow = true;
      const v = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5 + 0.5, (Math.random() - 0.5) * 2).multiplyScalar(speed * 0.6);
      this.scene.add(m);
      this.items.push({ obj: m, vel: v, life: 2.5, max: 2.5, gravity: 12, spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8), floor: true });
    }
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life -= dt;
      p.vel.y -= p.gravity * dt;
      p.obj.position.addScaledVector(p.vel, dt);
      if (p.floor && p.obj.position.y < 0.04) { p.obj.position.y = 0.04; p.vel.multiplyScalar(0.5); p.vel.y = Math.abs(p.vel.y) * 0.3; }
      if (p.spin) { p.obj.rotation.x += p.spin.x * dt; p.obj.rotation.y += p.spin.y * dt; if (p.floor && p.obj.position.y <= 0.05) p.spin.multiplyScalar(0.9); }
      if (p.sprite) {
        const k = p.life / p.max;
        p.obj.material.opacity = Math.max(0, k);
        p.obj.scale.setScalar(p.size * (1.6 - k * 0.6));
        p.vel.multiplyScalar(1 - dt * 1.5);
      }
      if (p.life <= 0) {
        this.scene.remove(p.obj);
        if (p.sprite) p.obj.material.dispose(); else p.obj.geometry.dispose();
        this.items.splice(i, 1);
      }
    }
  }

  clear() { this.items.forEach(p => this.scene.remove(p.obj)); this.items = []; }
}
