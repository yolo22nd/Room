import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { screenCanvas, woodGrain, weave, plaid, bookSpines } from './textures';

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

// Textured furniture materials. Built lazily: the canvases need a document,
// and this module is also imported by node-side unit tests.
let FM: any = null;
function fm() {
  if (FM) return FM;
  const wood = (color, roughness = 0.6) => {
    const t = woodGrain();
    const m = new THREE.MeshStandardMaterial({ color, roughness, map: t, bumpMap: t, bumpScale: 1.2 });
    m.userData.tile = [0.9, 0.3]; // metres per texture repeat, along / across the grain
    return m;
  };
  const cloth = (color, map = weave(), tile = [0.16, 0.16], roughness = 0.95) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, map, bumpMap: weave(), bumpScale: 1.5 });
    m.userData.tile = tile;
    return m;
  };
  const hsl = (h, s, l) => new THREE.Color().setHSL(h / 360, s, l, THREE.SRGBColorSpace);
  FM = {
    wood: wood(0x8f5c36),
    darkWood: wood(0x5c3622, 0.65),
    lightWood: wood(0xc68f58, 0.55),
    linen: cloth(0xf3eee2),
    blanket: cloth(0xffffff, plaid(350), [0.42, 0.42]),
    sofa: cloth(hsl(200, 0.45, 0.42)),
    accent: cloth(hsl(30, 0.6, 0.46)),
    cushion: cloth(hsl(285, 0.45, 0.42)),
    seat: cloth(0xa02a38),
    keycap: new THREE.MeshStandardMaterial({ color: 0xf1ebdc, roughness: 0.45 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x1c1a1c, roughness: 0.85 }),
    shoes: [
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3, metalness: 0.1 }),
      new THREE.MeshStandardMaterial({ color: 0x8a4424, roughness: 0.55 }),
      cloth(0x5577cc, weave(), [0.08, 0.08]),
    ],
    globe: new THREE.MeshStandardMaterial({ color: 0x2f6688, roughness: 0.5 }),
    flame: new THREE.MeshBasicMaterial({ color: 0xffb040 }),
    wax: new THREE.MeshStandardMaterial({ color: 0xf2e8cf, roughness: 0.6, emissive: 0x2a1a08 }),
  };
  return FM;
}

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

// ---------- books: one instanced draw call with varied spines ----------
// A unit box whose UVs pick regions of the book atlas: +z is the spine (one of
// four designs, chosen per instance in the shader), ±x are plain covers and the
// remaining faces show cream page edges.
let bookGeo: THREE.BoxGeometry = null, bookMat: THREE.MeshStandardMaterial = null;
function bookAssets() {
  if (bookMat) return;
  bookGeo = new THREE.BoxGeometry(1, 1, 1);
  const uv = bookGeo.attributes.uv;
  for (let face = 0; face < 6; face++) for (let k = 0; k < 4; k++) {
    const i = face * 4 + k;
    if (face === 4) continue;                       // +z spine keeps 0..1
    if (face < 2) uv.setXY(i, 2.25, 0.5);           // covers
    else uv.setXY(i, 2.5 + uv.getX(i) * 0.5, uv.getY(i)); // pages
  }
  bookMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, map: bookSpines() });
  bookMat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'varying float vPage;\n' + sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
      vPage = 0.0;
      #ifdef USE_INSTANCING
        float bk = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      #else
        float bk = 0.0;
      #endif
      if (uv.x < 1.5) vMapUv.x = (uv.x + floor(bk * 4.0)) / 5.0;
      else { vMapUv.x = (uv.x + 2.0) / 5.0; vPage = step(2.4, uv.x); }`);
    sh.fragmentShader = 'varying float vPage;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb = mix(diffuseColor.rgb, sampledDiffuseColor.rgb * vec3(0.92, 0.85, 0.7), vPage);`);
  };
  bookMat.customProgramCacheKey = () => 'books-v1';
}

