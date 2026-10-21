import * as THREE from 'three';

// Canvas-generated textures so the game ships with zero image assets.

function canvas(w: number, h = w): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function rand(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function finish(c, repeat = [1, 1], srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const cache = new Map();
function cached(key, fn) { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); }

export const woodFloor = () => cached('wood', () => {
  const [c, g] = canvas(512); const r = rand(7);
  const plankH = 64;
  for (let y = 0; y < 512; y += plankH) {
    let x = -Math.floor(r() * 300);
    while (x < 512) {
      const len = 180 + r() * 220;
      const base = 70 + r() * 30;
      g.fillStyle = `hsl(${24 + r() * 8}, ${38 + r() * 12}%, ${base * 0.28}%)`;
      g.fillRect(x, y, len, plankH);
      // grain
      for (let i = 0; i < 26; i++) {
        g.strokeStyle = `rgba(20,10,4,${0.08 + r() * 0.12})`;
        g.lineWidth = 1 + r() * 1.5;
        const gy = y + r() * plankH;
        g.beginPath(); g.moveTo(x, gy);
        g.bezierCurveTo(x + len * 0.3, gy + (r() - 0.5) * 8, x + len * 0.6, gy + (r() - 0.5) * 8, x + len, gy + (r() - 0.5) * 4);
        g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x, y, 2, plankH);
      x += len;
    }
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, y, 512, 2);
  }
  return finish(c, [3, 3]);
});

export const wallpaper = () => cached('wallpaper', () => {
  const [c, g] = canvas(256); const r = rand(3);
  g.fillStyle = '#3b2335'; g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 32) { g.fillStyle = 'rgba(255,220,240,0.04)'; g.fillRect(x, 0, 14, 256); }
  // damask-ish diamonds
  g.strokeStyle = 'rgba(220,170,120,0.18)'; g.lineWidth = 2;
  for (let y = 0; y < 256; y += 64) for (let x = 0; x < 256; x += 64) {
    const ox = (y / 64) % 2 ? 32 : 0;
    g.beginPath();
    g.moveTo(x + ox + 32, y + 8); g.quadraticCurveTo(x + ox + 52, y + 32, x + ox + 32, y + 56);
    g.quadraticCurveTo(x + ox + 12, y + 32, x + ox + 32, y + 8); g.stroke();
    g.fillStyle = 'rgba(220,170,120,0.12)'; g.beginPath(); g.arc(x + ox + 32, y + 32, 4, 0, Math.PI * 2); g.fill();
  }
  // grime
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.08})`; g.fillRect(r() * 256, r() * 256, 3 + r() * 10, 3 + r() * 10); }
  return finish(c, [4, 1.5]);
});

export const plaster = () => cached('plaster', () => {
  const [c, g] = canvas(256); const r = rand(11);
  g.fillStyle = '#4a4248'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2500; i++) { const v = r() * 40; g.fillStyle = `rgba(${v},${v},${v},0.12)`; g.fillRect(r() * 256, r() * 256, 2, 2); }
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  for (let i = 0; i < 6; i++) { g.beginPath(); let x = r() * 256, y = r() * 256; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
  return finish(c, [3, 3]);
});

export const tiles = (color = '#cfd6d8') => cached('tiles' + color, () => {
  const [c, g] = canvas(256);
  g.fillStyle = '#8a9294'; g.fillRect(0, 0, 256, 256);
  const r = rand(5);
  for (let y = 0; y < 256; y += 64) for (let x = 0; x < 256; x += 64) {
    g.fillStyle = color; g.fillRect(x + 2, y + 2, 60, 60);
    g.fillStyle = `rgba(0,0,0,${r() * 0.08})`; g.fillRect(x + 2, y + 2, 60, 60);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x + 4, y + 4, 56, 6);
  }
  return finish(c, [3, 3]);
});

export const brick = () => cached('brick', () => {
  const [c, g] = canvas(256); const r = rand(9);
  g.fillStyle = '#2a1a16'; g.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 8; row++) {
    const off = row % 2 ? 32 : 0;
    for (let x = -64; x < 256; x += 64) {
      g.fillStyle = `hsl(${8 + r() * 10}, 40%, ${16 + r() * 10}%)`;
      g.fillRect(x + off + 2, row * 32 + 2, 60, 28);
    }
  }
  return finish(c, [3, 1.5]);
});

export const basalt = () => cached('basalt', () => {
  const [c, g] = canvas(512); const r = rand(21);
  g.fillStyle = '#1a1414'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) {
    const x = r() * 512, y = r() * 512, s = 20 + r() * 60;
    g.fillStyle = `hsl(0, 6%, ${8 + r() * 9}%)`;
    g.beginPath();
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s); }
    g.closePath(); g.fill();
  }
  // glowing cracks
  g.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    let x = r() * 512, y = r() * 512;
    g.strokeStyle = `rgba(255,${80 + r() * 60},20,${0.35 + r() * 0.4})`; g.lineWidth = 1 + r() * 2.5;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 7; k++) { x += (r() - 0.5) * 60; y += (r() - 0.5) * 60; g.lineTo(x, y); }
    g.stroke();
  }
  return finish(c, [6, 6]);
});

export const lava = () => cached('lava', () => {
  const [c, g] = canvas(256); const r = rand(31);
  const grd = g.createLinearGradient(0, 0, 256, 256);
  grd.addColorStop(0, '#ff5a00'); grd.addColorStop(0.5, '#ffb300'); grd.addColorStop(1, '#e02000');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = `rgba(${60 + r() * 60},10,0,${0.3 + r() * 0.5})`;
    g.beginPath(); g.ellipse(r() * 256, r() * 256, 8 + r() * 30, 5 + r() * 18, r() * 3, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,240,150,0.35)'; g.beginPath(); g.arc(r() * 256, r() * 256, 1 + r() * 4, 0, Math.PI * 2); g.fill(); }
  return finish(c, [10, 10]);
});

export const fabric = (hue) => cached('fabric' + hue, () => {
  const [c, g] = canvas(64); const r = rand(hue);
  g.fillStyle = `hsl(${hue}, 45%, 38%)`; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 64; i += 2) { g.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.06})`; g.fillRect(0, i, 64, 1); g.fillRect(i, 0, 1, 64); }
  return finish(c, [2, 2]);
});

