// Themes are palettes. Every component styles itself with the shared classes
// in THEME_CLASSES, which read CSS variables; a theme only supplies the values.
// That keeps one meaning per colour across the whole page: `played` is always
// "a key you are pressing" and `guide` is always "a key practice wants next",
// on the computer keyboard, the piano, the waterfall and the toolbar alike.

export type ThemeID =
  | 'night' | 'day' | 'studio'
  | 'dark' | 'light' | 'cyber' | 'fauvism' | 'minimalist' | 'pastel';

export const DEFAULT_THEME_ID: ThemeID = 'night';

export interface ThemePalette {
  appBg: string;
  barBg: string;          // title row, toolbar and status bar
  barBorder: string;
  panelBg: string;        // toolbar groups, settings and history panels
  panelBorder: string;
  fieldBg: string;        // inputs and selects
  hoverBg: string;
  text: string;
  textMuted: string;
  keyboardBg: string;     // CSS background behind the computer keyboard (colour or gradient)
  keyboardAccent: string; // text drawn straight on keyboardBg (the support link)
  keyBg: string;
  keyBorder: string;
  keyEdge: string;        // the key's lower edge, drawn as a hard shadow
  keyLabel: string;       // QWERTY cap label
  keyText: string;        // jianpu digit
  played: string;         // a key you are pressing (6-digit hex: the waterfall adds alpha to it)
  playedInk: string;
  playedDeep: string;     // pressed black piano keys and black-key waterfall notes; must stand out on pianoBlack
  guide: string;          // practice: fades in as a note approaches, full = play now
  guideInk: string;
  rec: string;
  pianoBed: string;
  pianoWhite: string;
  pianoBlack: string;
  pianoBorder: string;
  staveBg: string;
  staveInk: string;
  waterfallBg: string;
  keyRadius: string;
  keyBorderWidth: string;
  keyEdgeDepth: string;
  /** Box-shadow for lit keys; 'none' everywhere except themes built on glow. */
  glowPlayed: string;
  glowGuide: string;
}

// ─── Palettes ───────────────────────────────────────────────────

const NIGHT: ThemePalette = {
  appBg: '#121418', barBg: '#181b21', barBorder: '#272b34', panelBg: '#1e2229', panelBorder: '#2c313b',
  fieldBg: '#121418', hoverBg: '#272b34', text: '#e6e8ec', textMuted: '#8a919e',
  keyboardBg: '#121418', keyboardAccent: '#f2b544', keyBg: '#232730', keyBorder: '#2f343e', keyEdge: '#0a0c0f', keyLabel: '#767e8c', keyText: '#e9ecf1',
  played: '#f2b544', playedInk: '#221700', playedDeep: '#c98d1f', guide: '#45c9bd', guideInk: '#062421', rec: '#f0524f',
  pianoBed: '#0c0e11', pianoWhite: '#ebe9e3', pianoBlack: '#1a1c21', pianoBorder: '#b9b6ae',
  staveBg: '#181b21', staveInk: '#e6e8ec', waterfallBg: '#0f1115',
  keyRadius: '6px', keyBorderWidth: '1px', keyEdgeDepth: '2px', glowPlayed: 'none', glowGuide: 'none',
};

const DAY: ThemePalette = {
  appBg: '#eef0f3', barBg: '#ffffff', barBorder: '#dadde3', panelBg: '#f5f6f8', panelBorder: '#dadde3',
  fieldBg: '#ffffff', hoverBg: '#e8ebf0', text: '#1e2330', textMuted: '#6b7280',
  keyboardBg: '#e7eaee', keyboardAccent: '#3563e9', keyBg: '#ffffff', keyBorder: '#d3d7de', keyEdge: '#bfc4cd', keyLabel: '#9aa1ad', keyText: '#1e2330',
  played: '#3563e9', playedInk: '#ffffff', playedDeep: '#6f93ff', guide: '#e2891b', guideInk: '#2b1a05', rec: '#e23d3a',
  pianoBed: '#dfe2e7', pianoWhite: '#ffffff', pianoBlack: '#252a35', pianoBorder: '#c9cdd5',
  staveBg: '#ffffff', staveInk: '#1e2330', waterfallBg: '#1e2330',
  keyRadius: '6px', keyBorderWidth: '1px', keyEdgeDepth: '2px', glowPlayed: 'none', glowGuide: 'none',
};

