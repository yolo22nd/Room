import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { fabric, screenCanvas } from './textures';

// Everything that can be conjured. kind: floor = 3x3 grid cell, wall = centre
// of a wall, beyond = an annex room outside a wall, hand = lands in your hand.
export const CATALOG = {
  lamp:     { name: 'Lamp',         icon: '🏮', kind: 'hand' },
  cushion:  { name: 'Cushion',      icon: '🟣', kind: 'floor', fp: [0.6, 0.6] },
  pc:       { name: 'PC',           icon: '💻', kind: 'floor', fp: [0.6, 0.6] },
  bed:      { name: 'Bed',          icon: '🛏️', kind: 'floor', fp: [0.95, 1.25] },
  sofa:     { name: 'Sofa',         icon: '🛋️', kind: 'floor', fp: [1.15, 0.5] },
  chair:    { name: 'Chair',        icon: '🪑', kind: 'floor', fp: [0.32, 0.32] },
  table:    { name: 'Study Table',  icon: '📝', kind: 'floor', fp: [0.8, 0.42] },
  dine:     { name: 'Dining Table', icon: '🍽️', kind: 'floor', fp: [1.1, 0.95] },
  shelf:    { name: 'Bookshelf',    icon: '📚', kind: 'floor', fp: [1.05, 0.28] },
  closet:   { name: 'Closet',       icon: '👗', kind: 'floor', fp: [0.85, 0.4] },
  shoerack: { name: 'Shoe Rack',    icon: '👟', kind: 'floor', fp: [0.65, 0.22] },
  showcase: { name: 'Showcase',     icon: '🗄️', kind: 'floor', fp: [0.65, 0.35] },
  door:     { name: 'Door',         icon: '🚪', kind: 'wall' },
  tv:       { name: 'TV',           icon: '📺', kind: 'wall' },
  bathroom: { name: 'Bathroom',     icon: '🚽', kind: 'beyond' },
  kitchen:  { name: 'Kitchen',      icon: '🍳', kind: 'beyond' },
  hell:     { name: 'Hell',         icon: '🔥', kind: 'beyond' },
  crate:    { name: 'Crate',        icon: '📦', kind: 'junk', shape: { box: [0.35, 0.35, 0.35] }, mass: 2 },
  ball:     { name: 'Beach Ball',   icon: '⚽', kind: 'junk', shape: { ball: 0.32 }, mass: 0.3, bounce: 0.8 },
  anvil:    { name: 'Anvil',        icon: '🔨', kind: 'junk', shape: { box: [0.36, 0.2, 0.18] }, mass: 40 },
};

const M = {
  wood: new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.7 }),
  darkWood: new THREE.MeshStandardMaterial({ color: 0x3a2214, roughness: 0.75 }),
  lightWood: new THREE.MeshStandardMaterial({ color: 0x9a6a3e, roughness: 0.65 }),
  white: new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.9 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xb8b0a0, roughness: 0.3, metalness: 0.9 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc9a23c, roughness: 0.35, metalness: 0.9 }),
  black: new THREE.MeshStandardMaterial({ color: 0x15131a, roughness: 0.6 }),
  plastic: new THREE.MeshStandardMaterial({ color: 0xd6cfbd, roughness: 0.5 }),
  mirror: new THREE.MeshStandardMaterial({ color: 0xc8d4e0, roughness: 0.05, metalness: 1, emissive: 0x1c2430 }),
  glass: new THREE.MeshStandardMaterial({ color: 0xaaccdd, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.18, depthWrite: false }),
  bone: new THREE.MeshStandardMaterial({ color: 0xeee3c8, roughness: 0.8 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x7a7066, roughness: 1 }),
  paper: new THREE.MeshStandardMaterial({ color: 0xf0e6cc, roughness: 1 }),
  red: new THREE.MeshStandardMaterial({ color: 0x8e2430, roughness: 0.8 }),
  porcelain: new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.25 }),
};
export const materials = M;

