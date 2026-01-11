
export type Language = 'en' | 'zh';
export type ThemeID = 'dark' | 'light' | 'cyber' | 'fauvism' | 'minimalist' | 'pastel';

export interface Theme {
  id: ThemeID;
  name: string;
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
  pianoBlackKey: string;
  pianoBlackKeyActive: string; // User press
  pianoBlackKeyPlayback: string; // Playback/Practice active
}

export const THEMES: Record<ThemeID, Theme> = {
  dark: {
    id: 'dark',
    name: 'Dark',
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
    pianoBlackKey: 'bg-gradient-to-b from-gray-800 to-black border-black',
    pianoBlackKeyActive: 'bg-yellow-600 border-yellow-800 shadow-[0_0_10px_orange]',
    pianoBlackKeyPlayback: 'bg-cyan-800 border-cyan-600 shadow-[0_0_5px_cyan]',
  },
  light: {
    id: 'light',
    name: 'Light',
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
    pianoBlackKey: 'bg-gray-800 border-black',
    pianoBlackKeyActive: 'bg-blue-600 shadow-[0_0_10px_rgba(59,130,246,0.5)] border-blue-800',
    pianoBlackKeyPlayback: 'bg-green-600 shadow-[0_0_5px_rgba(34,197,94,0.5)] border-green-800',
  },
  cyber: {
    id: 'cyber',
    name: 'Cyber',
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
    pianoBlackKey: 'bg-black border border-gray-800',
    pianoBlackKeyActive: 'bg-pink-600 shadow-[0_0_20px_magenta] border-pink-800',
    pianoBlackKeyPlayback: 'bg-purple-800 shadow-[0_0_20px_purple] border-purple-900',
  },
  fauvism: {
    id: 'fauvism',
    name: 'Fauvism',
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
    pianoBlackKey: 'bg-[#1e3a8a] border-[#172554]', // Blue 900
    pianoBlackKeyActive: 'bg-[#22c55e] border-[#15803d]', // Green 500
    pianoBlackKeyPlayback: 'bg-[#a855f7] border-[#7e22ce]', // Purple 500
  },
  minimalist: {
    id: 'minimalist',
    name: 'Minimalist',
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
    pianoBlackKey: 'bg-black border-black rounded-none',
    pianoBlackKeyActive: 'bg-gray-600 border-gray-700', // Lighter active state
    pianoBlackKeyPlayback: 'bg-gray-400 border-gray-500',
  },
  pastel: {
    id: 'pastel',
    name: 'Pastel',
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
    pianoBlackKey: 'bg-[#fdba74] border-[#fb923c] rounded-b-md', // Orange 300
    pianoBlackKeyActive: 'bg-[#fcd34d] border-[#fbbf24]', // Amber 300
    pianoBlackKeyPlayback: 'bg-[#fca5a5] border-[#f87171]', // Red 300
  }
};

