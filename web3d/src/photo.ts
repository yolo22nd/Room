import * as THREE from 'three';
import { input, moveVector } from './input';

// Photo mode: the game freezes, the camera flies freely, and a capture is
// saved with the chosen film filter baked in.
export const FILTERS = {
  none: { name: 'None', css: 'none' },
  noir: { name: 'Noir', css: 'grayscale(1) contrast(1.35) brightness(0.95)' },
  sepia: { name: 'Sepia', css: 'sepia(0.85) contrast(1.1)' },
  dream: { name: 'Dreamy', css: 'saturate(1.4) brightness(1.15) blur(0.6px) hue-rotate(-12deg)' },
  hell: { name: 'Hellfire', css: 'saturate(1.8) contrast(1.2) hue-rotate(-18deg) brightness(1.05)' },
  vapor: { name: 'Vapor', css: 'hue-rotate(160deg) saturate(1.6) contrast(1.05)' },
  mono: { name: 'Ink', css: 'grayscale(1) contrast(2.2) brightness(1.1)' },
};

export class PhotoMode {
  [key: string]: any;
  constructor(engine, canvas, panel) {
    this.engine = engine; this.canvas = canvas; this.panel = panel;
    this.active = false;
    this.filter = 'none';
    this.yaw = 0; this.pitch = 0; this.pos = new THREE.Vector3();
    this.pending = null;
  }

  enter() {
    const cam = this.engine.camera;
    this.active = true;
    this.pos.copy(cam.position);
    const e = new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ');
    this.yaw = e.y; this.pitch = e.x;
    this.fov0 = cam.fov;
    this.parent = cam.parent;
    // detach so the held lantern doesn't block the shot
    this.hidden = cam.children.filter(c => c.visible);
    this.hidden.forEach(c => { c.visible = false; });
    this.render();
    this.panel.classList.remove('hidden');
    document.getElementById('hud').classList.add('photo');
  }

  exit() {
    const cam = this.engine.camera;
    this.active = false;
    cam.fov = this.fov0; cam.updateProjectionMatrix();
    this.hidden.forEach(c => { c.visible = true; });
    this.canvas.style.filter = '';
    this.panel.classList.add('hidden');
    document.getElementById('hud').classList.remove('photo');
  }

  setFilter(f) { this.filter = f; this.canvas.style.filter = FILTERS[f].css === 'none' ? '' : FILTERS[f].css; this.render(); }

  render() {
    const p = this.panel;
    p.querySelectorAll('[data-f]').forEach(b => b.classList.toggle('on', b.dataset.f === this.filter));
    const r = p.querySelector('#ph-fov'); if (r) r.value = this.engine.camera.fov;
  }

  update(dt) {
    const cam = this.engine.camera;
    const s = 0.0022 * (this.engine.player.sensitivity || 1);
    this.yaw -= input.lookDX * s; this.pitch -= input.lookDY * s;
    this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch));
    input.lookDX = input.lookDY = 0;
    const mv = moveVector();
    const speed = (mv.run ? 6 : 2.5) * dt;
    const f = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    const r = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, this.yaw, 0, 'YXZ'));
    this.pos.addScaledVector(f, mv.y * speed).addScaledVector(r, mv.x * speed);
    if (input.keys.has('KeyE') || input.keys.has('PageUp')) this.pos.y += speed;
    if (input.keys.has('KeyQ') || input.keys.has('PageDown')) this.pos.y -= speed;
    this.pos.y = Math.max(0.15, this.pos.y);
    cam.position.copy(this.pos);
    cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  setFov(v) { const cam = this.engine.camera; cam.fov = v; cam.updateProjectionMatrix(); }

  /** Call right after the frame is rendered, while the drawing buffer is valid. */
  captureNow() {
    const src = this.canvas;
    const out = document.createElement('canvas');
    out.width = src.width; out.height = src.height;
    const g = out.getContext('2d');
    g.filter = FILTERS[this.filter].css;
    g.drawImage(src, 0, 0);
    g.filter = 'none';
    // a small watermark
    g.font = `${Math.round(out.height * 0.03)}px Georgia, serif`;
    g.fillStyle = 'rgba(255,220,180,0.75)'; g.textAlign = 'right';
    g.fillText('ROOM', out.width - out.height * 0.03, out.height - out.height * 0.03);
    return out.toDataURL('image/png');
  }
}
