import * as THREE from 'three';
// UI fonts, bundled (latin subsets load on demand)
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-700.css';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { applyLook } from './look';
import { loadAssets, modelIds, animated } from './assets';

// subtle film grain + lens vignette + per-area colour grade, applied after tone mapping
const GrainShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, amount: { value: 0.045 }, tint: { value: new THREE.Vector3(1, 1, 1) }, sat: { value: 1 }, contrast: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time; uniform float amount; uniform vec3 tint; uniform float sat; uniform float contrast; varying vec2 vUv;
    float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + time) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      c.rgb = mix(vec3(dot(c.rgb, vec3(0.299, 0.587, 0.114))), c.rgb, sat);
      c.rgb = clamp((c.rgb - 0.5) * contrast + 0.5, 0.0, 1.0) * tint;
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
import { Cutscene } from './cutscene';
import { RogueRoom, UPGRADES, newRun } from './roguelike';
import { seededRandom } from './state';
import { Peer } from './net';
import { CoopLevel } from './coop';
import { RoomBossLevel } from './roomboss';
import { Cat, catAdopted, catSettings, saveCat } from './cat';
import { SHOP, PAY, coins, owned, earn, buy, equip, equipped, onCoins } from './shop';
import { runDialogue } from './dialogue';
import { setVoiceEnabled, voiceAvailable } from './voice';
import { setIntensity, setSurface, setLowHealth } from './audio';
import { CATALOG } from './models';
import { knows } from './spells';

const CHAPTERS_KEY = 'room3d.chapters.v1';
const chaptersDone = (): string[] => { try { return JSON.parse(localStorage.getItem(CHAPTERS_KEY) || '[]'); } catch (e) { return []; } };
function markChapter(id) {
  const s = new Set(chaptersDone()); s.add(id);
  try { localStorage.setItem(CHAPTERS_KEY, JSON.stringify([...s])); } catch (e) { /* ignore */ }
}

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
import { INTRO, NGPLUS_INTRO, LANDLORD_INTRO, LANDLORD_END, HELL_ENTRY, ENDING, WITCH_INTRO, WITCH_ENDING, WITCH_TALK } from './story';
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
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 300);
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(new THREE.Scene(), camera);
// High quality renders through N8AO instead (ambient occlusion: soft contact shadows),
// loaded on first use so low quality never downloads it
let aoPass: any = null, aoLoading = false;
function ensureAO() {
  if (aoPass || aoLoading) return;
  aoLoading = true;
  import('n8ao').then(({ N8AOPass }) => {
    aoPass = new N8AOPass(renderPass.scene, camera, 512, 512);
    Object.assign(aoPass.configuration, { aoRadius: 1.1, distanceFalloff: 0.7, intensity: 2.4, halfRes: true, gammaCorrection: false, color: new THREE.Color(0x0a0408) });
    composer.insertPass(aoPass, 1);
    applyQuality();
  }).catch(() => { aoLoading = false; });
}
function setScene(s) { renderPass.scene = s; if (aoPass) aoPass.scene = s; }
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 0.82);
const grain = new ShaderPass(GrainShader);
composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(new OutputPass()); composer.addPass(grain);

// adaptive resolution: drop the render scale when frames are slow, raise it back when fast
let resScale = 1, slowT = 0, fastT = 0, frameEma = 16, lastNow = performance.now(), fpsShown = 0;
function adaptResolution() {
  const now = performance.now(), ms = now - lastNow; lastNow = now;
  frameEma = frameEma * 0.92 + Math.min(ms, 200) * 0.08;
  const fpsEl = document.getElementById('fps');
  if (settings.showFps) { if (now - fpsShown > 500) { fpsShown = now; fpsEl.textContent = `${Math.round(1000 / frameEma)} fps · ${Math.round(resScale * 100)}%`; } fpsEl.classList.remove('hidden'); } else fpsEl.classList.add('hidden');
  if (!settings.autoRes || engine.mode !== 'play' || document.hidden) { slowT = fastT = 0; return; }
  const dt = ms / 1000;
  if (frameEma > 25) { slowT += dt; fastT = 0; if (slowT > 1.5 && resScale > 0.5) { resScale = Math.max(0.5, +(resScale - 0.15).toFixed(2)); applyQuality(); slowT = 0; } }
  else if (frameEma < 15) { fastT += dt; slowT = 0; if (fastT > 4 && resScale < 1) { resScale = Math.min(1, +(resScale + 0.1).toFixed(2)); applyQuality(); fastT = 0; } }
  else slowT = fastT = 0;
}

