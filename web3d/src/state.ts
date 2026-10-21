// Fresh game state, the daily seed and its deterministic RNG (no DOM/three deps).

export function seededRandom(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}

export function todaySeed() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** mode: 'normal' | 'hard' | 'daily'. The daily room is seeded by date. */
export function freshRoomState(mode = 'normal', seed = null) {
  const hearts = mode === 'hard' ? 1 : 3;
  const st: any = {
    mode, seed,
    placed: {},                 // key -> { type, slot, rot }
    lamp: null,                 // 'hand' | {x, z} | null
    lampOn: false,
    hearts, maxHearts: hearts,
    shoes: 'none', clothes: 'old',
    flags: { books: [] },
    player: { x: 0, z: 0, yaw: 0 },
  };
  if (mode === 'editor' || mode === 'custom') {
    st.lamp = 'hand'; st.lampOn = true;
    st.custom = { title: 'My Room', note: '', keyIn: null, exit: null };
  }
  if (mode === 'daily') {
    // some furniture is already here, and the invisible key hides in a random cell
    const rnd = seededRandom('room-' + seed);
    const pool = ['bed', 'sofa', 'chair', 'table', 'dine', 'shelf', 'closet', 'shoerack'];
    const cells = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];
    const pick = (arr) => arr.splice(Math.floor(rnd() * arr.length), 1)[0];
    for (let i = 0; i < 4; i++) {
      const type = pick(pool), slot = pick(cells);
      st.placed[type] = { type, slot, rot: 0, auto: true };
    }
    st.flags.keyCell = ['nw', 'n', 'ne', 'w', 'm', 'e', 'sw', 's', 'se'][Math.floor(rnd() * 9)];
  }
  if (mode === 'ngplus') {
    // New Game+: the witch moved the key; the PC still knows where
    const rnd = seededRandom('ngplus-' + (seed || Date.now()));
    st.flags.keyCell = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'][Math.floor(rnd() * 8)];
  }
  return st;
}
