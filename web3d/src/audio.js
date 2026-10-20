// Procedural audio: everything is synthesised with WebAudio, no asset files.

let ctx = null;
let master, musicBus, sfxBus;
let noiseBuf = null;
let ambience = null;
let heartbeatTimer = 0;
let heartbeatRate = 0;
const settings = { music: 0.6, sfx: 0.8 };

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = settings.music; musicBus.connect(master);
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
  rift() { noise(0.8, { vol: 0.08, freq: 400, q: 8, type: 'bandpass', sweep: 4 }); },
  thud(size = 1) {
    tone(90 / Math.sqrt(size), 0.5, { type: 'sine', vol: 0.5, slide: 0.4 });
    noise(0.35, { vol: 0.35 * size, freq: 600, sweep: 0.3 });
  },
  shatter() {
    for (let i = 0; i < 8; i++) tone(2000 + Math.random() * 3000, 0.15 + Math.random() * 0.2, { type: 'triangle', vol: 0.05, delay: Math.random() * 0.25 });
    noise(0.5, { vol: 0.25, freq: 4000, type: 'highpass' });
  },
  hurt() { tone(220, 0.3, { type: 'sawtooth', vol: 0.18, slide: 0.5 }); noise(0.25, { vol: 0.2, freq: 900 }); },
  pickup() { tone(660, 0.1, { type: 'square', vol: 0.06 }); tone(990, 0.18, { type: 'square', vol: 0.06, delay: 0.08 }); },
  key() { [0, 0.08, 0.16].forEach((d, i) => tone([784, 988, 1319][i], 0.3, { type: 'triangle', vol: 0.1, delay: d })); },
  lampOn() { tone(1200, 0.04, { type: 'square', vol: 0.05 }); noise(0.4, { vol: 0.04, freq: 2500, type: 'bandpass' }); },
  lampOff() { tone(700, 0.05, { type: 'square', vol: 0.05 }); },
  step() { noise(0.07, { vol: 0.05, freq: 350 + Math.random() * 150 }); },
  water(on) { if (on) noise(0.6, { vol: 0.08, freq: 2500, type: 'bandpass', q: 0.6 }); },
  locked() { tone(160, 0.08, { type: 'square', vol: 0.12 }); tone(140, 0.12, { type: 'square', vol: 0.12, delay: 0.1 }); },
  achievement() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.4, { type: 'triangle', vol: 0.09, delay: i * 0.09 })); },
  win() { [392, 494, 587, 784].forEach((f, i) => tone(f, 0.25, { type: 'square', vol: 0.06, delay: i * 0.1 })); },
  lose() { [392, 330, 262].forEach((f, i) => tone(f, 0.3, { type: 'square', vol: 0.06, delay: i * 0.14 })); },
  roar() {
    tone(70, 2.2, { type: 'sawtooth', vol: 0.35, attack: 0.3, slide: 0.6 });
    tone(105, 2.0, { type: 'sawtooth', vol: 0.2, attack: 0.3, slide: 0.5 });
    noise(2.2, { vol: 0.35, freq: 300, q: 2, type: 'bandpass', attack: 0.3, sweep: 0.5 });
  },
  slam() { tone(55, 0.8, { type: 'sine', vol: 0.6, slide: 0.5 }); noise(0.6, { vol: 0.45, freq: 400, sweep: 0.2 }); },
  warn() { tone(330, 0.15, { type: 'square', vol: 0.05 }); },
  sizzle() { noise(0.5, { vol: 0.12, freq: 5000, type: 'highpass' }); },
  fireball() { noise(0.9, { vol: 0.15, freq: 800, q: 3, type: 'bandpass', sweep: 0.4 }); },
  nail() {
    tone(1500, 1.5, { type: 'triangle', vol: 0.15, slide: 0.98 });
    tone(2250, 1.2, { type: 'triangle', vol: 0.08, slide: 0.98 });
    tone(45, 1.4, { type: 'sine', vol: 0.7, slide: 0.5 });
    noise(1.2, { vol: 0.5, freq: 500, sweep: 0.2 });
  },
  heartbeat() { tone(60, 0.12, { type: 'sine', vol: 0.4, slide: 0.6 }); tone(55, 0.14, { type: 'sine', vol: 0.3, slide: 0.6, delay: 0.18 }); },
  whisper() { noise(1.6, { vol: 0.08, freq: 1800, q: 5, type: 'bandpass', attack: 0.4, sweep: 0.6 }); },
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
      if (beat % 4 === 0 || beat % 4 === 3) tone(70, 0.35, { type: 'sine', vol: 0.22, slide: 0.5, bus: musicBus });
      if (beat % 8 === 6) noise(0.15, { vol: 0.06, freq: 2000, type: 'highpass' });
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
      if (i % 4 === 2) noise(0.06, { vol: 0.05, freq: 3000, type: 'highpass' });
      i++;
    }, 220);
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

export function updateAudio(dt) {
  if (!ctx || heartbeatRate <= 0) return;
  heartbeatTimer -= dt;
  if (heartbeatTimer <= 0) { sfx.heartbeat(); heartbeatTimer = 60 / heartbeatRate; }
}
