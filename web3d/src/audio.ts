// Procedural audio: everything is synthesised with WebAudio, no asset files.

let ctx = null;
let capHook: (t: string) => void = () => {};
export function setCaptionHook(fn) { capHook = fn; }
const cap = (t) => capHook(t);
let master, musicBus, sfxBus, muffle;
let noiseBuf = null;
let ambience = null;
let heartbeatTimer = 0;
let intensity = 0;           // 0..1, set by the levels from danger
let surface = 'wood';
export function setIntensity(v) { intensity = Math.max(0, Math.min(1, v)); }
export function setSurface(s) { surface = s; }
let heartbeatRate = 0;
const settings = { music: 0.6, sfx: 0.8 };

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  // music runs through a low-pass that closes in when you're on your last heart
  muffle = ctx.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 18000; muffle.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = settings.music; musicBus.connect(muffle);
  sfxBus = ctx.createGain(); sfxBus.gain.value = settings.sfx; sfxBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function setVolumes(music, sfx) {
  settings.music = music; settings.sfx = sfx;
  if (!ctx) return;
  musicBus.gain.setTargetAtTime(music, ctx.currentTime, 0.1);
  sfxBus.gain.setTargetAtTime(sfx, ctx.currentTime, 0.1);
}

function env(g, t, a, peak, decay, sustain = 0) {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + a + decay);
}