export function box(w, h, d, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
export function rbox(w, h, d, mat, x = 0, y = 0, z = 0, parent, r = 0.06) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
/** Many coloured boxes as one draw call. books: [{ w, h, d, x, y, z, rz, color }] */
const bookMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
const unitBox = new THREE.BoxGeometry(1, 1, 1);
export function instancedBooks(books, parent, castShadow = true) {
  const im = new THREE.InstancedMesh(unitBox, bookMat, books.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
  books.forEach((b, i) => {
    q.setFromEuler(e.set(0, 0, b.rz || 0));
    m.compose(new THREE.Vector3(b.x, b.y, b.z), q, new THREE.Vector3(b.w, b.h, b.d));
    im.setMatrixAt(i, m);
    im.setColorAt(i, c.set(b.color));
  });
  im.castShadow = castShadow; im.receiveShadow = true;
  if (parent) parent.add(im);
  return im;
}

export function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, parent, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

function legs(g, w, d, h, mat, r = 0.04, inset = 0.08) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    cyl(r, r * 0.8, h, mat, sx * (w / 2 - inset), h / 2, sz * (d / 2 - inset), g, 8);
  }
}

const builders = {
  cushion() {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 12), new THREE.MeshStandardMaterial({ map: fabric(285), roughness: 0.95 }));
    m.scale.set(1, 0.3, 1); m.position.y = 0.17; m.castShadow = m.receiveShadow = true; g.add(m);
    cyl(0.05, 0.05, 0.03, M.brass, 0, 0.36, 0, g);
    return g;
  },

  pc() {
    const g = new THREE.Group();
    const y0 = 0.3; // sits on top of the cushion
    const scr = screenCanvas(256, 192);
    const ctx = scr.ctx;
    ctx.fillStyle = '#021006'; ctx.fillRect(0, 0, 256, 192);
    ctx.fillStyle = '#4dff7a'; ctx.font = 'bold 22px monospace';
    ctx.fillText('WIZ-DOS 3.1', 20, 40); ctx.font = '16px monospace';
    ctx.fillText('C:\\> play rps.exe_', 20, 80);
    ctx.fillText('> win 3 rounds', 20, 110); ctx.fillText('> learn a secret', 20, 134);
    scr.tex.needsUpdate = true;
    box(0.56, 0.44, 0.5, M.plastic, 0, y0 + 0.32, -0.05, g); // monitor body
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.33), new THREE.MeshStandardMaterial({ map: scr.tex, emissive: 0xffffff, emissiveMap: scr.tex, emissiveIntensity: 0.9 }));
    screen.position.set(0, y0 + 0.33, 0.205); g.add(screen);
    box(0.3, 0.08, 0.3, M.plastic, 0, y0 + 0.06, -0.05, g); // stand
    box(0.5, 0.04, 0.18, M.plastic, 0, y0 + 0.02, 0.32, g); // keyboard
    box(0.2, 0.44, 0.48, M.plastic, 0.45, y0 + 0.22, -0.05, g); // tower
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.015), new THREE.MeshBasicMaterial({ color: 0x33ff66 }));
    led.position.set(0.45, y0 + 0.38, 0.195); g.add(led);
    g.userData.screen = scr;
    return g;
  },

  bed() {
    const g = new THREE.Group();
    box(1.9, 0.32, 2.5, M.wood, 0, 0.16, 0, g);
    rbox(1.8, 0.24, 2.36, M.white, 0, 0.44, 0.02, g, 0.1);
    const blanket = rbox(1.86, 0.08, 1.5, new THREE.MeshStandardMaterial({ map: fabric(350), roughness: 0.95 }), 0, 0.58, 0.45, g);
    blanket.castShadow = true;
    const pillow = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 8), M.white);
    pillow.scale.set(1.5, 0.35, 0.7); pillow.position.set(0, 0.64, -0.85); pillow.castShadow = true; g.add(pillow);
    box(1.95, 1.1, 0.1, M.darkWood, 0, 0.55, -1.22, g); // headboard
    return g;
  },

  sofa() {
    const g = new THREE.Group();
    const f = new THREE.MeshStandardMaterial({ map: fabric(200), roughness: 0.95 });
    rbox(2.3, 0.42, 0.95, f, 0, 0.21, 0, g, 0.08);
    rbox(2.3, 0.75, 0.25, f, 0, 0.6, -0.36, g, 0.1);
    rbox(0.22, 0.62, 0.95, f, -1.04, 0.42, 0, g, 0.09);
    rbox(0.22, 0.62, 0.95, f, 1.04, 0.42, 0, g, 0.09);
    for (const x of [-0.46, 0.46]) rbox(0.88, 0.16, 0.7, f, x, 0.48, 0.08, g, 0.07);
    for (const x of [-0.5, 0.5]) { const p = rbox(0.6, 0.4, 0.14, new THREE.MeshStandardMaterial({ map: fabric(30), roughness: 0.95 }), x, 0.75, -0.18, g, 0.06); p.rotation.x = -0.25; }
    return g;
  },

  chair() {
    const g = new THREE.Group();
    box(0.56, 0.06, 0.56, M.lightWood, 0, 0.48, 0, g);
    legs(g, 0.56, 0.56, 0.46, M.lightWood, 0.025, 0.05);
    box(0.56, 0.6, 0.05, M.lightWood, 0, 0.8, -0.26, g);
    rbox(0.5, 0.06, 0.5, M.red, 0, 0.535, 0.01, g, 0.025);
    return g;
  },

  table() {
    const g = new THREE.Group();
    box(1.6, 0.06, 0.84, M.wood, 0, 0.78, 0, g);
    legs(g, 1.6, 0.84, 0.76, M.darkWood, 0.04);
    box(0.5, 0.16, 0.7, M.darkWood, 0.5, 0.66, 0, g); // drawer
    box(0.08, 0.03, 0.02, M.brass, 0.5, 0.66, 0.36, g);
    for (let i = 0; i < 4; i++) { const p = box(0.3, 0.005, 0.4, M.paper, -0.3 + i * 0.04, 0.815 + i * 0.004, 0.02, g); p.rotation.y = (i - 1.5) * 0.15; }
    cyl(0.05, 0.06, 0.08, M.black, 0.35, 0.85, -0.2, g); // inkwell
    const quill = cyl(0.008, 0.002, 0.35, M.white, 0.35, 0.98, -0.2, g, 6); quill.rotation.z = 0.4;
    return g;
  },

  dine() {
    const g = new THREE.Group();
    box(2.2, 0.08, 1.3, M.wood, 0, 0.76, 0, g);
    legs(g, 2.2, 1.3, 0.72, M.darkWood, 0.05, 0.15);
    for (const z of [-0.85, 0.85]) { box(1.9, 0.06, 0.32, M.lightWood, 0, 0.45, z, g); legs({ add: (m) => { m.position.z += z; g.add(m); } }, 1.9, 0.32, 0.42, M.darkWood, 0.03, 0.06); }
    cyl(0.04, 0.05, 0.2, M.white, 0, 0.9, 0, g); // candle
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffb040 }));
    flame.scale.y = 1.8; flame.position.set(0, 1.03, 0); g.add(flame);
    for (const x of [-0.6, 0.6]) { cyl(0.16, 0.12, 0.03, M.porcelain, x, 0.815, 0.3, g); cyl(0.16, 0.12, 0.03, M.porcelain, x, 0.815, -0.3, g); }
    return g;
  },

  shelf() {
    const g = new THREE.Group();
    const W = 2.1, H = 2.3, D = 0.5;
    box(W, H, 0.04, M.darkWood, 0, H / 2, -D / 2 + 0.02, g);
    box(0.06, H, D, M.wood, -W / 2, H / 2, 0, g);
    box(0.06, H, D, M.wood, W / 2, H / 2, 0, g);
    const hues = [0, 25, 45, 120, 200, 260, 300, 340];
    let seed = 3;
    const r = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const books = [];
    for (let i = 0; i < 5; i++) {
      const y = 0.05 + i * 0.55;
      box(W, 0.04, D, M.wood, 0, y, 0, g);
      if (i === 4) break;
      let x = -W / 2 + 0.08;
      while (x < W / 2 - 0.12) {
        const bw = 0.05 + r() * 0.07, bh = 0.32 + r() * 0.14;
        const color = new THREE.Color().setHSL(hues[Math.floor(r() * hues.length)] / 360, 0.5, 0.25 + r() * 0.15);
        books.push({ w: bw, h: bh, d: 0.34, x: x + bw / 2, y: y + 0.02 + bh / 2, z: 0.02, rz: r() < 0.08 ? 0.2 : 0, color });
        x += bw + 0.005;
      }
    }
    instancedBooks(books, g);
    box(W, 0.06, D, M.wood, 0, H, 0, g);
    return g;
  },

  closet() {
    const g = new THREE.Group();
    box(1.7, 2.3, 0.8, M.wood, 0, 1.15, 0, g);
    box(0.8, 2.1, 0.03, M.darkWood, -0.42, 1.15, 0.41, g);
    box(0.62, 1.6, 0.01, M.mirror, -0.42, 1.2, 0.43, g);
    box(0.8, 2.1, 0.03, M.darkWood, 0.42, 1.15, 0.41, g);
    for (const x of [-0.06, 0.06]) box(0.03, 0.2, 0.04, M.brass, x, 1.15, 0.44, g);
    box(1.8, 0.1, 0.88, M.darkWood, 0, 2.34, 0, g);
    return g;
  },

  shoerack() {
    const g = new THREE.Group();
    box(1.3, 0.04, 0.42, M.lightWood, 0, 0.9, 0, g);
    for (const x of [-0.63, 0.63]) box(0.04, 0.9, 0.42, M.lightWood, x, 0.45, 0, g);
    const shoeMat = [new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4 }), new THREE.MeshStandardMaterial({ color: 0xa0522d, roughness: 0.6 }), new THREE.MeshStandardMaterial({ color: 0x5577cc, roughness: 0.9 })];
    for (let i = 0; i < 3; i++) {
      const y = 0.05 + i * 0.3;
      box(1.22, 0.02, 0.4, M.lightWood, 0, y, 0, g);
      for (let k = 0; k < 3; k++) {
        const s = box(0.13, 0.09, 0.3, shoeMat[(i + k) % 3], -0.4 + k * 0.4 - 0.08, y + 0.06, 0, g);
        box(0.13, 0.09, 0.3, shoeMat[(i + k) % 3], -0.4 + k * 0.4 + 0.08, y + 0.06, 0, g);
        s.castShadow = true;
      }
    }
    return g;
  },

  showcase() {
    const g = new THREE.Group();
    box(1.3, 0.3, 0.7, M.darkWood, 0, 0.15, 0, g);
    box(1.3, 0.08, 0.7, M.darkWood, 0, 1.95, 0, g);
    for (const x of [-0.62, 0.62]) for (const z of [-0.32, 0.32]) box(0.05, 1.6, 0.05, M.darkWood, x, 1.1, z, g);
    // glass panels (front one is the door)
    const back = box(1.2, 1.6, 0.01, M.glass, 0, 1.1, -0.32, g); back.castShadow = false;
    for (const x of [-0.62, 0.62]) { const s = box(0.01, 1.6, 0.6, M.glass, x, 1.1, 0, g); s.castShadow = false; }
    const doorPivot = new THREE.Group(); doorPivot.position.set(-0.6, 1.1, 0.33); g.add(doorPivot);
    const door = box(1.2, 1.6, 0.01, M.glass, 0.6, 0, 0, doorPivot); door.castShadow = false;
    const keyhole = new THREE.Mesh(new THREE.CircleGeometry(0.03, 12), new THREE.MeshBasicMaterial({ color: 0x66ffff }));
    keyhole.position.set(1.12, 0, 0.01); doorPivot.add(keyhole);
    g.userData.door = doorPivot; g.userData.keyhole = keyhole;
    box(1.2, 0.03, 0.6, M.glass, 0, 1.1, 0, g).castShadow = false; // inner shelf
    // mini kraken skeleton on the top shelf
    const sk = new THREE.Group(); sk.position.set(0, 1.18, 0); g.add(sk);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), M.bone); skull.scale.set(1, 1.3, 1); skull.position.y = 0.32; sk.add(skull);
    for (const x of [-0.05, 0.05]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.03), M.black); e.position.set(x, 0.36, 0.12); sk.add(e); }
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.2, 0),
        new THREE.Vector3(Math.cos(a) * 0.15, 0.1, Math.sin(a) * 0.12),
        new THREE.Vector3(Math.cos(a) * 0.3, 0.02, Math.sin(a) * 0.2),
        new THREE.Vector3(Math.cos(a + 0.6) * 0.38, 0.06, Math.sin(a + 0.6) * 0.22),
      ]);
      const t = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.012, 5), M.bone); sk.add(t);
    }
    // fossil slab with the impression of a giant nail on the lower shelf
    const slab = box(0.7, 0.08, 0.4, M.stone, 0, 0.36, 0, g);
    slab.rotation.x = -0.25;
    const imp = new THREE.MeshStandardMaterial({ color: 0x3a332c, roughness: 1 });
    const shaft = box(0.5, 0.01, 0.04, imp, 0.03, 0.045, 0, slab);
    box(0.02, 0.012, 0.14, imp, -0.22, 0.046, 0, slab);
    shaft.castShadow = false;
    // the H key sits on the slab until taken
    const hkey = makeHellKey(); hkey.scale.setScalar(0.6); hkey.position.set(0.25, 0.47, 0.08); hkey.rotation.set(-Math.PI / 2 + 0.3, 0, 0.5); g.add(hkey);
    g.userData.hkey = hkey;
    return g;
  },
};