const STUDIO: ThemePalette = {
  appBg: '#16110e', barBg: '#1d1814', barBorder: '#30271f', panelBg: '#241d18', panelBorder: '#3a2f26',
  fieldBg: '#16110e', hoverBg: '#30271f', text: '#efe6d6', textMuted: '#a0927e',
  keyboardBg: '#16110e', keyboardAccent: '#c9a15a', keyBg: '#ece3d2', keyBorder: '#d6c9b2', keyEdge: '#8f8069', keyLabel: '#8e806b', keyText: '#2a1f15',
  played: '#c9a15a', playedInk: '#1c1307', playedDeep: '#b08d4c', guide: '#a8433a', guideInk: '#f6ece0', rec: '#d9543f',
  pianoBed: '#0f0b09', pianoWhite: '#ede4d3', pianoBlack: '#1b1512', pianoBorder: '#b3a58f',
  staveBg: '#efe6d6', staveInk: '#2a1f15', waterfallBg: '#0f0b09',
  keyRadius: '5px', keyBorderWidth: '1px', keyEdgeDepth: '2px', glowPlayed: 'none', glowGuide: 'none',
};

// The original themes, remade on the same rules: flat keys, a single-colour
// toolbar, and one colour each for "pressed" and "guide".

const DARK: ThemePalette = {
  appBg: '#2c2c2e', barBg: '#232325', barBorder: '#3a3a3d', panelBg: '#1c1c1e', panelBorder: '#3a3a3d',
  fieldBg: '#161618', hoverBg: '#3a3a3d', text: '#ececec', textMuted: '#9a9a9e',
  keyboardBg: 'linear-gradient(to bottom, #3a3a3c, #262628)', keyboardAccent: '#f2c14e', keyBg: '#f5f5f3', keyBorder: '#dcdcd8', keyEdge: '#7c7c78',
  keyLabel: '#8c8c88', keyText: '#1d1d1f',
  played: '#f2c14e', playedInk: '#231a00', playedDeep: '#b8861c', guide: '#4fb8f0', guideInk: '#04202e', rec: '#ef4444',
  pianoBed: '#19191b', pianoWhite: '#f7f7f5', pianoBlack: '#1e1e20', pianoBorder: '#a9a9a5',
  staveBg: '#242426', staveInk: '#e6e6e6', waterfallBg: '#19191b',
  keyRadius: '5px', keyBorderWidth: '1px', keyEdgeDepth: '2px', glowPlayed: 'none', glowGuide: 'none',
};

const LIGHT: ThemePalette = {
  appBg: '#ebebeb', barBg: '#ffffff', barBorder: '#dcdcdc', panelBg: '#f6f6f6', panelBorder: '#dcdcdc',
  fieldBg: '#ffffff', hoverBg: '#ececec', text: '#1f1f1f', textMuted: '#6e6e6e',
  keyboardBg: '#e2e2e2', keyboardAccent: '#2563eb', keyBg: '#ffffff', keyBorder: '#d2d2d2', keyEdge: '#b9b9b9', keyLabel: '#9b9b9b', keyText: '#1f1f1f',
  played: '#2563eb', playedInk: '#ffffff', playedDeep: '#6b98f2', guide: '#15803d', guideInk: '#ffffff', rec: '#dc2626',
  pianoBed: '#dadada', pianoWhite: '#ffffff', pianoBlack: '#2a2a2a', pianoBorder: '#c4c4c4',
  staveBg: '#fcfcfc', staveInk: '#1f1f1f', waterfallBg: '#262626',
  keyRadius: '6px', keyBorderWidth: '1px', keyEdgeDepth: '2px', glowPlayed: 'none', glowGuide: 'none',
};

const CYBER: ThemePalette = {
  appBg: '#07080c', barBg: '#0d0f16', barBorder: '#1c2a3a', panelBg: '#0a0d14', panelBorder: '#1c2a3a',
  fieldBg: '#05060a', hoverBg: '#15202d', text: '#c9f6ff', textMuted: '#5f8ea0',
  keyboardBg: 'radial-gradient(ellipse at center, #0b1420 0%, #05060a 75%)', keyboardAccent: '#e879f9', keyBg: '#0f141d', keyBorder: '#1f3647', keyEdge: '#03040a',
  keyLabel: '#3f6b7c', keyText: '#7fe8ff',
  played: '#22d3ee', playedInk: '#001417', playedDeep: '#0891b2', guide: '#e879f9', guideInk: '#22002a', rec: '#ff3b6b',
  pianoBed: '#030406', pianoWhite: '#c8d3dc', pianoBlack: '#0b0f16', pianoBorder: '#56707f',
  staveBg: '#0a0d14', staveInk: '#9bebff', waterfallBg: '#05060a',
  keyRadius: '3px', keyBorderWidth: '1px', keyEdgeDepth: '1px',
  glowPlayed: '0 0 14px rgba(34, 211, 238, 0.55)', glowGuide: '0 0 14px rgba(232, 121, 249, 0.5)',
};

