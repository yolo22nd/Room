import * as THREE from 'three';
import { woodFloor, wallpaper, plaster, tiles, brick, portal, glowSprite } from './textures';
import { box, cyl, materials as M } from './models';
import { screenCanvas } from './textures';

export const CELL = 3;
export const HALF = 4.5;
export const WALL_T = 0.2;
export const WALL_H = 3.2;
export const GAP_W = 1.5;
export const GAP_H = 2.45;
export const ANNEX_W = 6;
export const ANNEX_D = 4.6;

export const CELLS = ['nw', 'n', 'ne', 'w', 'm', 'e', 'sw', 's', 'se'];
export const SIDES = ['n', 'e', 's', 'w'];
export const SIDE_NAMES = { n: 'north', e: 'east', s: 'south', w: 'west' };
export const CELL_NAMES = { nw: 'north-west', n: 'north', ne: 'north-east', w: 'west', m: 'middle', e: 'east', sw: 'south-west', s: 'south', se: 'south-east' };
const SIDE_ROT = { n: 0, s: Math.PI, w: Math.PI / 2, e: -Math.PI / 2 };

export function cellCenter(cell) {
  const col = cell.includes('w') ? -1 : cell.includes('e') ? 1 : 0;
  const row = cell.startsWith('n') ? -1 : cell.startsWith('s') ? 1 : 0;
  return new THREE.Vector3(col * CELL, 0, row * CELL);
}
export function cellAt(x, z) {
  if (Math.abs(x) > HALF || Math.abs(z) > HALF) return null;
  const col = x < -1.5 ? 'w' : x > 1.5 ? 'e' : '';
  const row = z < -1.5 ? 'n' : z > 1.5 ? 's' : '';
  return (row + col) || 'm';
}
/** Matrix mapping a side's local frame (local +z points into the room, origin at wall centre on the floor) to world. */
export function sideMatrix(side) {
  const o = new THREE.Object3D();
  o.rotation.y = SIDE_ROT[side];
  const d = { n: [0, -HALF], s: [0, HALF], w: [-HALF, 0], e: [HALF, 0] }[side];
  o.position.set(d[0], 0, d[1]);
  o.updateMatrix();
  return o.matrix.clone();
}
export function sideRot(side) { return SIDE_ROT[side]; }

function localRectToWorld(side, x0, x1, z0, z1) {
  const m = sideMatrix(side);
  const pts = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].map(([x, z]) => new THREE.Vector3(x, 0, z).applyMatrix4(m));
  return {
    minX: Math.min(...pts.map(p => p.x)), maxX: Math.max(...pts.map(p => p.x)),
    minZ: Math.min(...pts.map(p => p.z)), maxZ: Math.max(...pts.map(p => p.z)),
  };
}

// Box with UVs scaled to world size so textures tile at a constant density.
function tiledBox(w, h, d, mat, density = 0.5) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    uv.setXY(i, uv.getX(i) * dims[f][0] * density, uv.getY(i) * dims[f][1] * density);
  }
  const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.castShadow = true;
  return m;
}
function repeatTex(t) { const c = t.clone(); c.repeat.set(1, 1); c.needsUpdate = true; return c; }

