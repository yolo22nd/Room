import * as THREE from 'three';
import { ChamberLevel } from './chamber';
import { CATALOG, cyl } from './models';
import { glowSprite } from './textures';
import * as ui from './ui';
import { sfx } from './audio';
import { unlock } from './save';

// Co-op: two wizards, one room. The host is authoritative for objects,
// runes, plates and the exit; both sides send their own position.

function wizardModel(color) {
  const g = new THREE.Group();
  const robe = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.5, 14), robe); body.position.y = 0.75; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), new THREE.MeshStandardMaterial({ color: 0xe8cfae })); head.position.y = 1.62; g.add(head);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 14), robe); hat.position.y = 2.05; g.add(hat);
  cyl(0.42, 0.42, 0.03, robe, 0, 1.76, 0, g, 18);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite('#9fe8ff'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(0.5); glow.position.set(0.35, 1.3, 0.3); g.add(glow);
  g.traverse((o: any) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export class CoopLevel extends ChamberLevel {
  constructor(engine, state, peer) {
    super(engine, state, { w: 12, d: 9, cols: 4, rows: 3, fog: 0x0a0810 });
    this.peer = peer;
    this.host = peer.role === 'host';
    this.chapterId = 'coop';
    this.start = this.host ? [-2, 3, 0] : [2, 3, 0];
    this.addExit('n', 'Exit door');
    this.lockedHint = () => this.runes && !this.runes.every(r => r.done) ? 'Match the floor runes first.' : 'Both wizards must stand on the pressure plates at the same time.';
    this.intro = this.host ? 'You are the host. Your partner is the blue wizard.' : 'You joined your partner. They are the orange wizard.';
    this.partner = wizardModel(this.host ? 0x2a5ab0 : 0xb0602a);
    this.partner.position.set(this.host ? 2 : -2, 0, 3);
    this.scene.add(this.partner);
    this.partnerTarget = { x: this.partner.position.x, z: this.partner.position.z, yaw: 0 };
    const hi5 = { label: 'High five!', fn: () => this.highFive() };
    this.partner.traverse((o: any) => { if (o.isMesh) { o.userData.use = hi5; this.usables.push(o); } });
    this.sendT = 0;
    // two pressure plates on opposite sides
    this.plates = [[0, 1], [3, 1]].map(cell => {
      const p = this.cellCenter(cell);
      const plate = cyl(0.9, 0.95, 0.06, new THREE.MeshStandardMaterial({ color: 0x777788, metalness: 0.7, roughness: 0.4, emissive: 0x000000 }), p.x, 0.03, p.z, this.root, 24);
      return { cell, plate, pressed: false };
    });
    this.off = peer.on((m) => this.onMessage(m));
    peer.onClose = () => this.partnerLeft();
    if (this.host) this.setupRunes();
  }

  // ---------------------------------------------------------- setup
  setupRunes() {
    const types = Object.keys(CATALOG).filter(t => CATALOG[t].kind === 'floor' && t !== 'pc').sort(() => Math.random() - 0.5);
    const cells = [[1, 0], [2, 0], [1, 2], [2, 2]].sort(() => Math.random() - 0.5).slice(0, 2);
    this.buildRunes(cells.map((cell, i) => ({ cell, type: types[i] })));
    this.peer.send({ t: 'setup', runes: this.runes.map(r => ({ cell: r.cell, type: r.type })) });
  }
  buildRunes(list) {
    this.runes = list.map(({ cell, type }) => {
      const p = this.cellCenter(cell);
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d');
      g.fillStyle = 'rgba(20,10,40,0.85)'; g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#b58cff'; g.lineWidth = 6; g.stroke();
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '54px serif'; g.fillText(CATALOG[type].icon, 64, 54);
      g.fillStyle = '#e8d8ff'; g.font = 'bold 14px sans-serif'; g.fillText(CATALOG[type].name.toUpperCase(), 64, 100);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.02, p.z); this.root.add(m);
      return { cell, type, done: false };
    });
    this.refreshHUD();
  }

  // ---------------------------------------------------------- network
  onMessage(m) {
    switch (m.t) {
      case 'setup': if (!this.host) this.buildRunes(m.runes); break;
      case 'p': this.partnerTarget = m; break;
      case 'req': if (this.host) {
        const err = this.placementError(m.type, m.cell);
        if (!err) this.conjure(m.type, m.cell);
      } break;
      case 'spawn': if (!this.host) this.applySpawn(m.type, m.cell); break;
      case 'unlock': if (!this.host) this.unlockExit(); break;
      case 'plates': if (!this.host) this.showPlates(m.pressed); break;
      case 'done': this.finish(); break;
      case 'bye': this.partnerLeft(); break;
      case 'hi5': this.theirHi5 = performance.now(); this.checkHi5(); break;
    }
  }

  conjure(type, cell) {
    if (!this.host) { this.peer.send({ t: 'req', type, cell }); sfx.conjure(); return null; }
    const o = super.conjure(type, cell);
    this.peer.send({ t: 'spawn', type, cell });
    return o;
  }
  applySpawn(type, cell) { super.conjure(type, cell); }

  onLanded() {
    if (!this.host || !this.runes) return;
    for (const r of this.runes) { const o = this.objects.get(r.type); r.done = !!o && this.cellKey(o.cell) === this.cellKey(r.cell); }
    this.refreshHUD();
  }

  showPlates(pressed) {
    this.plates.forEach((p, i) => { p.pressed = pressed[i]; p.plate.material.emissive.set(pressed[i] ? 0x2a8a50 : 0x000000); });
    this.refreshHUD();
  }

  highFive() {
    this.myHi5 = performance.now();
    this.peer.send({ t: 'hi5' });
    ui.log('You raise your hand for a high five...');
    this.checkHi5();
  }
  checkHi5() {
    if (this.myHi5 && this.theirHi5 && Math.abs(this.myHi5 - this.theirHi5) < 2000) {
      this.myHi5 = this.theirHi5 = 0;
      sfx.win();
      this.fx.burst(this.partner.position.clone().setY(1.6), { count: 24, color: '#ffe14a', size: 0.4, speed: 3 });
      ui.log('HIGH FIVE! ✋', 'good');
      unlock('highfive');
    } else if (this.theirHi5 && !this.myHi5) ui.log('Your partner wants a high five! (Look at them and use.)', 'lore');
  }

  // ---------------------------------------------------------- frame
  updateChamber(dt) {
    // smooth the partner's avatar toward their last reported position
    const t = this.partnerTarget, a = this.partner;
    a.position.x += (t.x - a.position.x) * Math.min(1, dt * 10);
    a.position.z += (t.z - a.position.z) * Math.min(1, dt * 10);
    a.rotation.y = (t.yaw || 0) + Math.PI;
    this.sendT -= dt;
    if (this.sendT <= 0) {
      this.sendT = 1 / 15;
      this.peer.send({ t: 'p', x: +this.player.pos.x.toFixed(2), z: +this.player.pos.z.toFixed(2), yaw: +this.player.yaw.toFixed(2) });
    }
    if (!this.host) return;
    // plates: each must be held by a different wizard
    const on = (pos, plate) => { const c = this.cellCenter(plate.cell); return Math.hypot(pos.x - c.x, pos.z - c.z) < 1.0; };
    const me = this.player.pos, them = this.partner.position;
    const pressed = this.plates.map(p => on(me, p) || on(them, p));
    const both = (on(me, this.plates[0]) && on(them, this.plates[1])) || (on(me, this.plates[1]) && on(them, this.plates[0]));
    if (pressed.join() !== this.plates.map(p => p.pressed).join()) { this.showPlates(pressed); this.peer.send({ t: 'plates', pressed }); }
    if (both && this.runes && this.runes.every(r => r.done) && this.exit.locked) {
      this.unlockExit();
      this.peer.send({ t: 'unlock' });
      ui.log('Together! The exit is open.', 'good');
    }
  }

  useExit() {
    if (this.exit.locked) { sfx.locked(); ui.log(this.lockedHint(), 'warn'); return; }
    this.peer.send({ t: 'done' });
    this.finish();
  }
  finish() {
    if (this.phase === 'done') return;
    this.phase = 'done';
    this.exit.door.userData.pivot.rotation.y = -1.5;
    sfx.win();
    setTimeout(() => this.engine.coopDone(), 600);
  }
  partnerLeft() {
    if (this.phase !== 'play') return;
    this.phase = 'done';
    ui.log('Your partner disconnected.', 'warn');
    setTimeout(() => this.engine.coopLost(), 800);
  }

  deactivate() {
    super.deactivate();
    if (this.off) this.off();
  }

  objective() {
    if (!this.runes) return 'Waiting for the host...';
    if (!this.runes.every(r => r.done)) return `Together: conjure what each floor rune shows onto it (${this.runes.filter(r => r.done).length}/2).`;
    if (this.exit.locked) return 'Now both stand on the pressure plates at the same time.';
    return 'Through the exit, together!';
  }
  inventory() {
    return [this.host ? '👑 <b>Host</b>' : '🤝 <b>Guest</b>', ...this.plates.map((p, i) => `${p.pressed ? '🟢' : '⚪'} plate ${i + 1}`)];
  }
}
