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

import { initInput, input, consumeActions, requestLock, releaseLock, pollGamepad, setPadListener } from './input.js';
import * as ui from './ui.js';
import { initAudio, setVolumes, updateAudio, playAmbience, setHeartbeat, sfx } from './audio.js';
import { Player } from './player.js';
import { RoomLevel, freshRoomState, todaySeed } from './game.js';
import { HellLevel } from './hell.js';
import { WitchLevel } from './witch.js';
import { INTRO, HELL_ENTRY, ENDING, WITCH_INTRO, WITCH_ENDING } from './story.js';
import {
  loadGame, saveGame, hasSave, clearSave, loadSettings, saveSettings, hasSavedSettings,
  ACHIEVEMENTS, isUnlocked, unlockedCount, setAchievementListener, unlock, bestFor, recordRun,
} from './save.js';

const canvas = document.getElementById('view');
ui.initUI();
initInput(canvas);

const settings = loadSettings();
if (input.touch && !hasSavedSettings()) settings.quality = 'low';

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
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

// ---------------------------------------------------------------- engine
const player = new Player(camera);
player.sensitivity = settings.sensitivity; player.invertY = settings.invertY;

const engine = {
  camera, player, renderer,
  quality: settings.quality,
  touch: input.touch,
  level: null,
  mode: 'title',          // title | play | dead | transition
  paused: false,
  stats: { time: 0, deaths: 0, conjured: 0, splits: {} },
  roomState: null,
  saveT: 0,

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
    const inHell = this.level instanceof HellLevel || this.level instanceof WitchLevel;
    ui.closeDialog(true);
    ui.screen(`<div class="title-wrap"><h1 style="font-size:64px">You died</h1><p class="sub">${ui.escapeHtml(why || 'it happens')}</p>
      <div class="actions"><button class="btn primary" id="retry">${inHell ? 'Retry the fight' : 'Load last save'}</button><button class="btn" id="totitle">Back to title</button></div></div>`);
    document.getElementById('retry').onclick = () => { sfx.click(); continueGame(true); };
    document.getElementById('totitle').onclick = () => { sfx.click(); showTitle(); };
  },

  autosave(force = false) {
    if (this.mode !== 'play' || !(this.level instanceof RoomLevel)) return;
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
        { label: 'Not today', onClick: () => { clearSave(); showEnding('escape'); } },
      ],
    });
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
    await ui.story(WITCH_ENDING);
    showEnding('witch');
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
  ui.screen(`<div class="title-wrap">
      <h1>ROOM</h1>
      <div class="sub">a wizard · a room · a way through hell</div>
      <div class="actions">
        ${cont ? '<button class="btn primary" id="t-continue">Continue</button>' : ''}
        <button class="btn ${cont ? '' : 'primary'}" id="t-new">New game</button>
        <button class="btn" id="t-help">How to play</button>
        <button class="btn" id="t-ach">Achievements (${unlockedCount()}/${ACHIEVEMENTS.length})</button>
        <button class="btn" id="t-settings">Settings</button>
      </div>
      <div class="foot">A 3D reimagining of “Room”, a Java command-line game.<br>Headphones recommended.</div>
    </div>`, { clear: true });
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = () => { initAudio(); sfx.click(); fn(); }; };
  on('t-continue', () => continueGame());
  on('t-new', () => { if (cont) ui.dialog({ title: 'Start over?', html: '<p>Your saved progress will be overwritten.</p>', buttons: [{ label: 'Yes, new game', cls: 'primary', onClick: chooseMode }, { label: 'Cancel' }] }); else chooseMode(); });
  on('t-help', () => showHelp());
  on('t-ach', () => showAchievements());
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