// Matisse cut-outs: flat blocks of ultramarine, vermilion, cadmium yellow and
// emerald with a dark outline, instead of every saturated colour at once.
const FAUVISM: ThemePalette = {
  appBg: '#f3e9d2', barBg: '#1f3a93', barBorder: '#152a6e', panelBg: '#2a4aa8', panelBorder: '#152a6e',
  fieldBg: '#152a6e', hoverBg: '#2f55c0', text: '#fff6e0', textMuted: '#c8d2f5',
  keyboardBg: '#d9412b', keyboardAccent: '#fff6e0', keyBg: '#f7d046', keyBorder: '#13213f', keyEdge: '#13213f', keyLabel: '#7a5200', keyText: '#13213f',
  played: '#1f7a4d', playedInk: '#ffffff', playedDeep: '#35b374', guide: '#1f3a93', guideInk: '#ffffff', rec: '#b3121b',
  pianoBed: '#13213f', pianoWhite: '#fff6e0', pianoBlack: '#13213f', pianoBorder: '#13213f',
  staveBg: '#fff6e0', staveInk: '#13213f', waterfallBg: '#13213f',
  keyRadius: '4px', keyBorderWidth: '2px', keyEdgeDepth: '3px', glowPlayed: 'none', glowGuide: 'none',
};

const MINIMALIST: ThemePalette = {
  appBg: '#ffffff', barBg: '#ffffff', barBorder: '#111111', panelBg: '#ffffff', panelBorder: '#111111',
  fieldBg: '#ffffff', hoverBg: '#f0f0f0', text: '#111111', textMuted: '#6b6b6b',
  keyboardBg: '#ffffff', keyboardAccent: '#111111', keyBg: '#ffffff', keyBorder: '#c9c9c9', keyEdge: '#c9c9c9', keyLabel: '#9a9a9a', keyText: '#111111',
  played: '#111111', playedInk: '#ffffff', playedDeep: '#6b6b6b', guide: '#d42f36', guideInk: '#ffffff', rec: '#d42f36',
  pianoBed: '#ffffff', pianoWhite: '#ffffff', pianoBlack: '#111111', pianoBorder: '#111111',
  staveBg: '#ffffff', staveInk: '#111111', waterfallBg: '#ffffff',
  keyRadius: '0px', keyBorderWidth: '1px', keyEdgeDepth: '0px', glowPlayed: 'none', glowGuide: 'none',
};

const PASTEL: ThemePalette = {
  appBg: '#fbf3f7', barBg: '#fffafc', barBorder: '#f0dbe6', panelBg: '#ffffff', panelBorder: '#efd9e4',
  fieldBg: '#ffffff', hoverBg: '#f7e8f0', text: '#4a3f55', textMuted: '#74678a',
  keyboardBg: '#f6e6ee', keyboardAccent: '#7457c4', keyBg: '#ffffff', keyBorder: '#ecd9e7', keyEdge: '#dcc4d6', keyLabel: '#b3a4bf', keyText: '#4a3f55',
  played: '#b69cf0', playedInk: '#2d1f4d', playedDeep: '#cdb9ff', guide: '#7fcfc0', guideInk: '#0f3a33', rec: '#f07a8a',
  pianoBed: '#f3e3ec', pianoWhite: '#ffffff', pianoBlack: '#5b4e6b', pianoBorder: '#e2cfdc',
  staveBg: '#fffafc', staveInk: '#4a3f55', waterfallBg: '#3a3044',
  keyRadius: '10px', keyBorderWidth: '1px', keyEdgeDepth: '3px', glowPlayed: 'none', glowGuide: 'none',
};

// ─── Shared classes (identical for every theme) ─────────────────