// junk: physics toys, built around their centre of mass
const junkBuilders = {
  crate() {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x9a6a3e, roughness: 0.8 });
    box(0.66, 0.66, 0.66, wood, 0, 0, 0, g);
    // twelve edge beams
    const e = 0.33, t = 0.07, L = 0.72;
    for (const a of [-e, e]) for (const b of [-e, e]) {
      box(L, t, t, M.darkWood, 0, a, b, g);
      box(t, L, t, M.darkWood, a, 0, b, g);
      box(t, t, L, M.darkWood, a, b, 0, g);
    }
    return g;
  },
  ball() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64;
    const x = c.getContext('2d');
    ['#ff4d5e', '#ffffff', '#4d9dff', '#ffffff', '#ffd84d', '#ffffff'].forEach((col, i) => { x.fillStyle = col; x.fillRect(i * 128 / 6, 0, 128 / 6 + 1, 64); });
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 16), new THREE.MeshStandardMaterial({ map: t, roughness: 0.35 }));
    m.castShadow = true; const g = new THREE.Group(); g.add(m); return g;
  },
  anvil() {
    const g = new THREE.Group();
    const iron = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.4, metalness: 0.9 });
    box(0.72, 0.12, 0.36, iron, 0, 0.14, 0, g);
    box(0.3, 0.16, 0.22, iron, 0, 0.0, 0, g);
    box(0.5, 0.08, 0.34, iron, 0, -0.14, 0, g);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 10), iron); horn.rotation.z = Math.PI / 2; horn.position.set(0.5, 0.14, 0); horn.castShadow = true; g.add(horn);
    return g;
  },
};
export function buildJunk(type) {
  const g = junkBuilders[type]();
  g.userData.type = type;
  return g;
}