function applyQuality() {
  const high = settings.quality === 'high';
  renderer.setPixelRatio(Math.min(devicePixelRatio, high ? 2 : 1) * resScale);
  renderer.shadowMap.enabled = high;
  bloom.enabled = high;
  if (high) ensureAO();
  if (aoPass) { aoPass.enabled = high; renderPass.enabled = !high; } else renderPass.enabled = true;
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
  setVoiceEnabled(settings.voice);
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
    cost = Math.round(cost * (s.costMul || 1));
    if (s.mana === undefined) { s.mana = s.maxMana = 100; }
    if (s.mana < cost) {
      sfx.locked(); ui.manaEmpty();
      if (performance.now() - (this.manaMsgT || 0) > 2500) { this.manaMsgT = performance.now(); ui.log(`Not enough mana (needs ${cost}). It refills on its own.`, 'warn'); }
      return false;
    }
    s.mana -= cost;
    return true;
  },

  // ------------------------------------------------------------ co-op
  startCoop(peer) {
    if (peer.closed) return;
    ui.closeDialog(true); ui.hideScreen();
    this.peer = peer;
    this.stats = { time: 0, deaths: 0, conjured: 0, splits: {} };
    const st: any = freshRoomState('coop');
    Object.assign(st, { lamp: 'hand', lampOn: true, mana: 100, maxMana: 100 });
    this.roomState = st;
    this.mode = 'play';
    ui.showHUD(true);
    this.setLevel(new CoopLevel(this, st, peer));
    sfx.win();
  },
  coopDone() {
    earn(PAY.coop, 'co-op');
    unlock('coop');
    this.mode = 'title';
    releaseLock(); ui.showHUD(false); ui.setTimer(null);
    ui.screen(`<div class="title-wrap"><h1 style="font-size:clamp(34px,7vw,60px)">Escaped together!</h1>
      <div class="sub">the twin room</div><div class="stats">Time ........ ${ui.fmtTime(this.stats.time)}</div>
      <div class="actions" style="margin-top:18px"><button class="btn primary" id="c-title">Back to title</button></div></div>`);
    document.getElementById('c-title').onclick = () => { sfx.click(); showTitle(); };
  },
  coopLost() {
    this.mode = 'title';
    ui.dialog({ title: 'Disconnected', html: '<p>Your partner left (or the connection dropped).</p>', buttons: [{ label: 'Back to title', onClick: () => showTitle() }], dismissable: false });
  },

  // ------------------------------------------------------------ endless mode
  startRun(daily = false) {
    initAudio();
    ui.closeDialog(true); ui.hideScreen();
    this.run = newRun(daily, daily ? 'daily-' + todaySeed() : null);
    this.stats = { time: 0, deaths: 0, conjured: 0, splits: {} };
    this.nextRunRoom();
  },

  nextRunRoom() {
    const r = this.run;
    const st: any = freshRoomState('rogue');
    Object.assign(st, { hearts: r.hearts, maxHearts: r.maxHearts, maxMana: r.maxMana, mana: r.maxMana, regen: r.regen, costMul: r.costMul, lamp: 'hand', lampOn: true, shoes: 'shoes' });
    this.roomState = st;
    this.mode = 'play';
    ui.showHUD(true);
    const room = new RogueRoom(this, st, r);
    this.setLevel(room);
    ui.toast(`🏚️ Room ${r.depth + 1}`, room.intro);
  },

  runRoomCleared() {
    const r = this.run;
    r.hearts = this.roomState.hearts;
    r.depth++;
    earn(PAY.room * (1 + Math.floor(r.depth / 5)), `room ${r.depth}`);
    sfx.win();
    if (r.depth === 5) unlock('rogue5');
    if (r.depth === 10) unlock('rogue10');
    if (r.depth === 15) unlock('rogue15');
    releaseLock();
    const rnd = seededRandom(r.seed + ':up:' + r.depth);
    const offer = UPGRADES.filter(u => !(u.id === 'nose' && r.nose) && !(u.id === 'umbrella' && r.umbrella) && !(u.id === 'heal' && r.hearts >= r.maxHearts)).sort(() => rnd() - 0.5).slice(0, 3);
    ui.dialog({
      title: `Room ${r.depth} cleared!`,
      html: `<p>Choose one upgrade for the rest of the run. (❤️ ${r.hearts}/${r.maxHearts})</p>`,
      dismissable: false,
      buttons: offer.map(u => ({ label: `${u.icon} <b>${u.name}</b> — ${u.desc}`, onClick: () => { u.apply(r); r.upgrades.push(u.id); this.nextRunRoom(); if (!input.touch) requestLock(); } })),
    });
  },

  runOver(why) {
    const r = this.run;
    this.run = null;
    this.mode = 'title';
    releaseLock(); setHeartbeat(0);
    ui.closeDialog(true); ui.showHUD(false); ui.setTimer(null);
    const entry = { depth: r.depth, time: Math.round(this.stats.time * 10) / 10, daily: r.daily ? todaySeed() : null, at: Date.now() };
    const board = loadRuns(); board.push(entry); board.sort((a, b) => b.depth - a.depth || a.time - b.time);
    saveRuns(board.slice(0, 20));
    const rank = board.indexOf(entry) + 1;
    ui.screen(`<div class="title-wrap"><h1 style="font-size:clamp(34px,7vw,60px)">Run over</h1>
      <div class="sub">${ui.escapeHtml(why || '')}</div>
      <div class="stats">Rooms cleared ${r.depth}<br>Time ........ ${ui.fmtTime(entry.time)}<br>Upgrades .... ${r.upgrades.map(id => UPGRADES.find(u => u.id === id).icon).join(' ') || '—'}<br>Rank ........ #${rank}${r.daily ? ' (daily)' : ''}</div>
      ${leaderboardHtml(entry.at)}
      <div class="actions" style="margin-top:18px"><button class="btn primary" id="r-again">New run</button><button class="btn" id="r-title">Back to title</button></div></div>`);
    document.getElementById('r-again').onclick = () => { sfx.click(); this.startRun(false); };
    document.getElementById('r-title').onclick = () => { sfx.click(); showTitle(); };
  },

  // ---------------------------------------------------------------- boss rush
  startRush() {
    initAudio();
    ui.closeDialog(true); ui.hideScreen();
    const st: any = freshRoomState('rush');
    Object.assign(st, { shoes: 'shoes', lamp: 'hand', lampOn: true, maxMana: 100, mana: 100 });
    st.flags.lemon = true;
    Object.keys(CATALOG).filter(t => CATALOG[t].kind === 'floor' && t !== 'pc').forEach((t, i) => { st.placed['r' + i] = { type: t, slot: i }; });
    this.roomState = st;
    this.rush = { stage: 'kraken' };
    this.stats = { time: 0, deaths: 0, conjured: 0, splits: {} };
    this.mode = 'play';
    ui.showHUD(true);
    this.setLevel(new HellLevel(this, st));
    playAmbience('rush');
    ui.toast('⚔️ Boss rush', 'Round 1: KRAKEN 2.0');
    if (!input.touch) requestLock();
  },

  rushNext() {
    this.split('Kraken');
    const s = this.roomState;
    s.hearts = Math.min(s.maxHearts, s.hearts + 1); s.mana = s.maxMana;
    this.rush.stage = 'witch';
    const wl = new WitchLevel(this, s);
    this.setLevel(wl);
    wl.phase = 'fight'; wl.refreshHUD();
    playAmbience('rush');
    ui.setHearts(s.hearts, s.maxHearts);
    ui.toast('⚔️ Round 2', 'The Witch of Ember Hollow (+1 heart)');
  },

  rushDone() {
    earn(PAY.rush, 'boss rush');
    this.split('Witch');
    this.rush = null;
    this.mode = 'title';
    releaseLock(); setHeartbeat(0);
    ui.closeDialog(true); ui.showHUD(false); ui.setTimer(null);
    const entry = { time: Math.round(this.stats.time * 10) / 10, hearts: this.roomState.hearts, at: Date.now() };
    const board = loadRush(); board.push(entry); board.sort((a, b) => a.time - b.time);
    saveRush(board.slice(0, 10));
    unlock('rush');
    if (entry.time < 180) unlock('rushfast');
    const sp = this.stats.splits;
    ui.screen(`<div class="title-wrap"><h1 style="font-size:clamp(34px,7vw,60px)">Rush cleared!</h1>
      <div class="sub">two bosses, no breaks</div>
      <div class="stats">Kraken ...... ${ui.fmtTime(sp.Kraken || 0)}<br>Witch ....... ${ui.fmtTime(entry.time - (sp.Kraken || 0))}<br>Total ....... ${ui.fmtTime(entry.time)}<br>Hearts left . ${'♥'.repeat(entry.hearts)}</div>
      ${rushBoardHtml(entry.at)}
      <div class="actions" style="margin-top:18px"><button class="btn primary" id="r-again">Rush again</button><button class="btn" id="r-title">Back to title</button></div></div>`);
    document.getElementById('r-again').onclick = () => { sfx.click(); this.startRush(); };
    document.getElementById('r-title').onclick = () => { sfx.click(); showTitle(); };
  },

  rushOver(why) {
    const stage = this.rush.stage;
    this.rush = null;
    this.mode = 'title';
    releaseLock(); setHeartbeat(0);
    ui.closeDialog(true); ui.showHUD(false); ui.setTimer(null);
    ui.screen(`<div class="title-wrap"><h1 style="font-size:clamp(34px,7vw,60px)">Rush over</h1>
      <div class="sub">${ui.escapeHtml(why || '')}</div>
      <div class="stats">Fell to ...... ${stage === 'kraken' ? 'Kraken 2.0' : 'the witch'}<br>Time ........ ${ui.fmtTime(this.stats.time)}</div>
      ${rushBoardHtml()}
      <div class="actions" style="margin-top:18px"><button class="btn primary" id="r-again">Try again</button><button class="btn" id="r-title">Back to title</button></div></div>`);
    document.getElementById('r-again').onclick = () => { sfx.click(); this.startRush(); };
    document.getElementById('r-title').onclick = () => { sfx.click(); showTitle(); };
  },

  playCutscene(shots) {
    this.cutscene = new Cutscene(camera, shots);
    document.body.classList.add('cutscene');
    releaseLock();
    return this.cutscene.promise.then(() => {
      this.cutscene = null;
      document.body.classList.remove('cutscene');
      if (!input.touch) requestLock();
    });
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
    this.paused = false;
    this.cat = null;
    if (demo) { demo.deactivate(); demo = null; }
    if (this.level) this.level.deactivate();
    this.level = level;
    setScene(level.scene);
    level.activate();
    this.refreshTouchButtons();
    this.spawnCat();
    // colour grade per area: [tint r, g, b, saturation, contrast]
    const name = level.chapterId || (level instanceof RoomLevel ? 'room' : level instanceof HellLevel ? 'hell' : level instanceof WitchLevel ? 'witch' : level instanceof RoomBossLevel ? 'landlord' : '');
    applyLook(renderer, level.scene, name);
    const G = { room: [1.02, 0.99, 0.95, 1.03, 1.02], hell: [1.08, 0.94, 0.86, 1.15, 1.1], witch: [0.94, 0.96, 1.1, 1.08, 1.05], upside: [1.0, 0.94, 1.1, 1.1, 1.05], library: [0.92, 1.03, 1.08, 1.05, 1.03], clockwork: [1.07, 1.0, 0.88, 1.0, 1.08] }[name] || [1, 1, 1, 1.04, 1.03];
    grain.uniforms.tint.value.set(G[0], G[1], G[2]); grain.uniforms.sat.value = G[3]; grain.uniforms.contrast.value = G[4];
  },

  // the cat comes along to calm places (not boss fights) once adopted and not sent off
  spawnCat() {
    const lv = this.level;
    if (!catAdopted() || catSettings().away || !(lv instanceof RoomLevel || lv instanceof ChamberLevel) || lv.cat) return;
    this.cat = new Cat(this, lv);
  },
  toggleCat() {
    if (this.cat) {
      this.cat.dispose(); this.cat = null;
      saveCat({ ...catSettings(), away: true });
      ui.log('The cat flicks its tail and saunters off through a gap that wasn\'t there a second ago.');
      return;
    }
    const first = !catAdopted();
    if (first && !this.spend(15)) return;
    saveCat({ ...catSettings(), adopted: true, away: false });
    this.spawnCat();
    if (!this.cat) { ui.log('The cat refuses to come here. Fair.', 'warn'); return; }
    sfx.meow(); sfx.conjure();
    if (first) { unlock('familiar'); ui.log('A cat drops from the sky, lands on its feet (obviously) and decides you are its person now.', 'good'); }
    else ui.log('The cat appears from nowhere, as cats do.', 'good');
  },

  // Lamp and Search only mean something in the room; elsewhere Search casts Shrink.
  refreshTouchButtons() {
    const lv = this.level, room = lv instanceof RoomLevel;
    const searchLabel = room || (lv instanceof RogueRoom && lv.kind === 'hunt') ? 'Search' : lv instanceof RogueRoom && lv.kind === 'memory' ? 'Peek' : lv instanceof RogueRoom && lv.kind === 'levers' ? 'Replay' : this.roomState && this.roomState.flags && knows(this.roomState, 'shrink') ? 'Shrink' : '';
    document.querySelectorAll<any>('#touch-buttons .tbtn').forEach(b => {
      if (b.dataset.act === 'lamp') b.classList.toggle('hidden', !room);
      if (b.dataset.act === 'search') { b.classList.toggle('hidden', !searchLabel); if (searchLabel) b.textContent = searchLabel; }
    });
  },

  damage(n, why) {
    const s = this.roomState;
    if (this.mode !== 'play' || s.hearts <= 0) return;
    s.hearts = Math.max(0, s.hearts - n);
    sfx.hurt(); ui.flash('#ff2030', 0.45, 500); player.addShake(0.8);
    if (this.cat) this.cat.judge();
    ui.setHearts(s.hearts, s.maxHearts);
    if (s.hearts <= 0) this.die(why);
  },

  die(why) {
    if (this.run) { this.runOver(why); return; }
    if (this.rush) { this.rushOver(why); return; }
    if (this.level instanceof CoopLevel) {
      this.roomState.hearts = this.roomState.maxHearts;
      ui.log('Your partner drags you back to your feet. (Co-op: no game over.)', 'good');
      ui.setHearts(this.roomState.hearts, this.roomState.maxHearts);
      return;
    }
    this.mode = 'dead';
    this.stats.deaths++;
    setHeartbeat(0);
    releaseLock();
    const inHell = this.level instanceof HellLevel || this.level instanceof WitchLevel || this.level instanceof ChamberLevel || this.level instanceof RoomBossLevel;
    ui.closeDialog(true);
    ui.screen(`<div class="title-wrap"><h1 style="font-size:64px">You died</h1><p class="sub">${ui.escapeHtml(why || 'it happens')}</p>
      <div class="actions"><button class="btn primary" id="retry">${inHell ? (this.level instanceof ChamberLevel ? 'Retry the lesson' : 'Retry the fight') : 'Load last save'}</button><button class="btn" id="totitle">Back to title</button></div></div>`);
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
    ui.showHUD(true);
    this.split('Hell');
    markChapter('room');
    const hell = new HellLevel(this, s);
    this.setLevel(hell);
    hell.phase = 'intro';
    await this.playCutscene([
      { from: [0, 30, 30], to: [6, 16, 6], lookFrom: [0, 0, -15], lookTo: [0, 4, -15], dur: 4, text: 'Beyond the door: a burning sea.' },
      { from: [10, 3, -2], to: [-8, 4, -3], lookFrom: [0, 5, -15], lookTo: [0, 6, -15], dur: 3.6, text: 'And something enormous, waking up.' },
      { from: [0, 2.5, 8], to: [0, 1.62, 13], lookFrom: [0, 6, -15], lookTo: [0, 4, -15], dur: 2.4, text: 'KRAKEN 2.0' },
    ]);
    hell.phase = 'fight';
    hell.refreshHUD();
  },

  async ending() {
    earn(PAY.boss, 'Kraken 2.0');
    if (this.rush) { this.rushNext(); return; }
    earn(PAY.escape, 'escaped the room');
    this.mode = 'transition';
    releaseLock();
    ui.flash('#ffffff', 1, 2000);
    this.split('Escape');
    if (this.stats.time < 15 * 60 && !this.stats.partial) unlock('speed');
    if (this.roomState && this.roomState.mode === 'hard') unlock('hardmode');
    if (this.roomState && this.roomState.mode === 'daily') unlock('daily');
    markChapter('hell');
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
    earn(PAY.custom, 'custom room');
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
    await ui.story(WITCH_INTRO.slice(0, 1));
    this.mode = 'play';
    ui.showHUD(true);
    delete s.talk;
    const wl = new WitchLevel(this, s);
    this.setLevel(wl);
    wl.phase = 'intro';
    await this.playCutscene([
      { from: [-14, 9, 14], to: [14, 9, 14], lookFrom: [0, 1, 0], lookTo: [0, 1, 0], dur: 5, text: 'Dusk. Fireflies. A ring of standing stones.', who: 'narrator' },
      { from: [0, 5, -2], to: [0, 2.6, 4], lookFrom: [0, 4, -8], lookTo: [0, 3, -8], dur: 3, text: s.mode === 'ngplus' ? '"YOU again. You\'re like a cursed boomerang."' : '"Rematch, then. I did ask."', who: 'witch' },
    ]);
    const effects = await runDialogue(WITCH_TALK, 'start', { flags: s.flags });
    wl.applyTalk(effects);
    s.talk = effects;
    saveGame({ version: 1, act: 'witch', room: s, stats: this.stats, savedAt: Date.now() });
    wl.phase = 'fight';
    wl.refreshHUD();
    if (!input.touch) requestLock();
  },

  async finale() {
    earn(PAY.boss, 'the witch');
    if (this.rush) { this.rushDone(); return; }
    this.mode = 'transition';
    releaseLock();
    ui.flash('#ffffff', 0.8, 1500);
    this.split('Rematch');
    markChapter('witch');
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
    earn(PAY.lesson, 'lesson passed');
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
      '...and somewhere much closer, in a small dark room, the wallpaper opens one eye.',
      'The witch claps, slowly. "Three for three. I didn\'t think you\'d manage the tower. Nobody manages the tower."',
      '"Next term: the Witch Exams. Bring a sofa."',
      '<em>PART 4 COMPLETE</em>',
    ]).then(() => showEnding('lessons'));
  },

  // ---------------------------------------------------------------- act 5
  async startLandlord() {
    this.mode = 'transition';
    releaseLock();
    ui.closeDialog(true); ui.hideScreen();
    const s = this.roomState && this.roomState.flags ? this.roomState : profileState();
    s.hearts = s.maxHearts; s.maxMana = s.maxMana || 100; s.mana = s.maxMana;
    delete s.lesson;
    this.roomState = s;
    if (!this.stats) this.stats = { time: 0, deaths: 0, conjured: 0, splits: {} };
    saveGame({ version: 1, act: 'landlord', room: s, stats: this.stats, savedAt: Date.now() });
    await ui.story(LANDLORD_INTRO);
    this.mode = 'play';
    ui.showHUD(true);
    const lv = new RoomBossLevel(this, s);
    this.setLevel(lv);
    lv.phase = 'intro';
    await this.playCutscene([
      { from: [3.6, 2.7, 3.6], to: [-3.6, 2.7, 3.6], lookFrom: [0, 1, 0], lookTo: [0, 1, 0], dur: 3.6, text: 'Back where it all started.' },
      { from: [0, 1.9, 2.2], to: [0, 1.1, 0.9], lookFrom: [0, 0, -1], lookTo: [0, 0, -0.2], dur: 2.6, text: 'The floorboards blink.' },
      { from: [0, 2.5, 4], to: [0, 1.62, 3], lookFrom: [0, 1.5, -4], lookTo: [0, 1.5, -4], dur: 2, text: 'THE ROOM' },
    ]);
    lv.phase = 'fight';
    lv.refreshHUD();
  },

  roomBossDone() {
    earn(PAY.act5, 'the room let you go');
    this.mode = 'transition';
    releaseLock();
    markChapter('landlord');
    clearSave();
    saveProfile(this.roomState);
    ui.story(LANDLORD_END).then(() => showEnding('checkout'));
  },

  async endWith(id) {
    if (this.roomState && this.roomState.mode === 'ngplus') unlock('ngplus');
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

setAchievementListener((a) => { ui.toast(`${a.icon} Achievement unlocked: <b>${a.name}</b>`, a.desc); sfx.achievement(); earn(PAY.achievement, 'achievement'); });
onCoins((n, why) => { if (document.getElementById('hud') && !document.getElementById('hud').classList.contains('hidden')) ui.log(`+${n} 🪙 ember coins${why ? ' — ' + why : ''}`, 'good'); });

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
  engine.run = null; engine.rush = null; engine.cat = null;
  if (engine.peer) { engine.peer.send({ t: 'bye' }); engine.peer.close(); engine.peer = null; }
  engine.mode = 'title'; engine.paused = false;
  ui.closeDialog(true); ui.showHUD(false); ui.setTimer(null); releaseLock();
  setHeartbeat(0); setLowHealth(0); playAmbience('title');
  if (engine.level) engine.level.deactivate();
  if (demo) demo.deactivate();
  demo = buildDemo(); engine.level = null;
  setScene(demo.scene); demo.scene.add(camera); applyLook(renderer, demo.scene, 'room');
  demo.refreshLighting(); setHeartbeat(0); ui.setVignette('');
  const cont = hasSave();
  const code = roomCodeFromHash();
  const shared = code ? decodeRoom(code) : null;
  const tile = (id, icon, label, sub = '') => `<button class="tile" id="${id}"><span class="ti">${icon}</span><span>${label}</span>${sub ? `<small>${sub}</small>` : ''}</button>`;
  ui.screen(`<div class="title-wrap title-main">
      <div class="title-head">
        <h1>ROOM</h1>
        <div class="sub">a wizard · a room · a way through hell</div>
      </div>
      <div class="title-menu">
        <div class="actions">
          ${shared ? `<button class="btn primary" id="t-shared">▶ Play shared room: “${ui.escapeHtml(shared.custom.title)}”</button>` : ''}
          ${cont ? `<button class="btn ${shared ? '' : 'primary'}" id="t-continue">Continue</button>` : ''}
          <button class="btn ${cont || shared ? '' : 'primary'}" id="t-new">New game</button>
          <button class="btn" id="t-campaign">📖 Campaign <span class="k" style="float:right">${chaptersDone().length + lessonsDone().length}/7</span></button>
        </div>
        <div class="tile-grid">
          ${tile('t-endless', '♾️', 'Endless')}
          ${tile('t-coop', '👥', 'Co-op')}
          ${tile('t-rush', '⚔️', 'Boss rush')}
          ${tile('t-shop', '🪙', 'Shop', `${coins()}`)}
          ${tile('t-editor', '🛠️', 'Editor')}
          ${tile('t-ach', '🏆', 'Awards', `${unlockedCount()}/${ACHIEVEMENTS.length}`)}
          ${tile('t-endings', '🎬', 'Endings', `${seenEndings().length}/${ENDING_IDS.length}`)}
          ${tile('t-settings', '⚙️', 'Settings')}
          ${tile('t-help', '❓', 'How to play')}
        </div>
      </div>
      <div class="foot">A 3D reimagining of “Room”, a Java command-line game. Headphones recommended.</div>
    </div>`, { clear: true });
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = () => { initAudio(); sfx.click(); fn(); }; };
  on('t-continue', () => continueGame());
  on('t-new', () => { if (cont) ui.dialog({ title: 'Start over?', html: '<p>Your saved progress will be overwritten.</p>', buttons: [{ label: 'Yes, new game', cls: 'primary', onClick: chooseMode }, { label: 'Cancel' }] }); else chooseMode(); });
  on('t-help', () => showHelp());
  on('t-editor', () => openEditor());
  on('t-campaign', () => showCampaign());
  on('t-endless', () => showEndless());
  on('t-coop', () => showCoop());
  on('t-rush', () => showRush());
  on('t-shop', () => showShop());
  on('t-lessons', () => ui.dialog({
    title: 'Part 4: The Three Lessons',
    buttons: [...LESSON_ORDER.map((id, i) => ({ label: `${lessonsDone().includes(id) ? '✅' : '▶'} ${LESSONS[id].title}`, disabled: i > 0 && !lessonsDone().includes(LESSON_ORDER[i - 1]), onClick: () => { engine.stats = { time: 0, deaths: 0, conjured: 0, splits: {} }; engine.startLesson(id); } })), { label: 'Back' }],
  }));
  on('t-shared', () => { const d = decodeRoom(roomCodeFromHash()); if (d) playCustom(d.custom, d.placed); });
  on('t-ach', () => showAchievements());
  on('t-endings', () => showEndings());
  on('t-settings', () => showSettings());
  // music starts on first interaction
  const kick = () => { initAudio(); if (engine.mode === 'title') playAmbience('title'); removeEventListener('pointerdown', kick); };
  addEventListener('pointerdown', kick);
}

