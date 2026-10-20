import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// subtle film grain + lens vignette, applied after tone mapping
const GrainShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, amount: { value: 0.045 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time; uniform float amount; varying vec2 vUv;
    float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + time) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float v = smoothstep(0.95, 0.35, distance(vUv, vec2(0.5)));
      c.rgb *= mix(0.72, 1.0, v);
      c.rgb += (rnd(vUv * 731.0) - 0.5) * amount;
      gl_FragColor = c;
    }`,
};

import { initInput, input, consumeActions, requestLock, releaseLock, pollGamepad, setPadListener, setBindings, getBindings, BIND_LABELS, DEFAULT_BINDS } from './input';
import { A11Y } from './a11y';
import { PhotoMode, FILTERS } from './photo';
import { setCaptionHook } from './audio';
import * as ui from './ui';
import { initAudio, setVolumes, updateAudio, playAmbience, setHeartbeat, sfx } from './audio';
import { Player } from './player';
import { RoomLevel, freshRoomState, todaySeed } from './game';
import { HellLevel } from './hell';
import { WitchLevel } from './witch';
import { encodeRoom, decodeRoom, shareUrl, roomCodeFromHash } from './share';
import { ENDINGS, ENDING_IDS, recordEnding, seenEndings, trueEndingReady } from './endings';
import { LESSONS, LESSON_ORDER } from './lessons';
import { ChamberLevel } from './chamber';

// What carries over between parts: spells, secrets and upgrades.
const PROFILE_KEY = 'room3d.profile.v1';
function saveProfile(s) {
  if (!s) return;
  const fl = s.flags || {};
  const keep = { spells: fl.spells, wand: fl.wand, cloak: fl.cloak, diary: fl.diary, lemon: fl.lemon, books: fl.books, crystal: fl.crystal };
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify({ flags: keep, maxHearts: s.maxHearts, maxMana: s.maxMana || 100, placed: s.placed, mode: s.mode === 'hard' ? 'hard' : 'normal' })); } catch (e) { /* ignore */ }
}
function profileState() {
  let p: any = null;
  try { p = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); } catch (e) { p = null; }
  const s = freshRoomState(p && p.mode === 'hard' ? 'hard' : 'normal');
  if (p) { Object.assign(s.flags, p.flags || {}); s.maxHearts = Math.max(s.maxHearts, p.maxHearts || 0); s.maxMana = p.maxMana || 100; s.placed = p.placed || {}; }
  s.hearts = s.maxHearts; s.mana = s.maxMana || 100; s.lamp = 'hand'; s.lampOn = true; s.shoes = 'shoes';
  return s;
}
const lessonsUnlocked = () => seenEndings().some(e => ['apprentice', 'rival', 'true'].includes(e));
const LESSONS_DONE_KEY = 'room3d.lessons.v1';
const lessonsDone = (): string[] => { try { return JSON.parse(localStorage.getItem(LESSONS_DONE_KEY) || '[]'); } catch (e) { return []; } };
import { INTRO, HELL_ENTRY, ENDING, WITCH_INTRO, WITCH_ENDING } from './story';
import {
  loadGame, saveGame, hasSave, clearSave, loadSettings, saveSettings, hasSavedSettings,
  ACHIEVEMENTS, isUnlocked, unlockedCount, setAchievementListener, unlock, bestFor, recordRun, loadEditor, saveEditor,
} from './save';

const canvas = document.getElementById('view');
ui.initUI();
initInput(canvas);

const settings = loadSettings();
if (input.touch && !hasSavedSettings()) settings.quality = 'low';

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 300);
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(new THREE.Scene(), camera);
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 0.82);
const grain = new ShaderPass(GrainShader);
composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(new OutputPass()); composer.addPass(grain);

function applyQuality() {
  const high = settings.quality === 'high';
  renderer.setPixelRatio(Math.min(devicePixelRatio, high ? 2 : 1));
  renderer.shadowMap.enabled = high;
  bloom.enabled = high;
  grain.enabled = high;
  resize();
}
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); composer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
applyQuality();
setVolumes(settings.music, settings.sfx);
function applyA11y() {
  A11Y.reducedMotion = !!settings.reducedMotion;
  A11Y.palette = settings.palette || 'standard';
  document.body.classList.toggle('reduced-motion', A11Y.reducedMotion);
  document.body.classList.toggle('captions', !!settings.captions);
  document.body.style.setProperty('--ui-scale', settings.textScale || 1);
  setBindings(settings.keys);
}
applyA11y();
setCaptionHook((t) => ui.caption(t));

// ---------------------------------------------------------------- photo mode
let photo = null;
function initPhoto() {
  const panel = document.getElementById('photo');
  photo = new PhotoMode(engine, canvas, panel);
  const fl = panel.querySelector<any>('#ph-filters');
  fl.innerHTML = Object.entries(FILTERS).map(([k, f]) => `<button class="ph-chip" data-f="${k}">${f.name}</button>`).join('');
  fl.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { sfx.click(); photo.setFilter(b.dataset.f); }));
  panel.querySelector<any>('#ph-fov').addEventListener('input', (e) => photo.setFov(+e.target.value));
  panel.querySelector<any>('#ph-shot').addEventListener('click', () => { photo.pending = true; });
  panel.querySelector<any>('#ph-exit').addEventListener('click', () => exitPhoto());
}
function enterPhoto() {
  if (engine.mode !== 'play' || !engine.level || photo.active) return;
  engine.photo = true;
  releaseLock();
  photo.enter();
  ui.setPrompt(null);
  unlock('photo');
}
function exitPhoto() {
  if (!photo || !photo.active) return;
  photo.exit();
  engine.photo = false;
  document.getElementById('ph-preview').classList.add('hidden');
}
function finishCapture() {
  const url = photo.captureNow();
  photo.pending = false;
  sfx.lampOn(); ui.flash('#ffffff', 0.5, 300);
  const pv = document.getElementById('ph-preview');
  const name = `room-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
  pv.innerHTML = `<img src="${url}" alt="Your photo"><a href="${url}" download="${name}">⬇ Save photo</a>`;
  pv.classList.remove('hidden');
}