/** Many coloured books as one draw call. books: [{ w, h, d, x, y, z, rz, color }] */
export function instancedBooks(books, parent, castShadow = true) {
  bookAssets();
  const im = new THREE.InstancedMesh(bookGeo, bookMat, books.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
  const p = new THREE.Vector3(), s = new THREE.Vector3();
  books.forEach((b, i) => {
    q.setFromEuler(e.set(0, 0, b.rz || 0));
    m.compose(p.set(b.x, b.y, b.z), q, s.set(b.w, b.h, b.d));
    im.setMatrixAt(i, m);
    im.setColorAt(i, c.set(b.color).multiplyScalar(1.2)); // the atlas base is mid grey
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

// ---------- kit: build furniture from many parts, draw it per material ----------
type V3 = [number, number, number];
interface PartOpts {
  rot?: V3; scale?: V3;
  uv?: 'box' | 'native' | 'keep'; // box: world-scale projection along the grain
  grain?: 0 | 1 | 2;              // axis the wood grain follows (default: longest)
  uvMul?: [number, number];       // for 'native'
  r?: number; seg?: number; segs?: [number, number]; e?: [number, number];
}
const _m4 = new THREE.Matrix4(), _eu = new THREE.Euler(), _v3 = new THREE.Vector3();

// Planar UVs per face orientation, in metres / tile, with U along the grain axis.
function projectUV(g, tile, grain, ou, ov) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  if (grain === undefined) {
    g.computeBoundingBox(); const s = g.boundingBox.getSize(_v3);
    grain = s.x >= s.y && s.x >= s.z ? 0 : s.y >= s.z ? 1 : 2;
  }
  const a = [0, 0, 0];
  for (let i = 0; i < p.count; i++) {
    a[0] = p.getX(i); a[1] = p.getY(i); a[2] = p.getZ(i);
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
    const dom = nx >= ny && nx >= nz ? 0 : ny >= nz ? 1 : 2;
    let ua, va;
    if (dom !== grain) { ua = grain; va = 3 - dom - grain; } else { ua = (dom + 1) % 3; va = (dom + 2) % 3; }
    uv.setXY(i, a[ua] / tile[0] + ou, a[va] / tile[1] + ov);
  }
  uv.needsUpdate = true;
}

// Soft cushion shape: a superellipsoid (e1 vertical, e2 horizontal exponent),
// unit half-extents. e1 > 1 pinches the seam like a stuffed pillow.
const pillowCache = new Map();
function pillowGeo(e1, e2) {
  const key = e1 + ':' + e2;
  if (!pillowCache.has(key)) {
    const g = new THREE.SphereGeometry(1, 18, 12);
    const p = g.attributes.position;
    const sp = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const r = Math.pow(Math.min(1, Math.hypot(x, z)), e1), a = Math.atan2(z, x);
      p.setXYZ(i, r * sp(Math.cos(a), e2), sp(y, e1), r * sp(Math.sin(a), e2));
    }
    g.computeVertexNormals();
    pillowCache.set(key, g);
  }
  return pillowCache.get(key);
}

class Kit {
  parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  seed = 1;
  rnd() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }

  add(mat, geo, x = 0, y = 0, z = 0, o: PartOpts = {}) {
    const g = geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (o.scale) g.scale(o.scale[0], o.scale[1], o.scale[2]);
    const mode = o.uv || 'box';
    if (mode === 'box') projectUV(g, mat.userData.tile || [0.5, 0.5], o.grain, this.rnd(), this.rnd());
    else if (mode === 'native' && o.uvMul) {
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * o.uvMul[0], uv.getY(i) * o.uvMul[1]);
    }
    if (o.rot) g.applyMatrix4(_m4.makeRotationFromEuler(_eu.set(o.rot[0], o.rot[1], o.rot[2])));
    g.translate(x, y, z);
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(g);
    return g;
  }
  box(mat, w, h, d, x = 0, y = 0, z = 0, o: PartOpts = {}) {
    const geo = o.r ? new RoundedBoxGeometry(w, h, d, o.seg || 1, Math.min(o.r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)) : new THREE.BoxGeometry(w, h, d);
    return this.add(mat, geo, x, y, z, o);
  }
  cyl(mat, rt, rb, h, x = 0, y = 0, z = 0, o: PartOpts = {}) {
    return this.add(mat, new THREE.CylinderGeometry(rt, rb, h, o.seg || 12), x, y, z, o);
  }
  sphere(mat, r, x = 0, y = 0, z = 0, o: PartOpts = {}) {
    const s = o.segs || [12, 8];
    return this.add(mat, new THREE.SphereGeometry(r, s[0], s[1]), x, y, z, o);
  }
  torus(mat, R, t, x = 0, y = 0, z = 0, o: PartOpts = {}) {
    const s = o.segs || [6, 24];
    return this.add(mat, new THREE.TorusGeometry(R, t, s[0], s[1]), x, y, z, { uv: 'native', uvMul: [8, 1], ...o });
  }
  /** Turned profile [[radius, height], ...] from the bottom up; grain runs up the piece. */
  lathe(mat, pts, x = 0, y = 0, z = 0, o: PartOpts = {}) {
    const geo = new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), o.seg || 10);
    if (!o.uvMul) {
      const uv = geo.attributes.uv, p = geo.attributes.position, tile = mat.userData.tile || [0.5, 0.5];
      for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getY(i) / tile[0], uv.getX(i) * 0.2 / tile[1]);
    }
    return this.add(mat, geo, x, y, z, { uv: o.uvMul ? 'native' : 'keep', ...o });
  }
  pillow(mat, w, h, d, x = 0, y = 0, z = 0, o: PartOpts = {}) {
    const [e1, e2] = o.e || [1.3, 0.3];
    return this.add(mat, pillowGeo(e1, e2), x, y, z, { scale: [w / 2, h / 2, d / 2], ...o });
  }

  finish(): [THREE.BufferGeometry, THREE.Material][] {
    const out: [THREE.BufferGeometry, THREE.Material][] = [];
    for (const [mat, geos] of this.parts) {
      const indexed = geos.every(g => g.index);
      const merged = mergeGeometries(indexed ? geos : geos.map(g => g.index ? g.toNonIndexed() : g));
      merged.computeBoundingBox(); merged.computeBoundingSphere();
      out.push([merged, mat]);
    }
    return out;
  }
}

// Merged parts are built once per kind and shared by every copy (and ghost).
const kitCache = new Map<string, [THREE.BufferGeometry, THREE.Material][]>();
function kitted(key, fn: (k: Kit, f: any) => void) {
  let parts = kitCache.get(key);
  if (!parts) { const k = new Kit(); fn(k, fm()); parts = k.finish(); kitCache.set(key, parts); }
  return parts;
}
function addKit(parent, key, fn: (k: Kit, f: any) => void) {
  for (const [geo, mat] of kitted(key, fn)) {
    const m = new THREE.Mesh(geo, mat);
    const basic = (mat as any).isMeshBasicMaterial;
    m.castShadow = !basic && !mat.transparent; m.receiveShadow = !basic;
    parent.add(m);
  }
  return parent;
}

// Turned-leg profiles (radius fraction, height fraction).
const SPINDLE = [[0, 0], [0.7, 0], [0.8, 0.025], [0.62, 0.07], [0.55, 0.2], [0.78, 0.28], [0.55, 0.34], [0.45, 0.52], [0.52, 0.68], [0.82, 0.74], [0.82, 0.77], [1, 0.8], [1, 1], [0, 1]];
const TAPER = [[0, 0], [0.55, 0], [0.62, 0.03], [0.6, 0.06], [0.8, 0.7], [0.95, 0.74], [0.85, 0.78], [1, 0.8], [1, 1], [0, 1]];
const BUN = [[0, 0], [0.7, 0], [1, 0.3], [0.95, 0.65], [0.6, 0.85], [0.75, 1], [0, 1]];
const prof = (P, r, h) => P.map(([a, b]) => [a * r, b * h]);