function chooseMode() {
  const seed = todaySeed();
  const fmtBest = (b) => (b ? ` · best ${ui.fmtTime(b.total)}` : '');
  ui.dialog({
    title: 'New game',
    html: '<p class="muted">Hard mode: one heart, a faster Kraken that needs five pins. Daily room: the same seeded room for everyone today — pre-built furniture and a key hidden somewhere new. New Game+: all spells, the key moved, and both bosses on hard.</p>',
    buttons: [
      { label: `Normal${fmtBest(bestFor('normal'))}`, cls: 'primary', onClick: () => newGame('normal') },
      { label: `Hard — one heart${fmtBest(bestFor('hard'))}`, onClick: () => newGame('hard') },
      { label: `Daily room ${seed}${fmtBest(bestFor('daily', seed))}`, onClick: () => newGame('daily', seed) },
      seenEndings().length ? { label: `✨ New Game+ — all spells, angrier bosses${fmtBest(bestFor('ngplus'))}`, onClick: () => newGame('ngplus') }
        : { label: '🔒 New Game+ (see any ending first)', disabled: true },
      { label: 'Cancel' },
    ],
  });
}

async function newGame(mode = 'normal', seed = null) {
  initAudio();
  clearSave();
  ui.hideScreen();
  engine.mode = 'transition';
  engine.stats = { time: 0, deaths: 0, conjured: 0, splits: {} };
  playAmbience('dark');
  await ui.story(mode === 'ngplus' ? NGPLUS_INTRO : INTRO);
  const st = freshRoomState(mode, seed);
  if (mode === 'ngplus') { st.flags.wand = true; st.flags.spells = { levitate: true, shrink: true, blink: true }; }
  startRoom(st);
  if (mode !== 'normal') ui.log(mode === 'hard' ? 'HARD MODE: one heart. Don\'t look at your feet.' : mode === 'ngplus' ? 'NEW GAME+: the Ember Wand is back in your hand, and you remember Levitate, Shrink and Blink.' : `DAILY ROOM ${seed}: someone has already decorated...`, 'warn');
  ui.log('Total darkness. You can\'t see a thing, and you are far too scared to move.', 'lore');
  ui.log(`Open your spellbook (${input.touch ? 'Spells button' : 'Q'}) and conjure something.`);
}