const THEME_CLASSES = {
  appBg: 'bg-[color:var(--kp-app-bg)]',
  toolbarBg: 'bg-[color:var(--kp-bar-bg)]',
  toolbarBorder: 'border-[color:var(--kp-bar-border)]',
  toolbarText: 'text-[color:var(--kp-text)]',
  mutedText: 'text-[color:var(--kp-text-muted)]',
  panelBg: 'bg-[color:var(--kp-panel-bg)]',
  panelBorder: 'border-[color:var(--kp-panel-border)]',
  field: 'bg-[color:var(--kp-field-bg)] text-[color:var(--kp-text)] border-[color:var(--kp-panel-border)]',
  accentText: 'text-[color:var(--kp-played)]',
  /** A toolbar control that is switched on. */
  controlOn: 'bg-[color:var(--kp-played)] text-[color:var(--kp-played-ink)]',
  /** A toolbar control at rest: text colour only, no hue of its own. */
  controlOff: 'text-[color:var(--kp-text-muted)] hover:text-[color:var(--kp-text)] hover:bg-[color:var(--kp-hover-bg)]',
  keyboardBg: '[background:var(--kp-keyboard-bg)]',
  keyBase: 'bg-[color:var(--kp-key-bg)] border-[color:var(--kp-key-border)] [border-width:var(--kp-key-border-width)] [box-shadow:0_var(--kp-key-edge-depth)_0_var(--kp-key-edge)]',
  keyActive: 'bg-[color:var(--kp-played)] border-[color:var(--kp-played)] [border-width:var(--kp-key-border-width)] translate-y-[var(--kp-key-edge-depth)] [box-shadow:var(--kp-glow-played)]',
  keyPlayback: 'bg-[color:var(--kp-guide)] border-[color:var(--kp-guide)] [border-width:var(--kp-key-border-width)] [box-shadow:var(--kp-glow-guide)]',
  keyGuide: 'bg-[color:var(--kp-guide)]',
  keyText: 'text-[color:var(--kp-key-label)]',
  keyFunctionText: 'text-[color:var(--kp-key-text)]',
  keyMainLabel: 'text-[color:var(--kp-key-text)]',
  keyMainLabelActive: 'text-[color:var(--kp-played-ink)]',
  keyMainLabelGuide: 'text-[color:var(--kp-guide-ink)]',
  keyDummy: 'opacity-0 pointer-events-none',
  coffeeText: 'text-[color:var(--kp-keyboard-accent)]',
  pianoBg: 'bg-[color:var(--kp-piano-bed)]',
  pianoWhiteKey: 'bg-[color:var(--kp-piano-white)] border-[color:var(--kp-piano-border)]',
  pianoWhiteKeyActive: 'bg-[color:var(--kp-played)] border-[color:var(--kp-played-deep)] [box-shadow:var(--kp-glow-played)]',
  pianoWhiteKeyPlayback: 'bg-[color:var(--kp-guide)] border-[color:var(--kp-guide)] [box-shadow:var(--kp-glow-guide)]',
  pianoWhiteKeyGuide: 'bg-[color:var(--kp-guide)]',
  pianoBlackKey: 'bg-[color:var(--kp-piano-black)] border-[color:var(--kp-piano-black)]',
  pianoBlackKeyActive: 'bg-[color:var(--kp-played-deep)] border-[color:var(--kp-played-deep)] [box-shadow:var(--kp-glow-played)]',
  pianoBlackKeyPlayback: 'bg-[color:var(--kp-guide)] border-[color:var(--kp-guide)] [box-shadow:var(--kp-glow-guide)]',
  pianoBlackKeyGuide: 'bg-[color:var(--kp-guide)]',
  keyRadius: '[border-radius:var(--kp-key-radius)]',
};

export type Theme = typeof THEME_CLASSES & {
  id: ThemeID;
  isLight: boolean;
  palette: ThemePalette;
  waterfallWhiteHex: string;
  waterfallBlackHex: string;
};

const makeTheme = (id: ThemeID, isLight: boolean, palette: ThemePalette): Theme => ({
  ...THEME_CLASSES,
  id,
  isLight,
  palette,
  waterfallWhiteHex: palette.played,
  waterfallBlackHex: palette.playedDeep,
});

// Order is the order shown in Settings.
export const THEMES: Record<ThemeID, Theme> = {
  night: makeTheme('night', false, NIGHT),
  day: makeTheme('day', true, DAY),
  studio: makeTheme('studio', false, STUDIO),
  dark: makeTheme('dark', false, DARK),
  light: makeTheme('light', true, LIGHT),
  cyber: makeTheme('cyber', false, CYBER),
  fauvism: makeTheme('fauvism', true, FAUVISM),
  minimalist: makeTheme('minimalist', true, MINIMALIST),
  pastel: makeTheme('pastel', true, PASTEL),
};

const toKebab = (key: string) => key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);

/** The CSS variables a theme sets on the document root, e.g. `--kp-key-bg`. */
export function themeCssVariables(theme: Theme): Record<string, string> {
  return Object.fromEntries(Object.entries(theme.palette).map(([key, value]) => [`--kp-${toKebab(key)}`, value]));
}
