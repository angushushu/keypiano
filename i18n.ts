export type Language = 'en' | 'zh';

interface TranslationSet {
  title: string;
  description: string;
  loading: string;
  selectSound: string;
  startEngine: string;
  requireInteraction: string;
  aboutTitle: string;
  aboutDesc: string;
  sustain: string;
  transpose: string;
  playPause: string;
  record: string;
  mobileHint: string;
  relatedProjects: string;
  sourceCode: string;
  desktopRemake: string;
  originalSite: string;
  buyCoffee: string;
  importMidi: string;
  exportMidi: string;
  settings: string;
  theme: string;
  language: string;
  view: string;
  toggleStave: string;
  toggleKeyboard: string;
  togglePiano: string;
  practiceMode: string;
  speed: string;
  instruments: {
    salamander: string;
    hq_piano: string;
    electric_grand_piano: string;
    drawbar_organ: string;
    acoustic_guitar_steel: string;
    string_ensemble_1: string;
    lead_1_square: string;
    synth_drum: string;
    gm_suffix: string;
    custom_suffix: string;
    salamander_hint: string;
    standard_hint: string;
  };
  themes: {
    dark: string;
    light: string;
    cyber: string;
    fauvism: string;
    minimalist: string;
    pastel: string;
  };
  metronome: {
    beep: string;
    click: string;
    woodblock: string;
  };
  controls: {
    bpm: string;
    base: string;
    vel: string;
    sus: string;
    oct: string;
  };
  landscape: {
    title: string;
    message: string;
  };
  errors: {
    midiParseFailed: string;
    audioInitFailed: string;
  };
}

export type TranslationKey = keyof typeof TRANSLATIONS;
export type { TranslationSet };

export const TRANSLATIONS: Record<Language, TranslationSet> = {
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
    view: 'View',
    toggleStave: 'Toggle Stave',
    toggleKeyboard: 'Toggle Keyboard',
    togglePiano: 'Toggle Piano',
    practiceMode: 'Practice Mode',
    speed: 'Speed',
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
    },
    errors: {
      midiParseFailed: 'Failed to parse MIDI file.',
      audioInitFailed: 'Could not start the audio engine. Please try again.'
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
    view: '视图',
    toggleStave: '切换五线谱',
    toggleKeyboard: '切换键盘',
    togglePiano: '切换钢琴',
    practiceMode: '练习模式',
    speed: '倍速',
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
    },
    errors: {
      midiParseFailed: '无法解析 MIDI 文件。',
      audioInitFailed: '无法启动音频引擎，请重试。'
    }
  }
};
