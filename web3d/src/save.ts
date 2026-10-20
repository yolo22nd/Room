// Persistence helpers. Browser storage can be missing or throw (private mode,
// blocked site data), so every access is guarded and the game works without it.

const SAVE_KEY = 'room3d.save.v1';
const ACH_KEY = 'room3d.achievements.v1';
const SETTINGS_KEY = 'room3d.settings.v1';

function read(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
}

export const loadGame = () => read(SAVE_KEY);
const EDITOR_KEY = 'room3d.editor.v1';
export const loadEditor = () => read(EDITOR_KEY);
export const saveEditor = (s) => write(EDITOR_KEY, s);
export const saveGame = (state) => write(SAVE_KEY, state);
export const hasSave = () => !!read(SAVE_KEY);
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }

export const defaultSettings = { music: 0.6, sfx: 0.8, sensitivity: 1, invertY: false, quality: 'high', showTimer: false, reducedMotion: false, palette: 'standard', captions: false, textScale: 1, keys: {} };

// personal bests: { normal: {total, splits}, hard: {...}, daily: { 'YYYY-MM-DD': {total, splits} } }
const BEST_KEY = 'room3d.best.v1';
export const loadBests = () => read(BEST_KEY) || {};
export function bestFor(mode, seed?) { const b = loadBests(); return mode === 'daily' ? (b.daily || {})[seed] : b[mode]; }
/** Records a finished run; returns true if it is a new personal best. */
export function recordRun(mode, seed, total, splits) {
  const b = loadBests();
  const prev = bestFor(mode, seed);
  if (prev && prev.total <= total) return false;
  const run = { total, splits };
  if (mode === 'daily') { b.daily = b.daily || {}; b.daily[seed] = run; } else b[mode] = run;
  write(BEST_KEY, b);
  return true;
}
export const loadSettings = () => ({ ...defaultSettings, ...(read(SETTINGS_KEY) || {}) });
export const saveSettings = (s) => write(SETTINGS_KEY, s);
export const hasSavedSettings = () => !!read(SETTINGS_KEY);

export const ACHIEVEMENTS = [
  { id: 'light', icon: '🏮', name: 'Let There Be Light', desc: 'Conjure a lamp and turn it on.' },
  { id: 'crushed', icon: '🥞', name: 'Flat Wizard', desc: 'Get crushed by your own furniture.' },
  { id: 'pcbroke', icon: '💥', name: 'Hardware Failure', desc: 'Drop a PC on the bare floor.' },
  { id: 'rps', icon: '✂️', name: 'Rock, Paper, Sorcery', desc: 'Beat the PC at rock-paper-scissors.' },
  { id: 'invisible', icon: '👻', name: 'Now You See It', desc: 'Find the invisible key.' },
  { id: 'fossil', icon: '🦴', name: 'Paleontologist', desc: 'Open the showcase.' },
  { id: 'fabulous', icon: '💅', name: 'Still Fabulous', desc: 'Admire yourself in the closet mirror.' },
  { id: 'hygiene', icon: '🚿', name: 'Squeaky Clean', desc: 'Take a shower in your own conjured bathroom.' },
  { id: 'dream', icon: '💤', name: 'Lucid Dreamer', desc: 'Sleep and hear the whispers.' },
  { id: 'bookworm', icon: '📚', name: 'Bookworm', desc: 'Read every book on the shelf.' },
  { id: 'couch', icon: '📺', name: 'Couch Potato', desc: 'Watch the witch\'s channel from a chair.' },
  { id: 'chef', icon: '🍲', name: 'Hell\'s Kitchen', desc: 'Cook ember stew in your kitchen.' },
  { id: 'dresscode', icon: '👟', name: 'Dress Code', desc: 'Enter Hell wearing proper shoes.' },
  { id: 'hotfeet', icon: '🔥', name: 'Hot Feet', desc: 'Enter Hell without shoes. Ouch.' },
  { id: 'pin', icon: '📌', name: 'Pinned', desc: 'Pin a tentacle with conjured furniture.' },
  { id: 'kraken', icon: '🦑', name: 'Kraken Nailed', desc: 'Defeat Kraken 2.0.' },
  { id: 'flawless', icon: '💎', name: 'Untouchable', desc: 'Defeat Kraken 2.0 without losing a heart in Hell.' },
  { id: 'witch', icon: '🧙', name: 'The Apprentice', desc: 'Win the rematch against the witch.' },
  { id: 'lemon', icon: '🍋', name: 'When Life Gives You Lemons', desc: 'Stun the witch with the judgmental lemon.' },
  { id: 'witchflawless', icon: '✨', name: 'Not a Scratch', desc: 'Beat the witch without losing a heart.' },
  { id: 'architect', icon: '📐', name: 'Architect', desc: 'Share a room you built in the editor.' },
  { id: 'custom', icon: '🚪', name: 'Guest Star', desc: 'Escape a custom room.' },
  { id: 'crystal', icon: '💠', name: 'Small Wonders', desc: 'Find the mana crystal under the bed (shrunk).' },
  { id: 'photo', icon: '📸', name: 'Say Cheese', desc: 'Open photo mode.' },
  { id: 'speed', icon: '⏱️', name: 'Speedrun Sorcerer', desc: 'Finish the game in under 15 minutes.' },
  { id: 'smash', icon: '🔨', name: 'Who Needs Keys', desc: 'Smash the showcase with a falling anvil.' },
  { id: 'vault', icon: '🔓', name: 'Safecracker', desc: 'Open the witch\'s vault on the PC.' },
  { id: 'secrets', icon: '🗝️', name: 'Secret Keeper', desc: 'Find the Ember Wand, the Witch\'s Cloak and the diary.' },
  { id: 'designer', icon: '🏠', name: 'Interior Designer', desc: 'Have all 12 kinds of furniture in the room at once.' },
  { id: 'minimalist', icon: '🧘', name: 'Minimalist', desc: 'Reach Hell having conjured 8 things or fewer.' },
  { id: 'hardmode', icon: '💀', name: 'One Heart Wonder', desc: 'Finish the game on Hard.' },
  { id: 'daily', icon: '📅', name: 'Daily Decorator', desc: 'Escape a daily room.' },
];

let unlocked = new Set(read(ACH_KEY) || []);
let onUnlock: (a: any) => void = () => {};

export function setAchievementListener(fn) { onUnlock = fn; }
export function unlock(id) {
  if (unlocked.has(id)) return false;
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (!a) return false;
  unlocked.add(id);
  write(ACH_KEY, [...unlocked]);
  onUnlock(a);
  return true;
}
export const isUnlocked = (id) => unlocked.has(id);
export const unlockedCount = () => unlocked.size;
