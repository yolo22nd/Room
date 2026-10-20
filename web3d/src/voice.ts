// Optional story narration with the browser's speech synthesis (off by default).
let enabled = false;
const VOICES = {
  witch: { pitch: 1.35, rate: 1.02 },
  narrator: { pitch: 0.95, rate: 0.98 },
  pc: { pitch: 0.55, rate: 1.2 },
  you: { pitch: 1.0, rate: 1.0 },
};

export function setVoiceEnabled(on) {
  enabled = !!on;
  if (!enabled) stopVoice();
}
export const voiceAvailable = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

function clean(text) {
  return String(text).replace(/<[^>]+>/g, ' ').replace(/[*_~]/g, '').replace(/\s+/g, ' ').trim();
}

export function speak(text, who = 'narrator') {
  if (!enabled || !voiceAvailable()) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean(text));
    const v = VOICES[who] || VOICES.narrator;
    u.pitch = v.pitch; u.rate = v.rate;
    const en = window.speechSynthesis.getVoices().filter(x => /^en/i.test(x.lang));
    if (en.length) u.voice = who === 'witch' ? (en.find(x => /female|samantha|zira|google uk english female/i.test(x.name)) || en[0]) : en[0];
    window.speechSynthesis.speak(u);
  } catch (e) { /* speech is best-effort */ }
}
export function stopVoice() { try { if (voiceAvailable()) window.speechSynthesis.cancel(); } catch (e) { /* ignore */ } }

/** Guess who is talking from a story line (quotes from the witch etc.). */
export function speakerOf(text) {
  const t = clean(text);
  if (/^"|^📺|she says|witch/i.test(t)) return 'witch';
  return 'narrator';
}
