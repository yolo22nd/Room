import { CATALOG } from './models.js';

// Compact, URL-safe encoding of a custom room:
// { v, t: title, n: note, p: [[typeIndex, slot, rot], ...], k: key-hiding entity, x: exit side }
const TYPES = Object.keys(CATALOG).filter(t => ['floor', 'wall', 'beyond'].includes(CATALOG[t].kind));

function toB64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = ''; bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64Url(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

export function encodeRoom(placed, custom) {
  const p = Object.values(placed).filter(e => TYPES.includes(e.type)).map(e => [TYPES.indexOf(e.type), e.slot, e.rot]);
  return toB64Url(JSON.stringify({ v: 1, t: custom.title || '', n: custom.note || '', p, k: custom.keyIn, x: custom.exit }));
}

/** Returns { placed, custom } or null if the code is invalid. */
export function decodeRoom(code) {
  try {
    const d = JSON.parse(fromB64Url(code));
    if (d.v !== 1 || !Array.isArray(d.p)) return null;
    const placed = {};
    for (const [ti, slot, rot] of d.p) {
      const type = TYPES[ti];
      if (!type || typeof slot !== 'string') continue;
      const key = type === 'door' ? 'door_' + slot : type;
      placed[key] = { type, slot, rot: (rot | 0) % 4 };
    }
    return { placed, custom: { title: String(d.t || 'A mysterious room').slice(0, 60), note: String(d.n || '').slice(0, 400), keyIn: d.k || null, exit: d.x || null } };
  } catch (e) { return null; }
}

export function shareUrl(code) {
  return `${location.origin}${location.pathname}#room=${code}`;
}
export function roomCodeFromHash() {
  const m = /#room=([A-Za-z0-9_-]+)/.exec(location.hash);
  return m ? m[1] : null;
}