export function buildObject(type) {
  const g = builders[type]();
  g.userData.type = type;
  g.traverse((o: any) => { if (o.isMesh) o.userData.owner = type; });
  return g;
}

// ---------- wall items ----------
export function buildDoor() {
  const g = new THREE.Group();
  const frameMat = M.darkWood;
  box(0.1, 2.35, 0.3, frameMat, -0.72, 1.175, 0, g);
  box(0.1, 2.35, 0.3, frameMat, 0.72, 1.175, 0, g);
  box(1.54, 0.12, 0.3, frameMat, 0, 2.38, 0, g);
  const pivot = new THREE.Group(); pivot.position.set(-0.66, 0, 0); g.add(pivot);
  const leaf = box(1.3, 2.28, 0.06, M.wood, 0.65, 1.14, 0, pivot);
  for (const y of [0.6, 1.6]) box(1.0, 0.7, 0.02, M.darkWood, 0.65, y, 0.04, pivot);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), M.brass); knob.position.set(1.18, 1.05, 0.07); pivot.add(knob);
  const knob2 = knob.clone(); knob2.position.z = -0.07; pivot.add(knob2);
  g.userData.pivot = pivot; g.userData.leaf = leaf;
  g.traverse((o: any) => { if (o.isMesh) o.userData.owner = 'door'; });
  return g;
}

