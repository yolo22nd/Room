// Ember coins and the cosmetics shop. Coins come from finishing things in
// every mode; they buy lantern flames and cat coats. Stored per browser.
const KEY = 'room3d.shop.v1';

export const SHOP = {
  flame: [
    { id: 'amber', name: 'Amber', price: 0, color: 0xffb469, glass: 0xffa040, icon: '🟠' },
    { id: 'witchfire', name: 'Witchfire', price: 60, color: 0x8aff7a, glass: 0x40ff60, icon: '🟢' },
    { id: 'frost', name: 'Frost', price: 60, color: 0x9ad8ff, glass: 0x50b8ff, icon: '🔵' },
    { id: 'rose', name: 'Rose', price: 80, color: 0xff8ad0, glass: 0xff4ab0, icon: '🌸' },
    { id: 'void', name: 'Void', price: 120, color: 0xb08aff, glass: 0x8050ff, icon: '🟣' },
    { id: 'rainbow', name: 'Rainbow', price: 250, color: 0xffffff, glass: 0xffffff, icon: '🌈', rainbow: true },
  ],
  cat: [
    { id: 'ginger', name: 'Ginger', price: 0, fur: 0xb8692a, pale: 0xd8c4a4, icon: '🧡' },
    { id: 'black', name: 'Midnight', price: 50, fur: 0x1c1a22, pale: 0x3a3442, icon: '🖤' },
    { id: 'snow', name: 'Snow', price: 50, fur: 0xe8e4dc, pale: 0xffffff, icon: '🤍' },
    { id: 'grey', name: 'Tabby grey', price: 70, fur: 0x7a7a82, pale: 0xc8c4c0, icon: '🩶' },
    { id: 'ember', name: 'Ember', price: 150, fur: 0xff5a20, pale: 0xffc080, icon: '🔥', glow: true },
  ],
};
export type Slot = keyof typeof SHOP;

/** How many coins each finished thing pays. */
export const PAY = { escape: 50, boss: 30, lesson: 20, room: 5, rush: 40, act5: 60, achievement: 10, coop: 25, custom: 10 };

function read() {
  try { return { coins: 0, owned: ['amber', 'ginger'], equipped: { flame: 'amber', cat: 'ginger' }, earned: 0, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch (e) { return { coins: 0, owned: ['amber', 'ginger'], equipped: { flame: 'amber', cat: 'ginger' }, earned: 0 }; }
}
function write(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage blocked */ } }

let listener: (n: number, why: string) => void = () => {};
export function onCoins(fn) { listener = fn; }

export const coins = () => read().coins;
export const owned = (id: string) => read().owned.includes(id);
export function earn(n: number, why = '') {
  if (!(n > 0)) return;
  const s = read(); s.coins += n; s.earned = (s.earned || 0) + n; write(s);
  listener(n, why);
}
export function buy(slot: Slot, id: string): 'ok' | 'poor' | 'owned' {
  const s = read(), item = SHOP[slot].find(i => i.id === id);
  if (!item) return 'poor';
  if (s.owned.includes(id)) return 'owned';
  if (s.coins < item.price) return 'poor';
  s.coins -= item.price; s.owned.push(id); s.equipped[slot] = id; write(s);
  return 'ok';
}
export function equip(slot: Slot, id: string) { const s = read(); if (s.owned.includes(id)) { s.equipped[slot] = id; write(s); } }
export function equipped(slot: Slot): any { const s = read(); return SHOP[slot].find(i => i.id === s.equipped[slot]) || SHOP[slot][0]; }
