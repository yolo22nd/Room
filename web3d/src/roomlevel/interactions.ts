// Using furniture: every object menu, the PC, books, secrets and the bathroom.
import * as THREE from 'three';
import { COL } from '../a11y';
import {
  Room, CELLS, SIDES, SIDE_NAMES, CELL_NAMES, cellCenter, cellAt, sideMatrix, sideRot,
  HALF, WALL_H, GAP_W, ANNEX_W, ANNEX_D, WALL_T,
} from '../room';
import { CATALOG, buildObject, buildDoor, buildTV, makeLantern, makeGhostKey, buildJunk } from '../models';
import { loadPhysics, PhysicsWorld } from '../physics';
import { SPELLS, manaCost, learn, knows, castShrink, castBlink } from '../spells';
import { ring } from '../textures';
import { RADIUS } from '../player';
import { FX } from '../fx';
import { glowSprite } from '../textures';
import * as ui from '../ui';
import { sfx, playAmbience, setHeartbeat } from '../audio';
import { unlock } from '../save';
import { BOOKS, DREAM, TV_BROADCAST, KITCHEN_NOTE, MIRROR_LINES, PC_SURF, PC_MAIL, WITCH_DIARY } from '../story';

import { HUG, SEATS, ROT_FRONT, SIDE_FRONT_ROT } from './shared';

