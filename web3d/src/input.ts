// Unified input: keyboard + mouse (pointer lock) and touch (virtual stick,
// drag-to-look, on-screen buttons). Game code reads `input` and drains actions.

export const input = {
  keys: new Set(),
  lookDX: 0, lookDY: 0,
  stick: { x: 0, y: 0 },
  pad: { x: 0, y: 0, run: false, connected: false },
  actions: [],
  touch: false,
  locked: false,
  enabled: false,      // when false (menus open) movement/look are ignored
};

// Remappable bindings (action -> key code). Arrows, digits, Enter, Esc and
// Tab keep fixed meanings so menus and spell slots always work.
export const BIND_LABELS = {
  forward: 'Move forward', back: 'Move back', left: 'Strafe left', right: 'Strafe right', run: 'Run',
  use: 'Interact', book: 'Spellbook / switch spell', lamp: 'Lamp', search: 'Search', rotate: 'Rotate',
  stand: 'Stand up', drop: 'Put lamp down', console: 'Command line', photo: 'Photo mode',
};
export const DEFAULT_BINDS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', run: 'ShiftLeft',
  use: 'KeyE', book: 'KeyQ', lamp: 'KeyF', search: 'KeyG', rotate: 'KeyR',
  stand: 'Space', drop: 'KeyX', console: 'Slash', photo: 'KeyV',
};
const MOVE = ['forward', 'back', 'left', 'right', 'run'];
let binds = { ...DEFAULT_BINDS };
export function setBindings(b) { binds = { ...DEFAULT_BINDS, ...(b || {}) }; }
export const getBindings = () => ({ ...binds });

const FIXED_ACTIONS = {
  Tab: 'book', Escape: 'pause', KeyP: 'pause',
  Digit1: 'n1', Digit2: 'n2', Digit3: 'n3', Digit4: 'n4', Digit5: 'n5', Digit6: 'n6', Digit7: 'n7', Digit8: 'n8', Digit9: 'n9',
  Enter: 'enter',
};
function actionFor(code) {
  for (const [a, c] of Object.entries(binds)) if (c === code && !MOVE.includes(a)) return a;
  return FIXED_ACTIONS[code] || null;
}

let canvasEl;
let lockT = 0;
const overlayOpen = () => !document.getElementById('dialog').classList.contains('hidden') || !document.getElementById('screen').classList.contains('hidden');

export function initInput(canvas) {
  canvasEl = canvas;
  input.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (input.touch) document.body.classList.add('touch');

  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    input.keys.add(e.code);
    if (overlayOpen()) return; // dialogs handle their own keys
    const a = actionFor(e.code);
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
    // browsers can report one huge bogus delta right after the pointer is captured
    if (performance.now() - lockT < 120 || Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) return;
    input.lookDX += e.movementX; input.lookDY += e.movementY;
  });
  document.addEventListener('pointerlockchange', () => {
    input.locked = document.pointerLockElement === canvasEl;
    lockT = performance.now();
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
  if (k.has(binds.forward) || k.has('ArrowUp')) y += 1;
  if (k.has(binds.back) || k.has('ArrowDown')) y -= 1;
  if (k.has(binds.right) || k.has('ArrowRight')) x += 1;
  if (k.has(binds.left) || k.has('ArrowLeft')) x -= 1;
  x += input.stick.x + input.pad.x; y += input.stick.y + input.pad.y;
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  return { x, y, run: k.has(binds.run) || (binds.run === 'ShiftLeft' && k.has('ShiftRight')) || input.pad.run };
}

// ---------------------------------------------------------------- gamepad
// Standard mapping: A use, B stand/cancel, X lamp, Y spellbook, RT/RB cast,
// LB search, LT rotate, Start pause, Back command line. In menus the d-pad
// moves focus, A clicks, B backs out.
const PAD_ACTIONS = { 0: 'use', 1: 'cancel', 2: 'lamp', 3: 'book', 4: 'search', 5: 'cast', 6: 'rotate', 7: 'cast', 8: 'console', 9: 'pause' };
let prevButtons = [];
let onPadConnect: (id: string) => void = () => {};
export function setPadListener(fn) { onPadConnect = fn; }
addEventListener('gamepadconnected', (e) => { input.pad.connected = true; onPadConnect(e.gamepad.id); });
addEventListener('gamepaddisconnected', () => { input.pad.connected = false; input.pad.x = input.pad.y = 0; });

const dead = (v) => (Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82);

function menuNav(dir) {
  const root = !document.getElementById('dialog').classList.contains('hidden') ? document.getElementById('dialog') : document.getElementById('screen');
  const items = [...root.querySelectorAll<any>('button:not([disabled]), input, select')];
  if (!items.length) return;
  const i = items.indexOf(document.activeElement);
  const next = items[(i + dir + items.length) % items.length] || items[0];
  next.focus();
}

export function pollGamepad(dt) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = [...pads].find(p => p && p.connected);
  if (!gp) { input.pad.x = input.pad.y = 0; return; }
  const ax = gp.axes;
  input.pad.x = dead(ax[0] || 0); input.pad.y = -dead(ax[1] || 0);
  input.pad.run = !!(gp.buttons[10] && gp.buttons[10].pressed);
  if (input.enabled) {
    const lx = dead(ax[2] || 0), ly = dead(ax[3] || 0);
    input.lookDX += lx * Math.abs(lx) * 900 * dt;
    input.lookDY += ly * Math.abs(ly) * 650 * dt;
  }
  const pressed = gp.buttons.map(b => b.pressed || b.value > 0.5);
  const edge = (i) => pressed[i] && !prevButtons[i];
  if (overlayOpen()) {
    if (edge(12) || edge(14)) menuNav(-1);
    if (edge(13) || edge(15)) menuNav(1);
    if (edge(0)) {
      const a = document.activeElement;
      if (a && a.tagName === 'BUTTON' && a.closest('#dialog,#screen')) (a as HTMLElement).click();
      else dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', key: 'Enter' }));
    }
    if (edge(1)) dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }));
  } else {
    for (const [i, a] of Object.entries(PAD_ACTIONS)) if (edge(+i)) input.actions.push(a);
    if (edge(1)) input.actions.push('stand');
  }
  prevButtons = pressed;
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

  document.querySelectorAll<any>('#touch-buttons .tbtn').forEach(b => {
    b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); input.actions.push(b.dataset.act); }, { passive: false });
    b.addEventListener('click', () => input.actions.push(b.dataset.act));
  });
}
