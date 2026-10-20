import * as ui from './ui';
import { speak, stopVoice } from './voice';
import { sfx } from './audio';

/**
 * A tiny dialogue-tree runner. nodes: { id: { who, name, text, choices: [{ label, next?, if?, effect? }] } }
 * Choices whose `if()` returns false are hidden. Resolves with the list of effects chosen.
 */
export function runDialogue(nodes, start, ctx: any = {}) {
  return new Promise<string[]>((resolve) => {
    const effects: string[] = [];
    const show = (id) => {
      const n = nodes[id];
      if (!n) { stopVoice(); resolve(effects); return; }
      speak(n.text, n.who);
      const choices = (n.choices || [{ label: 'Continue' }]).filter(c => !c.if || c.if(ctx));
      ui.dialog({
        title: n.name || '',
        html: `<p>${n.text}</p>`,
        dismissable: false,
        buttons: choices.map(c => ({
          label: c.label,
          onClick: () => { sfx.click(); if (c.effect) effects.push(c.effect); show(c.next); },
        })),
      });
    };
    show(start);
  });
}