function tone(freq, dur, { type = 'sine', vol = 0.3, attack = 0.005, slide = 0, bus = sfxBus, delay = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  const g = ctx.createGain(); env(g, t, attack, vol, dur);
  o.connect(g).connect(bus);
  o.start(t); o.stop(t + attack + dur + 0.05);
}

function noise(dur, { vol = 0.3, freq = 1000, q = 1, type = 'lowpass', attack = 0.005, sweep = 0, delay = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(30, freq * sweep), t + dur);
  const g = ctx.createGain(); env(g, t, attack, vol, dur);
  s.connect(f).connect(g).connect(sfxBus);
  s.start(t, Math.random()); s.stop(t + attack + dur + 0.05);
}

export const sfx = {
  click() { tone(880, 0.05, { type: 'triangle', vol: 0.08 }); },
  open() { tone(520, 0.08, { type: 'triangle', vol: 0.1 }); tone(780, 0.12, { type: 'triangle', vol: 0.08, delay: 0.06 }); },
  close() { tone(600, 0.06, { type: 'triangle', vol: 0.08 }); tone(400, 0.1, { type: 'triangle', vol: 0.08, delay: 0.05 }); },
  conjure() {
    // rising shimmer
    [0, 0.05, 0.1, 0.15, 0.2].forEach((d, i) => tone(440 * Math.pow(1.26, i), 0.35, { type: 'sine', vol: 0.07, delay: d }));
    noise(0.6, { vol: 0.06, freq: 3000, type: 'highpass', sweep: 2 });
  },
  rift() { cap('[a rift opens above]'); noise(0.8, { vol: 0.08, freq: 400, q: 8, type: 'bandpass', sweep: 4 }); },
  thud(size = 1) {
    if (size >= 1.2) cap('[loud thud]');
    tone(90 / Math.sqrt(size), 0.5, { type: 'sine', vol: 0.5, slide: 0.4 });
    noise(0.35, { vol: 0.35 * size, freq: 600, sweep: 0.3 });
  },
  shatter() { cap('[glass shatters]');
    for (let i = 0; i < 8; i++) tone(2000 + Math.random() * 3000, 0.15 + Math.random() * 0.2, { type: 'triangle', vol: 0.05, delay: Math.random() * 0.25 });
    noise(0.5, { vol: 0.25, freq: 4000, type: 'highpass' });
  },
  hurt() { cap('[you grunt in pain]'); tone(220, 0.3, { type: 'sawtooth', vol: 0.18, slide: 0.5 }); noise(0.25, { vol: 0.2, freq: 900 }); },
  pickup() { tone(660, 0.1, { type: 'square', vol: 0.06 }); tone(990, 0.18, { type: 'square', vol: 0.06, delay: 0.08 }); },
  key() { [0, 0.08, 0.16].forEach((d, i) => tone([784, 988, 1319][i], 0.3, { type: 'triangle', vol: 0.1, delay: d })); },
  lampOn() { tone(1200, 0.04, { type: 'square', vol: 0.05 }); noise(0.4, { vol: 0.04, freq: 2500, type: 'bandpass' }); },
  lampOff() { tone(700, 0.05, { type: 'square', vol: 0.05 }); },
  step() {
    const r = Math.random();
    switch (surface) {
      case 'tile': noise(0.05, { vol: 0.06, freq: 2400 + r * 600, type: 'bandpass', q: 3 }); tone(900 + r * 200, 0.03, { type: 'triangle', vol: 0.015 }); break;
      case 'stone': noise(0.08, { vol: 0.06, freq: 700 + r * 200, type: 'bandpass', q: 1.5 }); break;
      case 'grass': noise(0.12, { vol: 0.04, freq: 3000 + r * 1500, type: 'highpass' }); break;
      case 'water': noise(0.25, { vol: 0.07, freq: 900 + r * 400, type: 'bandpass', q: 0.8, sweep: 2 }); break;
      case 'metal': tone(260 + r * 60, 0.12, { type: 'triangle', vol: 0.04 }); noise(0.05, { vol: 0.04, freq: 3000, type: 'highpass' }); break;
      default: noise(0.07, { vol: 0.05, freq: 350 + r * 150 });
    }
  },
  page() { noise(0.18, { vol: 0.06, freq: 4000, type: 'highpass', sweep: 0.5 }); noise(0.12, { vol: 0.04, freq: 2500, type: 'bandpass', delay: 0.12 }); },
  type() { for (let i = 0; i < 6; i++) tone(1800 + Math.random() * 600, 0.02, { type: 'square', vol: 0.02, delay: i * 0.06 + Math.random() * 0.03 }); },
  creak() { tone(180, 0.6, { type: 'sawtooth', vol: 0.03, slide: 1.6, attack: 0.1 }); noise(0.5, { vol: 0.03, freq: 600, q: 6, type: 'bandpass', sweep: 1.5 }); },
  tick() { tone(2400, 0.02, { type: 'square', vol: 0.03 }); },
  whoosh() { noise(0.35, { vol: 0.08, freq: 600, q: 1.5, type: 'bandpass', sweep: 4 }); },
  splash() { noise(0.5, { vol: 0.12, freq: 1200, type: 'bandpass', q: 0.7, sweep: 0.4 }); },
  water(on) { cap('[running water]'); if (on) noise(0.6, { vol: 0.08, freq: 2500, type: 'bandpass', q: 0.6 }); },
  locked() { cap('[locked]'); tone(160, 0.08, { type: 'square', vol: 0.12 }); tone(140, 0.12, { type: 'square', vol: 0.12, delay: 0.1 }); },
  achievement() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.4, { type: 'triangle', vol: 0.09, delay: i * 0.09 })); },
  win() { [392, 494, 587, 784].forEach((f, i) => tone(f, 0.25, { type: 'square', vol: 0.06, delay: i * 0.1 })); },
  lose() { [392, 330, 262].forEach((f, i) => tone(f, 0.3, { type: 'square', vol: 0.06, delay: i * 0.14 })); },
  roar() { cap('[KRAKEN ROARS]');
    tone(70, 2.2, { type: 'sawtooth', vol: 0.35, attack: 0.3, slide: 0.6 });
    tone(105, 2.0, { type: 'sawtooth', vol: 0.2, attack: 0.3, slide: 0.5 });
    noise(2.2, { vol: 0.35, freq: 300, q: 2, type: 'bandpass', attack: 0.3, sweep: 0.5 });
  },
  slam() { cap('[heavy slam]'); tone(55, 0.8, { type: 'sine', vol: 0.6, slide: 0.5 }); noise(0.6, { vol: 0.45, freq: 400, sweep: 0.2 }); },
  warn() { cap('[warning tone]'); tone(330, 0.15, { type: 'square', vol: 0.05 }); },
  sizzle() { cap('[sizzle]'); noise(0.5, { vol: 0.12, freq: 5000, type: 'highpass' }); },
  fireball() { cap('[fireball whooshes]'); noise(0.9, { vol: 0.15, freq: 800, q: 3, type: 'bandpass', sweep: 0.4 }); },
  nail() { cap('[enormous metallic CLANG]');
    tone(1500, 1.5, { type: 'triangle', vol: 0.15, slide: 0.98 });
    tone(2250, 1.2, { type: 'triangle', vol: 0.08, slide: 0.98 });
    tone(45, 1.4, { type: 'sine', vol: 0.7, slide: 0.5 });
    noise(1.2, { vol: 0.5, freq: 500, sweep: 0.2 });
  },
  heartbeat() { tone(60, 0.12, { type: 'sine', vol: 0.4, slide: 0.6 }); tone(55, 0.14, { type: 'sine', vol: 0.3, slide: 0.6, delay: 0.18 }); },
  coin() { cap('[coins jingle]'); tone(1320, 0.09, { type: 'triangle', vol: 0.08 }); tone(1760, 0.14, { type: 'triangle', vol: 0.07, delay: 0.07 }); },
  purr() { cap('[purring]'); for (let i = 0; i < 6; i++) noise(0.14, { vol: 0.05, freq: 120, q: 2, type: 'lowpass', delay: i * 0.17 }); },
  hiss() { cap('[the cat hisses]'); noise(0.5, { vol: 0.06, freq: 4200, q: 1.5, type: 'highpass', attack: 0.02 }); },
  meow() { cap('[meow]'); tone(700, 0.35, { type: 'triangle', vol: 0.06, slide: 0.6, attack: 0.03 }); },
  whisper() { cap('[eerie whispering]'); noise(1.6, { vol: 0.08, freq: 1800, q: 5, type: 'bandpass', attack: 0.4, sweep: 0.6 }); },
};