export function buildTV() {
  const g = new THREE.Group();
  box(1.3, 0.82, 0.12, M.black, 0, 0, 0, g);
  const scr = screenCanvas(320, 200);
  scr.ctx.fillStyle = '#050505'; scr.ctx.fillRect(0, 0, 320, 200); scr.tex.needsUpdate = true;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 0.7), new THREE.MeshStandardMaterial({ map: scr.tex, emissive: 0xffffff, emissiveMap: scr.tex, emissiveIntensity: 0.0 }));
  screen.position.z = 0.065; g.add(screen);
  g.userData.screen = scr; g.userData.screenMesh = screen;
  g.traverse((o: any) => { if (o.isMesh) o.userData.owner = 'tv'; });
  return g;
}

// ---------- keys, lamp, nail ----------
export function makeHellKey() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xd4502a, roughness: 0.3, metalness: 0.8, emissive: 0x501000 });
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 8, 20), mat); bow.position.y = 0.2; g.add(bow);
  // the "H" inside the bow
  box(0.012, 0.07, 0.012, mat, -0.025, 0.2, 0, g); box(0.012, 0.07, 0.012, mat, 0.025, 0.2, 0, g); box(0.05, 0.012, 0.012, mat, 0, 0.2, 0, g);
  cyl(0.015, 0.015, 0.28, mat, 0, 0.0, 0, g, 8);
  box(0.06, 0.03, 0.015, mat, 0.03, -0.1, 0, g); box(0.04, 0.03, 0.015, mat, 0.02, -0.05, 0, g);
  return g;
}