export const interactionsMethods = {
  use(this: any) {
    if (this.lev) { this.levCast(); return; }
    if (this.placing) { this.engine.touch ? this.rotatePlacing() : this.castPlacing(); return; }
    const f = this.focus;
    if (!f) { if (this.player.sitting) { this.player.stand(); ui.log('You stood up.'); } return; }
    sfx.click();
    const fn = this['use_' + f.owner];
    if (fn) fn.call(this, f);
  },

  use_cat(this: any) { if (this.engine.cat) this.engine.cat.pet(); },

  // what the cat notices: unfound secrets near the player
  catInterest(this: any) {
    const fl = this.state.flags;
    const at = (type) => { const e = this.entities.get(type); return e && e.group ? e.group.position : null; };
    const shelf = at('shelf'), closet = at('closet'), bed = at('bed');
    if (shelf && !fl.wand) return { key: 'wand', pos: shelf, msg: 'The cat stares at the bookshelf, tail twitching. One book sits a little crooked.' };
    if (closet && !fl.cloak) return { key: 'cloak', pos: closet, msg: 'The cat paws at the back of the closet and hisses. Something behind the clothes sounds hollow.' };
    if (bed && !fl.crystal) return { key: 'crystal', pos: bed, msg: 'The cat peers under the bed and puffs up its tail. Something small glints down there.' };
    return null;
  },
  // somewhere soft for a nap
  napSpot(this: any) {
    for (const [type, y] of [['bed', 0.62], ['sofa', 0.48], ['cushion', 0.2]] as [string, number][]) {
      const e = this.entities.get(type);
      if (e && e.group) return new THREE.Vector3(e.group.position.x, y, e.group.position.z);
    }
    return null;
  },

  // knock three times on the window onto the void
  use_voidwindow(this: any) {
    const now = performance.now();
    this.knocks = now - (this.lastKnock || 0) < 1500 ? (this.knocks || 0) + 1 : 1;
    this.lastKnock = now;
    sfx.thud(0.4);
    const lines = ['Knock. The void ripples politely.', 'Knock, knock. Something far away stops what it was doing.'];
    if (this.knocks < 3) { ui.log(lines[this.knocks - 1]); return; }
    this.knocks = 0;
    sfx.win();
    this.room.voidMat.color.set(0xffe0a0);
    setTimeout(() => { if (this.room.voidMat) this.room.voidMat.color.set(0x8a70c0); }, 1200);
    ui.log('Far out in the void, a tiny wizard in a tiny window knocks back three times, waves, and draws the curtains.', 'lore');
    unlock('knock');
  },

  menu(this: any, title, text, items) {
    ui.dialog({
      title, html: text ? `<p>${text}</p>` : '',
      buttons: [...items.filter(Boolean), { label: 'Never mind', cls: 'danger' }],
    });
  },

  sitOn(this: any, type, ent) {
    if (this.player.sitting) { ui.log('You are already sitting.'); return; }
    const p = ent.group.position;
    const front = ROT_FRONT(ent.rot);
    if (type === 'chair' || type === 'cushion') { this.player.pos.set(p.x, 0, p.z); }
    else {
      // perch on the front edge
      const fp = CATALOG[type].fp;
      const target = p.clone().addScaledVector(front, type === 'bed' ? fp[1] - 0.6 : fp[1] * 0.3);
      this.player.pos.set(target.x, 0, target.z);
    }
    this.player.yaw = Math.atan2(-front.x, -front.z);
    this.player.pitch = 0;
    this.player.sit(type, SEATS[type] || 1.0);
    ui.log(`You sat on the ${CATALOG[type].name.toLowerCase()}. (Move to stand up.)`);
    if (type === 'chair') this.checkTV();
  },

  sleepOn(this: any, type, ent) {
    const fl = this.state.flags;
    const floorKinds = [...this.entities.values()].filter(e => CATALOG[e.type].kind === 'floor').length;
    if (fl.hellKeyTaken && floorKinds >= 12 && this.state.mode !== 'custom' && this.state.mode !== 'editor') {
      ui.dialog({
        title: 'Stay?',
        html: '<p>You lie down in a room you built yourself. Every piece of it. The H key is heavy in your pocket.</p><p>You could just... stay.</p>',
        buttons: [
          { label: '🛋️ Stay forever and redecorate', onClick: () => this.engine.endWith('redecorator') },
          { label: 'No — hell is waiting', cls: 'primary' },
        ],
      });
      return;
    }
    if (fl.showered) { ui.log('You had just taken a shower. You\'re too fresh to sleep.'); return; }
    if (fl.slept) { ui.log('You have already slept enough. You are not feeling sleepy.'); return; }
    fl.slept = true;
    this.player.lie();
    sfx.whisper();
    ui.story(DREAM, { clear: true }).then(() => {
      this.sitOn(type, ent);
      unlock('dream');
      if (learn(this.state, 'shrink')) ui.log('In the dream you were tiny, and it felt natural. New spell: Shrink.', 'good');
      this.engine.autosave();
    });
  },

  use_bed(this: any, f) { const e = this.entities.get('bed'); this.menu('Bed', 'A conjured bed. Suspiciously comfortable.', [{ label: 'Sit', onClick: () => this.sitOn('bed', e) }, { label: 'Sleep', onClick: () => this.sleepOn('bed', e) }]); },

  use_sofa(this: any, f) { const e = this.entities.get('sofa'); this.menu('Sofa', '', [{ label: 'Sit', onClick: () => this.sitOn('sofa', e) }, { label: 'Nap', onClick: () => this.sleepOn('sofa', e) }]); },

  use_cushion(this: any, f) { const e = this.entities.get('cushion'); if (this.entityAt(e.slot, 'pc')) { this.use_pc(); return; } this.menu('Cushion', 'Soft. Purple. Ideal for sitting, or for catching falling things.', [{ label: 'Sit', onClick: () => this.sitOn('cushion', e) }]); },

  use_dine(this: any) {
    const e = this.entities.get('dine');
    const fl = this.state.flags;
    this.menu('Dining Table', 'A long table set for guests who will never come.', [
      { label: 'Sit', onClick: () => this.sitOn('dine', e) },
      fl.stewCooked && !fl.stewEaten ? { label: 'Eat the ember stew', onClick: () => this.eatStew() } : null,
    ]);
  },

  use_table(this: any) {
    const e = this.entities.get('table');
    this.menu('Study Table', 'Papers, an inkwell, a quill. Someone has scribbled notes.', [
      { label: 'Sit', onClick: () => this.sitOn('table', e) },
      { label: 'Read the notes', onClick: () => ui.dialog({ title: 'Scribbled notes', html: `<div class="book">Things I know:
• Conjured things fall from the sky. Don't stand under them.
• Floor things land on the cell you look at. Doors and TVs go on the wall you face. Whole rooms go beyond it.
• R rotates what I'm about to conjure.
• Chairs can be turned. Why would I want that? (TV?)
• G to search the floor. F for the lamp.</div>`, buttons: [{ label: 'Close' }] }) },
    ]);
  },

  use_chair(this: any) {
    const e = this.entities.get('chair');
    this.menu('Chair', `It is facing ${SIDE_NAMES[Object.keys(SIDE_FRONT_ROT).find(k => SIDE_FRONT_ROT[k] === e.rot)]}.`, [
      { label: 'Sit', onClick: () => this.sitOn('chair', e) },
      { label: 'Turn clockwise', onClick: () => this.turnChair(1) },
      { label: 'Turn anti-clockwise', onClick: () => this.turnChair(-1) },
    ]);
  },

  turnChair(this: any, d) {
    const e = this.entities.get('chair');
    e.rot = (e.rot + (d > 0 ? 3 : 1)) % 4; // clockwise seen from above
    e.group.rotation.y = e.rot * Math.PI / 2;
    this.state.placed.chair.rot = e.rot;
    e.rect = this.footprint('chair', e.slot, e.rot);
    sfx.click();
    const facing = Object.keys(SIDE_FRONT_ROT).find(k => SIDE_FRONT_ROT[k] === e.rot);
    const tv = this.entities.get('tv');
    ui.log(`The chair is now facing ${SIDE_NAMES[facing]}${tv && tv.slot === facing ? ' — right at the TV.' : '.'}`);
  },

  checkTV(this: any) {
    const tv = this.entities.get('tv'); const ch = this.entities.get('chair');
    if (!tv || !ch || SIDE_FRONT_ROT[tv.slot] !== ch.rot) return;
    this.playBroadcast();
  },

  playBroadcast(this: any) {
    const tv = this.entities.get('tv');
    tv.group.userData.screenMesh.material.emissiveIntensity = 1;
    this.tvOn = true;
    sfx.whisper();
    ui.story(TV_BROADCAST.map(t => `📺\n\n${t}`), { clear: true }).then(() => {
      this.tvOn = false;
      this.state.flags.tvSeen = true;
      tv.group.userData.screenMesh.material.emissiveIntensity = 0.15;
      unlock('couch');
      if (learn(this.state, 'blink')) ui.log('You noticed how she flickers between frames. New spell: Blink.', 'good');
      this.engine.autosave();
    });
  },

  use_tv(this: any) {
    this.menu('TV', 'An old television with a single channel.', [
      { label: 'Turn it on', onClick: () => {
        const tv = this.entities.get('tv');
        tv.group.userData.screenMesh.material.emissiveIntensity = 0.6; this.tvStatic = 2.5;
        ui.log('Static. A voice crackles: "...sit... down... and... pay... attention..."', 'lore');
      } },
    ]);
  },

  use_shelf(this: any) {
    const fl = this.state.flags;
    const read = fl.books;
    this.menu('Bookshelf', `There are plenty of (${BOOKS.length}) books in here to read.`, [
      ...BOOKS.map(b => ({ label: `${read.includes(b.id) ? '✓ ' : ''}${b.title}`, onClick: () => this.readBook(b) })),
      read.includes('diary') && !fl.wand ? { label: '📕 Pull the crooked book', onClick: () => this.pullBook() } : null,
    ]);
  },

  pullBook(this: any) {
    const fl = this.state.flags;
    fl.wand = true; sfx.key();
    const e = this.entities.get('shelf');
    if (e) this.fx.burst(e.group.position.clone().setY(1.3), { count: 20, color: '#ff9a50', size: 0.25 });
    ui.dialog({ title: 'A hidden compartment', html: '<p>The crooked book is a lever. Something clicks, and a slim drawer slides out of the shelf.</p><p>Inside lies a wand of black wood with a glowing ember core.</p><p class="muted">Found: <b>Ember Wand</b> — your falling-furniture spell recharges twice as fast in battle.</p>', buttons: [{ label: 'Take it' }] });
    this.secretFound(); this.refreshHUD(); this.engine.autosave();
  },

  secretFound(this: any) {
    const fl = this.state.flags;
    if (fl.wand && fl.cloak && fl.diary) unlock('secrets');
  },

  readBook(this: any, b) {
    const read = this.state.flags.books;
    if (!read.includes(b.id)) read.push(b.id);
    if (read.length >= BOOKS.length) unlock('bookworm');
    if (b.id === 'conjuring' && learn(this.state, 'levitate')) ui.log('Chapter 3 teaches you to LIFT what you conjured. New spell: Levitate.', 'good');
    sfx.page();
    ui.dialog({ title: b.title, html: `<div class="book">${ui.escapeHtml(b.text)}</div>`, buttons: [{ label: 'Back to the shelf', onClick: () => this.use_shelf() }, { label: 'Close' }] });
  },

  use_closet(this: any) {
    const fl = this.state.flags;
    this.menu('Closet', 'You can change your clothes here, or view yourself in the mirror.', [
      { label: 'Change clothes', onClick: () => { if (this.state.clothes === 'new') ui.log('You are already in a new pair of clothes.'); else { this.state.clothes = 'new'; sfx.open(); ui.log('You wear a new pair of clothes. Very wizardly.'); } } },
      { label: 'Look in the mirror', onClick: () => { fl.mirror = (fl.mirror || 0) + 1; ui.log(MIRROR_LINES[Math.min(fl.mirror - 1, MIRROR_LINES.length - 1)]); unlock('fabulous'); } },
      this.state.clothes === 'new' && !fl.cloak ? { label: 'Knock on the back panel', onClick: () => this.knockPanel() } : null,
    ]);
  },

  knockPanel(this: any) {
    const fl = this.state.flags;
    fl.knocks = (fl.knocks || 0) + 1;
    if (!fl.books.includes('witch') && fl.knocks < 3) { sfx.close(); ui.log('Knock knock. The panel sounds... hollow? You\'re not sure what you\'re looking for.'); return; }
    fl.cloak = true; sfx.key();
    ui.dialog({ title: 'A false back', html: '<p>The panel behind your old clothes is hollow. It swings open on a hidden hinge.</p><p>Hanging inside: a midnight-purple cloak that smells faintly of smoke and roses.</p><p class="muted">Found: <b>Witch\'s Cloak</b> — absorbs the first hit you take in each boss fight.</p>', buttons: [{ label: 'Wear it' }] });
    this.secretFound(); this.refreshHUD(); this.engine.autosave();
  },

  use_shoerack(this: any) {
    const s = this.state.shoes;
    this.menu('Shoe Rack', `Here you can wear shoes and slippers. A label reads: "please wear shoes before going out of the house".\nYou are wearing: ${s === 'none' ? 'nothing on your feet' : s}.`, [
      s !== 'shoes' ? { label: 'Wear shoes', onClick: () => { this.state.shoes = 'shoes'; sfx.pickup(); ui.log('You wore shoes. Sturdy soles.'); this.refreshHUD(); } } : null,
      s !== 'slippers' ? { label: 'Wear slippers', onClick: () => { this.state.shoes = 'slippers'; sfx.pickup(); ui.log('You wore slippers. Comfy. Probably flammable.'); this.refreshHUD(); } } : null,
      s !== 'none' ? { label: 'Take them off', onClick: () => { ui.log(`You took off the ${this.state.shoes}.`); this.state.shoes = 'none'; this.refreshHUD(); } } : null,
    ]);
  },

  use_showcase(this: any) {
    const fl = this.state.flags;
    const e = this.entities.get('showcase');
    if (!fl.showcaseOpen) {
      if (!fl.showKey) {
        sfx.locked();
        this.menu('Showcase', fl.hellKeyTaken ? 'The glass case is locked again. Your H key doesn\'t fit — it wants the invisible one.' : 'A locked glass case. Inside you can make out a skeleton, a stone slab and a glint of red metal. The keyhole glows faintly cyan.', []);
        return;
      }
      sfx.key();
      fl.showcaseOpen = true;
      this.openShowcaseVisual(false);
      ui.log('The invisible key turns. The showcase is unlocked and swings open.', 'good');
      unlock('fossil');
      this.engine.autosave();
    }
    this.menu('Showcase', 'Inside, the skeleton of the legendary hell monster Kraken. It\'s smaller than you imagined. Below it, a fossil with the impression of some kind of giant nail.', [
      { label: 'Study the skeleton', onClick: () => ui.log('Five arms, one enormous eye socket. The arms end in flat pads — as if made for slamming.', 'lore') },
      { label: fl.nailKnown ? 'Study the fossil again' : 'Study the nail fossil', onClick: () => this.studyFossil() },
      !fl.hellKeyTaken ? { label: 'Take the key with an "H" on it', onClick: () => { fl.hellKeyTaken = true; this.engine.split('H key'); e.group.userData.hkey.visible = false; sfx.key(); ui.log('You took the key with an "H" inscribed on it.', 'good'); this.refreshHUD(); this.engine.autosave(); } } : null,
    ]);
  },

  studyFossil(this: any) {
    const fl = this.state.flags;
    if (!fl.nailKnown) {
      fl.nailKnown = true; sfx.conjure();
      ui.dialog({ title: 'The Nail Fossil', html: '<p>You trace the impression with your fingers: a shaft as wide as a tree, a head like a cart wheel. Something like this once fell from the sky — and pinned the first Kraken to the floor of hell.</p><p>The shape burns itself into your memory.</p><p class="muted">New spell learned: <b>Giant Nail</b>. Far too big for this room. It needs a worthy target.</p>', buttons: [{ label: 'Got it' }] });
      this.engine.autosave();
    } else ui.log('The nail shape is already burned into your memory.', 'lore');
  },

  openShowcaseVisual(this: any, instant) {
    const e = this.entities.get('showcase');
    if (!e) return;
    e.group.userData.keyhole.material.color.set(0x335555);
    if (instant) e.group.userData.door.rotation.y = -1.9;
    else this.anim = { obj: e.group.userData.door, prop: 'y', to: -1.9 };
  },

  use_pc(this: any) {
    const fl = this.state.flags;
    sfx.type();
    const pcMenu = () => ui.dialog({
      title: '💻 WIZ-DOS 3.1',
      html: '<div class="pc-screen">Power button pressed.\nHome screen opened.\n\nC:\\&gt; _</div>',
      buttons: [
        { label: '🎮 Play a game', onClick: () => this.rps() },
        { label: '🌐 Surf', onClick: () => ui.dialog({ title: 'WizNet', html: `<div class="pc-screen">${PC_SURF}</div>`, buttons: [{ label: 'Back', onClick: pcMenu }] }) },
        { label: '✉️ Messages', onClick: () => ui.dialog({ title: 'Mail', html: `<div class="pc-screen">${PC_MAIL}</div>`, buttons: [{ label: 'Back', onClick: pcMenu }] }) },
        { label: this.state.flags.diary ? '📓 vault.exe (open)' : '🔒 vault.exe', onClick: () => this.vault(pcMenu) },
        { label: 'Shut down', cls: 'danger', onClick: () => ui.log('PC closed.') },
      ],
    });
    pcMenu();
  },

  vault(this: any, back) {
    const fl = this.state.flags;
    if (fl.diary) { ui.dialog({ title: 'Vault', html: `<div class="book">${ui.escapeHtml(WITCH_DIARY)}</div>`, buttons: [{ label: 'Back', onClick: back }, { label: 'Close' }] }); return; }
    const box = ui.dialog({
      title: '🔒 vault.exe',
      html: `<div class="pc-screen">PROPERTY OF THE WITCH.\nENTER 3-DIGIT CODE:</div><input id="vcode" inputmode="numeric" maxlength="3" autocomplete="off" style="margin-top:10px;width:100%;font:22px var(--mono);letter-spacing:.4em;text-align:center;padding:8px;border-radius:8px;border:1px solid #1d4d2a;background:#031207;color:#59ff8a">`,
      buttons: [{ label: 'Enter', cls: 'primary', keep: true, onClick: () => check() }, { label: 'Back', onClick: back }],
    });
    const inp = box.querySelector<any>('#vcode');
    setTimeout(() => inp.focus(), 30);
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') check(); });
    const check = () => {
      if (inp.value.replace(/\D/g, '') === '556') {
        fl.diary = true; sfx.key(); unlock('vault');
        ui.dialog({ title: 'ACCESS GRANTED', html: `<div class="book">${ui.escapeHtml(WITCH_DIARY)}</div>`, buttons: [{ label: 'Close the vault' }] });
        this.secretFound(); this.refreshHUD(); this.engine.autosave();
      } else { sfx.locked(); inp.value = ''; inp.placeholder = 'WRONG'; }
    };
  },

  rps(this: any) {
    let you = 0, comp = 0, last = 'First to 3 wins.\nType... er, click rock, paper or scissors when ready.';
    const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
    const icon = { rock: '🪨', paper: '📄', scissors: '✂️' };
    const render = () => {
      const box = ui.dialog({
        title: 'Rock · Paper · Scissors',
        html: `<div class="pc-screen">${last}\n\nYOU ${you}  —  ${comp} PC</div><div class="rps-row"><button class="btn" data-m="rock">🪨</button><button class="btn" data-m="paper">📄</button><button class="btn" data-m="scissors">✂️</button></div>`,
        buttons: [{ label: 'Quit game', cls: 'danger' }],
      });
      box.querySelectorAll<any>('[data-m]').forEach(b => b.addEventListener('click', () => play(b.dataset.m)));
    };
    const play = (m) => {
      const c = ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)];
      let res;
      if (m === c) res = 'Tie!';
      else if (beats[m] === c) { you++; res = 'You win the round!'; sfx.win(); }
      else { comp++; res = 'PC wins the round. It looks smug.'; sfx.lose(); }
      last = `1!, 2!!, 3!!! GO!!!!!\n\nyou: ${icon[m]}   pc: ${icon[c]}\n${res}`;
      if (you >= 3 || comp >= 3) return finish(you >= 3);
      render();
    };
    const finish = (won) => {
      const fl = this.state.flags;
      if (won) {
        fl.pcWon = true; unlock('rps');
        if (comp === 0) unlock('rpsflawless');
        const tip = fl.keyCell ? `"Close the PC and SEARCH the floor in the ${CELL_NAMES[fl.keyCell].toUpperCase()} part of the room."` : '"Close the PC and SEARCH the floor before moving from this spot."';
        ui.dialog({ title: 'YOU WON!!!', html: `<div class="pc-screen">Congratulations,\nyou have cleared the first half of the game...\n\nNow here is your secret tip:\n\n${tip}</div>`, buttons: [{ label: 'Close the PC' }] });
        this.engine.autosave();
      } else {
        ui.dialog({ title: 'You lost!', html: '<div class="pc-screen">PC wins 3 rounds.\nIt plays a little victory jingle.</div>', buttons: [{ label: 'Rematch', onClick: () => this.rps() }, { label: 'Close' }] });
      }
    };
    render();
  },

  use_door(this: any, f) {
    const side = f.key.split('_')[1];
    const open = !!this.state.flags[f.key];
    const c = this.state.custom;
    if (this.state.mode === 'custom' && c && c.exit === side) {
      if (!this.state.flags.customKey) { sfx.locked(); ui.log('The exit door is locked. The key is hidden somewhere in this room — search near the furniture (G).', 'warn'); return; }
      sfx.key(); this.setDoor(side, true);
      ui.log('The key turns. Daylight pours in!', 'good');
      setTimeout(() => { if (this.engine.level === this) this.engine.customWin(); }, 900);
      return;
    }
    if (open) { this.setDoor(side, false); ui.log('You closed the door.'); return; }
    const a = this.room.annexes[side];
    if (a && a.type === 'hell' && !this.state.flags.hellKeyTaken) {
      sfx.locked();
      ui.log(this.state.flags.showKey ? 'The door is locked. You try the invisible key, but it does not fit. Maybe it goes into something else.' : 'The door is locked. You don\'t have its key. The keyhole is shaped like... a letter?', 'warn');
      return;
    }
    this.setDoor(side, true);
    if (a && a.type === 'hell') ui.log('The H key turns. Heat pours through the doorway.', 'good');
    else ui.log('You opened the door.');
    if (!a) ui.log('Beyond the door: nothing. A flat black void. Maybe conjure something out there.', 'lore');
  },

  setDoor(this: any, side, open) {
    const key = 'door_' + side;
    const e = this.entities.get(key);
    if (!e) return;
    this.state.flags[key] = open;
    open ? (sfx.open(), sfx.creak()) : sfx.close();
    this.anim = { obj: e.group.userData.pivot, prop: 'y', to: open ? -1.6 : 0 };
  },

  use_lamp(this: any) { this.menu('Lamp', '', [{ label: 'Pick it up', onClick: () => this.pickLamp() }, { label: this.state.lampOn ? 'Turn off' : 'Turn on', onClick: () => this.toggleLamp() }]); },

  use_tap(this: any) {
    const fl = this.state.flags;
    const a = this.annexOfType('bathroom');
    this.menu('Sink', fl.tapOn ? 'Water is flowing.' : 'The tap is off.', [
      { label: fl.tapOn ? 'Turn the tap off' : 'Turn the tap on', onClick: () => { fl.tapOn = !fl.tapOn; a.water.visible = fl.tapOn; sfx.water(fl.tapOn); ui.log(fl.tapOn ? 'You turned the tap. Water is flowing.' : 'You turned the tap. Water stopped flowing.'); } },
      { label: 'Wash your face', onClick: () => { if (fl.tapOn) { ui.log('You washed your face. Please remember to turn off the tap.'); fl.washed = true; } else ui.log('Please turn the tap on to wash your face.'); } },
      { label: 'Look in the mirror', onClick: () => { unlock('fabulous'); ui.log('A tired but fabulous wizard looks back at you.'); } },
    ]);
  },

  use_toilet(this: any) { const fl = this.state.flags; if (!fl.peed) { fl.peed = true; ui.log('You peed. Magic does not solve everything.'); } else ui.log('You were not able to pee anymore.'); },

  use_shower(this: any) {
    const fl = this.state.flags;
    const a = this.annexOfType('bathroom');
    this.menu('Shower', 'Do you want to take a shower?', [{
      label: 'Yes', onClick: () => {
        fl.showered = true; this.state.clothes = 'new';
        a.drops.visible = true; sfx.water(true);
        setTimeout(() => { a.drops.visible = false; }, 3500);
        ui.log('You keep your lamp aside, take off your soiled clothes and take a hot shower. You wear a new pair of clothes. You feel fresh and active.', 'good');
        unlock('hygiene'); this.engine.autosave();
      },
    }]);
  },

  use_stove(this: any) {
    const fl = this.state.flags;
    if (fl.stewCooked) { ui.log(fl.stewEaten ? 'The cauldron is empty. The witch did say ONE stew.' : 'Your bowl of ember stew is waiting. Eat it at a proper table.'); return; }
    ui.dialog({ title: 'Stove', html: `<div class="book">${ui.escapeHtml(KITCHEN_NOTE)}</div>`, buttons: [{ label: 'Cook the ember stew', onClick: () => {
      fl.stewCooked = true; const a = this.annexOfType('kitchen'); a.stew.visible = false;
      sfx.sizzle(); unlock('chef');
      ui.log('You ladle the glowing stew into a bowl. The witch would insist you eat it at a dining table.', 'good');
      this.refreshHUD(); this.engine.autosave();
    } }, { label: 'Leave it' }] });
  },

  eatStew(this: any) {
    const fl = this.state.flags;
    fl.stewEaten = true;
    this.state.maxHearts += 1; this.state.hearts = this.state.maxHearts;
    sfx.pickup();
    ui.log('You sit down properly and eat the ember stew. Warmth spreads through your chest. (+1 max heart, fully healed.)', 'good');
    this.refreshHUD(); this.engine.autosave();
  },

  use_knives(this: any) { ui.log('You reach for the knives. A voice in your head says: "NO."', 'lore'); },

  use_fridge(this: any) {
    const fl = this.state.flags;
    sfx.open();
    if (fl.lemon) { ui.log('Empty. Even the lemon left you.'); return; }
    this.menu('Fridge', 'Empty, except for a single, judgmental lemon.', [{ label: 'Take the lemon', onClick: () => { fl.lemon = true; sfx.pickup(); ui.log('You pocket the lemon. It judges you from inside your pocket.'); this.refreshHUD(); this.engine.autosave(); } }]);
  },

  use_portal(this: any) { this.enterPortal(); },

  annexOfType(this: any, type) { for (const s of SIDES) if (this.room.annexes[s] && this.room.annexes[s].type === type) return this.room.annexes[s]; return null; },
};