function turnedLegs(k: Kit, mat, P, w, d, h, r, inset) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.lathe(mat, prof(P, r, h), sx * (w / 2 - inset), 0, sz * (d / 2 - inset), { seg: 8 });
}

const builders = {
  cushion() {
    const g = new THREE.Group();
    addKit(g, 'cushion', (k, f) => {
      k.lathe(f.cushion, [[0, 0.005], [0.42, 0], [0.54, 0.02], [0.6, 0.07], [0.62, 0.14], [0.6, 0.24], [0.54, 0.3], [0.42, 0.335], [0.3, 0.348], [0.12, 0.345], [0.05, 0.33], [0, 0.328]], 0, 0, 0, { seg: 28, uvMul: [20, 8] });
      k.torus(f.cushion, 0.618, 0.016, 0, 0.15, 0, { rot: [Math.PI / 2, 0, 0], segs: [6, 40], uvMul: [40, 1] });
      k.cyl(M.brass, 0.05, 0.05, 0.03, 0, 0.34, 0, { seg: 16 });
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; k.sphere(M.brass, 0.022, Math.cos(a) * 0.3, 0.342, Math.sin(a) * 0.3, { scale: [1, 0.55, 1], segs: [8, 5] }); }
    });
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
    addKit(g, 'pc', (k, f) => {
      const P = M.plastic, K = f.keycap, B = M.black;
      // CRT: bezel, housing and tube neck
      k.box(P, 0.56, 0.44, 0.12, 0, y0 + 0.32, 0.14, { r: 0.03, seg: 2, uv: 'keep' });
      k.box(P, 0.5, 0.4, 0.24, 0, y0 + 0.33, -0.03, { r: 0.05, seg: 2, uv: 'keep' });
      k.box(P, 0.34, 0.27, 0.16, 0, y0 + 0.35, -0.21, { r: 0.04, seg: 1, uv: 'keep' });
      for (let i = 0; i < 5; i++) k.box(B, 0.24, 0.004, 0.02, 0, y0 + 0.531, -0.08 + i * 0.035, { uv: 'keep' }); // vents
      k.box(B, 0.48, 0.37, 0.01, 0, y0 + 0.33, 0.198, { uv: 'keep' }); // screen surround
      k.cyl(B, 0.012, 0.012, 0.01, 0.22, y0 + 0.135, 0.2, { rot: [Math.PI / 2, 0, 0], uv: 'keep' }); // power
      k.box(K, 0.07, 0.014, 0.004, -0.17, y0 + 0.135, 0.2, { uv: 'keep' }); // badge
      // swivel stand
      k.cyl(P, 0.13, 0.16, 0.04, 0, y0 + 0.02, -0.03, { seg: 20, uv: 'keep' });
      k.box(P, 0.18, 0.08, 0.16, 0, y0 + 0.07, -0.03, { r: 0.025, uv: 'keep' });
      // keyboard with keys
      k.box(P, 0.5, 0.035, 0.18, 0, y0 + 0.018, 0.32, { r: 0.01, uv: 'keep' });
      k.box(B, 0.47, 0.004, 0.16, 0, y0 + 0.036, 0.32, { uv: 'keep' });
      const kw = 0.027, pitch = 0.0335;
      for (let r = 0; r < 4; r++) for (let c = 0; c < 13; c++) {
        k.box(K, kw, 0.012, kw, (c - 6) * pitch + (r % 2) * 0.008, y0 + 0.042, 0.32 + (r - 2) * pitch, { uv: 'keep' });
      }
      k.box(K, 0.2, 0.012, kw, 0, y0 + 0.042, 0.32 + 2 * pitch, { uv: 'keep' }); // space bar
      for (const x of [-0.17, -0.13, 0.13, 0.17]) k.box(K, kw, 0.012, kw, x, y0 + 0.042, 0.32 + 2 * pitch, { uv: 'keep' });
      // mouse on a pad
      k.box(B, 0.16, 0.004, 0.2, 0.42, y0 + 0.002, 0.34, { uv: 'keep' });
      k.pillow(P, 0.06, 0.035, 0.1, 0.42, y0 + 0.02, 0.33, { e: [0.6, 0.6], uv: 'keep' });
      // tower with drive bays and vents
      k.box(P, 0.2, 0.44, 0.48, 0.45, y0 + 0.22, -0.05, { r: 0.02, seg: 2, uv: 'keep' });
      k.box(K, 0.16, 0.13, 0.006, 0.45, y0 + 0.29, 0.191, { uv: 'keep' });
      for (const y of [0.32, 0.27]) k.box(B, 0.12, 0.012, 0.006, 0.45, y0 + y, 0.194, { uv: 'keep' });
      for (let i = 0; i < 5; i++) k.box(B, 0.13, 0.006, 0.004, 0.45, y0 + 0.05 + i * 0.02, 0.191, { uv: 'keep' });
      k.cyl(B, 0.016, 0.016, 0.01, 0.45, y0 + 0.19, 0.192, { rot: [Math.PI / 2, 0, 0], uv: 'keep' });
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.33), new THREE.MeshStandardMaterial({ map: scr.tex, emissive: 0xffffff, emissiveMap: scr.tex, emissiveIntensity: 0.9 }));
    screen.position.set(0, y0 + 0.33, 0.206); g.add(screen);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.015), new THREE.MeshBasicMaterial({ color: 0x33ff66 }));
    led.position.set(0.45, y0 + 0.38, 0.195); g.add(led);
    g.userData.screen = scr;
    return g;
  },

  bed() {
    const g = new THREE.Group();
    addKit(g, 'bed', (k, f) => {
      const W = f.wood, D = f.darkWood, L = f.linen, BL = f.blanket;
      // frame: rails, base, footboard, turned posts
      for (const s of [-1, 1]) k.box(W, 0.08, 0.24, 2.36, s * 0.91, 0.24, 0, { r: 0.02 });
      k.box(D, 1.76, 0.14, 2.3, 0, 0.25, 0);
      k.box(W, 1.78, 0.34, 0.05, 0, 0.29, 1.225, { r: 0.015 });
      k.box(D, 1.5, 0.2, 0.02, 0, 0.29, 1.252, { r: 0.008 });
      k.box(W, 1.84, 0.04, 0.07, 0, 0.47, 1.22, { r: 0.015 });
      for (const s of [-1, 1]) {
        k.lathe(W, prof(TAPER, 0.045, 0.52), s * 0.93, 0, 1.205, { seg: 8 });
        k.sphere(W, 0.04, s * 0.93, 0.545, 1.205, { segs: [10, 6] });
        k.lathe(W, prof(TAPER, 0.05, 1.04), s * 0.925, 0, -1.22, { seg: 8 });
        k.sphere(W, 0.045, s * 0.925, 1.055, -1.22, { segs: [10, 6] });
      }
      // panelled headboard
      k.box(W, 1.8, 0.09, 0.07, 0, 1.0, -1.22, { r: 0.025 });
      k.box(W, 1.8, 0.07, 0.07, 0, 0.6, -1.22, { r: 0.02 });
      k.box(D, 1.8, 0.4, 0.05, 0, 0.38, -1.22);
      for (const x of [-0.29, 0.29]) k.box(W, 0.06, 0.34, 0.065, x, 0.8, -1.22, { r: 0.015 });
      for (const x of [-0.58, 0, 0.58]) {
        k.box(D, 0.5, 0.31, 0.04, x, 0.8, -1.22, { grain: 1 });
        k.box(D, 0.4, 0.22, 0.03, x, 0.8, -1.195, { r: 0.012 }); // raised field
      }
      k.box(W, 1.86, 0.035, 0.1, 0, 1.06, -1.22, { r: 0.015 });
      // mattress, folded sheet, blanket, pillows
      k.box(L, 1.76, 0.22, 2.32, 0, 0.43, 0.02, { r: 0.08, seg: 2 });
      k.box(BL, 1.84, 0.05, 1.5, 0, 0.565, 0.43, { r: 0.024, seg: 2 });
      for (const s of [-1, 1]) k.box(BL, 0.03, 0.2, 1.5, s * 0.905, 0.46, 0.43, { r: 0.012 });
      k.box(BL, 1.84, 0.18, 0.03, 0, 0.47, 1.17, { r: 0.012 });
      k.box(L, 1.86, 0.03, 0.27, 0, 0.598, -0.2, { r: 0.014, seg: 2 });
      k.cyl(L, 0.032, 0.032, 1.86, 0, 0.585, -0.33, { rot: [0, 0, Math.PI / 2], seg: 10 });
      for (const s of [-1, 1]) k.pillow(L, 0.74, 0.17, 0.44, s * 0.42, 0.63, -0.88, { rot: [-0.28, 0, s * 0.04], e: [1.25, 0.28] });
    });
    return g;
  },

  sofa() {
    const g = new THREE.Group();
    addKit(g, 'sofa', (k, f) => {
      const S = f.sofa, A = f.accent;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.lathe(f.darkWood, prof(BUN, 0.04, 0.075), sx * 1.02, 0, sz * 0.36, { seg: 10 });
      k.box(S, 1.9, 0.3, 0.92, 0, 0.22, 0, { r: 0.05, seg: 2 });
      // rolled arms with scrolled fronts
      for (const s of [-1, 1]) {
        k.box(S, 0.22, 0.46, 0.92, s * 1.04, 0.3, 0, { r: 0.05, seg: 2 });
        k.cyl(S, 0.115, 0.115, 0.93, s * 1.035, 0.58, 0, { rot: [Math.PI / 2, 0, 0], seg: 16, uv: 'native', uvMul: [6, 5] });
        k.cyl(S, 0.1, 0.1, 0.012, s * 1.035, 0.58, 0.468, { rot: [Math.PI / 2, 0, 0], seg: 16 });
        k.torus(A, 0.112, 0.012, s * 1.035, 0.58, 0.468, { segs: [5, 20] });
      }
      // back with a top roll
      k.box(S, 2.0, 0.6, 0.24, 0, 0.6, -0.36, { r: 0.08, seg: 2 });
      k.cyl(S, 0.075, 0.075, 2.0, 0, 0.9, -0.37, { rot: [0, 0, Math.PI / 2], seg: 14, uv: 'native', uvMul: [4, 12] });
      // seat and back cushions, throw pillows
      for (const s of [-1, 1]) {
        k.pillow(S, 0.9, 0.17, 0.72, s * 0.46, 0.45, 0.08, { e: [0.35, 0.18] });
        k.pillow(S, 0.9, 0.46, 0.2, s * 0.46, 0.72, -0.2, { rot: [-0.16, 0, 0], e: [0.45, 0.22] });
        k.pillow(A, 0.4, 0.38, 0.13, s * 0.68, 0.7, -0.04, { rot: [-0.32, s * 0.3, s * 0.12], e: [1.4, 0.32] });
      }
    });
    return g;
  },

  chair() {
    const g = new THREE.Group();
    addKit(g, 'chair', (k, f) => {
      const W = f.lightWood;
      for (const s of [-1, 1]) {
        k.lathe(W, prof(SPINDLE, 0.028, 0.47), s * 0.23, 0, 0.23, { seg: 8 });
        k.box(W, 0.045, 1.06, 0.045, s * 0.24, 0.53, -0.25, { r: 0.012 });
        k.sphere(W, 0.026, s * 0.24, 1.07, -0.25, { segs: [8, 6] });
        k.cyl(W, 0.012, 0.012, 0.46, s * 0.235, 0.14, -0.01, { rot: [Math.PI / 2, 0, 0], seg: 6 }); // side stretchers
      }
      k.cyl(W, 0.012, 0.012, 0.46, 0, 0.16, -0.01, { rot: [0, 0, Math.PI / 2], seg: 6 });
      k.box(W, 0.46, 0.09, 0.04, 0, 1.0, -0.255, { r: 0.015 });
      k.box(W, 0.46, 0.04, 0.035, 0, 0.57, -0.255, { r: 0.01 });
      for (const x of [-0.1, 0, 0.1]) k.box(W, 0.05, 0.4, 0.018, x, 0.765, -0.255, { r: 0.006, grain: 1 });
      k.box(W, 0.56, 0.05, 0.54, 0, 0.485, 0, { r: 0.015 });
      k.box(W, 0.44, 0.06, 0.02, 0, 0.43, 0.24);
      for (const s of [-1, 1]) k.box(W, 0.02, 0.06, 0.44, s * 0.24, 0.43, -0.01);
      k.pillow(f.seat, 0.5, 0.065, 0.48, 0, 0.54, 0.01, { e: [0.4, 0.2] });
    });
    return g;
  },

  table() {
    const g = new THREE.Group();
    addKit(g, 'table', (k, f) => {
      const W = f.wood, D = f.darkWood;
      k.box(W, 1.6, 0.05, 0.84, 0, 0.785, 0, { r: 0.016, seg: 2 });
      k.box(D, 1.54, 0.025, 0.78, 0, 0.75, 0, { r: 0.008 });
      turnedLegs(k, D, SPINDLE, 1.6, 0.84, 0.74, 0.04, 0.08);
      k.box(D, 1.36, 0.12, 0.025, 0, 0.68, 0.335);
      k.box(D, 1.36, 0.12, 0.025, 0, 0.68, -0.335);
      for (const s of [-1, 1]) k.box(D, 0.025, 0.12, 0.6, s * 0.72, 0.68, 0);
      for (const s of [-1, 1]) { // drawers
        k.box(W, 0.5, 0.1, 0.02, s * 0.4, 0.68, 0.355, { r: 0.008 });
        k.box(W, 0.42, 0.06, 0.012, s * 0.4, 0.68, 0.367, { r: 0.005 });
        k.sphere(M.brass, 0.018, s * 0.4, 0.68, 0.38, { segs: [10, 6] });
        k.cyl(M.brass, 0.022, 0.022, 0.006, s * 0.4, 0.68, 0.373, { rot: [Math.PI / 2, 0, 0], seg: 10 });
      }
      for (let i = 0; i < 4; i++) k.box(M.paper, 0.3, 0.005, 0.4, -0.3 + i * 0.04, 0.815 + i * 0.004, 0.02, { rot: [0, (i - 1.5) * 0.15, 0], uv: 'keep' });
      k.lathe(M.black, [[0, 0], [0.055, 0], [0.06, 0.02], [0.056, 0.055], [0.03, 0.072], [0.02, 0.078], [0.024, 0.092], [0, 0.092]], 0.35, 0.81, -0.2, { seg: 14, uvMul: [1, 1] });
      const dir = [-Math.sin(0.4), Math.cos(0.4)];
      k.cyl(M.white, 0.004, 0.002, 0.35, 0.35, 0.98, -0.2, { rot: [0, 0, 0.4], seg: 5, uv: 'keep' });
      k.sphere(M.white, 1, 0.35 + dir[0] * 0.07, 0.98 + dir[1] * 0.07, -0.2, { scale: [0.03, 0.12, 0.004], rot: [0, 0, 0.4], uv: 'keep' });
      // a couple of books
      k.box(M.red, 0.24, 0.04, 0.17, -0.58, 0.83, -0.2, { rot: [0, 0.25, 0], r: 0.006, uv: 'keep' });
      k.box(M.black, 0.22, 0.035, 0.16, -0.57, 0.867, -0.19, { rot: [0, 0.05, 0], r: 0.006, uv: 'keep' });
      k.box(M.paper, 0.23, 0.032, 0.155, -0.58, 0.83, -0.2, { rot: [0, 0.25, 0], uv: 'keep' });
    });
    return g;
  },

  dine() {
    const g = new THREE.Group();
    addKit(g, 'dine', (k, f) => {
      const W = f.wood, D = f.darkWood, LW = f.lightWood;
      k.box(W, 2.2, 0.07, 1.3, 0, 0.765, 0, { r: 0.025, seg: 2 });
      for (const s of [-1, 1]) { k.box(D, 1.86, 0.1, 0.03, 0, 0.68, s * 0.5); k.box(D, 0.03, 0.1, 1.0, s * 0.95, 0.68, 0); }
      turnedLegs(k, D, SPINDLE, 2.2, 1.3, 0.73, 0.055, 0.15);
      // benches on turned legs with padded seats
      for (const z of [-0.85, 0.85]) {
        k.box(LW, 1.9, 0.06, 0.32, 0, 0.45, z, { r: 0.02 });
        k.box(LW, 1.7, 0.06, 0.02, 0, 0.39, z + 0.13);
        k.box(LW, 1.7, 0.06, 0.02, 0, 0.39, z - 0.13);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.lathe(D, prof(SPINDLE, 0.03, 0.42), sx * 0.89, 0, z + sz * 0.1, { seg: 8 });
        k.cyl(D, 0.013, 0.013, 1.78, 0, 0.12, z, { rot: [0, 0, Math.PI / 2], seg: 6 });
        for (const sx of [-1, 1]) k.cyl(D, 0.012, 0.012, 0.2, sx * 0.89, 0.12, z, { rot: [Math.PI / 2, 0, 0], seg: 6 });
        for (const x of [-0.6, 0, 0.6]) k.pillow(f.seat, 0.54, 0.05, 0.27, x, 0.495, z, { e: [0.4, 0.2] });
      }
      // runner, candle, place settings
      k.box(f.seat, 0.42, 0.006, 1.32, 0, 0.803, 0);
      for (const s of [-1, 1]) k.box(f.seat, 0.42, 0.12, 0.006, 0, 0.745, s * 0.663);
      k.lathe(M.brass, [[0, 0], [0.1, 0], [0.1, 0.012], [0.03, 0.02], [0.02, 0.05], [0.035, 0.06], [0.04, 0.07], [0, 0.07]], 0, 0.806, 0, { seg: 16, uvMul: [1, 1] });
      k.cyl(f.wax, 0.032, 0.035, 0.13, 0, 0.94, 0, { seg: 12, uv: 'keep' });
      k.sphere(f.flame, 0.025, 0, 1.03, 0, { scale: [1, 1.8, 1], segs: [8, 6], uv: 'keep' });
      for (const x of [-0.6, 0.6]) for (const z of [-0.3, 0.3]) {
        k.lathe(M.porcelain, [[0, 0], [0.09, 0], [0.1, 0.008], [0.16, 0.026], [0.155, 0.03], [0.09, 0.012], [0, 0.012]], x, 0.801, z, { seg: 20, uvMul: [1, 1] });
        k.box(M.metal, 0.012, 0.004, 0.18, x + 0.2, 0.803, z, { uv: 'keep' });
        k.box(M.metal, 0.018, 0.004, 0.06, x - 0.2, 0.803, z - 0.06, { uv: 'keep' });
        k.box(M.metal, 0.008, 0.004, 0.12, x - 0.2, 0.803, z + 0.03, { uv: 'keep' });
        const gz = z < 0 ? z + 0.2 : z - 0.2;
        k.lathe(M.brass, [[0, 0], [0.035, 0], [0.035, 0.006], [0.007, 0.012], [0.006, 0.07], [0.03, 0.09], [0.036, 0.15], [0, 0.15]], x + 0.2, 0.8, gz, { seg: 10, uvMul: [1, 1] });
      }
    });
    return g;
  },

  shelf() {
    const g = new THREE.Group();
    const W = 2.1, H = 2.3, D = 0.5;
    addKit(g, 'shelf', (k, f) => {
      k.box(f.darkWood, W - 0.04, H - 0.04, 0.03, 0, H / 2, -D / 2 + 0.02, { grain: 1 });
      for (const s of [-1, 1]) {
        k.box(f.wood, 0.06, H, D, s * W / 2, H / 2, 0, { r: 0.012, grain: 1 });
        k.box(f.darkWood, 0.02, H - 0.2, 0.012, s * W / 2, H / 2, D / 2, { r: 0.004, grain: 1 }); // reeded face
      }
      for (let i = 0; i < 4; i++) {
        const y = 0.05 + i * 0.55;
        k.box(f.wood, W - 0.06, 0.04, D - 0.04, 0, y, 0);
        k.box(f.wood, W - 0.06, 0.055, 0.025, 0, y - 0.005, D / 2 - 0.015, { r: 0.008 }); // edge band
      }
      k.box(f.darkWood, W - 0.06, 0.08, 0.02, 0, 0.04, D / 2 - 0.005); // kick plate
      k.box(f.wood, W - 0.02, 0.05, D, 0, H - 0.04, 0, { r: 0.012 });
      k.box(f.darkWood, W + 0.06, 0.06, D, 0, H, 0, { r: 0.02, seg: 2 }); // crown
      // brass globe on the third shelf
      k.lathe(M.brass, [[0, 0], [0.06, 0], [0.06, 0.012], [0.015, 0.02], [0.012, 0.06], [0, 0.06]], -0.38, 1.17, 0.02, { seg: 12, uvMul: [1, 1] });
      k.torus(M.brass, 0.1, 0.006, -0.38, 1.33, 0.02, { rot: [0, Math.PI / 2, 0.4], segs: [4, 24] });
      k.sphere(f.globe, 0.09, -0.38, 1.33, 0.02, { segs: [16, 10], uv: 'keep' });
    });
    const hues = [0, 25, 45, 120, 200, 260, 300, 340];
    let seed = 3;
    const r = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const books = [];
    const color = () => new THREE.Color().setHSL(hues[Math.floor(r() * hues.length)] / 360, 0.5, 0.25 + r() * 0.15);
    for (let i = 0; i < 4; i++) {
      const y = 0.05 + i * 0.55;
      // a gap for the globe, a lying stack on the second shelf
      const skip = i === 2 ? [-0.52, -0.24] : i === 1 ? [0.56, 0.92] : null;
      let x = -W / 2 + 0.08;
      while (x < W / 2 - 0.12) {
        if (skip && x + 0.12 > skip[0] && x < skip[1]) { x = skip[1]; continue; }
        const bw = 0.05 + r() * 0.07, bh = 0.32 + r() * 0.14;
        books.push({ w: bw, h: bh, d: 0.34 - r() * 0.05, x: x + bw / 2, y: y + 0.02 + bh / 2, z: 0.02, rz: r() < 0.08 ? 0.2 : 0, color: color() });
        x += bw + 0.005;
      }
      if (i === 1) for (let s = 0, yy = y + 0.02; s < 4; s++) {
        const t = 0.04 + r() * 0.025, L = 0.26 + r() * 0.06;
        books.push({ w: t, h: L, d: 0.3, x: 0.74 + (r() - 0.5) * 0.03, y: yy + t / 2, z: 0.02, rz: Math.PI / 2, color: color() });
        yy += t;
      }
    }
    instancedBooks(books, g);
    return g;
  },

  closet() {
    const g = new THREE.Group();
    addKit(g, 'closet', (k, f) => {
      const W = f.wood, D = f.darkWood, Z = 0.415;
      k.box(W, 1.7, 2.16, 0.8, 0, 1.16, 0, { grain: 1 });
      k.box(D, 1.74, 0.1, 0.84, 0, 0.05, 0, { r: 0.015 });
      k.box(W, 1.76, 0.07, 0.84, 0, 2.27, 0, { r: 0.012 });
      k.box(D, 1.8, 0.08, 0.88, 0, 2.35, 0, { r: 0.02, seg: 2 });
      for (const s of [-1, 1]) {
        const x = s * 0.42;
        // frame-and-panel door
        for (const e of [-1, 1]) k.box(D, 0.08, 2.08, 0.035, x + e * 0.36, 1.15, Z, { r: 0.008, grain: 1 });
        for (const y of [0.155, 0.65, 2.145]) k.box(D, 0.64, 0.09, 0.035, x, y, Z, { r: 0.008, grain: 0 });
        k.box(W, 0.62, 0.42, 0.02, x, 0.4, Z - 0.005, { r: 0.008, grain: 1 });
        k.box(W, 0.48, 0.3, 0.02, x, 0.4, Z + 0.005, { r: 0.008, grain: 1 });
        if (s > 0) {
          k.box(W, 0.62, 1.42, 0.02, x, 1.4, Z - 0.005, { grain: 1 });
          k.box(W, 0.48, 1.28, 0.02, x, 1.4, Z + 0.005, { r: 0.01, grain: 1 });
        } else {
          k.box(D, 0.62, 1.42, 0.02, x, 1.4, Z - 0.005);
          k.box(M.mirror, 0.56, 1.36, 0.01, x, 1.4, Z + 0.01, { uv: 'keep' });
        }
        // bar pull, hinges, escutcheon
        k.cyl(M.brass, 0.011, 0.011, 0.26, s * 0.06, 1.15, 0.458, { seg: 8, uv: 'keep' });
        for (const y of [1.06, 1.24]) k.cyl(M.brass, 0.008, 0.008, 0.03, s * 0.06, y, 0.443, { rot: [Math.PI / 2, 0, 0], seg: 6, uv: 'keep' });
        for (const y of [0.4, 1.9]) k.box(M.brass, 0.02, 0.1, 0.012, s * 0.825, y, Z + 0.012, { uv: 'keep' });
      }
      k.box(M.brass, 0.03, 0.05, 0.006, 0.06, 0.98, 0.436, { r: 0.004, uv: 'keep' });
    });
    return g;
  },

  shoerack() {
    const g = new THREE.Group();
    addKit(g, 'shoerack', (k, f) => {
      const W = f.lightWood;
      k.box(W, 1.3, 0.04, 0.42, 0, 0.9, 0, { r: 0.012 });
      for (const x of [-0.63, 0.63]) k.box(W, 0.04, 0.9, 0.42, x, 0.45, 0, { r: 0.01, grain: 1 });
      k.box(W, 1.22, 0.06, 0.015, 0, 0.84, -0.2);
      for (let i = 0; i < 3; i++) {
        const y = 0.05 + i * 0.3;
        for (const z of [-0.14, 0, 0.14]) k.box(W, 1.22, 0.02, 0.11, 0, y, z, { r: 0.006 });
        for (let p = 0; p < 3; p++) for (const side of [-1, 1]) {
          const x = -0.4 + p * 0.4 + side * 0.075, mat = f.shoes[(i + p) % 3];
          k.box(f.rubber, 0.12, 0.02, 0.29, x, y + 0.02, 0.01, { r: 0.008, uv: 'keep' });
          k.box(f.rubber, 0.1, 0.03, 0.07, x, y + 0.035, -0.1, { r: 0.006, uv: 'keep' });
          k.pillow(mat, 0.115, 0.075, 0.27, x, y + 0.06, 0.015, { e: [0.55, 0.6], uv: 'native', uvMul: [3, 2] });
          k.pillow(f.rubber, 0.07, 0.01, 0.1, x, y + 0.096, -0.06, { e: [1, 0.9], uv: 'keep' }); // opening
        }
      }
    });
    return g;
  },

  showcase() {
    const g = new THREE.Group();
    addKit(g, 'showcase', (k, f) => {
      const D = f.darkWood, W = f.wood;
      k.box(D, 1.3, 0.3, 0.7, 0, 0.15, 0, { r: 0.015 });
      for (const s of [-1, 1]) {
        k.box(W, 0.58, 0.19, 0.02, s * 0.31, 0.15, 0.352, { r: 0.008 });
        k.sphere(M.brass, 0.018, s * 0.31, 0.15, 0.372, { segs: [10, 6], uv: 'keep' });
      }
      k.box(D, 1.3, 0.08, 0.7, 0, 1.95, 0, { r: 0.02, seg: 2 });
      k.box(W, 1.24, 0.03, 0.64, 0, 1.9, 0, { r: 0.01 });
      k.box(W, 1.24, 0.03, 0.64, 0, 0.31, 0, { r: 0.01 });
      for (const x of [-0.62, 0.62]) for (const z of [-0.32, 0.32]) k.box(D, 0.05, 1.6, 0.05, x, 1.1, z, { r: 0.012, grain: 1 });
    });
    // glass panels (front one is the door)
    addKit(g, 'showcase-glass', (k) => {
      k.box(M.glass, 1.2, 1.6, 0.01, 0, 1.1, -0.32, { uv: 'keep' });
      for (const x of [-0.62, 0.62]) k.box(M.glass, 0.01, 1.6, 0.6, x, 1.1, 0, { uv: 'keep' });
      k.box(M.glass, 1.2, 0.03, 0.6, 0, 1.1, 0, { uv: 'keep' }); // inner shelf
    });
    const doorPivot = new THREE.Group(); doorPivot.position.set(-0.6, 1.1, 0.33); g.add(doorPivot);
    const door = box(1.2, 1.6, 0.01, M.glass, 0.6, 0, 0, doorPivot); door.castShadow = false;
    addKit(doorPivot, 'showcase-door', (k, f) => {
      for (const x of [0.015, 1.185]) k.box(f.wood, 0.03, 1.6, 0.02, x, 0, 0.012, { r: 0.005, grain: 1 });
      for (const y of [-0.785, 0.785]) k.box(f.wood, 1.2, 0.03, 0.02, 0.6, y, 0.012, { r: 0.005 });
      k.torus(M.brass, 0.036, 0.006, 1.12, 0, 0.008, { segs: [4, 16] });
    });
    const keyhole = new THREE.Mesh(new THREE.CircleGeometry(0.03, 12), new THREE.MeshBasicMaterial({ color: 0x66ffff }));
    keyhole.position.set(1.12, 0, 0.01); doorPivot.add(keyhole);
    g.userData.door = doorPivot; g.userData.keyhole = keyhole;
    // mini kraken skeleton on the top shelf
    const sk = new THREE.Group(); sk.position.set(0, 1.18, 0); g.add(sk);
    addKit(sk, 'showcase-kraken', (k) => {
      k.sphere(M.bone, 0.14, 0, 0.32, 0, { scale: [1, 1.3, 1], segs: [12, 10], uv: 'keep' });
      for (const x of [-0.05, 0.05]) k.sphere(M.black, 0.03, x, 0.36, 0.12, { uv: 'keep' });
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0.2, 0),
          new THREE.Vector3(Math.cos(a) * 0.15, 0.1, Math.sin(a) * 0.12),
          new THREE.Vector3(Math.cos(a) * 0.3, 0.02, Math.sin(a) * 0.2),
          new THREE.Vector3(Math.cos(a + 0.6) * 0.38, 0.06, Math.sin(a + 0.6) * 0.22),
        ]);
        k.add(M.bone, new THREE.TubeGeometry(curve, 12, 0.012, 5), 0, 0, 0, { uv: 'keep' });
      }
    });
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
  addKit(g, 'door-frame', (k, f) => {
    const D = f.darkWood;
    for (const s of [-1, 1]) {
      k.box(D, 0.1, 2.35, 0.3, s * 0.72, 1.175, 0, { r: 0.012, grain: 1 });
      for (const z of [-1, 1]) k.box(D, 0.14, 2.4, 0.03, s * 0.74, 1.2, z * 0.16, { r: 0.01, grain: 1 }); // architrave
      for (const z of [-1, 1]) k.box(D, 0.16, 0.16, 0.04, s * 0.74, 0.08, z * 0.165, { r: 0.008 }); // plinth blocks
    }
    k.box(D, 1.54, 0.12, 0.3, 0, 2.38, 0, { r: 0.012 });
    for (const z of [-1, 1]) k.box(D, 1.62, 0.12, 0.03, 0, 2.42, z * 0.16, { r: 0.01 });
  });
  const pivot = new THREE.Group(); pivot.position.set(-0.66, 0, 0); g.add(pivot);
  const leafKit = kitted('door-leaf-slab', (k, f) => k.box(f.wood, 1.3, 2.28, 0.06, 0, 0, 0, { grain: 1 }))[0];
  const leaf = new THREE.Mesh(leafKit[0], leafKit[1]);
  leaf.position.set(0.65, 1.14, 0); leaf.castShadow = leaf.receiveShadow = true; pivot.add(leaf);
  addKit(pivot, 'door-leaf', (k, f) => {
    const D = f.darkWood;
    for (const z of [-1, 1]) {
      const zz = z * 0.035;
      for (const y of [0.6, 1.6]) for (const x of [0.38, 0.92]) {
        k.box(D, 0.42, 0.72, 0.012, x, y, zz, { r: 0.004, grain: 1 });
        k.box(f.wood, 0.32, 0.6, 0.016, x, y, zz, { r: 0.006, grain: 1 }); // raised field
      }
      k.cyl(M.brass, 0.035, 0.04, 0.012, 1.18, 1.05, z * 0.036, { rot: [Math.PI / 2, 0, 0], seg: 14, uv: 'keep' });
      k.cyl(M.brass, 0.012, 0.016, 0.03, 1.18, 1.05, z * 0.05, { rot: [Math.PI / 2, 0, 0], seg: 8, uv: 'keep' });
      k.sphere(M.brass, 0.045, 1.18, 1.05, z * 0.075, { scale: [1, 1, 0.75], segs: [14, 8], uv: 'keep' });
      k.box(M.brass, 0.03, 0.08, 0.004, 1.18, 0.92, z * 0.032, { r: 0.002, uv: 'keep' }); // keyhole plate
    }
    for (const y of [0.35, 1.95]) k.cyl(M.brass, 0.014, 0.014, 0.12, 0.0, y, 0.035, { seg: 8, uv: 'keep' }); // hinges
  });
  g.userData.pivot = pivot; g.userData.leaf = leaf;
  g.traverse((o: any) => { if (o.isMesh) o.userData.owner = 'door'; });
  return g;
}

export function buildTV() {
  const g = new THREE.Group();
  rbox(1.3, 0.82, 0.12, M.black, 0, 0, 0, g, 0.03);
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