// ---------------------------------------------------------------- engine
const player = new Player(camera);
player.sensitivity = settings.sensitivity; player.invertY = settings.invertY;

const engine: any = {
  camera, player, renderer,
  quality: settings.quality,
  touch: input.touch,
  level: null,
  mode: 'title',          // title | play | dead | transition
  paused: false,
  stats: { time: 0, deaths: 0, conjured: 0, splits: {} },
  roomState: null,
  saveT: 0,

  spend(cost) {
    const s = this.roomState;
    if (!s) return true;
    if (s.mode === 'editor') return true;
    if (s.mana === undefined) { s.mana = s.maxMana = 100; }
    if (s.mana < cost) {
      sfx.locked(); ui.manaEmpty();
      if (performance.now() - (this.manaMsgT || 0) > 2500) { this.manaMsgT = performance.now(); ui.log(`Not enough mana (needs ${cost}). It refills on its own.`, 'warn'); }
      return false;
    }
    s.mana -= cost;
    return true;
  },

  split(name) {
    const sp = this.stats.splits || (this.stats.splits = {});
    if (sp[name] !== undefined) return;
    sp[name] = this.stats.time;
    const st = this.roomState || {};
    const best = bestFor(st.mode || 'normal', st.seed);
    const b = best && best.splits && best.splits[name];
    this.splitMsg = { text: `${name} ${ui.fmtTime(sp[name])}${b !== undefined ? '  ' + ui.fmtDelta(sp[name] - b) : ''}`, cls: b === undefined ? '' : (sp[name] <= b ? 'ahead' : 'behind'), until: this.stats.time + 4 };
  },

  setLevel(level) {
    if (demo) { demo.deactivate(); demo = null; }
    if (this.level) this.level.deactivate();
    this.level = level;
    renderPass.scene = level.scene;
    level.activate();
  },

  damage(n, why) {
    const s = this.roomState;
    if (this.mode !== 'play' || s.hearts <= 0) return;
    s.hearts = Math.max(0, s.hearts - n);
    sfx.hurt(); ui.flash('#ff2030', 0.45, 500); player.addShake(0.8);
    ui.setHearts(s.hearts, s.maxHearts);
    if (s.hearts <= 0) this.die(why);
  },

  die(why) {
    this.mode = 'dead';
    this.stats.deaths++;
    setHeartbeat(0);
    releaseLock();
    const inHell = this.level instanceof HellLevel || this.level instanceof WitchLevel || this.level instanceof ChamberLevel;
    ui.closeDialog(true);
    ui.screen(`<div class="title-wrap"><h1 style="font-size:64px">You died</h1><p class="sub">${ui.escapeHtml(why || 'it happens')}</p>
      <div class="actions"><button class="btn primary" id="retry">${inHell ? 'Retry the fight' : 'Load last save'}</button><button class="btn" id="totitle">Back to title</button></div></div>`);
    document.getElementById('retry').onclick = () => { sfx.click(); continueGame(true); };
    document.getElementById('totitle').onclick = () => { sfx.click(); showTitle(); };
  },

  autosave(force = false) {
    if (this.mode !== 'play' || !(this.level instanceof RoomLevel)) return;
    const m = this.roomState && this.roomState.mode;
    if (m === 'editor') { saveEditor(this.roomState); return; }
    if (m === 'custom') return;
    if (!force && performance.now() - this.saveT < 1500) { this.pendingSave = true; return; }
    this.saveT = performance.now(); this.pendingSave = false;
    saveGame({ version: 1, act: 'room', room: this.roomState, stats: this.stats, savedAt: Date.now() });
  },

  async enterHell() {
    this.mode = 'transition';
    const s = this.roomState;
    s.hearts = s.maxHearts;
    // checkpoint: the fight restarts from here on death
    saveGame({ version: 1, act: 'hell', room: s, stats: this.stats, savedAt: Date.now() });
    releaseLock();
    ui.flash('#ff3010', 1, 1500);
    sfx.roar();
    await ui.story(HELL_ENTRY);
    this.mode = 'play';
    this.split('Hell');
    this.setLevel(new HellLevel(this, s));
  },

  async ending() {
    this.mode = 'transition';
    releaseLock();
    ui.flash('#ffffff', 1, 2000);
    this.split('Escape');
    if (this.stats.time < 15 * 60) unlock('speed');
    if (this.roomState && this.roomState.mode === 'hard') unlock('hardmode');
    if (this.roomState && this.roomState.mode === 'daily') unlock('daily');
    await ui.story(ENDING);
    ui.dialog({
      title: '"Rematch?"',
      html: '<p>The witch is twirling her broom, waiting for an answer.</p>',
      dismissable: false,
      buttons: [
        { label: '⚔️ Accept the rematch (Part 3)', cls: 'primary', onClick: () => this.startWitch() },
        { label: 'Not today', onClick: () => this.endWith('escape') },
      ],
    });
  },

  customWin() {
    this.mode = 'transition';
    releaseLock();
    ui.flash('#fff4d0', 0.9, 1200);
    sfx.win();
    unlock('custom');
    const c = this.roomState.custom;
    const back = this.returnToEditor;
    ui.showHUD(false);
    ui.screen(`<div class="title-wrap"><h1 style="font-size:clamp(34px,7vw,60px)">Escaped!</h1>
      <div class="sub">${ui.escapeHtml(c.title)}</div>
      <div class="stats">Time ........ ${ui.fmtTime(this.stats.time)}</div>
      <div class="actions" style="margin-top:22px">
        ${back ? '<button class="btn primary" id="c-edit">Back to the editor</button>' : '<button class="btn primary" id="c-again">Play again</button>'}
        <button class="btn" id="c-make">Build your own room</button>
        <button class="btn" id="c-title">Back to title</button>
      </div></div>`);
    const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = () => { sfx.click(); fn(); }; };
    on('c-edit', () => openEditor());
    on('c-again', () => playCustom(c, this.customPlaced));
    on('c-make', () => openEditor());
    on('c-title', () => showTitle());
  },

  async startWitch() {
    this.mode = 'transition';
    const s = this.roomState;
    s.hearts = s.maxHearts;
    saveGame({ version: 1, act: 'witch', room: s, stats: this.stats, savedAt: Date.now() });
    await ui.story(WITCH_INTRO);
    this.mode = 'play';
    ui.showHUD(true);
    this.setLevel(new WitchLevel(this, s));
  },

  async finale() {
    this.mode = 'transition';
    releaseLock();
    ui.flash('#ffffff', 0.8, 1500);
    this.split('Rematch');
    clearSave();
    await ui.story([WITCH_ENDING[0]]);
    const ready = trueEndingReady(this.roomState);
    ui.dialog({
      title: 'The witch, in the grass',
      html: '<p>She is laughing too hard to get up. Her broom lies next to her. What do you do?</p>',
      dismissable: false,
      buttons: [
        { label: '🤝 Offer her a hand', cls: 'primary', onClick: () => this.endWith('apprentice') },
        { label: '🧹 Take her broom', onClick: () => this.endWith('rival') },
        ready ? { label: '📓 Give back everything you found', onClick: () => this.endWith('true') }
          : { label: '🔒 ??? (you don\'t know enough yet)', disabled: true },
      ],
    });
  },

  async startLesson(id, intro = true) {
    this.mode = 'transition';
    releaseLock();
    ui.closeDialog(true); ui.hideScreen();
    const s = this.roomState && this.roomState.lesson === id ? this.roomState : profileState();
    s.lesson = id; s.hearts = s.maxHearts; s.maxMana = s.maxMana || 100; s.mana = s.maxMana;
    this.roomState = s;
    if (!this.stats || this.mode === 'title') this.stats = { time: 0, deaths: 0, conjured: 0, splits: {} };
    saveGame({ version: 1, act: 'lesson', lesson: id, room: s, stats: this.stats, savedAt: Date.now() });
    if (intro) await ui.story([`<em>PART 4 — THE THREE LESSONS</em>\n\n${LESSONS[id].title}`]);
    this.mode = 'play';
    ui.showHUD(true);
    this.setLevel(LESSONS[id].make(this, s));
  },

  retryChapter(id) {
    this.stats.deaths++;
    this.startLesson(id, false);
  },

  chapterDone(id) {
    this.mode = 'transition';
    releaseLock();
    const done = new Set(lessonsDone()); done.add(id);
    try { localStorage.setItem(LESSONS_DONE_KEY, JSON.stringify([...done])); } catch (e) { /* ignore */ }
    this.split(LESSONS[id].title.split(' — ')[1]);
    saveProfile(this.roomState);
    const next = LESSON_ORDER[LESSON_ORDER.indexOf(id) + 1];
    if (next) {
      ui.dialog({
        title: 'Lesson complete!', html: `<p>${LESSONS[id].title.split(' — ')[1]}: passed.</p>`, dismissable: false,
        buttons: [{ label: `▶ ${LESSONS[next].title}`, cls: 'primary', onClick: () => this.startLesson(next) }, { label: 'Back to title', onClick: () => { clearSave(); showTitle(); } }],
      });
      return;
    }
    clearSave();
    unlock('lessons');
    ui.story([
      'The tower stops. The library drains. Somewhere, the upside-down room quietly rights itself.',
      'The witch claps, slowly. "Three for three. I didn\'t think you\'d manage the tower. Nobody manages the tower."',
      '"Next term: the Witch Exams. Bring a sofa."',
      '<em>PART 4 COMPLETE</em>',
    ]).then(() => showEnding('lessons'));
  },

  async endWith(id) {
    this.mode = 'transition';
    releaseLock();
    clearSave();
    saveProfile(this.roomState);
    const n = recordEnding(id);
    if (id === 'true') unlock('trueending');
    if (id === 'redecorator') unlock('redecorator');
    if (n >= ENDING_IDS.length) unlock('allendings');
    if (ENDINGS[id].story) await ui.story(ENDINGS[id].story);
    showEnding(id);
  },
};