// Swirling portal, drawn as radial spiral arms.
export const portal = (hueA, hueB) => cached('portal' + hueA + hueB, () => {
  const [c, g] = canvas(256);
  const grd = g.createRadialGradient(128, 128, 4, 128, 128, 128);
  grd.addColorStop(0, `hsla(${hueA},100%,85%,1)`); grd.addColorStop(0.4, `hsla(${hueA},100%,50%,0.9)`);
  grd.addColorStop(0.85, `hsla(${hueB},100%,25%,0.6)`); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  g.translate(128, 128);
  for (let arm = 0; arm < 5; arm++) {
    g.rotate(Math.PI * 2 / 5);
    g.strokeStyle = `hsla(${hueB},100%,70%,0.45)`; g.lineWidth = 6;
    g.beginPath();
    for (let t = 0; t < 1; t += 0.02) { const a = t * 5, rr = t * 120; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    g.stroke();
  }
  const t = finish(c, [1, 1]); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
});

export function glowSprite(color = '#ffffff') {
  return cached('glow' + color, () => {
    const [c, g] = canvas(64);
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, color); grd.addColorStop(0.3, color); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 1; g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  });
}

// Ring decal used for targeting and attack telegraphs.
export const ring = () => cached('ring', () => {
  const [c, g] = canvas(128);
  g.strokeStyle = '#fff'; g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.stroke();
  g.globalAlpha = 0.25; g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); return t;
});

// A live canvas for the TV / PC screen.
export function screenCanvas(w = 256, h = 192) {
  const [c, g] = canvas(w, h);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return { canvas: c, ctx: g, tex };
}

// ---------- furniture surfaces (neutral, tinted by the material colour) ----------

// Shared furniture textures live for the whole session; disposeTree skips them.
function shared(t) { t.userData.shared = true; return t; }

