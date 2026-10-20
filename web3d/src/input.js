// Unified input: keyboard + mouse (pointer lock) and touch (virtual stick,
// drag-to-look, on-screen buttons). Game code reads `input` and drains actions.

export const input = {
  keys: new Set(),
  lookDX: 0, lookDY: 0,
  stick: { x: 0, y: 0 },
  actions: [],
  touch: false,
  locked: false,
  enabled: false,      // when false (menus open) movement/look are ignored
};

const KEY_ACTIONS = {
  KeyE: 'use', KeyQ: 'book', Tab: 'book', KeyF: 'lamp', KeyG: 'search', KeyR: 'rotate',
  Escape: 'pause', KeyP: 'pause', Space: 'stand', KeyC: 'stand',
  Digit1: 'n1', Digit2: 'n2', Digit3: 'n3', Digit4: 'n4', Digit5: 'n5', Digit6: 'n6', Digit7: 'n7', Digit8: 'n8', Digit9: 'n9',
  Enter: 'enter',
};

let canvasEl;
const overlayOpen = () => !document.getElementById('dialog').classList.contains('hidden') || !document.getElementById('screen').classList.contains('hidden');

export function initInput(canvas) {
  canvasEl = canvas;
  input.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (input.touch) document.body.classList.add('touch');

  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    input.keys.add(e.code);
    if (overlayOpen()) return; // dialogs handle their own keys
    const a = KEY_ACTIONS[e.code];
    if (a) { input.actions.push(a); if (e.code === 'Tab' || e.code === 'Space') e.preventDefault(); }
  });
  addEventListener('keyup', (e) => input.keys.delete(e.code));
  addEventListener('blur', () => input.keys.clear());

  canvas.addEventListener('mousedown', (e) => {
    if (input.touch) return;
    if (!input.locked && input.enabled) { requestLock(); return; }
    if (e.button === 0) input.actions.push('cast');
    if (e.button === 2) input.actions.push('cancel');
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('mousemove', (e) => {
    if (!input.locked) return;
    input.lookDX += e.movementX; input.lookDY += e.movementY;
  });
  document.addEventListener('pointerlockchange', () => {
    input.locked = document.pointerLockElement === canvasEl;
    if (!input.locked && input.enabled && !input.touch) input.actions.push('unlocked');
  });

  if (input.touch) initTouch(canvas);
}

export function requestLock() {
  if (input.touch || !canvasEl) return;
  try {
    const p = canvasEl.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* not available */ }
}
export function releaseLock() {
  if (document.pointerLockElement) document.exitPointerLock();
}

export function consumeActions() { const a = input.actions; input.actions = []; return a; }

export function moveVector() {
  let x = 0, y = 0;
  const k = input.keys;
  if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
  if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
  if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
  if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
  x += input.stick.x; y += input.stick.y;
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  return { x, y, run: k.has('ShiftLeft') || k.has('ShiftRight') };
}

function initTouch(canvas) {
  const stick = document.getElementById('stick');
  const knob = document.getElementById('stick-knob');
  let stickId = null, cx = 0, cy = 0;
  const R = 55;
  stick.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0]; stickId = t.identifier;
    const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    moveStick(t);
  }, { passive: false });
  const moveStick = (t) => {
    let dx = t.clientX - cx, dy = t.clientY - cy;
    const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    input.stick.x = dx / R; input.stick.y = -dy / R;
  };
  addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) moveStick(t);
      else if (t.identifier === lookId) {
        input.lookDX += (t.clientX - lx) * 1.6; input.lookDY += (t.clientY - ly) * 1.6;
        lx = t.clientX; ly = t.clientY;
      }
    }
  }, { passive: false });
  const end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) { stickId = null; input.stick.x = input.stick.y = 0; knob.style.transform = ''; }
      if (t.identifier === lookId) lookId = null;
    }
  };
  addEventListener('touchend', end); addEventListener('touchcancel', end);

  // look: any touch that starts on the canvas
  let lookId = null, lx = 0, ly = 0;
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    if (lookId === null) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; }
  }, { passive: false });

  document.querySelectorAll('#touch-buttons .tbtn').forEach(b => {
    b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); input.actions.push(b.dataset.act); }, { passive: false });
    b.addEventListener('click', () => input.actions.push(b.dataset.act));
  });
}