setPadListener((id) => ui.toast('🎮 Controller connected', id.slice(0, 40)));

// offline / installable (production builds only)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

// re-capture the mouse after a dialog closes (the click is a user gesture)
ui.setAfterClose(() => setTimeout(() => {
  const screenHidden = document.getElementById('screen').classList.contains('hidden');
  if (engine.mode === 'play' && !engine.paused && !ui.isDialogOpen() && screenHidden) requestLock();
}, 0));

setAchievementListener((a) => { ui.toast(`${a.icon} Achievement unlocked: <b>${a.name}</b>`, a.desc); sfx.achievement(); });

// ---------------------------------------------------------------- screens
let demo = null;
function buildDemo() {
  const st = freshRoomState();
  st.placed = {
    bed: { type: 'bed', slot: 'nw', rot: 0 }, shelf: { type: 'shelf', slot: 'n', rot: 0 },
    closet: { type: 'closet', slot: 'ne', rot: 0 }, cushion: { type: 'cushion', slot: 'w', rot: 1 },
    pc: { type: 'pc', slot: 'w', rot: 1 }, showcase: { type: 'showcase', slot: 'e', rot: 3 },
    sofa: { type: 'sofa', slot: 's', rot: 2 }, chair: { type: 'chair', slot: 'sw', rot: 2 }, door_s: { type: 'door', slot: 's', rot: 0 },
    tv: { type: 'tv', slot: 'e', rot: 0 }, dine: { type: 'dine', slot: 'se', rot: 2 },
  };
  st.lamp = { x: 0.3, z: 0.4 }; st.lampOn = true;
  return new RoomLevel(engine, st);
}

