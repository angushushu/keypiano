
export type { Language } from './i18n';
export type ThemeID = 'dark' | 'light' | 'cyber' | 'fauvism' | 'minimalist' | 'pastel';
export { TRANSLATIONS } from './i18n';

export interface Theme {
  id: ThemeID;
  name: string;
  isLight: boolean;
  // Global Layout
  appBg: string;
  toolbarBg: string;
  toolbarBorder: string;
  toolbarText: string;
  // Toolbar Modules (Unified Style)
  panelBg: string;     // Background for Instrument/Volume/Metronome/Recorder panels
  panelBorder: string; // Border for these panels
  // Keyboard Area
  keyboardBg: string; // Gradient or solid background behind keys
  // Virtual Key Styles
  keyBase: string;      // Normal state classes
  keyActive: string;    // Active/Pressed state classes (User)
  keyPlayback: string;  // Active state for Playback/Practice mode
  keyUpcoming: string;  // Upcoming state
  keyText: string;      // QWERTY label color (Top Left)
  keyFunctionText: string; // F-keys/Special label color
  keyMainLabel: string; // Center content (Jianpu) color
  keyMainLabelActive: string; // Center content color when active
  keyDummy: string;
  // Coffee Button
  coffeeText: string;
  coffeeHover: string;
  // Piano Visualization
  pianoBg: string;
  pianoWhiteKey: string;
  pianoWhiteKeyActive: string; // User press
  pianoWhiteKeyPlayback: string; // Playback/Practice active
  pianoWhiteKeyUpcoming: string; // Upcoming state
  pianoBlackKey: string;
  pianoBlackKeyActive: string; // User press
  pianoBlackKeyPlayback: string; // Playback/Practice active
  pianoBlackKeyUpcoming: string; // Upcoming state
  // Waterfall Canvas Colors
  waterfallWhiteHex: string;
  waterfallBlackHex: string;
}