function startRoom(state) {
  engine.roomState = state;
  engine.mode = 'play';
  ui.hideScreen(); ui.showHUD(true);
  engine.setLevel(new RoomLevel(engine, state));
  if (!input.touch) ui.log('Click the screen to look around with the mouse.');
}

function continueGame(fromDeath = false) {
  initAudio();
  const save = loadGame();
  const prev = engine.stats || {};
  if (!save) { if (fromDeath) { const st = engine.roomState || {}; newGame(st.mode && ['normal', 'hard', 'daily'].includes(st.mode) ? st.mode : 'normal', st.seed || null); } return; }
  engine.stats = save.stats || { time: 0, deaths: 0, conjured: 0 };
  if (fromDeath) {
    engine.stats.deaths = Math.max(engine.stats.deaths || 0, prev.deaths || 0);
    engine.stats.time = Math.max(engine.stats.time || 0, prev.time || 0);
  }
  ui.hideScreen();
  if (save.act === 'lesson') {
    engine.roomState = save.room;
    engine.startLesson(save.lesson, false);
    return;
  }
  if (save.act === 'landlord') {
    const s = save.room; s.hearts = s.maxHearts;
    engine.roomState = s;
    engine.mode = 'play'; ui.showHUD(true);
    const lv = new RoomBossLevel(engine, s);
    engine.setLevel(lv);
    lv.phase = 'fight'; lv.refreshHUD();
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
  const record = engine.stats.partial ? false : recordRun(mode, st.seed, t, splits);
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
    <div class="actions" style="margin-top:22px">${['apprentice', 'rival', 'true'].includes(kind) ? '<button class="btn primary" id="e-lessons">▶ Part 4: The Three Lessons</button>' : ''}${kind === 'lessons' ? '<button class="btn primary" id="e-act5">▶ Act 5: Checkout Time</button>' : ''}<button class="btn" id="e-ach">Achievements</button><button class="btn" id="e-end">Endings</button><button class="btn" id="e-title">Back to title</button></div>
    <div class="foot">${ENDINGS[kind].foot}<br>Endings found: ${seenEndings().length}/${ENDING_IDS.length}</div></div>`);
  document.getElementById('e-ach').onclick = () => showAchievements();
  document.getElementById('e-end').onclick = () => showEndings();
  const el = document.getElementById('e-lessons'); if (el) el.onclick = () => { sfx.click(); engine.startLesson('upside'); };
  const a5 = document.getElementById('e-act5'); if (a5) a5.onclick = () => { sfx.click(); engine.startLandlord(); };
  document.getElementById('e-title').onclick = () => showTitle();
}

const RUNS_KEY = 'room3d.runs.v1';
function loadRuns(): any[] { try { return JSON.parse(localStorage.getItem(RUNS_KEY) || '[]'); } catch (e) { return []; } }
function saveRuns(b) { try { localStorage.setItem(RUNS_KEY, JSON.stringify(b)); } catch (e) { /* ignore */ } }
const RUSH_KEY = 'room3d.rush.v1';
function loadRush(): any[] { try { return JSON.parse(localStorage.getItem(RUSH_KEY) || '[]'); } catch (e) { return []; } }
function saveRush(b) { try { localStorage.setItem(RUSH_KEY, JSON.stringify(b)); } catch (e) { /* storage full or blocked */ } }
function rushBoardHtml(mine = 0) {
  const b = loadRush().slice(0, 8);
  if (!b.length) return '';
  return `<table class="splits">${b.map((e, i) => `<tr${e.at === mine ? ' class="mine"' : ''}><td>#${i + 1} ⚔️</td><td>${'♥'.repeat(e.hearts)}</td><td>${ui.fmtTime(e.time)}</td></tr>`).join('')}</table>`;
}
function showShop() {
  const names = { flame: 'Lantern flames', cat: 'Cat coats' };
  const html = Object.keys(SHOP).map(slot => `<div class="section-label">${names[slot]}</div><div class="spell-grid">${SHOP[slot].map(it => {
    const own = owned(it.id), on = equipped(slot as any).id === it.id;
    return `<button class="spell${on ? ' on' : ''}" data-slot="${slot}" data-id="${it.id}"><span class="ico">${it.icon}</span><span class="nm">${it.name}</span><span class="ty">${on ? 'equipped' : own ? 'owned · equip' : `🪙 ${it.price}`}</span></button>`;
  }).join('')}</div>`).join('');
  const box = ui.dialog({
    title: `🪙 Shop · ${coins()} ember coins`,
    html: `<p class="muted">Earn ember coins by escaping, beating bosses, passing lessons, clearing endless rooms and unlocking achievements.${catAdopted() ? '' : ' (Cat coats apply once you summon the cat.)'}</p>${html}`,
    buttons: [{ label: 'Back' }],
  });
  box.querySelectorAll<any>('[data-id]').forEach(b => b.addEventListener('click', () => {
    const slot = b.dataset.slot, id = b.dataset.id;
    if (owned(id)) { equip(slot, id); sfx.click(); }
    else {
      const r = buy(slot, id);
      if (r === 'poor') { sfx.locked(); ui.toast('Not enough ember coins', 'Go escape something.'); return; }
      sfx.coin(); unlock('shopper');
    }
    showShop();
  }));
}

function showRush() {
  const open = chaptersDone().includes('hell');
  ui.dialog({
    title: '⚔️ Boss rush',
    html: `<p>Kraken 2.0, then the witch, back to back. One set of hearts (one comes back between fights), every piece of furniture, and the lemon. Fastest time wins.</p>${open ? '' : '<p class="muted">Beat Kraken 2.0 in the story to unlock the rush.</p>'}${rushBoardHtml()}`,
    buttons: [{ label: '⚔️ Start the rush', cls: 'primary', disabled: !open, onClick: () => engine.startRush() }, { label: 'Back' }],
  });
}

function leaderboardHtml(mine = 0) {
  const b = loadRuns().slice(0, 8);
  if (!b.length) return '';
  return `<table class="splits">${b.map((e, i) => `<tr${e.at === mine ? ' class="mine"' : ''}><td>#${i + 1} ${e.daily ? '📅 ' + e.daily : '♾️'}</td><td>${e.depth} rooms</td><td>${ui.fmtTime(e.time)}</td></tr>`).join('')}</table>`;
}
function codeBox(id, value = '', readonly = false) {
  return `<textarea id="${id}" rows="4" ${readonly ? 'readonly' : ''} spellcheck="false" style="width:100%;font:11px var(--mono);padding:8px;border-radius:8px;border:1px solid #45355e;background:#0d0a12;color:var(--good);resize:vertical">${value}</textarea>`;
}
function copyText(text) {
  const done = () => ui.toast('Copied!');
  if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, done); else done();
}
function showCoop() {
  ui.dialog({
    title: '👥 Co-op (two players)',
    html: `<p>Two wizards, one room. One of you hosts, the other joins. You swap two codes (by chat, email, anything) — there's no server.</p>
      <p class="muted">Peer-to-peer WebRTC. Works best on the same network; across the internet it uses a public STUN server to find each other, and some strict networks block it.</p>`,
    buttons: [{ label: '👑 Host a room', cls: 'primary', onClick: hostCoop }, { label: '🤝 Join a room', onClick: joinCoop }, { label: 'Back' }],
  });
}
async function hostCoop() {
  const peer = new Peer();
  peer.onOpen = () => engine.startCoop(peer);
  ui.dialog({ title: '👑 Host', html: '<p>Creating your invite code…</p>', onClose: () => peer.close(), buttons: [{ label: 'Cancel' }] });
  const code = await peer.createOffer();
  if (peer.closed) return;
  const b = ui.dialog({
    title: '👑 Host',
    onClose: () => { if (!peer.open) peer.close(); },
    html: `<p><b>1.</b> Send this invite code to your partner:</p>${codeBox('co-offer', code, true)}
      <p><b>2.</b> Paste the reply code they send back:</p>${codeBox('co-answer')}`,
    buttons: [
      { label: '📋 Copy invite', keep: true, onClick: () => copyText(code) },
      { label: '🔗 Connect', cls: 'primary', keep: true, onClick: async () => {
        try { await peer.acceptAnswer(b.querySelector<any>('#co-answer').value); ui.toast('Connecting…'); } catch (e) { ui.toast('That reply code didn\'t work.'); }
      } },
      { label: 'Cancel' },
    ],
  });
  b.querySelectorAll('textarea').forEach((t: any) => t.addEventListener('keydown', (e) => e.stopPropagation()));
}
function joinCoop() {
  const peer = new Peer();
  peer.onOpen = () => engine.startCoop(peer);
  const b = ui.dialog({
    title: '🤝 Join',
    onClose: () => { if (!peer.open) peer.close(); },
    html: `<p><b>1.</b> Paste the host's invite code:</p>${codeBox('co-offer')}<div id="co-reply"></div>`,
    buttons: [
      { label: 'Create my reply code', cls: 'primary', keep: true, onClick: async () => {
        try {
          const reply = await peer.acceptOffer(b.querySelector<any>('#co-offer').value);
          b.querySelector<any>('#co-reply').innerHTML = `<p><b>2.</b> Send this reply code back to the host, then wait:</p>${codeBox('co-answer', reply, true)}`;
          copyText(reply);
        } catch (e) { ui.toast('That invite code didn\'t work.'); }
      } },
      { label: 'Cancel' },
    ],
  });
  b.querySelectorAll('textarea').forEach((t: any) => t.addEventListener('keydown', (e) => e.stopPropagation()));
}