function showTitle() {
  engine.mode = 'title'; engine.paused = false;
  ui.closeDialog(true); ui.showHUD(false); ui.setTimer(null); releaseLock();
  setHeartbeat(0);
  if (engine.level) engine.level.deactivate();
  demo = buildDemo(); engine.level = null;
  renderPass.scene = demo.scene; demo.scene.add(camera);
  demo.refreshLighting(); setHeartbeat(0); ui.setVignette('');
  const cont = hasSave();
  const code = roomCodeFromHash();
  const shared = code ? decodeRoom(code) : null;
  ui.screen(`<div class="title-wrap">
      <h1>ROOM</h1>
      <div class="sub">a wizard · a room · a way through hell</div>
      <div class="actions">
        ${shared ? `<button class="btn primary" id="t-shared">▶ Play shared room: “${ui.escapeHtml(shared.custom.title)}”</button>` : ''}
        ${cont ? `<button class="btn ${shared ? '' : 'primary'}" id="t-continue">Continue</button>` : ''}
        <button class="btn ${cont || shared ? '' : 'primary'}" id="t-new">New game</button>
        ${lessonsUnlocked() ? `<button class="btn" id="t-lessons">📜 Part 4: The Three Lessons (${lessonsDone().length}/3)</button>` : ''}
        <button class="btn" id="t-editor">🛠️ Room editor</button>
        <button class="btn" id="t-help">How to play</button>
        <button class="btn" id="t-ach">Achievements (${unlockedCount()}/${ACHIEVEMENTS.length})</button>
        <button class="btn" id="t-endings">Endings (${seenEndings().length}/${ENDING_IDS.length})</button>
        <button class="btn" id="t-settings">Settings</button>
      </div>
      <div class="foot">A 3D reimagining of “Room”, a Java command-line game.<br>Headphones recommended.</div>
    </div>`, { clear: true });
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = () => { initAudio(); sfx.click(); fn(); }; };
  on('t-continue', () => continueGame());
  on('t-new', () => { if (cont) ui.dialog({ title: 'Start over?', html: '<p>Your saved progress will be overwritten.</p>', buttons: [{ label: 'Yes, new game', cls: 'primary', onClick: chooseMode }, { label: 'Cancel' }] }); else chooseMode(); });
  on('t-help', () => showHelp());
  on('t-editor', () => openEditor());
  on('t-lessons', () => ui.dialog({
    title: 'Part 4: The Three Lessons',
    buttons: [...LESSON_ORDER.map((id, i) => ({ label: `${lessonsDone().includes(id) ? '✅' : '▶'} ${LESSONS[id].title}`, disabled: i > 0 && !lessonsDone().includes(LESSON_ORDER[i - 1]), onClick: () => { engine.stats = { time: 0, deaths: 0, conjured: 0, splits: {} }; engine.startLesson(id); } })), { label: 'Back' }],
  }));
  on('t-shared', () => { const d = decodeRoom(roomCodeFromHash()); if (d) playCustom(d.custom, d.placed); });
  on('t-ach', () => showAchievements());
  on('t-endings', () => showEndings());
  on('t-settings', () => showSettings());
  // music starts on first interaction
  const kick = () => { initAudio(); playAmbience('room'); removeEventListener('pointerdown', kick); };
  addEventListener('pointerdown', kick);
}

function chooseMode() {
  const seed = todaySeed();
  const fmtBest = (b) => (b ? ` · best ${ui.fmtTime(b.total)}` : '');
  ui.dialog({
    title: 'New game',
    html: '<p class="muted">Hard mode: one heart, a faster Kraken that needs five pins. Daily room: the same seeded room for everyone today — pre-built furniture and a key hidden somewhere new.</p>',
    buttons: [
      { label: `Normal${fmtBest(bestFor('normal'))}`, cls: 'primary', onClick: () => newGame('normal') },
      { label: `Hard — one heart${fmtBest(bestFor('hard'))}`, onClick: () => newGame('hard') },
      { label: `Daily room ${seed}${fmtBest(bestFor('daily', seed))}`, onClick: () => newGame('daily', seed) },
      { label: 'Cancel' },
    ],
  });
}

async function newGame(mode = 'normal', seed = null) {
  initAudio();
  ui.hideScreen();
  engine.mode = 'transition';
  engine.stats = { time: 0, deaths: 0, conjured: 0, splits: {} };
  playAmbience('dark');
  await ui.story(INTRO);
  startRoom(freshRoomState(mode, seed));
  if (mode !== 'normal') ui.log(mode === 'hard' ? 'HARD MODE: one heart. Don\'t look at your feet.' : `DAILY ROOM ${seed}: someone has already decorated...`, 'warn');
  ui.log('Total darkness. You can\'t see a thing, and you are far too scared to move.', 'lore');
  ui.log(`Open your spellbook (${input.touch ? 'Spells button' : 'Q'}) and conjure something.`);
}

function startRoom(state) {
  engine.roomState = state;
  demo = null;
  engine.mode = 'play';
  ui.hideScreen(); ui.showHUD(true);
  engine.setLevel(new RoomLevel(engine, state));
  if (!input.touch) ui.log('Click the screen to look around with the mouse.');
}