export function makeGhostKey() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x88ffff, transparent: true, opacity: 0.55 });
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 8, 20), mat); bow.position.y = 0.16; g.add(bow);
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.24, 8), mat); g.add(s);
  const t = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.025, 0.012), mat); t.position.set(0.025, -0.09, 0); g.add(t);
  return g;
}

export function makeLantern() {
  const g = new THREE.Group();
  const frame = M.brass;
  cyl(0.09, 0.1, 0.03, frame, 0, 0, 0, g);
  cyl(0.06, 0.09, 0.05, frame, 0, 0.27, 0, g);
  cyl(0.02, 0.06, 0.04, frame, 0, 0.31, 0, g);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xffd28a, emissive: 0xffa040, emissiveIntensity: 2.2, transparent: true, opacity: 0.85 });
  const glass = cyl(0.075, 0.075, 0.22, glassMat, 0, 0.135, 0, g); glass.castShadow = false;
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; cyl(0.006, 0.006, 0.24, frame, Math.cos(a) * 0.08, 0.135, Math.sin(a) * 0.08, g, 4); }
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 6, 16, Math.PI), frame); handle.position.y = 0.33; g.add(handle);
  g.userData.glass = glassMat;
  g.traverse((o: any) => { if (o.isMesh) { o.castShadow = false; o.userData.owner = 'lamp'; } });
  return g;
}

export function makeGiantNail(scale = 1) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.35, metalness: 0.95, emissive: 0x101820 });
  cyl(0.45, 0.45, 9, mat, 0, 4.5 + 1.5, 0, g, 20);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.5, 20), mat); tip.rotation.x = Math.PI; tip.position.y = 0.75; g.add(tip);
  cyl(1.6, 1.6, 0.5, mat, 0, 10.75, 0, g, 28);
  g.scale.setScalar(scale);
  g.traverse((o: any) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
