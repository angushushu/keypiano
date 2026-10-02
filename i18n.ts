import type { SampleSourceID } from './services/sampleSources';
import type { ThemeID } from './theme';

export type Language = 'en' | 'zh';

interface TranslationSet {
  title: string;
  loading: string;
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
  arrange: {
    title: string; auto: string; ready: string; recording: string; editing: string;
    hint: string; empty: string; snap: string; free: string; undo: string; redo: string;
    delete: string; stop: string; zoom: string; grid: string; note: string; resize: string; selected: string;
  };
  toggleStave: string;
  toggleKeyboard: string;
  togglePiano: string;
  practiceMode: string;
  speed: string;
  close: string;
  openToolbar: string;
  closeToolbar: string;
  masterVolume: string;
  instrument: string;
  metronomeToggle: string;
  stopReset: string;
  waterfall: string;
  zenMode: string;
  exitZenMode: string;
  pianoKeyboard: string;
  keymap: string;
  dismiss: string;
  /** Accessible name for a piano key, with `{note}` replaced by the note name. */
  playNote: string;
  /** Tooltip/ARIA text for the on-screen keyboard, keyed by KeyboardEvent.code. */
  keyDescriptions: Record<string, string>;
  shortcuts: {
    title: string;
    hint: string;
  };
  errorScreen: {
    title: string;
    message: string;
    tryAgain: string;
  };
  midi: {
    title: string;
    enable: string;
    retry: string;
    requesting: string;
    connected: string;
    denied: string;
    unsupported: string;
    inputs: string;
  };
  sampleSource: {
    title: string;
    hint: string;
    options: Record<SampleSourceID, string>;
  };
  takes: {
    title: string;
    empty: string;
    /** Name shown for a recording, with `{date}` replaced by when it was made. */
    recordingName: string;
    /** Note count, with `{count}` replaced; `notesOne` is the singular form. */
    notes: string;
    notesOne: string;
    current: string;
    delete: string;
    confirmDelete: string;
    unavailable: string;
    /** Asked before replacing a take that the browser could not save. */
    confirmDiscard: string;
  };
  numpadHints: {
    label: string;
    hint: string;
  };
  fingering: {
    planning: string;
    failed: string;
    legend: string;
    leftShort: string;
    rightShort: string;
    left: string;
    right: string;
    finger: string;
    numpadKey: string;
    hold: string;
    adaptations: string;
    release: string;
    roll: string;
    useWaitMode: string;
  };
  practiceRange: {
    /** `{count}` notes out of range now, `{octave}` suggested, `{after}` left out after switching. */
    message: string;
    apply: string;
  };
  waitMode: {
    toggle: string;
    /** Shown while playback waits, with `{count}` replaced by the notes left. */
    waiting: string;
    skip: string;
  };
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
  themes: Record<ThemeID, string>;
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
    off: string;
    short: string;
    long: string;
  };
  landscape: {
    title: string;
    message: string;
  };
  errors: {
    midiParseFailed: string;
    midiExportFailed: string;
    audioInitFailed: string;
    importDuringRecording: string;
    /** Sample-download warning, with `{count}` replaced by the number of failures. */
    samplesFailed: string;
  };
}

export type { TranslationSet };