// ---- ambience / music beds ----
function stopAmbience() {
  if (!ambience) return;
  const t = ctx.currentTime;
  ambience.out.gain.setTargetAtTime(0.0001, t, 0.8);
  const nodes = ambience.nodes;
  setTimeout(() => nodes.forEach(n => { try { n.stop(); } catch (e) { /* already stopped */ } }), 4000);
  clearInterval(ambience.timer);
  ambience = null;
}

function pad(out, freqs, type = 'sine', detune = 6, vol = 0.05) {
  const nodes = [];
  freqs.forEach(f => {
    [-detune, detune].forEach(dt => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = dt;
      const g = ctx.createGain(); g.gain.value = vol;
      o.connect(g).connect(out); o.start(); nodes.push(o);
    });
  });
  return nodes;
}

export function playAmbience(kind) {
  if (!ctx) return;
  if (ambience && ambience.kind === kind) return;
  stopAmbience();
  const out = ctx.createGain(); out.gain.value = 0.0001;
  const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 700;
  out.connect(filt).connect(musicBus);
  const nodes = [];
  let timer = null;
  // slow LFO on filter
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
  const lfoG = ctx.createGain(); lfoG.gain.value = 300; lfo.connect(lfoG).connect(filt.frequency); lfo.start(); nodes.push(lfo);

  if (kind === 'room') {
    nodes.push(...pad(out, [55, 82.4, 98], 'sine', 7, 0.07));
    // occasional minor arpeggio "music box"
    const notes = [220, 261.6, 329.6, 392, 329.6, 261.6, 207.7, 246.9];
    let i = 0;
    timer = setInterval(() => {
      if (Math.random() < 0.55) tone(notes[i % notes.length] * 2, 1.6, { type: 'triangle', vol: 0.025, attack: 0.02, bus: musicBus });
      i++;
    }, 900);
  } else if (kind === 'dark') {
    nodes.push(...pad(out, [41.2, 43.6], 'sine', 4, 0.09));
  } else if (kind === 'hell') {
    filt.frequency.value = 500;
    nodes.push(...pad(out, [36.7, 55, 77.8], 'sawtooth', 9, 0.035));
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 160;
    const ng = ctx.createGain(); ng.gain.value = 0.35;
    s.connect(nf).connect(ng).connect(out); s.start(); nodes.push(s);
    let beat = 0;
    timer = setInterval(() => {
      // war drum
      const hot = intensity > 0.5;
      if (beat % 4 === 0 || beat % 4 === 3 || (hot && beat % 2 === 1)) tone(70, 0.35, { type: 'sine', vol: 0.22, slide: 0.5, bus: musicBus });
      if (beat % 8 === 6 || (intensity > 0.3 && beat % 4 === 2)) noise(0.15, { vol: 0.06, freq: 2000, type: 'highpass' });
      if (intensity > 0.7 && beat % 2 === 0) tone([146.8, 155.6, 174.6, 155.6][(beat / 2) % 4 | 0], 0.25, { type: 'sawtooth', vol: 0.03, bus: musicBus });
      filt.frequency.setTargetAtTime(500 + intensity * 1600, ctx.currentTime, 0.4);
      beat++;
    }, 300);
  } else if (kind === 'witch') {
    filt.frequency.value = 1400;
    nodes.push(...pad(out, [73.4, 110, 146.8], 'triangle', 6, 0.03));
    const notes = [293.7, 349.2, 440, 523.3, 440, 392, 349.2, 329.6];
    let i = 0;
    timer = setInterval(() => {
      tone(notes[i % notes.length], 0.28, { type: 'square', vol: 0.025, bus: musicBus });
      if (i % 2 === 0) tone(73.4, 0.2, { type: 'sine', vol: 0.15, slide: 0.6, bus: musicBus });
      if (i % 4 === 2 || (intensity > 0.5 && i % 2 === 1)) noise(0.06, { vol: 0.05, freq: 3000, type: 'highpass' });
      if (intensity > 0.75 && i % 2 === 0) tone(notes[(i + 4) % notes.length] * 2, 0.12, { type: 'square', vol: 0.015, bus: musicBus });
      filt.frequency.setTargetAtTime(1400 + intensity * 1800, ctx.currentTime, 0.4);
      i++;
    }, 220);
  } else if (kind === 'title') {
    // a gentle theme: Am - F - C - G, arpeggiated, with a bell on top
    filt.frequency.value = 1800;
    nodes.push(...pad(out, [55, 82.4, 110], 'sine', 5, 0.05));
    const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [130.8, 164.8, 196], [196, 246.9, 293.7]];
    let i = 0;
    timer = setInterval(() => {
      const c = chords[Math.floor(i / 8) % 4];
      tone(c[i % 3] * (i % 8 < 4 ? 1 : 2), 0.9, { type: 'triangle', vol: 0.03, attack: 0.01, bus: musicBus });
      if (i % 8 === 0) tone(c[0] / 2, 2.6, { type: 'sine', vol: 0.08, attack: 0.05, bus: musicBus });
      if (i % 16 === 6) tone(c[2] * 4, 1.8, { type: 'sine', vol: 0.02, attack: 0.01, bus: musicBus });
      i++;
    }, 330);
  } else if (kind === 'lesson') {
    // the witch's classroom: plucky pizzicato in a major key, a little sneaky
    filt.frequency.value = 2200;
    nodes.push(...pad(out, [98, 146.8], 'triangle', 4, 0.025));
    const line = [392, 0, 493.9, 587.3, 0, 493.9, 440, 0, 392, 369.9, 392, 0, 293.7, 0, 329.6, 369.9];
    let i = 0;
    timer = setInterval(() => {
      const n = line[i % line.length];
      if (n) tone(n, 0.16, { type: 'triangle', vol: 0.04, attack: 0.003, bus: musicBus });
      if (i % 4 === 0) tone([98, 98, 130.8, 146.8][Math.floor(i / 4) % 4], 0.3, { type: 'sine', vol: 0.12, slide: 0.9, bus: musicBus });
      if (i % 8 === 7 && Math.random() < 0.5) tone(n * 2 || 784, 0.6, { type: 'sine', vol: 0.02, bus: musicBus });
      filt.frequency.setTargetAtTime(2200 + intensity * 1500, ctx.currentTime, 0.4);
      i++;
    }, 240);
  } else if (kind === 'endless') {
    // a driving minor arpeggio that speeds up with danger
    filt.frequency.value = 1200;
    nodes.push(...pad(out, [55, 65.4], 'sawtooth', 8, 0.02));
    const arp = [220, 261.6, 329.6, 261.6, 196, 246.9, 293.7, 246.9];
    let i = 0, acc = 0;
    timer = setInterval(() => {
      acc += 1 + intensity * 0.8;
      if (acc < 1.6) return;
      acc -= 1.6;
      tone(arp[i % arp.length], 0.14, { type: 'square', vol: 0.02, bus: musicBus });
      if (i % 4 === 0) tone(55, 0.25, { type: 'sine', vol: 0.18, slide: 0.6, bus: musicBus });
      if (i % 2 === 1) noise(0.04, { vol: 0.03, freq: 6000, type: 'highpass' });
      filt.frequency.setTargetAtTime(1200 + intensity * 2000, ctx.currentTime, 0.3);
      i++;
    }, 100);
  } else if (kind === 'rush') {
    // the boss rush: double-time war drums and brass stabs
    filt.frequency.value = 1600;
    nodes.push(...pad(out, [36.7, 55], 'sawtooth', 9, 0.03));
    let beat = 0;
    timer = setInterval(() => {
      if (beat % 2 === 0 || beat % 8 === 7) tone(70, 0.25, { type: 'sine', vol: 0.22, slide: 0.5, bus: musicBus });
      if (beat % 4 === 2) noise(0.12, { vol: 0.07, freq: 1800, type: 'highpass' });
      if (beat % 16 === 0 || beat % 16 === 3) for (const f of [146.8, 220, 293.7]) tone(f, 0.35, { type: 'sawtooth', vol: 0.025, bus: musicBus });
      if (beat % 16 === 8) for (const f of [138.6, 207.7, 277.2]) tone(f, 0.35, { type: 'sawtooth', vol: 0.025, bus: musicBus });
      beat++;
    }, 180);
  } else if (kind === 'landlord') {
    // the room itself: a wheezing house organ and a slow, heavy pulse
    filt.frequency.value = 900;
    nodes.push(...pad(out, [65.4, 77.8, 98, 116.5], 'square', 14, 0.012));
    const chords = [[130.8, 155.6, 196], [123.5, 146.8, 185], [116.5, 138.6, 174.6], [110, 130.8, 164.8]];
    let i = 0;
    timer = setInterval(() => {
      if (i % 8 === 0) for (const f of chords[Math.floor(i / 8) % 4]) tone(f, 2.4, { type: 'square', vol: 0.014, attack: 0.3, bus: musicBus });
      if (i % 4 === 0 || (intensity > 0.6 && i % 2 === 0)) tone(45, 0.5, { type: 'sine', vol: 0.25, slide: 0.6, bus: musicBus });
      if (i % 16 === 13) noise(0.8, { vol: 0.03, freq: 300, q: 4, type: 'bandpass', sweep: 0.5 });
      filt.frequency.setTargetAtTime(900 + intensity * 1400, ctx.currentTime, 0.5);
      i++;
    }, 300);
  } else if (kind === 'ending') {
    nodes.push(...pad(out, [130.8, 164.8, 196, 246.9], 'triangle', 5, 0.03));
    const notes = [523.3, 659.3, 784, 987.8, 784, 659.3];
    let i = 0;
    timer = setInterval(() => { tone(notes[i++ % notes.length], 1.8, { type: 'sine', vol: 0.04, attack: 0.05, bus: musicBus }); }, 700);
  }
  out.gain.setTargetAtTime(1, ctx.currentTime, 1.2);
  ambience = { kind, out, nodes, timer };
}

export function setHeartbeat(rate) { heartbeatRate = rate; }

/** 0 = healthy, 1 = one heart left: the music goes muffled and distant. */
let lowHealth = -1;
export function setLowHealth(v) {
  if (!ctx || v === lowHealth) return;
  lowHealth = v;
  muffle.frequency.setTargetAtTime(v > 0 ? 900 : 18000, ctx.currentTime, 0.6);
}

export function updateAudio(dt) {
  if (!ctx || heartbeatRate <= 0) return;
  heartbeatTimer -= dt;
  if (heartbeatTimer <= 0) { sfx.heartbeat(); heartbeatTimer = 60 / heartbeatRate; }
}