function continueGame(fromDeath = false) {
  initAudio();
  const save = loadGame();
  if (!save) { if (fromDeath) newGame(); return; }
  engine.stats = save.stats || { time: 0, deaths: 0, conjured: 0 };
  if (fromDeath) engine.stats.deaths = Math.max(engine.stats.deaths, 0);
  ui.hideScreen();
  if (save.act === 'lesson') {
    engine.roomState = save.room;
    engine.startLesson(save.lesson, false);
    return;
  }
  if (save.act === 'hell' || save.act === 'witch') {
    const s = save.room; s.hearts = s.maxHearts;
    engine.roomState = s;
    engine.mode = 'play'; ui.showHUD(true);
    engine.setLevel(save.act === 'hell' ? new HellLevel(engine, s) : new WitchLevel(engine, s));
  } else {
    const s = save.room;
    if (s.hearts <= 0) s.hearts = s.maxHearts;
    startRoom(s);
  }
}

// ---------------------------------------------------------------- editor
function openEditor() {
  initAudio();
  ui.closeDialog(true);
  engine.returnToEditor = false;
  const saved = loadEditor();
  const st = saved && saved.mode === 'editor' ? saved : freshRoomState('editor');
  st.hearts = st.maxHearts;
  engine.stats = { time: 0, deaths: 0, conjured: 0, splits: {} };
  startRoom(st);
  ui.log('ROOM EDITOR: conjure anything (no crushing here). Press Esc for the editor menu.', 'lore');
}

function playCustom(custom, placed, fromEditor = false) {
  initAudio();
  ui.closeDialog(true);
  const st = freshRoomState('custom');
  st.placed = JSON.parse(JSON.stringify(placed));
  st.custom = { ...custom };
  engine.returnToEditor = fromEditor;
  engine.customPlaced = placed;
  engine.stats = { time: 0, deaths: 0, conjured: 0, splits: {} };
  startRoom(st);
  if (custom.note) ui.log(`A note from the builder: "${custom.note}"`, 'lore');
  ui.log('Find the hidden key (search near furniture), then open the exit door.');
}

function editorProblems(st) {
  const c = st.custom;
  const p = [];
  if (!c.keyIn || !st.placed[c.keyIn]) p.push('Hide the key in a piece of furniture.');
  if (!c.exit || !st.placed['door_' + c.exit]) p.push('Conjure a door and mark it as the exit.');
  return p;
}

function editorMenu() {
  engine.paused = true;
  releaseLock();
  const st = engine.roomState, c = st.custom;
  const resume = () => { engine.paused = false; requestLock(); };
  const floors = Object.entries<any>(st.placed).filter(([, p]) => p.type !== 'door' && !['tv', 'bathroom', 'kitchen', 'hell'].includes(p.type));
  const doors = Object.entries<any>(st.placed).filter(([, p]) => p.type === 'door');
  const problems = editorProblems(st);
  ui.dialog({
    title: '🛠️ Room Editor',
    html: `<p class="muted">${problems.length ? 'To share: ' + problems.join(' ') : 'Your room is ready to share!'}</p>`,
    onClose: () => { engine.paused = false; },
    buttons: [
      { label: 'Keep building', cls: 'primary', onClick: resume },
      { label: `🔑 Hide the key in… (${c.keyIn && st.placed[c.keyIn] ? st.placed[c.keyIn].type : 'not set'})`, onClick: () => ui.dialog({
        title: 'Hide the key in…', html: floors.length ? '' : '<p>Conjure some furniture first.</p>',
        onClose: () => { engine.paused = false; },
        buttons: [...floors.map(([k, p]) => ({ label: `${p.type} (${p.slot})`, onClick: () => { c.keyIn = k; engine.autosave(); engine.level.refreshHUD(); ui.log(`The key is now hidden in the ${p.type}.`, 'good'); resume(); } })), { label: 'Back', onClick: editorMenu }],
      }) },
      { label: `🚪 Exit door… (${c.exit && st.placed['door_' + c.exit] ? c.exit + ' wall' : 'not set'})`, onClick: () => ui.dialog({
        title: 'Which door is the exit?', html: doors.length ? '' : '<p>Conjure a door on a wall first.</p>',
        onClose: () => { engine.paused = false; },
        buttons: [...doors.map(([, p]) => ({ label: `Door on the ${p.slot} wall`, onClick: () => { c.exit = p.slot; engine.autosave(); engine.level.refreshHUD(); ui.log(`The ${p.slot} door is the exit.`, 'good'); resume(); } })), { label: 'Back', onClick: editorMenu }],
      }) },
      { label: '✏️ Title & note', onClick: () => {
        const box = ui.dialog({
          title: 'Title & note',
          html: `<div class="setting"><span>Title</span><input id="ed-t" maxlength="60" value="${ui.escapeHtml(c.title)}" style="width:60%;font:15px var(--font);padding:6px;border-radius:6px;border:1px solid #45355e;background:#0d0a12;color:var(--text)"></div>
            <p class="muted">A note players see when they start (hints welcome):</p>
            <textarea id="ed-n" maxlength="400" rows="3" style="width:100%;font:14px var(--font);padding:8px;border-radius:6px;border:1px solid #45355e;background:#0d0a12;color:var(--text)">${ui.escapeHtml(c.note)}</textarea>`,
          onClose: () => { engine.paused = false; },
          buttons: [{ label: 'Save', cls: 'primary', onClick: () => { c.title = box.querySelector<any>('#ed-t').value.trim() || 'My Room'; c.note = box.querySelector<any>('#ed-n').value.trim(); engine.autosave(); resume(); } }, { label: 'Back', onClick: editorMenu }],
        });
        box.querySelectorAll<any>('input,textarea').forEach(el => el.addEventListener('keydown', e => e.stopPropagation()));
      } },
      { label: '▶ Test play', disabled: problems.length > 0, onClick: () => { engine.autosave(); playCustom(c, st.placed, true); } },
      { label: '🔗 Share link', disabled: problems.length > 0, onClick: () => showShare(st) },
      { label: '🧹 Clear the room', cls: 'danger', onClick: () => ui.dialog({ title: 'Clear everything?', html: '<p>This removes all furniture from your editor room.</p>', buttons: [{ label: 'Yes, clear it', cls: 'primary', onClick: () => { saveEditor(null); openEditor(); } }, { label: 'Cancel', onClick: editorMenu }] }) },
      { label: 'Quit to title', onClick: () => { engine.autosave(true); showTitle(); } },
    ],
  });
}

