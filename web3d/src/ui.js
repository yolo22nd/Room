// DOM overlay: HUD, log, dialogs, screens, toasts.

const $ = (id) => document.getElementById(id);
const els = {};
let dialogKeyHandler = null;
let dialogOpen = false;
let onDialogClose = null;
let afterClose = () => {};
export function setAfterClose(fn) { afterClose = fn; }

export function initUI() {
  for (const id of ['hud', 'hearts', 'inventory', 'crosshair', 'prompt', 'log', 'cooldown', 'objective', 'vignette', 'flash', 'touch', 'screen', 'dialog', 'toasts']) els[id] = $(id);
  els.cooldownFill = $('cooldown-fill');
}

export const isDialogOpen = () => dialogOpen;

export function showHUD(on) {
  els.hud.classList.toggle('hidden', !on);
  els.touch.classList.toggle('hidden', !on || !document.body.classList.contains('touch'));
}

export function log(text, cls = '') {
  const d = document.createElement('div');
  d.className = 'line ' + cls; d.textContent = text;
  els.log.appendChild(d);
  const max = document.body.classList.contains('touch') ? 3 : 5;
  while (els.log.children.length > max) els.log.firstChild.remove();
  const life = Math.min(9000, 4000 + text.length * 45);
  setTimeout(() => d.classList.add('fade'), life);
  setTimeout(() => d.remove(), life + 1100);
}

export function setPrompt(html) {
  if (!html) { els.prompt.classList.add('hidden'); els.crosshair.classList.remove('active'); return; }
  els.prompt.innerHTML = html; els.prompt.classList.remove('hidden'); els.crosshair.classList.add('active');
}

let lastHearts = -1;
export function setHearts(cur, max) {
  if (cur === lastHearts && els.hearts.children.length === max) return;
  const hit = cur < lastHearts;
  els.hearts.innerHTML = '';
  for (let i = 0; i < max; i++) {
    const s = document.createElement('span');
    s.className = 'heart' + (i >= cur ? ' empty' : '') + (hit && i === cur ? ' hit' : '');
    s.textContent = '♥'; els.hearts.appendChild(s);
  }
  lastHearts = cur;
}

export function setInventory(items) {
  els.inventory.innerHTML = items.map(i => `<span class="inv">${i}</span>`).join('');
}
export function setObjective(html) { els.objective.innerHTML = html ? `Goal: <b>${html}</b>` : ''; }
export function setVignette(mode) { els.vignette.className = mode || ''; }
export function setCooldown(frac) {
  if (frac <= 0) { els.cooldown.classList.add('hidden'); return; }
  els.cooldown.classList.remove('hidden'); els.cooldownFill.style.width = (100 - frac * 100) + '%';
}

export function flash(color = '#fff', strength = 0.8, ms = 400) {
  const f = els.flash;
  f.style.transition = 'none'; f.style.background = color; f.style.opacity = strength;
  requestAnimationFrame(() => { f.style.transition = `opacity ${ms}ms ease-out`; f.style.opacity = 0; });
}

export function toast(title, sub = '') {
  const d = document.createElement('div');
  d.className = 'toast'; d.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`;
  els.toasts.appendChild(d); setTimeout(() => d.remove(), 4300);
}

function escapeHtml(s) { return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
export { escapeHtml };

/**
 * Open a modal dialog. buttons: [{label, onClick, cls, keep}] — clicking closes
 * the dialog unless `keep` is true. Number keys 1-9 pick buttons, Esc closes.
 */
export function dialog({ title = '', html = '', buttons = [], onClose = null, dismissable = true, wide = false }) {
  closeDialog(true);
  buttons = buttons.filter(Boolean);
  dialogOpen = true; onDialogClose = onClose;
  const wrap = els.dialog; wrap.innerHTML = '';
  const box = document.createElement('div'); box.className = 'dialog';
  if (wide) box.style.width = 'min(760px, 100%)';
  box.innerHTML = (title ? `<h2>${title}</h2>` : '') + html;
  const acts = document.createElement('div'); acts.className = 'actions';
  const btnEls = [];
  buttons.forEach((b, i) => {
    const el = document.createElement('button');
    el.className = 'btn ' + (b.cls || '');
    el.innerHTML = (buttons.length > 1 && i < 9 ? `<span class="k">${i + 1}</span>` : '') + b.label;
    if (b.disabled) el.disabled = true;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (b.disabled) return;
      if (!b.keep) closeDialog();
      b.onClick && b.onClick();
    });
    acts.appendChild(el); btnEls.push(el);
  });
  if (buttons.length) box.appendChild(acts);
  wrap.appendChild(box); wrap.classList.remove('hidden');
  const padOn = navigator.getGamepads && [...navigator.getGamepads()].some(p => p && p.connected);
  if (padOn) setTimeout(() => { const f = box.querySelector('button:not([disabled])'); if (f) f.focus(); }, 0);
  dialogKeyHandler = (e) => {
    if (e.code === 'Escape' && dismissable) { e.preventDefault(); closeDialog(); return; }
    const m = /^Digit([1-9])$/.exec(e.code);
    if (m) { const el = btnEls[+m[1] - 1]; if (el) { e.preventDefault(); el.click(); } }
    if ((e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') && btnEls.length === 1) { e.preventDefault(); btnEls[0].click(); }
  };
  setTimeout(() => addEventListener('keydown', dialogKeyHandler), 0);
  if (dismissable) wrap.onclick = (e) => { if (e.target === wrap) closeDialog(); };
  else wrap.onclick = null;
  return box;
}

export function closeDialog(silent = false) {
  if (!dialogOpen) return;
  dialogOpen = false;
  els.dialog.classList.add('hidden'); els.dialog.innerHTML = '';
  if (dialogKeyHandler) removeEventListener('keydown', dialogKeyHandler);
  dialogKeyHandler = null;
  const cb = onDialogClose; onDialogClose = null;
  if (!silent && cb) cb();
  if (!silent) afterClose();
}

/** Show a sequence of story pages; resolves when done. */
export function story(pages, { clear = false } = {}) {
  return new Promise((resolve) => {
    let i = 0;
    const scr = els.screen;
    scr.classList.toggle('clear', clear);
    const show = () => {
      scr.innerHTML = `<div class="story">${pages[i]}<span class="hint">${matchMedia('(pointer: coarse)').matches ? 'tap' : 'click / press enter'} to continue</span></div>`;
    };
    const next = (e) => {
      if (e && e.type === 'keydown' && !['Enter', 'Space', 'KeyE', 'Escape'].includes(e.code)) return;
      if (e) e.preventDefault();
      i++;
      if (i >= pages.length) {
        scr.removeEventListener('pointerup', next); removeEventListener('keydown', next);
        scr.classList.add('hidden'); scr.classList.remove('clear'); resolve();
      } else show();
    };
    scr.classList.remove('hidden'); show();
    setTimeout(() => { scr.addEventListener('pointerup', next); addEventListener('keydown', next); }, 250);
  });
}

export function screen(html, { clear = false } = {}) {
  const scr = els.screen;
  scr.classList.toggle('clear', clear);
  scr.innerHTML = html; scr.classList.remove('hidden');
  return scr;
}
export function hideScreen() { els.screen.classList.add('hidden'); els.screen.innerHTML = ''; }