function showEnding(kind = 'escape') {
  engine.mode = 'title';
  ui.showHUD(false); ui.setTimer(null);
  const t = engine.stats.time;
  const st = engine.roomState || {};
  const mode = st.mode || 'normal';
  const prev = bestFor(mode, st.seed);
  const splits = engine.stats.splits || {};
  const record = recordRun(mode, st.seed, t, splits);
  const rows = Object.entries(splits).map(([k, v]) => {
    const b = prev && prev.splits && prev.splits[k];
    return `<tr><td>${k}</td><td>${ui.fmtTime(v)}</td><td class="${b === undefined ? '' : v <= b ? 'ahead' : 'behind'}">${b === undefined ? '' : ui.fmtDelta(v - b)}</td></tr>`;
  }).join('');
  const modeName = mode === 'daily' ? `daily ${st.seed}` : mode;
  ui.screen(`<div class="title-wrap">
    <h1 style="font-size:clamp(36px,7vw,64px)">${kind === 'witch' ? 'The Apprentice' : 'You escaped'}</h1>
    <div class="sub">${kind === 'witch' ? 'kraken nailed · witch defeated' : 'kraken 2.0 · nailed'} <span class="mode-badge">${modeName}</span></div>
    <div class="stats">Time ........ ${ui.fmtTime(t)}${record ? ' ★ new best!' : prev ? ` (best ${ui.fmtTime(prev.total)})` : ''}<br>Deaths ...... ${engine.stats.deaths}<br>Conjured .... ${engine.stats.conjured} things<br>Achievements  ${unlockedCount()}/${ACHIEVEMENTS.length}</div>
    ${rows ? `<table class="splits">${rows}</table>` : ''}
    <div class="actions" style="margin-top:22px"><button class="btn primary" id="e-ach">Achievements</button><button class="btn" id="e-title">Back to title</button></div>
    <div class="foot">${kind === 'witch' ? 'Thanks for playing ROOM — all three parts.' : 'The rematch is waiting whenever you are: escape again and say yes.'}</div></div>`);
  document.getElementById('e-ach').onclick = () => showAchievements();
  document.getElementById('e-title').onclick = () => showTitle();
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
  const box = ui.dialog({
    title: 'Settings',
    html: `
      <div class="setting"><span>Music</span><input type="range" id="s-music" min="0" max="1" step="0.05" value="${settings.music}"></div>
      <div class="setting"><span>Sound effects</span><input type="range" id="s-sfx" min="0" max="1" step="0.05" value="${settings.sfx}"></div>
      <div class="setting"><span>Look sensitivity</span><input type="range" id="s-sens" min="0.3" max="2.5" step="0.1" value="${settings.sensitivity}"></div>
      <div class="setting"><span>Speedrun timer</span><input type="checkbox" id="s-timer" ${settings.showTimer ? 'checked' : ''}></div>
      <div class="setting"><span>Invert look Y</span><input type="checkbox" id="s-inv" ${settings.invertY ? 'checked' : ''}></div>
      <div class="setting"><span>Graphics</span><select id="s-q"><option value="high" ${settings.quality === 'high' ? 'selected' : ''}>High (shadows, bloom)</option><option value="low" ${settings.quality === 'low' ? 'selected' : ''}>Low (faster)</option></select></div>`,
    buttons: [{ label: 'Done' }],
  });
  const upd = () => {
    settings.music = +box.querySelector('#s-music').value;
    settings.sfx = +box.querySelector('#s-sfx').value;
    settings.sensitivity = +box.querySelector('#s-sens').value;
    settings.invertY = box.querySelector('#s-inv').checked;
    settings.showTimer = box.querySelector('#s-timer').checked;
    settings.quality = box.querySelector('#s-q').value;
    setVolumes(settings.music, settings.sfx);
    player.sensitivity = settings.sensitivity; player.invertY = settings.invertY;
    engine.quality = settings.quality; applyQuality();
    saveSettings(settings);
  };
  box.querySelectorAll('input,select').forEach(el => el.addEventListener('input', upd));
}

function pauseMenu() {
  if (engine.mode !== 'play') return;
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
  const dt = Math.min(0.05, clock.getDelta());
  const busy = ui.isDialogOpen() || !document.getElementById('screen').classList.contains('hidden');
  const playing = engine.mode === 'play' && engine.level && !engine.paused;
  input.enabled = playing && !busy;
  if (busy && input.locked) releaseLock();

  pollGamepad(dt);
  const actions = consumeActions();
  if (engine.mode === 'play' && engine.level) {
    for (const a of actions) {
      if (a === 'pause' || a === 'unlocked') { if (!busy) pauseMenu(); continue; }
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
      if (settings.showTimer || (st && st.mode !== 'normal')) {
        const m = engine.splitMsg && engine.splitMsg.until > engine.stats.time ? engine.splitMsg : null;
        ui.setTimer(engine.stats.time, m ? m.text : (st && st.mode !== 'normal' ? (st.mode === 'daily' ? 'daily ' + st.seed : 'hard') : ''), m ? m.cls : '');
      } else ui.setTimer(null);
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
addEventListener('keydown', (e) => { if (e.code === 'KeyX' && input.enabled && !e.repeat) input.actions.push('drop'); });

// debug / test hook (used by automated playtests)
window.__room = { engine, ui, input, newGame, continueGame, showTitle, startRoom, freshRoomState };

showTitle();
frame();
