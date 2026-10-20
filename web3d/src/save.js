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
export const saveGame = (state) => write(SAVE_KEY, state);
export const hasSave = () => !!read(SAVE_KEY);
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }

export const defaultSettings = { music: 0.6, sfx: 0.8, sensitivity: 1, invertY: false, quality: 'high' };
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
  { id: 'speed', icon: '⏱️', name: 'Speedrun Sorcerer', desc: 'Finish the game in under 15 minutes.' },
];

let unlocked = new Set(read(ACH_KEY) || []);
let onUnlock = () => {};

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