export const TRANSLATIONS = {
  en: {
    title: 'KeyPiano',
    description: 'Web-based polyphonic synthesizer',
    loading: 'Loading Sounds...',
    selectSound: 'Select Sound Source',
    startEngine: 'Start Engine',
    requireInteraction: 'Audio requires interaction to unlock.',
    aboutTitle: 'About KeyPiano',
    aboutDesc: 'KeyPiano is a browser-based polyphonic synthesizer inspired by FreePiano.',
    sustain: 'Sustain',
    transpose: 'Transpose/Octave',
    playPause: 'Play/Pause',
    record: 'Record',
    mobileHint: 'For mobile users: The keyboard scales to fit your screen in landscape mode.',
    relatedProjects: 'Related Projects',
    sourceCode: 'KeyPiano (Web) - Source Code',
    desktopRemake: 'FreePyano (Python) - Desktop Remake',
    originalSite: 'Original FreePiano Website',
    buyCoffee: '☕ Buy me a Coffee',
    importMidi: 'Import MIDI File',
    exportMidi: 'Export Recording to MIDI',
    settings: 'Settings',
    theme: 'Theme',
    language: 'Language',
    // New Translations for View Toggles
    view: 'View',
    toggleStave: 'Toggle Stave',
    toggleKeyboard: 'Toggle Keyboard',
    togglePiano: 'Toggle Piano',
    practiceMode: 'Practice Mode',
    speed: 'Speed',
    //
    instruments: {
      salamander: 'Yamaha C5 Grand (Pro)',
      hq_piano: 'Standard Piano (Lite)',
      electric_grand_piano: 'Electric Piano',
      drawbar_organ: 'Organ',
      acoustic_guitar_steel: 'Acoustic Guitar',
      string_ensemble_1: 'String Ensemble',
      lead_1_square: 'Synth Lead',
      synth_drum: 'Synth Drum',
      gm_suffix: '(Fast)',
      custom_suffix: '(HQ)',
      salamander_hint: 'Requires ~3MB download. Best quality.',
      standard_hint: 'Faster load time. Lower quality.'
    },
    themes: {
      dark: 'Dark',
      light: 'Light',
      cyber: 'Cyber',
      fauvism: 'Fauvism',
      minimalist: 'Minimalist',
      pastel: 'Pastel'
    },
    metronome: {
      beep: 'Beep',
      click: 'Click',
      woodblock: 'Wood'
    },
    controls: {
      bpm: 'BPM',
      base: 'Base',
      vel: 'Vel',
      sus: 'Sus',
      oct: 'Oct'
    },
    landscape: {
      title: 'Please Rotate Your Device',
      message: 'KeyPiano requires a landscape view for the best playing experience.'
    }
  },
  zh: {
    title: '键盘钢琴',
    description: '基于 Web 的多复音合成器',
    loading: '加载音色中...',
    selectSound: '选择音源',
    startEngine: '启动引擎',
    requireInteraction: '音频需要用户交互才能解锁',
    aboutTitle: '关于 KeyPiano',
    aboutDesc: 'KeyPiano 是一个受 FreePiano 启发的基于浏览器的多复音合成器。',
    sustain: '延音 (Sustain)',
    transpose: '移调 / 八度',
    playPause: '播放 / 暂停',
    record: '录音',
    mobileHint: '移动端用户：请使用横屏模式以获得最佳体验。',
    relatedProjects: '相关项目',
    sourceCode: 'KeyPiano (Web) - 源代码',
    desktopRemake: 'FreePyano (Python) - 桌面版重制',
    originalSite: 'FreePiano 原版网站',
    buyCoffee: '☕ 请我喝杯咖啡',
    importMidi: '导入 MIDI 文件',
    exportMidi: '导出录音为 MIDI',
    settings: '设置',
    theme: '主题',
    language: '语言',
    // New Translations for View Toggles
    view: '视图',
    toggleStave: '切换五线谱',
    toggleKeyboard: '切换键盘',
    togglePiano: '切换钢琴',
    practiceMode: '练习模式',
    speed: '倍速',
    //
    instruments: {
      salamander: '雅马哈 C5 三角钢琴 (专业)',
      hq_piano: '标准钢琴 (轻量)',
      electric_grand_piano: '电钢琴',
      drawbar_organ: '风琴',
      acoustic_guitar_steel: '木吉他',
      string_ensemble_1: '弦乐合奏',
      lead_1_square: '合成器主音',
      synth_drum: '合成器鼓',
      gm_suffix: '(快速)',
      custom_suffix: '(高音质)',
      salamander_hint: '需要下载约 3MB 数据。最佳音质。',
      standard_hint: '加载速度快。音质较低。'
    },
    themes: {
      dark: '暗色',
      light: '亮色',
      cyber: '赛博朋克',
      fauvism: '野兽派',
      minimalist: '极简',
      pastel: '马卡龙'
    },
    metronome: {
      beep: '哔声',
      click: '点击声',
      woodblock: '木鱼'
    },
    controls: {
      bpm: 'BPM',
      base: '基调',
      vel: '力度',
      sus: '延音',
      oct: '八度'
    },
    landscape: {
      title: '请旋转您的设备',
      message: 'KeyPiano 需要横屏模式以获得最佳演奏体验。'
    }
  }
};
