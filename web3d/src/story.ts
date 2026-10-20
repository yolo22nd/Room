// All narrative text lives here.

export const INTRO = [
  'You, a <em>WIZARD</em> — just a newbie —\ntook up a battle to the death with one of the best witches in your world...',
  'Obviously, you were defeated.\nAnd when the witch was about to <em>KILL YOU</em> with her final spell,\nyou begged for mercy...',
  'Being merciful, she banished you instead —\nto a place beyond hell. The place was a <em>room</em>.\nTo travel back to the world of the living,\nyou will literally need to go through hell.',
  'Here is the good news of her being merciful:\nyou <em>weren\'t</em> stripped of your powers.\nAnything you conjure will fall from the sky.\n(Mind your head.)',
  'So the main objective is:\n\n<em>GO  TO  HELL!!!</em>',
];

export const BOOKS = [
  {
    id: 'conjuring', title: 'Conjuration for Newbies',
    text: `Chapter 1 — Where Things Land

A conjured object is not created. It is borrowed from somewhere above and dropped. This is why conjurers wear hats, and why the wise ones never conjure a bed where they are standing.

Chapter 2 — Fragile Things

Glass, lamps and especially thinking-machines do not survive the fall onto a bare floor. Conjure something soft beneath them first. A cushion is traditional.

Chapter 3 — Second Thoughts

What was conjured can be lifted again. Hold the thought of the object, raise it, and set it down where it should have gone in the first place. (Spell: Levitate.)`,
  },
  {
    id: 'bestiary', title: 'Bestiary of the Under-Realms',
    text: `KRAKEN (Abyssus maximus)

Lord of the burning sea. Many-armed. Its arms strike where its prey stands, then lie still upon the stone for a few heartbeats, as if catching their breath.

Only one kraken was ever slain. Chroniclers agree it was "pinned like a moth to a board" — though by what, none can say. Some swear a nail the size of a tower fell from the heavens.

It is said a second one was spawned. They called it, unimaginatively, KRAKEN 2.0.`,
  },
  {
    id: 'diary', title: 'Diary of the Previous Prisoner',
    text: `Day 1: Dark. Too scared to move. Conjured a lamp. Much better.

Day 3: Conjured a PC. It shattered. Conjured a cushion, then the PC on top of it. It works! The PC only wants to play rock-paper-scissors. It is very smug.

Day 9: Beat it. It told me a secret: "search the floor where I stand". Found something I could not see. A key? It opens glass.

Day 5: One book on the shelf is not a book. It sits crooked, like it wants to be pulled.

Day 10: The door beside hell locks itself. It wants a different key. One with a letter on it.

Day 11: Going in. Wearing shoes. Floor looked hot.`,
  },
  {
    id: 'witch', title: 'The Witch of Ember Hollow',
    text: `She was the youngest witch ever to banish a dragon, and the oldest to still be undefeated. She is merciful, which her enemies find very irritating.

She keeps exactly one television channel — her own — and broadcasts to every room she has ever built. Prisoners report that she only appears when they are sitting down and paying attention.

She never travels without her cloak, and she hides it the way every witch does: behind her clothes, behind a panel that sounds hollow.`,
  },
  {
    id: 'rps', title: 'Rock, Paper, Scissors: A Treatise',
    text: `Paper covers rock.
Scissors cut paper.
Rock crushes scissors.

Machines, it is known, have no strategy at all. They pick at random. Do not let their smugness fool you; patience wins.

First to three wins.`,
  },
  {
    id: 'hitlist', title: 'Hit List',
    text: `1. The dragon of Mount Sorrow — DONE
2. The lich in the lighthouse — DONE
3. That newbie wizard — (crossed out) banished instead. Felt sorry.
4. Kraken 2.0 — someone else's problem now

(scribbled at the bottom) If the newbie gets this far: there is a nail-shaped hole in the history books. Fill it.`,
  },
];

export const DREAM = [
  'You drift off... the room melts into dark water.',
  'Something enormous moves beneath you. Eight... no, five arms.',
  'A voice, amused: "It strikes where you stand. It rests where it struck. Pin the arms, newbie. Then show it what fell from the sky the last time."',
  'You wake up, sitting on the edge of the bed.',
];

export const TV_BROADCAST = [
  '*static* ...is this thing on? Ah. Newbie.',
  'If you are watching this, you are sitting down. Good. Prisoners who stand never listen.',
  'You will want to leave. Of course. The way out is through hell, and hell has a doorman with too many arms.',
  'A hint, since I am merciful: the last kraken died under a falling nail. You will find its picture somewhere glass. Learn the shape, and you can conjure it.',
  'And no, you may not use the kitchen. Not because of the knives. Well. Mostly because of the knives.',
  'Oh, and stop trying to guess my vault code. It is the number of arms on a kraken, twice, then the number of the beast\'s last digit. Nobody will ever figure that out. *static*',
];

export const KITCHEN_NOTE = `A sticky note on the stove, in the witch's handwriting:

"Fine. ONE stew. Ember stew is good for the heart. Do not touch the knives."`;

export const MIRROR_LINES = [
  'You look at yourself in the closet mirror... you realise you already look fabulous.',
  'You look again. Still fabulous.',
  'You strike a heroic pose. The mirror seems impressed.',
];

