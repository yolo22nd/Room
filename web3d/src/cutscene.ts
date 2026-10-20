import * as THREE from 'three';
import { speak, stopVoice } from './voice';

/**
 * Letterboxed camera moves. shots: [{ from, to, lookFrom, lookTo, dur, text?, who? }]
 * Positions are Vector3-like arrays. Resolves when finished or skipped.
 */
export class Cutscene {
  [key: string]: any;
  constructor(camera, shots) {
    this.camera = camera; this.shots = shots;
    this.i = 0; this.t = 0; this.done = false;
    this.bars = document.getElementById('letterbox');
    this.cap = document.getElementById('cutscene-cap');
    this.promise = new Promise<void>((r) => { this.resolve = r; });
    this.bars.classList.add('on');
    this.enterShot();
  }
  enterShot() {
    const s = this.shots[this.i];
    this.cap.textContent = s && s.text ? s.text : '';
    this.cap.classList.toggle('show', !!(s && s.text));
    if (s && s.text) speak(s.text, s.who || 'narrator');
  }
  skip() { this.finish(); }
  finish() {
    if (this.done) return;
    this.done = true;
    stopVoice();
    this.bars.classList.remove('on');
    this.cap.classList.remove('show');
    this.resolve();
  }
  update(dt) {
    if (this.done) return;
    const s = this.shots[this.i];
    this.t += dt;
    const k = Math.min(1, this.t / s.dur);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const v = (a, b) => new THREE.Vector3(...a).lerp(new THREE.Vector3(...b), e);
    this.camera.position.copy(v(s.from, s.to));
    this.camera.lookAt(v(s.lookFrom, s.lookTo || s.lookFrom));
    if (k >= 1) {
      this.i++; this.t = 0;
      if (this.i >= this.shots.length) this.finish(); else this.enterShot();
    }
  }
}
