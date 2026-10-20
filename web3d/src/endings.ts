// The five endings. Which ones you've seen is remembered across runs.

export const ENDINGS = {
  escape: {
    title: 'You escaped', sub: 'kraken 2.0 · nailed',
    hint: 'Defeat Kraken 2.0 and turn down the rematch.',
    foot: 'The rematch is waiting whenever you are: escape again and say yes.',
  },
  apprentice: {
    title: 'The Apprentice', sub: 'kraken nailed · witch defeated · hand offered',
    hint: 'Win the rematch and help the witch up.',
    foot: 'A nicer room. With a window. And knives.',
    story: [
      'You offer her a hand. She stares at it, then takes it.',
      '"Fine! FINE! You win, newbie. Nobody has beaten me since the dragon."',
      '"I suppose that makes you... my apprentice? Don\'t make that face. It comes with a room."',
      '"A nicer one. With a window. And yes — a kitchen. With knives."',
      '<em>ENDING: THE APPRENTICE</em>',
    ],
  },
  rival: {
    title: 'The Rival', sub: 'kraken nailed · witch defeated · broom stolen',
    hint: 'Win the rematch and take what isn\'t yours.',
    foot: 'Somewhere, a witch is walking home. Furious. Delighted.',
    story: [
      'Her broom lies in the grass. You pick it up. It hums.',
      '"Don\'t you DARE," she says, already grinning.',
      'You dare. The broom shoots into the dusk with you clinging to it, screaming, triumphant.',
      'From far below, a voice: "REMATCH! NEXT TUESDAY!"',
      '<em>ENDING: THE RIVAL</em>',
    ],
  },
  true: {
    title: 'The Truth', sub: 'every secret found · every book read',
    hint: 'Know everything the room knows before you win the rematch.',
    foot: 'The room was never a prison. It was a classroom.',
    story: [
      'You hand her back her diary, her cloak, and her wand. She goes very quiet.',
      '"You found all of it. Of course you did. That was rather the point."',
      '"The room was never a prison. Every book, every hidden panel — I put them there. For the right newbie."',
      '"Nobody taught me. I had to fight a dragon to learn what I know. I thought... maybe someone shouldn\'t have to."',
      '"Partners, then? Not master and apprentice. Two witches. Well — a witch and a wizard who conjures sofas."',
      '<em>TRUE ENDING: THE TRUTH</em>',
    ],
  },
  lessons: {
    title: 'Three for Three', sub: 'part 4 · the three lessons passed',
    hint: 'Pass all three of the witch\'s lessons.', foot: 'Next term: the Witch Exams.', notEnding: true,
  },
  redecorator: {
    title: 'The Redecorator', sub: 'you had the key · you stayed',
    hint: '"Most people just stay in the room and redecorate."',
    foot: 'Honestly? It\'s a lovely room now.',
    story: [
      'You lie in the bed you conjured, in the room you built, holding the key to hell.',
      'You look at the shelf. The sofa. The ridiculous showcase. The rug you didn\'t even conjure.',
      'You put the key on the bedside table.',
      'Somewhere far away, a witch checks her crystal ball, sighs, and mutters: "...they always redecorate."',
      '<em>ENDING: THE REDECORATOR</em>',
    ],
  },
};
export type EndingId = keyof typeof ENDINGS;
export const ENDING_IDS = Object.keys(ENDINGS).filter(k => !(ENDINGS as any)[k].notEnding);

const KEY = 'room3d.endings.v1';
export function seenEndings(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
}
export function recordEnding(id: EndingId) {
  const s = new Set(seenEndings()); s.add(id);
  try { localStorage.setItem(KEY, JSON.stringify([...s])); } catch (e) { /* ignore */ }
  return [...s].filter(x => ENDING_IDS.includes(x)).length;
}

/** The true ending needs all three secrets and every book read. */
export function trueEndingReady(state) {
  const fl = state.flags || {};
  return !!(fl.wand && fl.cloak && fl.diary && fl.books && fl.books.length >= 6);
}