function showShare(st) {
  const url = shareUrl(encodeRoom(st.placed, st.custom));
  const box = ui.dialog({
    title: '🔗 Share your room',
    html: `<p>Anyone who opens this link can play <b>${ui.escapeHtml(st.custom.title)}</b>:</p>
      <input id="share-url" readonly value="${url}" style="width:100%;font:13px var(--mono);padding:8px;border-radius:6px;border:1px solid #45355e;background:#0d0a12;color:var(--good)">
      <p class="muted">The whole room lives inside the link — no server needed.</p>`,
    onClose: () => { engine.paused = false; },
    buttons: [
      { label: '📋 Copy link', cls: 'primary', keep: true, onClick: () => {
        const inp = box.querySelector<any>('#share-url'); inp.select();
        const done = () => { ui.toast('Link copied!'); unlock('architect'); };
        if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => { document.execCommand('copy'); done(); });
        else { document.execCommand('copy'); done(); }
      } },
      { label: 'Back', onClick: editorMenu },
    ],
  });
  unlock('architect');
}

function showEnding(kind = 'escape') {
  engine.mode = 'title';
  ui.showHUD(false); ui.setTimer(null);
  const t = engine.stats.time;
  const st = engine.roomState || {};
  const mode = st.mode || 'normal';
  const prev: any = bestFor(mode, st.seed);
  const splits = engine.stats.splits || {};
  const record = recordRun(mode, st.seed, t, splits);
  const rows = Object.entries<any>(splits).map(([k, v]) => {
    const b = prev && prev.splits && prev.splits[k];
    return `<tr><td>${k}</td><td>${ui.fmtTime(v)}</td><td class="${b === undefined ? '' : v <= b ? 'ahead' : 'behind'}">${b === undefined ? '' : ui.fmtDelta(v - b)}</td></tr>`;
  }).join('');
  const modeName = mode === 'daily' ? `daily ${st.seed}` : mode;
  ui.screen(`<div class="title-wrap">
    <h1 style="font-size:clamp(36px,7vw,64px)">${ENDINGS[kind].title}</h1>
    <div class="sub">${ENDINGS[kind].sub} <span class="mode-badge">${modeName}</span></div>
    <div class="stats">Time ........ ${ui.fmtTime(t)}${record ? ' ★ new best!' : prev ? ` (best ${ui.fmtTime(prev.total)})` : ''}<br>Deaths ...... ${engine.stats.deaths}<br>Conjured .... ${engine.stats.conjured} things<br>Achievements  ${unlockedCount()}/${ACHIEVEMENTS.length}</div>
    ${rows ? `<table class="splits">${rows}</table>` : ''}
    <div class="actions" style="margin-top:22px"><button class="btn primary" id="e-ach">Achievements</button><button class="btn" id="e-end">Endings</button>${['apprentice', 'rival', 'true'].includes(kind) ? '<button class="btn primary" id="e-lessons">▶ Part 4: The Three Lessons</button>' : ''}<button class="btn" id="e-title">Back to title</button></div>
    <div class="foot">${ENDINGS[kind].foot}<br>Endings found: ${seenEndings().length}/${ENDING_IDS.length}</div></div>`);
  document.getElementById('e-ach').onclick = () => showAchievements();
  document.getElementById('e-end').onclick = () => showEndings();
  const el = document.getElementById('e-lessons'); if (el) el.onclick = () => { sfx.click(); engine.startLesson('upside'); };
  document.getElementById('e-title').onclick = () => showTitle();
}

function showEndings() {
  const seen = seenEndings();
  ui.dialog({
    title: `Endings ${seen.length}/${ENDING_IDS.length}`,
    html: `<div class="ach-list">${ENDING_IDS.map(id => [id, ENDINGS[id]]).map(([id, e]: any) => seen.includes(id)
      ? `<div class="ach"><span class="ico">🎬</span><div>${e.title}<small>${e.sub}</small></div></div>`
      : `<div class="ach locked"><span class="ico">🔒</span><div>???<small>${e.hint}</small></div></div>`).join('')}</div>`,
    buttons: [{ label: 'Close' }],
  });
}

function showAchievements() {
  ui.dialog({
    title: `Achievements ${unlockedCount()}/${ACHIEVEMENTS.length}`,
    html: `<div class="ach-list">${ACHIEVEMENTS.map(a => `<div class="ach ${isUnlocked(a.id) ? '' : 'locked'}"><span class="ico">${isUnlocked(a.id) ? a.icon : '🔒'}</span><div>${a.name}<small>${a.desc}</small></div></div>`).join('')}</div>`,
    buttons: [{ label: 'Close' }],
  });
}