export const THEMES: Record<ThemeID, Theme> = {
  dark: {
    id: 'dark',
    name: 'Dark',
    isLight: false,
    appBg: 'bg-[#333333]',
    toolbarBg: 'bg-[#2a2a2a]',
    toolbarBorder: 'border-[#111]',
    toolbarText: 'text-gray-400',
    panelBg: 'bg-[#1a1a1a]',
    panelBorder: 'border-[#333]',
    keyboardBg: 'bg-gradient-to-b from-[#505050] to-[#2a2a2a] shadow-[inset_0_0_30px_rgba(0,0,0,0.8)]',
    keyBase: 'bg-gradient-to-b from-[#fbfbfb] to-[#e0e0e0] shadow-[0_1px_0px_#999,0_2px_0px_#777,0_3px_2px_rgba(0,0,0,0.3)] border-t border-l border-r border-white/50',
    keyActive: 'bg-[#ccc] translate-y-[2px] shadow-[inset_0_1px_4px_rgba(0,0,0,0.4)] border-none',
    keyPlayback: 'bg-cyan-700/80 translate-y-[1px] border border-cyan-500 shadow-[0_0_5px_cyan]',
    keyUpcoming: '!bg-yellow-900/40 !border-yellow-600/60 !shadow-[0_0_10px_rgba(202,138,4,0.3)] outline outline-2 outline-yellow-500 outline-offset-[-2px]',
    keyText: 'text-gray-400',
    keyFunctionText: 'text-gray-600',
    keyMainLabel: 'text-gray-800',
    keyMainLabelActive: 'text-black',
    keyDummy: 'opacity-0 pointer-events-none',
    coffeeText: 'text-yellow-500',
    coffeeHover: 'text-yellow-400',
    pianoBg: 'bg-[#1a1a1a]',
    pianoWhiteKey: 'bg-gradient-to-b from-white to-gray-200 border-gray-400',
    pianoWhiteKeyActive: 'bg-yellow-400 !bg-none shadow-[0_0_10px_orange] border-yellow-600',
    pianoWhiteKeyPlayback: 'bg-cyan-200 !bg-none shadow-[0_0_5px_cyan] border-cyan-400',
    pianoWhiteKeyUpcoming: '!bg-gradient-to-b !from-yellow-100 !to-yellow-200 outline outline-2 outline-yellow-400 outline-offset-[-2px]',
    pianoBlackKey: 'bg-gradient-to-b from-gray-800 to-black border-black',
    pianoBlackKeyActive: 'bg-yellow-600 border-yellow-800 shadow-[0_0_10px_orange]',
    pianoBlackKeyPlayback: 'bg-cyan-800 border-cyan-600 shadow-[0_0_5px_cyan]',
    pianoBlackKeyUpcoming: '!bg-gradient-to-b !from-yellow-800 !to-yellow-900 outline outline-2 outline-yellow-500 outline-offset-[-2px]',
    waterfallWhiteHex: '#fbbf24',
    waterfallBlackHex: '#b45309',
  },
  light: {
    id: 'light',
    name: 'Light',
    isLight: true,
    appBg: 'bg-[#e5e7eb]',
    toolbarBg: 'bg-white',
    toolbarBorder: 'border-gray-200',
    toolbarText: 'text-gray-600',
    panelBg: 'bg-gray-50',
    panelBorder: 'border-gray-200',
    keyboardBg: 'bg-gradient-to-b from-gray-300 to-gray-100 shadow-[inset_0_0_20px_rgba(0,0,0,0.1)]',
    keyBase: 'bg-white shadow-[0_1px_0px_#ccc,0_2px_0px_#bbb,0_3px_2px_rgba(0,0,0,0.1)] border border-gray-200',
    keyActive: 'bg-blue-100 translate-y-[2px] shadow-inner border-blue-200',
    keyPlayback: 'bg-green-100 translate-y-[2px] shadow-inner border-green-200',
    keyUpcoming: '!bg-green-100/80 outline outline-2 outline-green-400 outline-offset-[-2px]',
    keyText: 'text-gray-400',
    keyFunctionText: 'text-blue-500',
    keyMainLabel: 'text-gray-800',
    keyMainLabelActive: 'text-blue-900',
    keyDummy: 'opacity-0 pointer-events-none',
    coffeeText: 'text-orange-500',
    coffeeHover: 'text-orange-600',
    pianoBg: 'bg-gray-200',
    pianoWhiteKey: 'bg-white border-gray-300',
    pianoWhiteKeyActive: 'bg-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)] border-blue-500',
    pianoWhiteKeyPlayback: 'bg-green-300 shadow-[0_0_5px_rgba(34,197,94,0.5)] border-green-400',
    pianoWhiteKeyUpcoming: '!bg-green-100/80 outline outline-2 outline-green-400 outline-offset-[-2px]',
    pianoBlackKey: 'bg-gray-800 border-black',
    pianoBlackKeyActive: 'bg-blue-600 shadow-[0_0_10px_rgba(59,130,246,0.5)] border-blue-800',
    pianoBlackKeyPlayback: 'bg-green-600 shadow-[0_0_5px_rgba(34,197,94,0.5)] border-green-800',
    pianoBlackKeyUpcoming: '!bg-green-800 outline outline-2 outline-green-400 outline-offset-[-2px]',
    waterfallWhiteHex: '#3b82f6',
    waterfallBlackHex: '#1d4ed8',
  },
  cyber: {
    id: 'cyber',
    name: 'Cyber',
    isLight: false,
    appBg: 'bg-[#09090b]',
    toolbarBg: 'bg-[#18181b]',
    toolbarBorder: 'border-cyan-900/30',
    toolbarText: 'text-cyan-400',
    panelBg: 'bg-black/50',
    panelBorder: 'border-cyan-900/50',
    keyboardBg: 'bg-[#000000] shadow-[inset_0_0_50px_rgba(6,182,212,0.15)] border-t border-b border-cyan-900/50',
    keyBase: 'bg-gray-900 border border-cyan-900/50 shadow-[0_0_5px_rgba(6,182,212,0.2)]',
    keyActive: 'bg-cyan-900/40 translate-y-[1px] border border-cyan-400 shadow-[0_0_15px_cyan]',
    keyPlayback: 'bg-purple-900/40 translate-y-[1px] border border-purple-400 shadow-[0_0_15px_purple]',
    keyUpcoming: '!bg-[#00ff00]/10 border !border-[#00ff00] !shadow-[0_0_15px_#00ff00] outline outline-2 outline-[#00ff00] outline-offset-[-2px]',
    keyText: 'text-cyan-700',
    keyFunctionText: 'text-cyan-500',
    keyMainLabel: 'text-cyan-500',
    keyMainLabelActive: 'text-cyan-50 drop-shadow-[0_0_5px_cyan]',
    keyDummy: 'opacity-0 pointer-events-none',
    coffeeText: 'text-pink-500',
    coffeeHover: 'text-pink-400 drop-shadow-[0_0_5px_rgba(236,72,153,0.8)]',
    pianoBg: 'bg-black border-t border-cyan-900',
    pianoWhiteKey: 'bg-gray-900 border-r border-gray-800',
    pianoWhiteKeyActive: 'bg-cyan-500 shadow-[0_0_20px_cyan] border-cyan-700',
    pianoWhiteKeyPlayback: 'bg-purple-500 shadow-[0_0_20px_purple] border-purple-700',
    pianoWhiteKeyUpcoming: '!bg-[#00ff00]/20 !border-[#00ff00] shadow-[inset_0_0_15px_#00ff00]',
    pianoBlackKey: 'bg-black border border-gray-800',
    pianoBlackKeyActive: 'bg-pink-600 shadow-[0_0_20px_magenta] border-pink-800',
    pianoBlackKeyPlayback: 'bg-purple-800 shadow-[0_0_20px_purple] border-purple-900',
    pianoBlackKeyUpcoming: '!bg-[#003300] !border-[#00ff00] shadow-[0_0_10px_#00ff00]',
    waterfallWhiteHex: '#06b6d4',
    waterfallBlackHex: '#ec4899',
  },
  fauvism: {
    id: 'fauvism',
    name: 'Fauvism',
    isLight: true,
    appBg: 'bg-[#fbbf24]', // Amber 400
    toolbarBg: 'bg-[#1e40af]', // Blue 800
    toolbarBorder: 'border-[#ea580c]', // Orange 600
    toolbarText: 'text-yellow-300',
    panelBg: 'bg-[#1d4ed8]', // Blue 700
    panelBorder: 'border-[#facc15]', // Yellow 400
    keyboardBg: 'bg-[#b91c1c]', // Red 700
    keyBase: 'bg-[#a3e635] border-b-4 border-r-2 border-[#166534] shadow-[2px_2px_0_#166534]', // Lime 400 with Green 800 borders
    keyActive: 'bg-[#9333ea] border-[#581c87] translate-y-[2px] shadow-none', // Purple 600
    keyPlayback: 'bg-[#0ea5e9] border-[#0369a1] translate-y-[2px] shadow-none', // Sky 500
    keyUpcoming: '!bg-[#f472b6] !border-[#9f1239] outline outline-4 outline-dashed outline-[#fbcfe8] outline-offset-[-4px]',
    keyText: 'text-emerald-900',
    keyFunctionText: 'text-blue-900',
    keyMainLabel: 'text-[#166534]', // Green 800
    keyMainLabelActive: 'text-[#facc15]', // Yellow 400
    keyDummy: 'opacity-0 pointer-events-none',
    coffeeText: 'text-[#1e3a8a]', // Blue 900
    coffeeHover: 'text-white',
    pianoBg: 'bg-[#fbbf24]',
    pianoWhiteKey: 'bg-[#fef08a] border-r border-orange-500', // Yellow 200
    pianoWhiteKeyActive: 'bg-[#ef4444] border-[#991b1b]', // Red 500
    pianoWhiteKeyPlayback: 'bg-[#3b82f6] border-[#1d4ed8]', // Blue 500
    pianoWhiteKeyUpcoming: '!bg-[#f472b6] !border-[#9f1239] border-4',
    pianoBlackKey: 'bg-[#1e3a8a] border-[#172554]', // Blue 900
    pianoBlackKeyActive: 'bg-[#22c55e] border-[#15803d]', // Green 500
    pianoBlackKeyPlayback: 'bg-[#a855f7] border-[#7e22ce]', // Purple 500
    pianoBlackKeyUpcoming: '!bg-[#9d174d] !border-[#fbcfe8] border-4',
    waterfallWhiteHex: '#ef4444',
    waterfallBlackHex: '#a855f7',
  },
  minimalist: {
    id: 'minimalist',
    name: 'Minimalist',
    isLight: true,
    appBg: 'bg-[#ffffff]',
    toolbarBg: 'bg-[#ffffff]',
    toolbarBorder: 'border-black',
    toolbarText: 'text-black font-medium',
    panelBg: 'bg-white',
    panelBorder: 'border-black',
    keyboardBg: 'bg-white',
    keyBase: 'bg-white border border-gray-300 rounded-none hover:border-black transition-colors',
    keyActive: 'bg-black border-black text-white rounded-none',
    keyPlayback: 'bg-gray-300 border-gray-500 text-black rounded-none',
    keyUpcoming: '!bg-gray-100 !border-black border-dashed border-2',
    keyText: 'text-gray-400',
    keyFunctionText: 'text-black',
    keyMainLabel: 'text-black font-light',
    keyMainLabelActive: 'text-white',
    keyDummy: 'opacity-0 pointer-events-none',
    coffeeText: 'text-gray-400',
    coffeeHover: 'text-black',
    pianoBg: 'bg-white border-t border-black',
    pianoWhiteKey: 'bg-white border border-black rounded-none',
    pianoWhiteKeyActive: 'bg-gray-200 border-gray-400', // Lighter active state
    pianoWhiteKeyPlayback: 'bg-gray-100 border-gray-300', 
    pianoWhiteKeyUpcoming: '!bg-white !border-black border-dashed border-4',
    pianoBlackKey: 'bg-black border-black rounded-none',
    pianoBlackKeyActive: 'bg-gray-600 border-gray-700', // Lighter active state
    pianoBlackKeyPlayback: 'bg-gray-400 border-gray-500',
    pianoBlackKeyUpcoming: '!bg-black !border-white border-dashed border-4',
    waterfallWhiteHex: '#9ca3af',
    waterfallBlackHex: '#4b5563',
  },
  pastel: {
    id: 'pastel',
    name: 'Pastel',
    isLight: true,
    appBg: 'bg-[#fdf4ff]', // Fuchsia 50
    toolbarBg: 'bg-[#f0f9ff]', // Sky 50
    toolbarBorder: 'border-[#e0f2fe]',
    toolbarText: 'text-slate-500',
    panelBg: 'bg-white/60',
    panelBorder: 'border-[#bae6fd]', // Sky 200
    keyboardBg: 'bg-[#fce7f3] shadow-[inset_0_0_40px_rgba(251,207,232,0.5)]', // Pink 100
    keyBase: 'bg-white border-b-4 border-[#ddd6fe] shadow-sm rounded-xl', // Violet 200 borders
    keyActive: 'bg-[#c4b5fd] border-[#a78bfa] translate-y-[2px] shadow-none', // Violet 300
    keyPlayback: 'bg-[#a5f3fc] border-[#67e8f9] translate-y-[2px] shadow-none', // Cyan 200
    keyUpcoming: '!bg-[#ffe4e6] !border-[#fbcfe8] outline outline-2 outline-[#fda4af] outline-offset-[-2px]', // Rose 200/300/400
    keyText: 'text-slate-400',
    keyFunctionText: 'text-indigo-400',
    keyMainLabel: 'text-slate-600',
    keyMainLabelActive: 'text-white',
    keyDummy: 'opacity-0 pointer-events-none',
    coffeeText: 'text-[#f472b6]', // Pink 400
    coffeeHover: 'text-[#ec4899]',
    pianoBg: 'bg-[#fae8ff]', // Fuchsia 100
    pianoWhiteKey: 'bg-white border border-[#e9d5ff] rounded-b-lg',
    pianoWhiteKeyActive: 'bg-[#86efac] border-[#4ade80]', // Green 300
    pianoWhiteKeyPlayback: 'bg-[#fdba74] border-[#fb923c]', // Orange 300
    pianoWhiteKeyUpcoming: '!bg-[#ffe4e6] !border-[#fda4af] shadow-inner',
    pianoBlackKey: 'bg-[#fdba74] border-[#fb923c] rounded-b-md', // Orange 300
    pianoBlackKeyActive: 'bg-[#fcd34d] border-[#fbbf24]', // Amber 300
    pianoBlackKeyPlayback: 'bg-[#fca5a5] border-[#f87171]', // Red 300
    pianoBlackKeyUpcoming: '!bg-[#fb7185] !border-[#e11d48] shadow-inner',
    waterfallWhiteHex: '#86efac',
    waterfallBlackHex: '#fdba74',
  }
};