/** Tileable wood grain running along U: light, so material colours tint it. */
export const woodGrain = () => cached('woodGrain', () => {
  const S = 256; const [c, g] = canvas(S); const r = rand(77);
  g.fillStyle = '#d8cbb8'; g.fillRect(0, 0, S, S);
  // broad growth bands (wrap vertically)
  for (let i = 0; i < 14; i++) {
    const y = r() * S, h = 6 + r() * 22;
    g.fillStyle = `rgba(${r() < 0.5 ? '255,245,225' : '60,35,15'},${0.03 + r() * 0.05})`;
    for (const o of [-S, 0, S]) g.fillRect(0, y + o, S, h);
  }
  // fine wavy grain lines, periodic in x so the tile wraps
  for (let i = 0; i < 70; i++) {
    const y0 = r() * S, a = 1 + r() * 4, k = 1 + Math.floor(r() * 2), ph = r() * 6.28, k2 = 3 + Math.floor(r() * 3), ph2 = r() * 6.28;
    g.strokeStyle = `rgba(55,30,12,${0.1 + r() * 0.22})`; g.lineWidth = 0.6 + r() * 1.4;
    for (const o of [-S, 0, S]) {
      g.beginPath();
      for (let x = 0; x <= S; x += 8) {
        const y = y0 + o + a * Math.sin(x / S * 6.2832 * k + ph) + 0.8 * Math.sin(x / S * 6.2832 * k2 + ph2);
        if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
  }
  // a couple of knots with rings
  for (let i = 0; i < 2; i++) {
    const x = r() * S, y = r() * S;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      for (let k = 5; k >= 1; k--) {
        g.strokeStyle = `rgba(60,30,10,${0.12 + 0.05 * (5 - k)})`; g.lineWidth = 1.2;
        g.beginPath(); g.ellipse(x + ox, y + oy, k * 4.5, k * 1.6, 0, 0, Math.PI * 2); g.stroke();
      }
      g.fillStyle = 'rgba(50,25,8,0.45)'; g.beginPath(); g.ellipse(x + ox, y + oy, 3.5, 1.4, 0, 0, Math.PI * 2); g.fill();
    }
  }
  return shared(finish(c));
});

/** Tileable woven cloth, near-white so it takes any material colour. */
export const weave = () => cached('weave', () => {
  const S = 128, N = 16, cell = S / N; const [c, g] = canvas(S); const r = rand(5150);
  g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, S, S);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const over = (i + j) % 2 === 0;
    const x = i * cell, y = j * cell;
    const grd = over ? g.createLinearGradient(x, y, x, y + cell) : g.createLinearGradient(x, y, x + cell, y);
    const l = 225 + r() * 25;
    grd.addColorStop(0, `rgb(${l - 50},${l - 50},${l - 50})`); grd.addColorStop(0.5, `rgb(${l},${l},${l})`); grd.addColorStop(1, `rgb(${l - 55},${l - 55},${l - 55})`);
    g.fillStyle = grd; g.fillRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
  }
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * 0.07})`; g.fillRect(r() * S, r() * S, 1 + r() * 3, 1); }
  return shared(finish(c));
});

/** Tartan for blankets and throws. */
export const plaid = (hue) => cached('plaid' + hue, () => {
  const S = 128; const [c, g] = canvas(S);
  g.fillStyle = `hsl(${hue}, 50%, 42%)`; g.fillRect(0, 0, S, S);
  const band = (p, w, col) => { g.fillStyle = col; g.fillRect(p, 0, w, S); g.fillRect(0, p, S, w); };
  band(10, 26, `hsla(${hue}, 45%, 20%, 0.55)`); band(74, 26, `hsla(${hue}, 45%, 20%, 0.55)`);
  band(52, 4, `hsla(${(hue + 40) % 360}, 70%, 62%, 0.7)`); band(116, 4, `hsla(${(hue + 40) % 360}, 70%, 62%, 0.7)`);
  band(30, 2, 'rgba(240,230,210,0.45)'); band(94, 2, 'rgba(240,230,210,0.45)');
  // twill texture
  for (let y = 0; y < S; y += 2) for (let x = 0; x < S; x += 4) { g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect((x + y) % S, y, 2, 1); }
  return shared(finish(c));
});

/** Book atlas: four spine designs, then a column of plain cover (left half) and page edges (right half). Grey base so bands read lighter. */
export const bookSpines = () => cached('bookSpines', () => {
  const W = 320, H = 256, C = 64; const [c, g] = canvas(W, H); const r = rand(404);
  const base = '#d0d0d0', hi = '#ffffff', lo = 'rgba(0,0,0,0.38)';
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  // 0: gilt bands top and bottom with a title block
  g.fillStyle = hi; for (const y of [14, 24, 222, 232]) g.fillRect(4, y, C - 8, 4);
  g.fillStyle = lo; g.fillRect(14, 60, C - 28, 90);
  g.fillStyle = hi; for (let y = 72; y < 140; y += 14) g.fillRect(20, y, (C - 40) * (0.6 + r() * 0.4), 4);
  // 1: leather ribs
  for (const y of [30, 80, 130, 180, 226]) { g.fillStyle = lo; g.fillRect(C, y + 5, C, 4); g.fillStyle = hi; g.fillRect(C, y, C, 5); }
  g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(C + 16, 96, C - 32, 22);
  // 2: pale label
  g.fillStyle = '#efe6d2'; g.fillRect(2 * C + 10, 150, C - 20, 50);
  g.fillStyle = lo; g.fillRect(2 * C + 16, 166, C - 32, 4); g.fillRect(2 * C + 16, 180, C - 40, 4);
  g.fillRect(2 * C, 8, C, 6); g.fillRect(2 * C, H - 14, C, 6);
  // 3: diamond tooling
  g.strokeStyle = hi; g.lineWidth = 3;
  for (let y = 40; y < 220; y += 44) { g.beginPath(); g.moveTo(3 * C + 32, y); g.lineTo(3 * C + 50, y + 20); g.lineTo(3 * C + 32, y + 40); g.lineTo(3 * C + 14, y + 20); g.closePath(); g.stroke(); }
  g.fillStyle = hi; g.fillRect(3 * C + 6, 6, 4, H - 12); g.fillRect(4 * C - 10, 6, 4, H - 12);
  // 4: plain cover | page lines
  g.fillStyle = '#e8e2d2'; g.fillRect(4 * C + 32, 0, 32, H);
  for (let y = 0; y < H; y += 3) { g.fillStyle = `rgba(90,70,40,${0.15 + r() * 0.2})`; g.fillRect(4 * C + 32, y, 32, 1); }
  // subtle scuffs on the spines
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.08})`; g.fillRect(r() * 4 * C, r() * H, 2 + r() * 4, 1 + r() * 3); }
  const t = finish(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 2;
  return shared(t);
});