function showHelp() {
  const touch = input.touch;
  ui.dialog({
    title: 'How to play',
    html: `<p>You are a newbie wizard banished to a dark, empty room. Your one power: <b>anything you conjure falls from the sky</b>. Build the room, solve its secrets, and find your way to Hell — then out the other side.</p>
    ${touch ? `<p><b>Left stick</b> move · <b>drag</b> anywhere to look<br><b>Use</b> interact / confirm · <b>Cast</b> conjure / attack<br><b>Spells</b> open the spellbook (in Hell: switch spell)<br><b>Lamp</b> toggle the lamp · <b>Search</b> search the floor</p>`
      : `<p><kbd>WASD</kbd> move · <kbd>Shift</kbd> run · <kbd>Mouse</kbd> look<br><kbd>E</kbd> interact · <kbd>Q</kbd> spellbook · <kbd>Click</kbd> cast<br><kbd>R</kbd> rotate before casting · <kbd>Right-click</kbd> cancel<br><kbd>F</kbd> lamp · <kbd>G</kbd> search the floor · <kbd>X</kbd> put the lamp down<br><kbd>Space</kbd> stand up · <kbd>Esc</kbd> pause<br><kbd>/</kbd> classic command line (<i>create bed north</i>, <i>go sw</i>…)<br>In Hell: <kbd>1</kbd>/<kbd>2</kbd> or <kbd>Q</kbd> switch spell</p>`}
    <p class="muted">Controller: left stick move · right stick look · <b>A</b> use · <b>RT</b> cast · <b>Y</b> spells · <b>X</b> lamp · <b>LB</b> search · <b>LT</b> rotate · <b>B</b> stand/cancel · <b>Start</b> pause. D-pad + A in menus.</p>
    <p class="muted">Tip: things land on whatever cell you're looking at. Don't look at your own feet.</p>`,
    buttons: [{ label: 'Got it' }],
  });
}

function showSettings() {
  const chk = (id, on) => `<input type="checkbox" id="${id}" ${on ? 'checked' : ''}>`;
  const sel = (id, opts, v) => `<select id="${id}">${opts.map(([k, l]) => `<option value="${k}" ${String(v) === String(k) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const box = ui.dialog({
    title: 'Settings',
    html: `
      <div class="settings-section">Audio</div>
      <div class="setting"><span>Music</span><input type="range" id="s-music" min="0" max="1" step="0.05" value="${settings.music}"></div>
      <div class="setting"><span>Sound effects</span><input type="range" id="s-sfx" min="0" max="1" step="0.05" value="${settings.sfx}"></div>
      <div class="setting"><span>Sound captions</span>${chk('s-cap', settings.captions)}</div>
      <div class="settings-section">Controls</div>
      <div class="setting"><span>Look sensitivity</span><input type="range" id="s-sens" min="0.3" max="2.5" step="0.1" value="${settings.sensitivity}"></div>
      <div class="setting"><span>Invert look Y</span>${chk('s-inv', settings.invertY)}</div>
      <div class="setting"><span>Keyboard bindings</span><button class="btn" id="s-keys" style="padding:6px 12px">Remap keys…</button></div>
      <div class="settings-section">Display</div>
      <div class="setting"><span>Graphics</span>${sel('s-q', [['high', 'High (shadows, bloom)'], ['low', 'Low (faster)']], settings.quality)}</div>
      <div class="setting"><span>Text size</span>${sel('s-text', [[1, 'Normal'], [1.2, 'Large'], [1.4, 'Extra large']], settings.textScale)}</div>
      <div class="setting"><span>Speedrun timer</span>${chk('s-timer', settings.showTimer)}</div>
      <div class="settings-section">Accessibility</div>
      <div class="setting"><span>Reduced motion<br><small class="muted">no camera shake, head-bob or bright flashes</small></span>${chk('s-motion', settings.reducedMotion)}</div>
      <div class="setting"><span>Telegraph colours</span>${sel('s-pal', [['standard', 'Standard'], ['safe', 'Colour-blind safe']], settings.palette)}</div>`,
    buttons: [{ label: 'Done' }],
  });
  const upd = () => {
    settings.music = +box.querySelector<any>('#s-music').value;
    settings.sfx = +box.querySelector<any>('#s-sfx').value;
    settings.sensitivity = +box.querySelector<any>('#s-sens').value;
    settings.invertY = box.querySelector<any>('#s-inv').checked;
    settings.showTimer = box.querySelector<any>('#s-timer').checked;
    settings.quality = box.querySelector<any>('#s-q').value;
    settings.captions = box.querySelector<any>('#s-cap').checked;
    settings.reducedMotion = box.querySelector<any>('#s-motion').checked;
    settings.palette = box.querySelector<any>('#s-pal').value;
    settings.textScale = +box.querySelector<any>('#s-text').value;
    setVolumes(settings.music, settings.sfx);
    player.sensitivity = settings.sensitivity; player.invertY = settings.invertY;
    engine.quality = settings.quality; applyQuality();
    applyA11y();
    saveSettings(settings);
  };
  box.querySelectorAll<any>('input,select').forEach(el => el.addEventListener('input', upd));
  box.querySelector<any>('#s-keys').addEventListener('click', (e) => { e.stopPropagation(); showKeys(); });
}

const keyName = (code) => code.replace(/^Key/, '').replace(/^Digit/, '').replace('Left', ' L').replace('Right', ' R');
function showKeys() {
  const binds = getBindings();
  const box = ui.dialog({
    title: 'Remap keys',
    html: `<p class="muted">Click a key, then press the new one. Arrows, Esc, Enter, Tab and 1–9 stay fixed.</p>
      ${Object.entries(BIND_LABELS).map(([a, l]) => `<div class="setting"><span>${l}</span><button class="btn keybind" data-a="${a}">${keyName(binds[a])}</button></div>`).join('')}`,
    buttons: [
      { label: 'Reset to defaults', keep: true, onClick: () => { settings.keys = {}; saveSettings(settings); applyA11y(); showKeys(); } },
      { label: 'Back', onClick: showSettings },
    ],
  });
  box.querySelectorAll<any>('.keybind').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation();
    box.querySelectorAll<any>('.keybind').forEach(x => x.classList.remove('listening'));
    b.classList.add('listening'); b.textContent = 'press a key…';
    const grab = (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      removeEventListener('keydown', grab, true);
      if (ev.code !== 'Escape') {
        const a = b.dataset.a;
        // swap with whichever action already used this key
        const cur = getBindings();
        const clash = Object.keys(cur).find(k => cur[k] === ev.code && k !== a);
        settings.keys = { ...cur, [a]: ev.code, ...(clash ? { [clash]: cur[a] } : {}) };
        saveSettings(settings); applyA11y();
      }
      showKeys();
    };
    addEventListener('keydown', grab, true);
  }));
}