export const TRANSLATIONS: Record<Language, TranslationSet> = {
  en: {
    title: 'KeyPiano',
    arrange: {
      title: 'Arrange', auto: 'Auto record', ready: 'Play to record · appends to the end',
      recording: 'Recording · stop to edit', editing: 'Editor',
      hint: 'Click to add · right-drag to select · Shift+click to toggle selection · drag to move · right edge to resize · Delete to remove · Ctrl+Z to undo',
      empty: 'Play your keyboard or click the grid to add your first note.',
      snap: 'Snap', free: 'Free', undo: 'Undo', redo: 'Redo', delete: 'Delete selected notes',
      stop: 'Stop recording', zoom: 'Zoom', grid: 'Piano roll',
      note: '{note} · {start}s · {duration}s', resize: 'Resize selected notes', selected: '{count} notes selected',
    },
    loading: 'Loading Sounds...',
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
    close: 'Close',
    openToolbar: 'Open controls',
    closeToolbar: 'Close controls',
    masterVolume: 'Master output volume',
    instrument: 'Instrument',
    metronomeToggle: 'Toggle metronome',
    stopReset: 'Stop and reset',
    waterfall: 'Waterfall view',
    zenMode: 'Zen mode',
    exitZenMode: 'Exit Zen mode',
    pianoKeyboard: '88-key piano keyboard',
    keymap: 'Keymap',
    dismiss: 'Dismiss',
    playNote: 'Play note {note}',
    keyDescriptions: {
      Escape: 'Cycle sustain level',
      F1: 'Octave down',
      F2: 'Octave up',
      F3: 'Transpose down',
      F4: 'Transpose up',
      F5: 'Keyboard velocity down',
      F6: 'Keyboard velocity up',
      F7: 'Toggle metronome',
      F8: 'Toggle stave and keyboard view',
      F9: 'Play or pause recording',
      F10: 'Start or stop recording',
      F11: 'Stop playback and reset position',
      F12: 'Reset transpose and octave',
      Coffee: 'Open support link',
      ShiftLeft: 'Raise left-hand notes by one semitone while held',
      ShiftRight: 'Mapped performance key',
      ControlLeft: 'Lower left-hand notes by one semitone while held',
      Space: 'Play mapped spacebar note'
    },
    shortcuts: {
      title: 'Keyboard Shortcuts',
      hint: 'Octave and transpose keys are locked while recording or playing back, so a take keeps one consistent mapping.'
    },
    errorScreen: {
      title: 'Oops! Something went wrong',
      message: 'KeyPiano encountered an unexpected error. Your audio engine may still be running.',
      tryAgain: 'Try Again'
    },
    midi: {
      title: 'MIDI keyboard',
      enable: 'Enable MIDI',
      retry: 'Retry MIDI access',
      requesting: 'Requesting permission…',
      connected: 'MIDI access enabled',
      denied: 'MIDI access was denied',
      unsupported: 'Web MIDI is not supported in this browser',
      inputs: 'inputs connected',
    },
    sampleSource: {
      title: 'Sample server',
      hint: 'If notes are silent or slow to load, try another server. In mainland China, try a jsDelivr mirror.',
      options: {
        github: 'GitHub (default)',
        jsdelivr_fastly: 'jsDelivr mirror · Fastly',
        jsdelivr_gcore: 'jsDelivr mirror · Gcore',
      },
    },
    takes: {
      title: 'Recent recordings',
      empty: 'Recordings and imported MIDI files are saved here automatically.',
      recordingName: 'Recording {date}',
      notes: '{count} notes',
      notesOne: '{count} note',
      current: 'Loaded',
      delete: 'Delete',
      confirmDelete: 'Delete this recording? This cannot be undone.',
      unavailable: 'This browser is not saving recordings (for example in private mode), so they are lost when the page closes.',
      confirmDiscard: 'The current recording could not be saved in this browser. Replace it anyway?',
    },
    numpadHints: {
      label: 'My keyboard has a numpad',
      hint: 'On by default: unmodified notes prefer the numpad and navigation keys; the main keys handle #L/bL. Turn off if your keyboard has no numpad; some chords then need separate presses.',
    },
    fingering: {
      planning: 'Planning fingering…',
      failed: 'Fingering could not be planned. Reload the piece to retry.',
      legend: 'Suggested fingering · L/R = left/right · 1 thumb, 2 index, 3 middle, 4 ring, 5 little finger · • keep holding until the cue ends',
      leftShort: 'L', rightShort: 'R', left: 'Left hand', right: 'Right hand',
      finger: '{hand}, finger {finger}',
      numpadKey: 'Numpad {key}',
      hold: 'Keep holding until the cue ends',
      adaptations: '{roll} chords need separate presses · {release} early releases · {unreachable} notes outside range',
      release: 'Release {keys} before playing the highlighted notes.',
      roll: 'Play the bright keys first, then follow the next step.',
      useWaitMode: 'Turn on wait mode to learn the separate presses step by step.',
    },
    practiceRange: {
      message: '{count} notes are outside the keyboard range. Octave {octave} leaves {after}.',
      apply: 'Switch octave',
    },
    waitMode: {
      toggle: 'Wait for me: playback pauses until you play each note',
      waiting: 'Play the highlighted notes · {count} left',
      skip: 'Skip',
    },
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
      night: 'Night',
      day: 'Day',
      studio: 'Studio',
      dark: 'Dark (classic)',
      light: 'Light (classic)',
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
      oct: 'Oct',
      off: 'Off',
      short: 'Short',
      long: 'Long'
    },
    landscape: {
      title: 'Please Rotate Your Device',
      message: 'KeyPiano requires a landscape view for the best playing experience.'
    },
    errors: {
      midiParseFailed: 'Failed to parse MIDI file.',
      midiExportFailed: 'MIDI export needs more channels for overlapping unisons. Reduce overlapping notes or free a MIDI channel and try again.',
      audioInitFailed: 'Could not load the sounds. Try again, or pick another sample server in Settings.',
      importDuringRecording: 'Stop recording before importing a MIDI file.',
      samplesFailed: '{count} samples failed to load. Using pitch-shift fallback.'
    }
  },
  zh: {
    title: '键盘钢琴',
    arrange: {
      title: '编曲', auto: '自动录入', ready: '开始弹奏即可录入 · 接在已有音符末尾',
      recording: '正在录入 · 停止后可编辑', editing: '编辑模式',
      hint: '点空白处添加 · 右键拖拽框选 · Shift+点击增减选择 · 拖动移动 · 拖右边缘改长度 · Delete 删除 · Ctrl+Z 撤销',
      empty: '弹奏键盘，或点击网格，添加第一个音符。',
      snap: '吸附', free: '自由', undo: '撤销', redo: '重做', delete: '删除所选音符',
      stop: '停止录入', zoom: '缩放', grid: '钢琴卷帘',
      note: '{note} · {start} 秒 · 时长 {duration} 秒', resize: '调整所选音符长度', selected: '已选择 {count} 个音符',
    },
    loading: '加载音色中...',
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
    close: '关闭',
    openToolbar: '展开控制栏',
    closeToolbar: '收起控制栏',
    masterVolume: '主输出音量',
    instrument: '乐器',
    metronomeToggle: '开关节拍器',
    stopReset: '停止并复位',
    waterfall: '瀑布流视图',
    zenMode: '禅模式',
    exitZenMode: '退出禅模式',
    pianoKeyboard: '88 键钢琴键盘',
    keymap: '键位映射',
    dismiss: '关闭提示',
    playNote: '弹奏 {note}',
    keyDescriptions: {
      Escape: '循环切换延音级别',
      F1: '降低八度',
      F2: '升高八度',
      F3: '降低半音（移调）',
      F4: '升高半音（移调）',
      F5: '降低键盘力度',
      F6: '提高键盘力度',
      F7: '开关节拍器',
      F8: '在五线谱与键盘视图间切换',
      F9: '播放或暂停录音',
      F10: '开始或停止录音',
      F11: '停止播放并复位',
      F12: '重置移调与八度',
      Coffee: '打开赞助链接',
      ShiftLeft: '按住时把左手音符升高半音',
      ShiftRight: '参与演奏映射的按键',
      ControlLeft: '按住时把左手音符降低半音',
      Space: '弹奏映射到空格键的音符'
    },
    shortcuts: {
      title: '快捷键',
      hint: '录音或播放期间，八度与移调快捷键会被锁定，以保证整段演奏使用一致的映射。'
    },
    errorScreen: {
      title: '出错了',
      message: 'KeyPiano 遇到了意外错误。音频引擎可能仍在运行。',
      tryAgain: '重试'
    },
    midi: {
      title: 'MIDI 键盘',
      enable: '启用 MIDI',
      retry: '重试 MIDI 授权',
      requesting: '正在请求权限…',
      connected: 'MIDI 已启用',
      denied: 'MIDI 权限已被拒绝',
      unsupported: '此浏览器不支持 Web MIDI',
      inputs: '个输入设备已连接',
    },
    sampleSource: {
      title: '音源下载线路',
      hint: '如果没有声音或加载很慢，可以换一条线路。中国大陆用户可以优先试试 jsDelivr 线路。',
      options: {
        github: 'GitHub（默认）',
        jsdelivr_fastly: 'jsDelivr 镜像 · Fastly',
        jsdelivr_gcore: 'jsDelivr 镜像 · Gcore',
      },
    },
    takes: {
      title: '最近的录音',
      empty: '录音和导入的 MIDI 文件会自动保存在这里。',
      recordingName: '录音 {date}',
      notes: '{count} 个音',
      notesOne: '{count} 个音',
      current: '当前',
      delete: '删除',
      confirmDelete: '删除这段录音？删除后无法恢复。',
      unavailable: '当前浏览器没有保存录音（例如无痕模式），关闭页面后录音会丢失。',
      confirmDiscard: '当前录音没能保存到浏览器中。仍然要替换它吗？',
    },
    numpadHints: {
      label: '我的键盘有小键盘',
      hint: '默认开启：不需变调的音优先用小键盘和导航键，主键盘负责 #L/bL 变调。没有小键盘可关闭，但部分和弦需分次弹奏。',
    },
    fingering: {
      planning: '正在规划指法…',
      failed: '指法规划失败，请重新载入曲目重试。',
      legend: '建议指法 · 左/右表示手别 · 1 拇指、2 食指、3 中指、4 无名指、5 小指 · • 表示继续按住，提示消失后松键',
      leftShort: '左', rightShort: '右', left: '左手', right: '右手',
      finger: '{hand}第 {finger} 指',
      numpadKey: '小键盘 {key}',
      hold: '继续按住，提示消失后松键',
      adaptations: '{roll} 组和弦需分次弹奏 · {release} 处需提前松键 · {unreachable} 个音超出键位范围',
      release: '先松开 {keys}，再弹奏高亮音符。',
      roll: '先弹奏亮起的键，再跟随下一步提示。',
      useWaitMode: '开启等待模式，可逐步学习分次弹奏的和弦。',
    },
    practiceRange: {
      message: '有 {count} 个音超出键位范围，换到八度 {octave} 后剩 {after} 个。',
      apply: '切换八度',
    },
    waitMode: {
      toggle: '等待模式：弹对每个音后才继续播放',
      waiting: '请弹奏高亮的音 · 还剩 {count} 个',
      skip: '跳过',
    },
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
      night: '夜',
      day: '昼',
      studio: '琴房',
      dark: '暗色（经典）',
      light: '亮色（经典）',
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
      oct: '八度',
      off: '关闭',
      short: '短',
      long: '长'
    },
    landscape: {
      title: '请旋转您的设备',
      message: 'KeyPiano 需要横屏模式以获得最佳演奏体验。'
    },
    errors: {
      midiParseFailed: '无法解析 MIDI 文件。',
      midiExportFailed: '同音重叠需要额外 MIDI 通道。请减少重叠音符或腾出通道后再导出。',
      audioInitFailed: '音色加载失败。请重试，或在设置中切换音源下载线路。',
      importDuringRecording: '请先停止录音，再导入 MIDI 文件。',
      samplesFailed: '{count} 个采样加载失败，已改用变调回退。'
    }
  }
};