export const HELL_ENTRY = [
  'Congratulations, you have entered hell.\nIt is a notable day in the history of...',
  'NO WAIT!!!',
  'It\'s <em>KRAKEN 2.0</em>.\nIt\'s much bigger than you would have imagined.',
];

export const ENDING = [
  'The giant nail drives home. KRAKEN 2.0 shudders, sinks, and the lava cools to glass beneath your feet.',
  'A white door opens in the air. Beyond it: grass, wind, an ordinary sky.',
  'The witch is waiting on the other side, leaning on her broom.\n"Impressive, newbie. Most people just stay in the room and redecorate."',
  '"Oh — and the TV and the kitchen? I promised you a legit explanation.\nThe TV only ever plays my channel. And nobody lets a prisoner near the knives."',
  'She smiles. "Rematch?"\n\nTO BE CONTINUED...',
];

export const WITCH_INTRO = [
  'You step through the white door onto cool grass. Dusk. Fireflies. A ring of standing stones.',
  'The witch drifts down on her broom and lands in front of you.\n"Rematch, then. I did ask."',
  '"Same rules as always: whatever you conjure falls from the sky.\nSame rules for me, too."',
  '<em>PART 3 — THE REMATCH</em>',
];

export const WITCH_TALK = {
  start: {
    who: 'witch', name: 'The Witch of Ember Hollow',
    text: '"Before I flatten you with a pumpkin — any last words, newbie?"',
    choices: [
      { label: '"Please go easy on me."', next: 'easy', effect: 'easy' },
      { label: '"I\'ve been practising."', next: 'practice' },
      { label: '"Your diary says you hate lemons."', next: 'lemon', effect: 'rattled', if: (c) => c.flags && c.flags.diary },
      { label: '"Why did you really banish me?"', next: 'why', if: (c) => c.flags && c.flags.books && c.flags.books.length >= 6 },
    ],
  },
  easy: { who: 'witch', name: 'The Witch', text: '"Ha! Fine. I\'ll cast a little slower. Don\'t tell anyone I\'m soft."', choices: [{ label: 'Fight!' }] },
  practice: { who: 'witch', name: 'The Witch', text: '"Oh? Show me, then. I do love a show."', choices: [{ label: 'Fight!' }] },
  lemon: {
    who: 'witch', name: 'The Witch', text: '"...WHO told you. Nobody reads my diary. NOBODY." (She looks genuinely rattled.)',
    choices: [{ label: '"Everyone, apparently."', next: 'lemon2' }],
  },
  lemon2: { who: 'witch', name: 'The Witch', text: '"I am going to rearrange your FURNITURE." (Her shield flickers. She\'s off her game.)', choices: [{ label: 'Fight!' }] },
  why: {
    who: 'witch', name: 'The Witch', text: '"...Because the dragon didn\'t give me a choice either. Someone has to learn the hard way so the next one doesn\'t have to."',
    choices: [{ label: '"And am I learning?"', next: 'why2' }],
  },
  why2: { who: 'witch', name: 'The Witch', text: '"Ask me again after I win."', choices: [{ label: 'Fight!' }] },
};

export const LESSON_HINTS = {
  upside: ['"Look UP. The ceiling shows what it wants, and where."', '"Open the spellbook and aim at the glowing rune itself — not the floor."', '"Each rune shows one piece of furniture. Conjure exactly that, aimed at that rune. Three runes, three pieces."'],
  library: ['"Low books first. The water won\'t wait, and it will lift you away from them."', '"Every piece of furniture you conjure makes the water rise. Useful — if the low books are already safe."', '"Grab the two low books by the entrance at once. Then conjure to raise the water and float up to the high ones."'],
  clockwork: ['"Watch the door. Count the turns."', '"Anything that falls into the gear pit in the middle jams the tower."', '"Wait until the door faces the bridge, then conjure into the middle cell. Then open the door and walk."'],
};

export const WITCH_TAUNTS = [
  '"Is that a sofa? You brought a SOFA to a duel?"',
  '"I taught half the wizards in this world. You\'re the worst one. I like that."',
  '"Pumpkin season!"',
  '"Look up, newbie!"',
  '"Still fabulous, I see."',
  '"My cauldron says hello."',
];

export const WITCH_ENDING = [
  'The witch lies in the grass, hat crumpled, laughing so hard she can\'t get up.',
  '"Fine! FINE! You win, newbie. Nobody has beaten me since the dragon."',
  '"I suppose that makes you... my apprentice? Don\'t make that face. It comes with a room."',
  '"A nicer one. With a window. And yes — a kitchen. With knives."',
  '<em>THE END</em>\n\n(for real this time)',
];

export const PC_SURF = `WIZNET EXPLORER v0.9

> Connecting to the world of the living...
> ERROR 666: You are beyond hell. No signal.

Try again after escaping.`;

export const WITCH_DIARY = `THE WITCH'S DIARY (private!!)

Monday: banished a newbie. Felt sorry for them. Gave them a room. Am I going soft?

Tuesday: the newbie has conjured fourteen chairs. Fourteen.

Wednesday: if they ever beat Kraken 2.0 they will want a rematch. They always want a rematch.

Note to self: NOBODY must ever learn about my one weakness.

(It's lemons. I cannot stand lemons. The smell alone makes me drop my broom.)`;

export const PC_MAIL = `INBOX (1)

From: the witch
Subject: re: please let me out

no.

(but the machine knows a secret. beat it at its own game.)`;