function pauseMenu() {
  if (engine.mode !== 'play') return;
  if (engine.roomState && engine.roomState.mode === 'editor' && engine.level instanceof RoomLevel) { editorMenu(); return; }
  if (engine.roomState && engine.roomState.mode === 'custom') {
    engine.paused = true; releaseLock();
    ui.dialog({ title: 'Paused', onClose: () => { engine.paused = false; }, buttons: [
      { label: 'Resume', cls: 'primary', onClick: () => { engine.paused = false; requestLock(); } },
      engine.returnToEditor ? { label: 'Back to the editor', onClick: () => openEditor() } : null,
      { label: 'Restart this room', onClick: () => playCustom(engine.roomState.custom, engine.customPlaced, engine.returnToEditor) },
      { label: 'How to play', onClick: () => showHelp() },
      { label: 'Quit to title', cls: 'danger', onClick: () => showTitle() },
    ] });
    return;
  }
  engine.paused = true;
  releaseLock();
  const inRoom = engine.level instanceof RoomLevel;
  ui.dialog({
    title: 'Paused',
    html: '',
    onClose: () => { engine.paused = false; },
    buttons: [
      { label: 'Resume', cls: 'primary', onClick: () => { engine.paused = false; requestLock(); } },
      inRoom ? { label: 'Save game', onClick: () => { engine.mode = 'play'; engine.autosave(true); ui.log('Game saved.', 'good'); engine.paused = false; requestLock(); } } : { label: 'Checkpoint saved at the start of this fight', disabled: true },
      inRoom ? { label: 'Command line (classic mode)', onClick: () => { engine.paused = false; engine.level.openConsole(); } } : null,
      { label: '📸 Photo mode', onClick: () => { engine.paused = false; enterPhoto(); } },
      { label: 'How to play', onClick: () => { showHelp(); } },
      { label: 'Settings', onClick: () => showSettings() },
      { label: 'Achievements', onClick: () => showAchievements() },
      { label: 'Quit to title', cls: 'danger', onClick: () => { engine.autosave(true); showTitle(); } },
    ],
  });
}

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
let titleT = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = (window as any).__freeze ? (clock.getDelta(), 0) : Math.min(0.05, clock.getDelta());
  engine.frames = (engine.frames || 0) + 1;
  const busy = ui.isDialogOpen() || !document.getElementById('screen').classList.contains('hidden');
  const playing = engine.mode === 'play' && engine.level && !engine.paused;
  input.enabled = playing && !busy;
  if (busy && input.locked) releaseLock();

  pollGamepad(dt);
  const actions = consumeActions();
  if (engine.photo) {
    for (const a of actions) if (a === 'pause' || a === 'photo' || a === 'cancel') exitPhoto();
    input.enabled = true;
    photo.update(dt);
    updateAudio(dt);
    composer.render(dt);
    if (photo.pending) finishCapture();
    return;
  }
  if (engine.mode === 'play' && engine.level) {
    for (const a of actions) {
      if (a === 'pause' || a === 'unlocked') { if (!busy) pauseMenu(); continue; }
      if (a === 'photo') { if (!busy) enterPhoto(); continue; }
      if (!input.enabled) continue;
      engine.level.handleAction(a);
    }
    if (input.enabled && !input.touch && !input.locked && !input.pad.connected && !(engine.level.placing)) {
      ui.setPrompt('<kbd>Click</kbd>to look around');
    }
  }

  if (engine.mode === 'title' && demo) {
    titleT += dt * 0.08;
    camera.position.set(Math.sin(titleT) * 3.2, 1.9, Math.cos(titleT) * 3.2);
    camera.lookAt(0, 0.9, 0);
    demo.room.update(dt, titleT * 12, camera.position);
    renderPass.scene = demo.scene;
  } else if (engine.level) {
    if (playing) {
      engine.stats.time += dt;
      const st = engine.roomState;
      const timed = st && ['hard', 'daily', 'custom'].includes(st.mode);
      if (st && st.mode !== 'editor' && (settings.showTimer || timed)) {
        const m = engine.splitMsg && engine.splitMsg.until > engine.stats.time ? engine.splitMsg : null;
        const label = !st ? '' : st.mode === 'daily' ? 'daily ' + st.seed : st.mode === 'hard' ? 'hard' : st.mode === 'custom' ? st.custom.title : '';
        ui.setTimer(engine.stats.time, m ? m.text : label, m ? m.cls : '');
      } else ui.setTimer(null);
      if (st) {
        if (!st.maxMana) st.maxMana = 100;
        if (st.mana === undefined || Number.isNaN(st.mana)) st.mana = st.maxMana;
        const rate = (engine.level instanceof RoomLevel ? 10 : 16) * (st.mode === 'hard' ? 0.7 : 1);
        st.mana = st.mode === 'editor' ? st.maxMana : Math.min(st.maxMana, st.mana + rate * dt);
        ui.setMana(st.mode === 'editor' ? null : st.mana, st.maxMana);
      }
      player.update(dt);
      engine.level.update(dt);
      if (engine.pendingSave) engine.autosave();
    } else if (engine.mode === 'play' || engine.mode === 'dead' || engine.mode === 'transition') {
      player.update(0);
    }
  }
  updateAudio(dt);
  grain.uniforms.time.value = (grain.uniforms.time.value + dt) % 100;
  composer.render(dt);
}

// key X drops the lamp

// debug / test hook (used by automated playtests)
(window as any).__room = { enterPhoto, exitPhoto, engine, ui, input, newGame, continueGame, showTitle, startRoom, freshRoomState };

initPhoto();
showTitle();
frame();
