// Accessibility state shared by the levels: motion and telegraph colours.
export const A11Y = { reducedMotion: false, palette: 'standard' };

// Okabe-Ito colours for the colour-blind safe palette.
const PALETTES = {
  standard: { mine: 0xc9a8ff, danger: 0xff3030, fire: 0xff6020, nail: 0xffe0a0 },
  safe: { mine: 0x56b4e9, danger: 0xe69f00, fire: 0xd55e00, nail: 0xf0e442 },
};
export const COL: Record<'mine' | 'danger' | 'fire' | 'nail', number> = new Proxy({} as any, { get: (_, k) => (PALETTES[A11Y.palette] || PALETTES.standard)[k] });