function showEndless() {
  const today = loadRuns().filter(e => e.daily === todaySeed()).sort((a, b) => b.depth - a.depth)[0];
  ui.dialog({
    title: '♾️ Endless rooms',
    html: `<p>Room after room, each one built from scratch: runes (upside-down, memory, mirrored), lever sequences, key hunts, pressure plates and the odd treasure room. Pick an upgrade after every room. One life.</p>${leaderboardHtml()}`,
    buttons: [
      { label: '▶ New run', cls: 'primary', onClick: () => engine.startRun(false) },
      { label: `📅 Daily run ${todaySeed()}${today ? ` · best ${today.depth} rooms` : ''}`, onClick: () => engine.startRun(true) },
      { label: 'Back' },
    ],
  });
}

function showCampaign() {
  const done = chaptersDone(), ld = lessonsDone();
  const fresh = () => { engine.stats = { time: 0, deaths: 0, conjured: 0, splits: {}, partial: true }; };
  const chapters = [
    { n: '1', id: 'room', title: 'The Room', sub: 'A dark room. A lamp. A very smug PC.', open: true, done: done.includes('room'), go: () => chooseMode() },
    { n: '2', id: 'hell', title: 'Go To Hell', sub: 'Kraken 2.0 and the giant nail.', open: done.includes('room'), done: done.includes('hell'), go: () => { fresh(); engine.roomState = profileState(); ui.hideScreen(); engine.enterHell(); } },
    { n: '3', id: 'witch', title: 'The Rematch', sub: 'The witch\'s garden at dusk.', open: done.includes('hell'), done: done.includes('witch'), go: () => { fresh(); engine.roomState = profileState(); ui.hideScreen(); ui.showHUD(true); engine.startWitch(); } },
    ...LESSON_ORDER.map((id, i) => ({ n: '4.' + (i + 1), id, title: LESSONS[id].title.split(' — ')[1], sub: ['Things fall up.', 'The water is rising.', 'The tower never stops turning.'][i], open: lessonsUnlocked() && (i === 0 || ld.includes(LESSON_ORDER[i - 1])), done: ld.includes(id), go: () => { fresh(); engine.startLesson(id); } })),
    { n: '5', id: 'landlord', title: 'Checkout Time', sub: 'The room you started in wakes up.', open: ld.includes('clockwork'), done: done.includes('landlord'), go: () => { fresh(); engine.roomState = profileState(); engine.startLandlord(); } },
  ];
  const box = ui.dialog({
    title: '📖 Campaign',
    html: `<p class="muted">Replay any chapter you've reached. Your spells and secrets come with you.</p><div class="chapters">${chapters.map((c, i) => `<button class="chapter ${c.open ? '' : 'locked'}" data-i="${i}" ${c.open ? '' : 'disabled'}><span class="num">${c.n}</span><span>${c.open ? c.title : '???'}<small>${c.open ? c.sub : 'Locked'}</small></span>${c.done ? '<span class="st">✓ done</span>' : ''}</button>`).join('')}</div>`,
    buttons: [{ label: 'Back' }],
  });
  box.querySelectorAll('.chapter').forEach((b: any) => b.addEventListener('click', () => {
    const c = chapters[+b.dataset.i];
    if (!c.open) return;
    initAudio(); sfx.click(); ui.closeDialog(true);
    if (hasSave()) ui.dialog({ title: 'Replace your save?', html: '<p>Playing this chapter replaces your saved progress (the Continue button).</p>', buttons: [{ label: 'Yes, play it', cls: 'primary', onClick: c.go }, { label: 'Cancel', onClick: showCampaign }] });
    else c.go();
  }));
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
      : `<p><kbd>WASD</kbd> move · <kbd>Shift</kbd> run · <kbd>Mouse</kbd> look<br><kbd>E</kbd> interact · <kbd>Q</kbd> spellbook · <kbd>Click</kbd> cast<br><kbd>R</kbd> rotate before casting · <kbd>Right-click</kbd> cancel<br><kbd>F</kbd> lamp · <kbd>G</kbd> search the floor · <kbd>X</kbd> put the lamp down<br><kbd>Space</kbd> stand up · <kbd>Esc</kbd> pause<br><kbd>/</kbd> classic command line (<i>create bed north</i>, <i>go sw</i>…)<br><kbd>V</kbd> photo mode · in boss fights <kbd>1</kbd>–<kbd>4</kbd> or <kbd>Q</kbd> switch spell</p>`}
    <p class="muted">Controller: left stick move · right stick look · <b>A</b> use · <b>RT</b> cast · <b>Y</b> spells · <b>X</b> lamp · <b>LB</b> search · <b>LT</b> rotate · <b>B</b> stand/cancel · <b>Start</b> pause. D-pad + A in menus.</p>
    <p><b>Mana</b> (blue bar) pays for conjuring and refills on its own. Read, sleep and watch TV to learn <b>Levitate</b>, <b>Shrink</b> and <b>Blink</b>.</p>
    <p><b>Modes:</b> 📖 Campaign replays chapters · ♾️ Endless builds a new room every time · 👥 Co-op swaps two codes with a friend · 🛠️ Editor lets you build and share your own room.</p>
    <p class="muted">Tip: things land on whatever cell you're looking at. Don't look at your own feet. Key bindings, captions, reduced motion and colour-blind telegraphs are in Settings.</p>`,
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
      <div class="setting"><span>Read story aloud<br><small class="muted">${voiceAvailable() ? 'uses your browser\'s voices' : 'not supported in this browser'}</small></span>${chk('s-voice', settings.voice)}</div>
      <div class="settings-section">Controls</div>
      <div class="setting"><span>Look sensitivity</span><input type="range" id="s-sens" min="0.3" max="2.5" step="0.1" value="${settings.sensitivity}"></div>
      <div class="setting"><span>Invert look Y</span>${chk('s-inv', settings.invertY)}</div>
      ${input.touch ? '' : '<div class="setting"><span>Keyboard bindings</span><button class="btn" id="s-keys" style="padding:6px 12px">Remap keys…</button></div>'}
      <div class="settings-section">Display</div>
      <div class="setting"><span>Graphics</span>${sel('s-q', [['high', 'High (shadows, bloom)'], ['low', 'Low (faster)']], settings.quality)}</div>
      <div class="setting"><span>Text size</span>${sel('s-text', [[1, 'Normal'], [1.2, 'Large'], [1.4, 'Extra large']], settings.textScale)}</div>
      <div class="setting"><span>Auto resolution<br><small class="muted">lowers the render scale to keep it smooth</small></span>${chk('s-autores', settings.autoRes)}</div>
      <div class="setting"><span>Show FPS</span>${chk('s-fps', settings.showFps)}</div>
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
    settings.voice = box.querySelector<any>('#s-voice').checked;
    settings.autoRes = box.querySelector<any>('#s-autores').checked;
    settings.showFps = box.querySelector<any>('#s-fps').checked;
    if (!settings.autoRes && resScale !== 1) { resScale = 1; }
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
  box.querySelector<any>('#s-keys')?.addEventListener('click', (e) => { e.stopPropagation(); showKeys(); });
}

let activeGrab = null;
function dropGrab() { if (activeGrab) { removeEventListener('keydown', activeGrab, true); activeGrab = null; } }
const keyName = (code) => code.replace(/^Key/, '').replace(/^Digit/, '').replace('Left', ' L').replace('Right', ' R');
function showKeys() {
  const binds = getBindings();
  const box = ui.dialog({
    title: 'Remap keys',
    onClose: dropGrab,
    html: `<p class="muted">Click a key, then press the new one. Arrows, Esc, Enter, Tab and 1–9 stay fixed.</p>
      ${Object.entries(BIND_LABELS).map(([a, l]) => `<div class="setting"><span>${l}</span><button class="btn keybind" data-a="${a}">${keyName(binds[a])}</button></div>`).join('')}`,
    buttons: [
      { label: 'Reset to defaults', keep: true, onClick: () => { settings.keys = {}; saveSettings(settings); applyA11y(); showKeys(); } },
      { label: 'Back', onClick: () => { dropGrab(); showSettings(); } },
    ],
  });
  box.querySelectorAll<any>('.keybind').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation();
    box.querySelectorAll<any>('.keybind').forEach(x => x.classList.remove('listening'));
    b.classList.add('listening'); b.textContent = 'press a key…';
    dropGrab();
    const grab = (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      dropGrab();
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
    activeGrab = grab;
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
  adaptResolution();
  const busy = ui.isDialogOpen() || !document.getElementById('screen').classList.contains('hidden');
  const playing = engine.mode === 'play' && engine.level && !engine.paused;
  input.enabled = playing && !busy;
  if (busy && input.locked) releaseLock();

  pollGamepad(dt);
  const actions = consumeActions();
  if (engine.cutscene) {
    for (const a of actions) if (['pause', 'enter', 'use', 'cast', 'cancel', 'stand'].includes(a)) engine.cutscene.skip();
    input.lookDX = input.lookDY = 0;
    if (engine.level) engine.level.update(dt);
    engine.cutscene && engine.cutscene.update(dt);
    updateAudio(dt);
    composer.render(dt);
    return;
  }
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
    setScene(demo.scene);
  } else if (engine.level) {
    if (playing) {
      engine.stats.time += dt;
      const st = engine.roomState;
      const timed = st && ['hard', 'daily', 'custom', 'rogue', 'rush', 'ngplus'].includes(st.mode);
      if (st && st.mode !== 'editor' && (settings.showTimer || timed)) {
        const m = engine.splitMsg && engine.splitMsg.until > engine.stats.time ? engine.splitMsg : null;
        const label = !st ? '' : st.mode === 'daily' ? 'daily ' + st.seed : st.mode === 'hard' ? 'hard' : st.mode === 'custom' ? st.custom.title : st.mode === 'rogue' ? `room ${engine.run.depth + 1}${engine.run.daily ? ' · daily' : ''}` : st.mode === 'rush' ? 'boss rush' : st.mode === 'ngplus' ? 'NG+' : '';
        ui.setTimer(engine.stats.time, m ? m.text : label, m ? m.cls : '');
      } else ui.setTimer(null);
      if (st) {
        if (!st.maxMana) st.maxMana = 100;
        if (st.mana === undefined || Number.isNaN(st.mana)) st.mana = st.maxMana;
        const rate = (engine.level instanceof RoomLevel ? 10 : 16) * (st.mode === 'hard' ? 0.7 : 1) * (st.regen || 1);
        st.mana = st.mode === 'editor' ? st.maxMana : Math.min(st.maxMana, st.mana + rate * dt);
        ui.setMana(st.mode === 'editor' ? null : st.mana, st.maxMana);
        setLowHealth(st.hearts <= 1 && st.maxHearts > 1 ? 1 : 0);
      }
      player.update(dt);
      engine.level.update(dt);
      if (engine.cat) engine.cat.update(dt);
      setIntensity(engine.level.intensity ? engine.level.intensity() : 0);
      setSurface(engine.level.surface ? engine.level.surface() : 'wood');
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
(window as any).__room = { Peer, enterPhoto, exitPhoto, engine, ui, input, newGame, continueGame, showTitle, startRoom, freshRoomState, loadAssets, modelIds, animated };
// real models, if any are installed (public/models/manifest.json); the game never waits on them
loadAssets();

initPhoto();
showTitle();
frame();