export class Room {
  [key: string]: any;
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group(); scene.add(this.group);
    this.plugs = {};
    this.annexes = {};
    const wp = repeatTex(wallpaper());
    this.wallMat = new THREE.MeshStandardMaterial({ map: wp, bumpMap: wp, bumpScale: 0.8, roughness: 0.9 });
    this.build();
  }

  build() {
    const g = this.group;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, HALF * 2), new THREE.MeshStandardMaterial({ map: woodFloor(), bumpMap: woodFloor(), bumpScale: 1.5, roughness: 0.75 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.userData.floor = true; g.add(floor);
    this.floor = floor;
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 0.4, HALF * 2 + 0.4), new THREE.MeshStandardMaterial({ map: plaster(), roughness: 1 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = WALL_H; g.add(ceil);
    // ceiling beams
    for (const x of [-1.5, 1.5]) { const b = box(0.25, 0.25, HALF * 2, M.darkWood, x, WALL_H - 0.125, 0, g); b.castShadow = false; }

    const segW = HALF + WALL_T - GAP_W / 2;
    for (const side of SIDES) {
      const wall = new THREE.Group();
      wall.applyMatrix4(sideMatrix(side));
      const z = -WALL_T / 2;
      const left = tiledBox(segW, WALL_H, WALL_T, this.wallMat); left.position.set(-(GAP_W / 2 + segW / 2), WALL_H / 2, z); wall.add(left);
      const right = tiledBox(segW, WALL_H, WALL_T, this.wallMat); right.position.set(GAP_W / 2 + segW / 2, WALL_H / 2, z); wall.add(right);
      const lintel = tiledBox(GAP_W, WALL_H - GAP_H, WALL_T, this.wallMat); lintel.position.set(0, GAP_H + (WALL_H - GAP_H) / 2, z); wall.add(lintel);
      const plug = tiledBox(GAP_W, GAP_H, WALL_T, this.wallMat); plug.position.set(0, GAP_H / 2, z); wall.add(plug);
      this.plugs[side] = plug;
      // baseboard + crown
      const bb = box(HALF * 2, 0.14, 0.04, M.darkWood, 0, 0.07, 0.02, wall); bb.castShadow = false;
      const cr = box(HALF * 2, 0.08, 0.06, M.darkWood, 0, WALL_H - 0.04, 0.03, wall); cr.castShadow = false;
      g.add(wall);
    }

    this.buildDecor();

    // drifting dust motes
    const n = matchMedia('(pointer: coarse)').matches ? 120 : 260, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 9; pos[i * 3 + 1] = Math.random() * 3; pos[i * 3 + 2] = (Math.random() - 0.5) * 9; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.04, map: glowSprite('#ffe0b0'), color: 0xffe0b0, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    g.add(this.dust);
  }

  buildDecor() {
    const g = this.group;
    // rug in the middle
    const rc = screenCanvas(256, 256); const r = rc.ctx;
    r.fillStyle = '#4a1420'; r.fillRect(0, 0, 256, 256);
    r.strokeStyle = '#c9963c'; r.lineWidth = 6; r.strokeRect(12, 12, 232, 232);
    r.lineWidth = 2; r.strokeRect(24, 24, 208, 208);
    r.fillStyle = '#2a0c14'; r.fillRect(40, 40, 176, 176);
    r.strokeStyle = '#d4a85a'; r.lineWidth = 3;
    for (let i = 0; i < 4; i++) { r.beginPath(); r.arc(128, 128, 20 + i * 18, 0, Math.PI * 2); r.stroke(); }
    for (let a = 0; a < 8; a++) { r.save(); r.translate(128, 128); r.rotate(a * Math.PI / 4); r.fillStyle = '#8a2a3a'; r.beginPath(); r.moveTo(0, 30); r.lineTo(10, 80); r.lineTo(0, 88); r.lineTo(-10, 80); r.fill(); r.restore(); }
    for (let i = 0; i < 2000; i++) { r.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`; r.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
    rc.tex.needsUpdate = true;
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.4), new THREE.MeshStandardMaterial({ map: rc.tex, roughness: 1 }));
    rug.rotation.x = -Math.PI / 2; rug.position.y = 0.005; rug.receiveShadow = true; g.add(rug);

    // two paintings: a stormy landscape, and the witch, whose eyes follow you
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x8a6420, roughness: 0.35, metalness: 0.8 });
    const paint = (draw, w, h) => {
      const c = screenCanvas(192, Math.round(192 * h / w)); draw(c.ctx, 192, Math.round(192 * h / w)); c.tex.needsUpdate = true;
      const grp = new THREE.Group();
      box(w + 0.12, h + 0.12, 0.05, frameMat, 0, 0, 0, grp).castShadow = false;
      const canvasMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: c.tex, roughness: 0.8 }));
      canvasMesh.position.z = 0.03; grp.add(canvasMesh);
      return grp;
    };
    const land = paint((c, W, H) => {
      const sky = c.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#1b2440'); sky.addColorStop(1, '#6a4a5a');
      c.fillStyle = sky; c.fillRect(0, 0, W, H);
      c.fillStyle = '#20141a'; c.beginPath(); c.moveTo(0, H); c.lineTo(0, H * 0.6); c.lineTo(W * 0.3, H * 0.45); c.lineTo(W * 0.55, H * 0.62); c.lineTo(W * 0.8, H * 0.4); c.lineTo(W, H * 0.55); c.lineTo(W, H); c.fill();
      c.fillStyle = '#f0e0a0'; c.beginPath(); c.arc(W * 0.75, H * 0.2, 10, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ff7a3c'; c.fillRect(W * 0.28, H * 0.5, 3, 4);
    }, 1.2, 0.8);
    const s1 = new THREE.Group(); s1.applyMatrix4(sideMatrix('n')); land.position.set(-2.9, 1.75, 0.03); s1.add(land); g.add(s1);
    const witch = paint((c, W, H) => {
      c.fillStyle = '#1c0c1a'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#e6cfae'; c.beginPath(); c.ellipse(W / 2, H * 0.58, W * 0.24, H * 0.24, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#120612'; c.beginPath(); c.moveTo(W / 2, H * 0.02); c.lineTo(W * 0.2, H * 0.42); c.lineTo(W * 0.8, H * 0.42); c.fill();
      c.fillRect(W * 0.08, H * 0.4, W * 0.84, H * 0.05);
      c.fillStyle = '#5a1a2a'; c.fillRect(W * 0.43, H * 0.72, W * 0.14, H * 0.025);
      c.fillStyle = '#3a1a4a'; c.fillRect(0, H * 0.86, W, H * 0.14);
    }, 0.9, 1.2);
    const s2 = new THREE.Group(); s2.applyMatrix4(sideMatrix('s')); witch.position.set(2.9, 1.75, 0.03); s2.add(witch); g.add(s2);
    // eyes: painted sockets with real eyeballs that track the camera
    this.paintEyes = [];
    const white = new THREE.MeshStandardMaterial({ color: 0xf4efe0, roughness: 0.3 });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x103010 });
    this.pupilMat = pupilMat;
    this.portrait = witch;
    for (const ex of [-0.1, 0.1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), white);
      eye.position.set(ex, -0.02, 0.04); witch.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), pupilMat); pupil.position.z = 0.03; eye.add(pupil);
      this.paintEyes.push(eye);
    }
  }

  setPlug(side, visible) { this.plugs[side].visible = visible; }

  // ---------- annexes (rooms beyond the walls) ----------
  addAnnex(type, side) {
    this.removeAnnex(side);
    const a = new THREE.Group();
    a.applyMatrix4(sideMatrix(side));
    const z0 = -WALL_T, z1 = -WALL_T - ANNEX_D, cz = (z0 + z1) / 2;
    const look = {
      bathroom: { floor: tiles('#d8e4e8'), wall: tiles('#b9d3dc'), light: 0xcfe8ff, power: 6 },
      kitchen: { floor: tiles('#c9b48a'), wall: brick(), light: 0xffc890, power: 6 },
      hell: { floor: null, wall: brick(), light: 0xff3010, power: 18 },
    }[type];
    const floorMat = look.floor ? new THREE.MeshStandardMaterial({ map: repeatTex(look.floor), roughness: 0.4 }) : new THREE.MeshStandardMaterial({ color: 0x1a0805, roughness: 1, emissive: 0x200400 });
    const wallMat = new THREE.MeshStandardMaterial({ map: repeatTex(look.wall), roughness: 0.8, color: type === 'hell' ? 0x884444 : 0xffffff });
    const fl = tiledBox(ANNEX_W, 0.1, ANNEX_D - z0, floorMat, 0.8); fl.position.set(0, -0.051, (z1 + 0) / 2); a.add(fl);
    const ce = tiledBox(ANNEX_W, 0.1, ANNEX_D, wallMat); ce.position.set(0, WALL_H + 0.05, cz); a.add(ce);
    const back = tiledBox(ANNEX_W, WALL_H, 0.2, wallMat, 0.7); back.position.set(0, WALL_H / 2, z1 - 0.1); a.add(back);
    for (const sx of [-1, 1]) { const sw = tiledBox(0.2, WALL_H, ANNEX_D, wallMat, 0.7); sw.position.set(sx * (ANNEX_W / 2 + 0.1), WALL_H / 2, cz); a.add(sw); }
    // facing panels on the annex side of the shared wall, around the gap
    const pw = (ANNEX_W - GAP_W) / 2;
    for (const sx of [-1, 1]) { const p = tiledBox(pw, WALL_H, 0.02, wallMat, 0.7); p.position.set(sx * (GAP_W / 2 + pw / 2), WALL_H / 2, z0 - 0.01); a.add(p); }
    const top = tiledBox(GAP_W, WALL_H - GAP_H, 0.02, wallMat, 0.7); top.position.set(0, GAP_H + (WALL_H - GAP_H) / 2, z0 - 0.01); a.add(top);

    const light = new THREE.PointLight(look.light, look.power, 9, 1.6);
    light.position.set(0, WALL_H - 0.4, cz); a.add(light);
    const info: any = { type, side, group: a, light, interactives: [], obstacles: [], z0, z1, cz };
    const addObs = (x0, x1, za, zb) => info.obstacles.push(localRectToWorld(side, x0, x1, za, zb));

    if (type === 'bathroom') {
      // toilet
      const t = new THREE.Group(); t.position.set(-2.2, 0, z1 + 0.6); a.add(t);
      cyl(0.22, 0.18, 0.4, M.porcelain, 0, 0.2, 0, t); cyl(0.25, 0.25, 0.06, M.porcelain, 0, 0.42, 0, t);
      box(0.5, 0.45, 0.2, M.porcelain, 0, 0.62, -0.3, t);
      addObs(-2.55, -1.85, z1, z1 + 1.0);
      // sink with tap
      const s = new THREE.Group(); s.position.set(-0.3, 0, z1 + 0.35); a.add(s);
      cyl(0.08, 0.12, 0.8, M.porcelain, 0, 0.4, 0, s);
      const basin = box(0.7, 0.14, 0.45, M.porcelain, 0, 0.85, 0.05, s);
      const tap = new THREE.Group(); tap.position.set(0, 0.95, -0.12); s.add(tap);
      cyl(0.02, 0.02, 0.18, M.metal, 0, 0.09, 0, tap, 8);
      const spout = box(0.03, 0.03, 0.14, M.metal, 0, 0.17, 0.07, tap);
      const handle = box(0.12, 0.02, 0.02, M.metal, 0, 0.2, 0, tap);
      const water = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.22, 6), new THREE.MeshStandardMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.7, emissive: 0x204060 }));
      water.position.set(0, 0.06, 0.13); water.visible = false; tap.add(water);
      const mirror = box(0.6, 0.8, 0.02, M.mirror, 0, 1.6, -0.22, s);
      for (const m of [basin, spout, handle, water, mirror]) m.userData.owner = 'tap';
      tap.traverse((o: any) => { if (o.isMesh) o.userData.owner = 'tap'; });
      info.interactives.push(basin, spout, handle, mirror);
      info.water = water;
      addObs(-0.7, 0.1, z1, z1 + 0.65);
      // shower corner
      const sh = new THREE.Group(); sh.position.set(2.1, 0, z1 + 0.9); a.add(sh);
      const tray = box(1.5, 0.08, 1.5, M.porcelain, 0, 0.04, 0, sh); tray.userData.owner = 'shower';
      const glass = box(0.02, 2.1, 1.5, M.glass, -0.75, 1.1, 0, sh); glass.castShadow = false; glass.userData.owner = 'shower';
      cyl(0.02, 0.02, 2.2, M.metal, 0.55, 1.1, -0.6, sh, 8);
      const head = cyl(0.12, 0.06, 0.06, M.metal, 0.4, 2.2, -0.5, sh); head.userData.owner = 'shower';
      info.interactives.push(tray, glass, head);
      const drops = new THREE.Group(); drops.visible = false; sh.add(drops);
      for (let i = 0; i < 40; i++) {
        const d = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.12, 0.01), new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.6 }));
        d.position.set(0.4 + (Math.random() - 0.5) * 0.5, Math.random() * 2.1, -0.5 + (Math.random() - 0.5) * 0.5); drops.add(d);
      }
      info.drops = drops;
    } else if (type === 'kitchen') {
      const counter = new THREE.Group(); counter.position.set(0, 0, z1 + 0.4); a.add(counter);
      box(5.4, 0.9, 0.7, M.lightWood, 0, 0.45, 0, counter);
      box(5.5, 0.05, 0.75, M.stone, 0, 0.92, 0, counter);
      // stove + cauldron
      const stove = box(0.9, 0.06, 0.6, M.black, 0, 0.97, 0, counter); stove.userData.owner = 'stove';
      const pot = cyl(0.3, 0.24, 0.35, M.black, 0, 1.17, 0, counter); pot.userData.owner = 'stove';
      const stew = new THREE.Mesh(new THREE.CircleGeometry(0.27, 20), new THREE.MeshStandardMaterial({ color: 0xff5a20, emissive: 0xc02800, emissiveIntensity: 1.2 }));
      stew.rotation.x = -Math.PI / 2; stew.position.set(0, 1.3, 0); stew.userData.owner = 'stove'; counter.add(stew);
      info.stew = stew;
      info.interactives.push(stove, pot, stew);
      // knife block (look, don't touch)
      const kb = box(0.2, 0.3, 0.15, M.darkWood, 1.6, 1.1, 0, counter);
      for (let i = 0; i < 4; i++) box(0.015, 0.15, 0.06, M.metal, 1.55 + i * 0.035, 1.32, 0, counter);
      kb.userData.owner = 'knives'; info.interactives.push(kb);
      // fridge
      const fr = box(0.9, 2.0, 0.8, M.porcelain, 2.4, 1.0, cz + 0.6, a); fr.userData.owner = 'fridge'; info.interactives.push(fr);
      addObs(-2.8, 2.8, z1, z1 + 0.8);
      addObs(1.9, 2.9, cz + 0.2, cz + 1.0);
    } else if (type === 'hell') {
      // lava cracks floor + a swirling portal
      const lavaMat = new THREE.MeshBasicMaterial({ map: repeatTex(portal(20, 0)), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      const p = new THREE.Mesh(new THREE.CircleGeometry(1.4, 40), lavaMat);
      p.position.set(0, 1.5, z1 + 0.4); a.add(p);
      p.userData.owner = 'portal';
      const ringM = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.08, 10, 40), new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff3000, emissiveIntensity: 2 }));
      ringM.position.copy(p.position); a.add(ringM);
      info.portal = p; info.interactives.push(p);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite('#ff4010'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.set(5, 5, 1); glow.position.copy(p.position); a.add(glow);
      // embers
      const n = 80, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 5.6; pos[i * 3 + 1] = Math.random() * 3; pos[i * 3 + 2] = z1 + Math.random() * ANNEX_D; }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const embers = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.12, map: glowSprite('#ff8030'), color: 0xff8030, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      a.add(embers); info.embers = embers;
      info.portalWorld = new THREE.Vector3(0, 0, z1 + 0.6).applyMatrix4(sideMatrix(side));
    }
    info.rect = localRectToWorld(side, -ANNEX_W / 2, ANNEX_W / 2, z1, z0);
    info.gapRect = localRectToWorld(side, -GAP_W / 2, GAP_W / 2, z0 - 0.7, 0.7);
    this.group.add(a);
    this.annexes[side] = info;
    return info;
  }

  removeAnnex(side) {
    const info = this.annexes[side];
    if (!info) return;
    this.group.remove(info.group);
    info.group.traverse((o: any) => { if (o.geometry) o.geometry.dispose(); });
    delete this.annexes[side];
  }

  annexAt(x, z) {
    for (const s of SIDES) {
      const a = this.annexes[s];
      if (a && x >= a.rect.minX && x <= a.rect.maxX && z >= a.rect.minZ && z <= a.rect.maxZ) return a;
    }
    return null;
  }

  update(dt, t, camPos) {
    if (camPos && this.paintEyes) {
      const w = new THREE.Vector3();
      for (const e of this.paintEyes) { e.getWorldPosition(w); e.lookAt(camPos.x, camPos.y, camPos.z); }
    }
    const p = this.dust.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + dt * 0.04; if (y > 3) y = 0;
      p.setY(i, y); p.setX(i, p.getX(i) + Math.sin(t * 0.3 + i) * dt * 0.02);
    }
    p.needsUpdate = true;
    for (const s of SIDES) {
      const a = this.annexes[s];
      if (!a) continue;
      if (a.portal) { a.portal.rotation.z += dt * 1.5; a.light.intensity = 16 + Math.sin(t * 7) * 3 + Math.random() * 2; }
      if (a.embers) {
        const ep = a.embers.geometry.attributes.position;
        for (let i = 0; i < ep.count; i++) { let y = ep.getY(i) + dt * (0.3 + (i % 5) * 0.1); if (y > 3) y = 0; ep.setY(i, y); }
        ep.needsUpdate = true;
      }
      if (a.drops && a.drops.visible) a.drops.children.forEach(d => { d.position.y -= dt * 5; if (d.position.y < 0) d.position.y = 2.1; });
      if (a.stew && a.stew.visible) a.stew.material.emissiveIntensity = 1 + Math.sin(t * 3) * 0.3;
    }
  }
}
