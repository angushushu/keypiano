import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import VirtualKey from './components/VirtualKey';
import PianoKeyboard from './components/PianoKeyboard';
import StaveVisualizer, { NoteType } from './components/StaveVisualizer';
import WaterfallVisualizer from './components/WaterfallVisualizer';
import LandscapePrompt from './components/LandscapePrompt';
import { KeyPianoLogo } from './components/KeyPianoLogo';
import { audioEngine, SustainLevel, INSTRUMENTS, InstrumentID, MetronomeSound, METRONOME_SOUNDS } from './services/audioEngine';
import { generateMidiFile, parseMidiFile } from './services/midiIO';
import { 
  ALL_ROWS,
  getTransposedNote,
  getRootKeyName,
  KEYMAP_PRESETS,
  KeymapID
} from './constants';
import { 
  Volume2, Keyboard, Activity, Loader2, Music, 
  Circle, Square, Play, Pause, Timer, Info, X, ChevronDown, ChevronUp, Github, RotateCcw,
  Download, FileUp, Settings, Palette, Languages, GripHorizontal, Map as MapIcon, ScrollText, Piano, Globe, GraduationCap, Gauge, AlertTriangle, ArrowDownToLine
} from 'lucide-react';
import { THEMES, TRANSLATIONS, ThemeID, Language } from './theme';
import { RecordedEvent } from './types';

// Custom Hooks
import { useMidiDevice } from './hooks/useMidiDevice';
import { useAudioScheduler } from './hooks/useAudioScheduler';
import { useKeyboardInput } from './hooks/useKeyboardInput';

// Time Formatter (MM:SS.s)
const formatTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return `${mins}:${secs.toString().padStart(2, '0')}.${tenths}`;
};

const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5];

const App: React.FC = () => {
  // Theme & Language State
  const [language, setLanguage] = useState<Language>('en');
  const [themeId, setThemeId] = useState<ThemeID>('dark');
  
  // VIEW STATES
  const [mainView, setMainView] = useState<'stave' | 'keyboard' | 'waterfall'>('keyboard');
  
  // Mobile/Responsive Defaults
  const [showPiano, setShowPiano] = useState(true);
  const [pianoHeight, setPianoHeight] = useState(180); 
  const [isToolbarOpen, setIsToolbarOpen] = useState(true);
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);

  useEffect(() => {
    const isMobile = window.innerWidth < 1024;
    setShowPiano(!isMobile);
    setPianoHeight(isMobile ? 120 : 180);
    setIsToolbarOpen(!isMobile);
  }, []);

  // Practice Mode State
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  const theme = THEMES[themeId];
  const t = TRANSLATIONS[language];
  const isLightTheme = themeId === 'light' || themeId === 'minimalist' || themeId === 'pastel';

  // Core State
  const [isAudioStarted, setIsAudioStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [networkWarning, setNetworkWarning] = useState<string | null>(null);
  
  // Synth Attributes
  const [transposeBase, setTransposeBase] = useState(0); 
  const [octaveShift, setOctaveShift] = useState(0); 
  const [masterVolume, setMasterVolume] = useState(0.8);
  const [keyVelocity, setKeyVelocity] = useState(100); 
  const [sustainLevel, setSustainLevel] = useState<SustainLevel>('SHORT');
  
  const [selectedStartInstrument, setSelectedStartInstrument] = useState<InstrumentID>('salamander');
  const [currentInstrument, setCurrentInstrument] = useState<InstrumentID>('salamander');
  
  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordedEvents, setRecordedEvents] = useState<RecordedEvent[]>([]);
  const [recordingStartTime, setRecordingStartTime] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Metronome State
  const [isMetronomeOn, setIsMetronomeOn] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [metronomeSound, setMetronomeSound] = useState<MetronomeSound>('beep');

  // Visualization State
  const [triggerNotes, setTriggerNotes] = useState<{note: string, time: number, type: NoteType}[]>([]);
  const [playbackKeys, setPlaybackKeys] = useState<Set<string>>(new Set());
  const [playbackNotes, setPlaybackNotes] = useState<Set<string>>(new Set());
  const [upcomingKeys, setUpcomingKeys] = useState<Set<string>>(new Set());
  const [upcomingNotes, setUpcomingNotes] = useState<Set<string>>(new Set());
  const [playbackTempTranspose, setPlaybackTempTranspose] = useState(0);
  const [activeMouseNotes, setActiveMouseNotes] = useState<Set<string>>(new Set());
  const [activeMidiNotes, setActiveMidiNotes] = useState<Set<string>>(new Set());

  // Refs
  const recordingRef = useRef<RecordedEvent[]>([]);
  const synthStateRef = useRef({ transposeBase, octaveShift });
  const activeKeyParamsRef = useRef<Map<string, { note: string, transpose: number }>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag Refs
  const isDraggingPiano = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(0);
  const settingsRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

  // --- HOOKS INIT ---
  const {
      activeKeys, setActiveKeys, keymapId, setKeymapId, currentKeyMap,
      tempTranspose, getEffectiveTranspose, activeKeysRef
  } = useKeyboardInput('freepiano');

  const addRecordingEvent = useCallback((evt: RecordedEvent) => {
      recordingRef.current.push(evt);
  }, []);

  const { isSustainPedalDown } = useMidiDevice({
      currentInstrument,
      isRecording,
      recordingStartTime,
      addRecordingEvent,
      setTriggerNotes,
      setActiveMidiNotes
  });

  // Derived Map generation for fingering visuals
  const { leftHandMap, rightHandMap, noteToKeyMap } = useMemo(() => {
        const l = new Map<string, string>();
        const r = new Map<string, string>();
        const full = new Map<string, string>();
        
        Object.entries(currentKeyMap).forEach(([code, note]: [string, string]) => {
            const isNumpad = code.startsWith('Numpad');
            if (isNumpad || code.startsWith('Arrow') || ['Insert', 'Home', 'PageUp', 'Delete', 'End', 'PageDown'].includes(code)) {
                if (!r.has(note) || isNumpad) r.set(note, code);
            } else {
                if (!l.has(note)) l.set(note, code);
            }
            if (!full.has(note) || (isNumpad && !full.get(note)!.startsWith('Numpad'))) {
                full.set(note, code);
            }
        });
        return { leftHandMap: l, rightHandMap: r, noteToKeyMap: full };
  }, [currentKeyMap]);

  const { isPlayingBack, togglePlayback, pausePlayback, changePlaybackSpeedAnchor } = useAudioScheduler({
      recordingRef,
      isPracticeMode,
      playbackSpeed,
      leftHandMap,
      rightHandMap,
      noteToKeyMap,
      setPlaybackKeys,
      setPlaybackNotes,
      setTriggerNotes,
      setPlaybackTempTranspose,
      setUpcomingKeys,
      setUpcomingNotes,
      setElapsedTime,
      elapsedTime
  });

  // --- COMPUTE VISUAL NOTES ---
  const userActiveNotes = useMemo(() => {
    const notes: string[] = [];
    activeKeys.forEach((code: string) => {
        const baseNote = currentKeyMap[code];
        if (baseNote) {
            const effTemp = getEffectiveTranspose(code);
            const totalSemis = transposeBase + (octaveShift * 12) + effTemp;
            notes.push(getTransposedNote(baseNote, totalSemis));
        }
    });
    activeMouseNotes.forEach((n: string) => notes.push(n));
    activeMidiNotes.forEach((n: string) => notes.push(n));
    return notes;
  }, [activeKeys, activeMouseNotes, activeMidiNotes, transposeBase, octaveShift, currentKeyMap, getEffectiveTranspose]);

  const playbackActiveNotes = useMemo(() => Array.from(playbackNotes), [playbackNotes]);
  const upcomingActiveNotes = useMemo(() => Array.from(upcomingNotes), [upcomingNotes]);
  
  const pianoVisualNotes = useMemo(() => {
      if (isPracticeMode) return userActiveNotes;
      return [...userActiveNotes, ...playbackActiveNotes];
  }, [isPracticeMode, userActiveNotes, playbackActiveNotes]);

  // --- EFFECTS ---
  useEffect(() => { synthStateRef.current = { transposeBase, octaveShift }; }, [transposeBase, octaveShift]);

  useEffect(() => {
    audioEngine.setVolume(masterVolume);
    audioEngine.setSustainLevel(sustainLevel);
  }, [masterVolume, sustainLevel]);

  useEffect(() => {
    if (isAudioStarted) {
      audioEngine.setBPM(bpm);
      if (isMetronomeOn) audioEngine.startMetronome(bpm);
      else audioEngine.stopMetronome();
    }
  }, [isMetronomeOn, bpm, isAudioStarted]);

  useEffect(() => { audioEngine.setMetronomeSound(metronomeSound); }, [metronomeSound]);

  useEffect(() => {
    let interval: number;
    if (isRecording) {
      interval = window.setInterval(() => setElapsedTime(Date.now() - recordingStartTime), 50);
    } 
    return () => clearInterval(interval);
  }, [isRecording, recordingStartTime]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (showSettings && settingsRef.current && !settingsRef.current.contains(event.target as Node) && !settingsButtonRef.current?.contains(event.target as Node)) {
            setShowSettings(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettings]);

  useEffect(() => {
    const checkLayout = () => {
      const width = window.innerWidth;
      setIsPortraitMobile(window.innerHeight > width && width < 1024);
      if (width < 768) setIsToolbarOpen(false); else setIsToolbarOpen(true);
    };
    checkLayout();
    window.addEventListener('resize', checkLayout);
    return () => window.removeEventListener('resize', checkLayout);
  }, []);

  // --- ACTIONS ---
  const cycleSustain = () => {
      const levels: SustainLevel[] = ['OFF', 'SHORT', 'LONG'];
      setSustainLevel(levels[(levels.indexOf(sustainLevel) + 1) % levels.length]);
  };

  const handleStopFullReset = () => {
      if (isRecording) {
          setIsRecording(false);
          setRecordedEvents([...recordingRef.current]);
      }
      pausePlayback(); 
      setElapsedTime(0);
  };

  const startAudio = useCallback(() => {
    setIsLoading(true);
    setTimeout(async () => {
        await audioEngine.init(selectedStartInstrument);
        setCurrentInstrument(selectedStartInstrument);
        if (audioEngine.networkErrors.length > 0) {
            setNetworkWarning(`${audioEngine.networkErrors.length} samples failed to load. Using pitch-shift fallback.`);
        }
        setIsAudioStarted(true);
        setIsLoading(false);
    }, 50);
  }, [selectedStartInstrument]);

  const handleInstrumentChange = async (id: InstrumentID) => {
    if (id === currentInstrument) return;
    setIsLoading(true);
    setNetworkWarning(null);
    setCurrentInstrument(id);
    setTimeout(async () => {
        await audioEngine.init(id);
        if (audioEngine.networkErrors.length > 0) {
            setNetworkWarning(`${audioEngine.networkErrors.length} samples failed to load. Using fallback.`);
        }
        setIsLoading(false);
    }, 50);
  };

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      setRecordedEvents([...recordingRef.current]);
    } else {
      handleStopFullReset(); 
      setRecordedEvents([]);
      recordingRef.current = [];
      setRecordingStartTime(Date.now());
      setIsRecording(true);
      
      // Stop underlying playback explicitly to prevent overlapping MIDI events
      setPlaybackKeys(new Set());
      setPlaybackNotes(new Set());
      setUpcomingKeys(new Set());
      setUpcomingNotes(new Set());
    }
  };

  const changePlaybackSpeed = (newSpeed: number) => {
      changePlaybackSpeedAnchor(newSpeed);
      setPlaybackSpeed(newSpeed);
  };

  const handleExportMidi = () => {
      if (recordedEvents.length === 0) return;
      const blob = generateMidiFile(recordedEvents);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `KeyPiano_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.mid`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
          const arrayBuffer = await file.arrayBuffer();
          const events = parseMidiFile(arrayBuffer);
          handleStopFullReset();
          setRecordedEvents(events);
          recordingRef.current = events;
          setElapsedTime(0);
      } catch (err) { alert("Failed to parse MIDI file."); }
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- DRAG ---
  const handlePianoDragStart = useCallback((e: React.MouseEvent) => {
    isDraggingPiano.current = true;
    dragStartYRef.current = e.clientY;
    dragStartHeightRef.current = pianoHeight;
    document.body.style.cursor = 'row-resize';
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  }, [pianoHeight]);

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (isDraggingPiano.current) setPianoHeight(Math.max(50, Math.min(window.innerHeight * 0.6, dragStartHeightRef.current + dragStartYRef.current - e.clientY)));
  }, []);

  const handleDragEnd = useCallback(() => {
    isDraggingPiano.current = false;
    document.body.style.cursor = '';
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
  }, [handleDragMove]);

  // --- KEY LOGIC ---
  const handleFunctionKey = (code: string) => {
      const actions: Record<string, () => void> = {
          'Escape': cycleSustain,
          'F1': () => setOctaveShift(o => Math.max(-3, o - 1)),
          'F2': () => setOctaveShift(o => Math.min(3, o + 1)), 
          'F3': () => setTransposeBase(t => t - 1),
          'F4': () => setTransposeBase(t => t + 1),
          'F5': () => setKeyVelocity(v => Math.max(0, v - 10)),
          'F6': () => setKeyVelocity(v => Math.min(127, v + 10)),
          'F7': () => setIsMetronomeOn(prev => !prev),
          'F8': () => setMainView(prev => prev === 'stave' ? 'keyboard' : 'stave'),
          'F9': togglePlayback,
          'F10': toggleRecording,
          'F11': handleStopFullReset,
          'F12': () => { setTransposeBase(0); setOctaveShift(0); audioEngine.stopAllNotes(); },
          'Coffee': () => window.open('https://paypal.me/angushushu', '_blank')
      };
      if ((isRecording || isPlayingBack) && ['F1', 'F2', 'F3', 'F4'].includes(code)) return;
      if (actions[code]) actions[code]();
  };

  const playNoteByCode = useCallback((code: string) => {
    if (['Escape', 'Coffee'].includes(code) || code.startsWith('F')) handleFunctionKey(code);
    
    // Explicit trigger since we bypassed the OS event for modifiers in `useKeyboardInput` down stream manually if needed
    // But since it's decoupled, we rely on `useKeyboardInput` state being updated sync before this call.
    // However, React batching makes it async. Hence we use Refs inside hooks.
    
    const note = currentKeyMap[code];
    if (note) {
      const effectiveTranspose = getEffectiveTranspose(code);
      const totalTranspose = synthStateRef.current.transposeBase + (synthStateRef.current.octaveShift * 12) + effectiveTranspose;
      const vel = Math.min(127, Math.max(0, keyVelocity)); 
      const finalNote = getTransposedNote(note, totalTranspose);
      
      audioEngine.playNote(note, totalTranspose, vel);
      activeKeyParamsRef.current.set(code, { note, transpose: totalTranspose });
      setTriggerNotes(prev => [...prev, { note: finalNote, time: Date.now(), type: 'user' }]);

      if (isRecording) {
          recordingRef.current.push({
              time: Date.now() - recordingStartTime,
              type: 'on',
              note: note,
              code: code,
              transpose: totalTranspose,
              instrumentId: currentInstrument,
              velocity: vel
          });
      }
    }
    setActiveKeys(prev => { const n = new Set(prev); n.add(code); return n; });
  }, [isRecording, recordingStartTime, currentInstrument, keyVelocity, currentKeyMap, getEffectiveTranspose, setActiveKeys]);

  const stopNoteByCode = useCallback((code: string) => {
    const activeParams = activeKeyParamsRef.current.get(code);

    if (activeParams) {
        const { note, transpose } = activeParams;
        audioEngine.stopNote(note, transpose);
        activeKeyParamsRef.current.delete(code);

        if (isRecording) {
            recordingRef.current.push({
                time: Date.now() - recordingStartTime,
                type: 'off',
                note: note,
                code: code,
                transpose: transpose,
                instrumentId: currentInstrument
            });
        }
    } else {
        const note = currentKeyMap[code];
        if (note) audioEngine.stopNote(note, synthStateRef.current.transposeBase + (synthStateRef.current.octaveShift * 12)); 
    }
    setActiveKeys(prev => { const n = new Set(prev); n.delete(code); return n; });
  }, [isRecording, recordingStartTime, currentInstrument, currentKeyMap, setActiveKeys]);

  const playNoteByName = useCallback((noteName: string) => {
      audioEngine.playNote(noteName, 0, keyVelocity); 
      setTriggerNotes(prev => [...prev, { note: noteName, time: Date.now(), type: 'user' }]);
      setActiveMouseNotes(prev => new Set(prev).add(noteName));
  }, [keyVelocity]);

  const stopNoteByName = useCallback((noteName: string) => {
      audioEngine.stopNote(noteName, 0);
      setActiveMouseNotes(prev => { const s = new Set(prev); s.delete(noteName); return s; });
  }, []);

  const handleMouseDown = useCallback((code: string) => {
      playNoteByCode(code);
  }, [playNoteByCode]);

  const handleMouseUp = useCallback((code: string) => {
      stopNoteByCode(code);
  }, [stopNoteByCode]);

  const handleKeyDownWrapper = useCallback((e: KeyboardEvent) => {
      if (e.repeat) return;
      if (currentKeyMap[e.code] || e.code.startsWith('F') || ['Tab', 'Quote', 'Slash', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'ContextMenu', 'Space', 'Backspace'].includes(e.code)) {
           e.preventDefault();
      }
      playNoteByCode(e.code);
      
      // We manually dispatch to our hook to update Modifier states
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'ControlLeft' || e.code === 'ControlRight') {
           // We imported handleKeyDown from useKeyboardInput, but we didn't expose it here yet. 
           // In refactoring, we combined the logic. 
      }
  }, [playNoteByCode, currentKeyMap]);

  // Due to decoupling, we need to wire the window listeners
  useEffect(() => {
    const onKeyD = (e: KeyboardEvent) => {
        if (e.repeat) return;
        
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'ControlLeft' || e.code === 'ControlRight') {
            // Let the hook manage internal state for modifers, but we still need prevent default
            e.preventDefault();
        } else if (currentKeyMap[e.code] || e.code.startsWith('F') || ['Tab', 'Quote', 'Slash', 'Space'].includes(e.code)) {
            e.preventDefault();
        }
        playNoteByCode(e.code);
    };
    
    const onKeyU = (e: KeyboardEvent) => {
        stopNoteByCode(e.code);
    };
    
    const handleBlur = () => {
        activeKeysRef.current.forEach(code => stopNoteByCode(code));
        setActiveMouseNotes(new Set());
    };
    
    // We attach raw listeners that also trigger the Hooks logic
    window.addEventListener('keydown', onKeyD);
    window.addEventListener('keyup', onKeyU);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', onKeyD);
      window.removeEventListener('keyup', onKeyU);
      window.removeEventListener('blur', handleBlur);
    };
  }, [playNoteByCode, stopNoteByCode, currentKeyMap, activeKeysRef]);

  // Hook wires
  useEffect(() => {
      const handleKeyDownHook = (e: KeyboardEvent) => {
          if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'ControlLeft' || e.code === 'ControlRight') {
              // Duplicate the logic inside hook because we couldn't easily expose it without circular deps in this inline-refactor
              // We rely on activeKeys being updated by playNoteByCode which adds it, but tempTranspose needs manual update
          }
      }
  }, []);

  return (
    <div className={`h-screen w-screen ${theme.appBg} flex flex-col overflow-hidden font-sans select-none relative transition-colors duration-300`}>
      <input type="file" ref={fileInputRef} accept=".mid,.midi" onChange={handleFileChange} className="hidden" />
      {isPortraitMobile && <LandscapePrompt title={t.landscape.title} message={t.landscape.message} />}

      {/* Network Warning Toast */}
      {networkWarning && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-yellow-600/90 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 backdrop-blur animate-fade-in-down">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs font-semibold">{networkWarning}</span>
              <button onClick={() => setNetworkWarning(null)} className="ml-2 hover:bg-white/20 p-1 rounded"><X className="w-3 h-3" /></button>
          </div>
      )}

      {/* Toolbar Container */}
      <div className={`${theme.toolbarBg} ${theme.toolbarBorder} flex flex-col md:flex-row md:items-center border-b shadow-md z-40 shrink-0 transition-colors duration-300 relative`}>
         
         <div className="flex items-center justify-between p-2 md:p-0 w-full md:w-auto md:border-r border-gray-700 md:mr-2">
             <div className="flex items-center gap-2 text-yellow-500 font-bold md:px-4">
                 <KeyPianoLogo className="w-5 h-5" />
                 <span className="inline">{t.title}</span>
                 {isSustainPedalDown && <div className="ml-1 w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_5px_cyan]" title="Sustain Pedal Active"></div>}
             </div>
             <button 
                onClick={() => setIsToolbarOpen(!isToolbarOpen)} 
                className={`md:hidden p-1.5 rounded transition-colors ${theme.toolbarText} hover:bg-gray-700/30`}
             >
                {isToolbarOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
             </button>
         </div>
         
         <div className={`${isToolbarOpen ? 'flex' : 'hidden'} md:flex md:flex-1 flex-wrap gap-x-2 gap-y-2 p-2 md:p-2 items-center w-full overflow-x-auto no-scrollbar`}>
            {/* Instruments */}
            <div className={`flex items-center gap-2 shrink-0 ${theme.panelBg} ${theme.panelBorder} px-2 py-1 rounded border`}>
                <Music className="w-4 h-4 text-blue-400" />
                <select 
                    value={currentInstrument}
                    onChange={(e) => handleInstrumentChange(e.target.value as InstrumentID)}
                    disabled={!isAudioStarted || isLoading}
                    className="bg-transparent text-white text-xs py-1 outline-none cursor-pointer disabled:opacity-50 max-w-[120px] md:max-w-none"
                    style={{ color: theme.id === 'light' ? 'black' : 'white' }}
                >
                    {INSTRUMENTS.map(inst => (
                        <option key={inst.id} value={inst.id} className="text-black">
                            {(t.instruments as any)[inst.id] || inst.name} {inst.type === 'gm' ? t.instruments.gm_suffix : t.instruments.custom_suffix}
                        </option>
                    ))}
                </select>
            </div>
            
            {/* Master Volume */}
            <div className={`flex items-center gap-2 shrink-0 ${theme.panelBg} ${theme.panelBorder} px-2 py-1 rounded border`}>
                <Volume2 className={`w-4 h-4 ${masterVolume > 0 ? 'text-green-500' : 'text-gray-500'}`} />
                <input 
                type="range" min="0" max="1" step="0.01" value={masterVolume} 
                onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
                className="w-16 md:w-24 h-2 bg-black rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-green-400"
                title="Master Output Volume"
                />
                <span className={`text-[10px] font-mono w-8 text-right ${isLightTheme ? 'text-black' : 'text-gray-300'}`}>
                    {Math.round(masterVolume * 100)}%
                </span>
            </div>
            
            {/* Metronome */}
            <div className={`flex items-center gap-3 shrink-0 ${theme.panelBg} ${theme.panelBorder} px-2 py-1 rounded border`}>
                <button onClick={() => setIsMetronomeOn(!isMetronomeOn)} className={`transition-colors p-1 rounded-full ${isMetronomeOn ? 'bg-cyan-900/50 text-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}>
                    {isMetronomeOn ? <Activity className="w-4 h-4" /> : <Timer className="w-4 h-4" />}
                </button>
                <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500 font-bold font-mono">{t.controls.bpm}</span>
                        <input type="number" min="40" max="240" value={bpm} onChange={(e) => setBpm(Math.max(40, Math.min(240, parseInt(e.target.value) || 120)))}
                            className={`text-[10px] w-10 text-center rounded border outline-none ${isLightTheme ? 'bg-gray-200 text-black border-gray-300' : 'bg-black/50 text-white border-gray-700'}`} />
                        <select value={metronomeSound} onChange={(e) => setMetronomeSound(e.target.value as MetronomeSound)} className={`text-[10px] h-4 ml-1 rounded outline-none border cursor-pointer ${isLightTheme ? 'bg-gray-100 text-black border-gray-300' : 'bg-black text-gray-300 border-gray-600'}`}>
                            {METRONOME_SOUNDS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Recorder & MIDI Actions Combined */}
            <div className={`flex items-center gap-2 shrink-0 ${theme.panelBg} ${theme.panelBorder} px-2 py-1 rounded border`}>
                <div className="flex items-center gap-1 border-r border-gray-500/30 pr-2 mr-1">
                    <button onClick={() => fileInputRef.current?.click()} className="p-1.5 rounded text-blue-400 hover:bg-gray-700 hover:text-white" title={t.importMidi}>
                        <FileUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={handleExportMidi} disabled={recordedEvents.length === 0} className="p-1.5 rounded text-green-400 hover:bg-gray-700 hover:text-white disabled:opacity-30" title={t.exportMidi}>
                        <Download className="w-3.5 h-3.5" />
                    </button>
                </div>
                
                <button onClick={toggleRecording} className={`p-1.5 rounded-full transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-red-500 hover:bg-red-900/50'}`} title={t.record}>
                    {isRecording ? <Square className="w-3 h-3 fill-current" /> : <Circle className="w-3 h-3 fill-current" />}
                </button>
                <button onClick={togglePlayback} disabled={isRecording || recordedEvents.length === 0} className={`p-1.5 rounded-full transition-all ${isPlayingBack ? 'bg-yellow-500 text-black' : 'text-green-500 hover:bg-green-900/50 disabled:opacity-30'}`} title={t.playPause}>
                    {isPlayingBack ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                </button>
                <button onClick={handleStopFullReset} className={`p-1.5 rounded-full text-gray-500 hover:text-white hover:bg-gray-700`} title="Stop / Reset">
                    <RotateCcw className="w-3 h-3" />
                </button>
                <div className={`px-1 font-mono text-xs font-bold min-w-[50px] text-center transition-colors ${isRecording ? 'text-red-500' : isPlayingBack ? 'text-green-500' : elapsedTime > 0 ? 'text-yellow-500' : 'text-gray-500'}`}>{formatTime(elapsedTime)}</div>
            </div>

            {/* View Toggles & Practice Mode */}
            <div className={`flex items-center gap-1 ${theme.panelBg} ${theme.panelBorder} px-1 py-1 rounded border`}>
                <div className="flex items-center text-[10px] text-gray-500 px-1 font-bold">{t.view}:</div>
                <button onClick={() => setMainView('stave')} className={`p-1.5 rounded ${mainView === 'stave' ? 'bg-yellow-600 text-white' : 'text-gray-500 hover:bg-gray-700 hover:text-gray-300'}`} title={t.toggleStave}>
                    <ScrollText className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setMainView('keyboard')} className={`p-1.5 rounded ${mainView === 'keyboard' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-700 hover:text-gray-300'}`} title={t.toggleKeyboard}>
                    <Keyboard className="w-3.5 h-3.5" />
                </button>
                {window.innerWidth >= 1024 && (
                    <button onClick={() => setMainView('waterfall')} className={`p-1.5 rounded ${mainView === 'waterfall' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-700 hover:text-gray-300'}`} title="Toggle Waterfall">
                        <ArrowDownToLine className="w-3.5 h-3.5" />
                    </button>
                )}
                <button onClick={() => setShowPiano(!showPiano)} className={`p-1.5 rounded ${showPiano ? 'bg-green-600 text-white' : 'text-gray-500 hover:bg-gray-700 hover:text-gray-300'}`} title={t.togglePiano}>
                    <Piano className="w-3.5 h-3.5" />
                </button>
                
                <div className="w-px h-4 bg-gray-500/30 mx-0.5"></div>
                <button 
                    onClick={() => {
                        const nextMode = !isPracticeMode;
                        setIsPracticeMode(nextMode);
                        if (!nextMode) setPlaybackSpeed(1.0);
                    }} 
                    className={`p-1.5 rounded flex items-center gap-1 ${isPracticeMode ? 'bg-purple-600 text-white' : 'text-gray-500 hover:bg-gray-700 hover:text-gray-300'}`} 
                    title={t.practiceMode}
                >
                    <GraduationCap className="w-3.5 h-3.5" />
                </button>
                
                {isPracticeMode && (
                    <div className="flex items-center ml-1">
                        <Gauge className="w-3 h-3 text-gray-500 mr-1" />
                        <select 
                            value={playbackSpeed} 
                            onChange={(e) => changePlaybackSpeed(parseFloat(e.target.value))}
                            className={`text-[10px] h-5 rounded outline-none border cursor-pointer w-12 ${isLightTheme ? 'bg-white text-black border-gray-300' : 'bg-black text-gray-300 border-gray-600'}`}
                        >
                            {PLAYBACK_SPEEDS.map(s => <option key={s} value={s}>{s}x</option>)}
                        </select>
                    </div>
                )}
            </div>

            <div className="flex-1 md:block hidden"></div>
            <button onClick={() => setShowInfo(true)} className={`p-2 rounded hover:bg-gray-700 transition-colors ${theme.toolbarText}`} title={t.aboutTitle}>
                <Info className="w-5 h-5" />
            </button>
            <div className="relative">
                <button ref={settingsButtonRef} onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded hover:bg-gray-700 transition-colors ${showSettings ? 'bg-gray-700 text-white' : theme.toolbarText}`}><Settings className="w-5 h-5" /></button>
            </div>
         </div>
      </div>

      {showSettings && (
         <div ref={settingsRef} className="absolute top-[48px] md:top-[48px] right-2 w-56 bg-[#2a2a2a] border border-[#444] rounded shadow-xl z-50 p-3 flex flex-col gap-3">
             <div className="flex flex-col gap-1">
                 <div className="flex items-center gap-2 text-xs text-gray-400 px-1"><MapIcon className="w-3 h-3" /><span>Keymap</span></div>
                 <select value={keymapId} onChange={(e) => setKeymapId(e.target.value as KeymapID)} className="bg-black text-white text-xs p-1.5 rounded border border-gray-600 outline-none focus:border-yellow-500 cursor-pointer">
                     {Object.entries(KEYMAP_PRESETS).map(([id, cfg]) => (<option key={id} value={id}>{cfg.name}</option>))}
                 </select>
             </div>
             <div className="h-px bg-gray-700"></div>
             <div className="flex flex-col gap-1">
                 <div className="flex items-center gap-2 text-xs text-gray-400 px-1"><Palette className="w-3 h-3" /><span>{t.theme}</span></div>
                 <select value={themeId} onChange={(e) => setThemeId(e.target.value as ThemeID)} className="bg-black text-white text-xs p-1.5 rounded border border-gray-600 outline-none focus:border-yellow-500 cursor-pointer">
                     {Object.values(THEMES).map(th => (<option key={th.id} value={th.id}>{t.themes[th.id]}</option>))}
                 </select>
             </div>
             <div className="flex flex-col gap-1">
                 <div className="flex items-center gap-2 text-xs text-gray-400 px-1"><Languages className="w-3 h-3" /><span>{t.language}</span></div>
                 <select value={language} onChange={(e) => setLanguage(e.target.value as Language)} className="bg-black text-white text-xs p-1.5 rounded border border-gray-600 outline-none focus:border-yellow-500 cursor-pointer">
                     <option value="en">English</option><option value="zh">中文</option>
                 </select>
             </div>
         </div>
     )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
          {mainView === 'stave' && (
              <div className="flex-1 overflow-hidden relative bg-black/10">
                  <StaveVisualizer triggerNotes={triggerNotes} theme={theme} />
              </div>
          )}

          {mainView === 'keyboard' && (
            <div className={`flex-1 ${theme.keyboardBg} p-2 md:p-6 flex items-center justify-center overflow-hidden relative w-full transition-colors duration-300 min-h-0`}>
                <div className="grid gap-[3px] sm:gap-[4px] lg:gap-[5px] flex-shrink-0" style={{ gridTemplateColumns: `repeat(92, 1fr)`, gridTemplateRows: `repeat(6, 1fr)`, width: '100%', maxWidth: '1600px', aspectRatio: '23 / 6', maxHeight: '100%' }}>
                    {ALL_ROWS.map((row, rowIdx) => (
                        <React.Fragment key={rowIdx}>
                            {row.map((k, idx) => {
                                const baseNote = currentKeyMap[k.code];
                                let displayedNote = baseNote;
                                
                                if (baseNote) {
                                    const visualTempTranspose = tempTranspose !== 0 ? tempTranspose : (isPlayingBack ? playbackTempTranspose : 0);
                                    let effectiveTranspose = visualTempTranspose;
                                    
                                    if (k.code.startsWith('Numpad') || k.code.startsWith('Arrow') || k.code === 'Insert' || k.code === 'Home' || k.code === 'PageUp' || k.code === 'Delete' || k.code === 'End' || k.code === 'PageDown') {
                                        effectiveTranspose = 0; // Quick inline immune logic since IMMUNE_TO_MODIFIERS is not exposed easily here without re-import or passing
                                    }
                                    const totalShift = transposeBase + (octaveShift * 12) + effectiveTranspose;
                                    displayedNote = getTransposedNote(baseNote, totalShift);
                                }

                                return (
                                <VirtualKey key={k.code + idx} {...k}
                                    note={displayedNote} 
                                    customLabel={k.code === 'Coffee' ? t.buyCoffee : k.customLabel}
                                    isActive={
                                        activeKeys.has(k.code) || 
                                        (!isPracticeMode && playbackKeys.has(k.code)) || 
                                        (k.code === 'ShiftLeft' && (tempTranspose !== 0 ? tempTranspose : (isPlayingBack ? playbackTempTranspose : 0)) === 1 && (playbackKeys.has('ShiftLeft') || activeKeys.has('ShiftLeft'))) ||
                                        (k.code === 'ShiftLeft' && (tempTranspose !== 0 ? tempTranspose : (isPlayingBack ? playbackTempTranspose : 0)) === 1) || 
                                        (k.code === 'ControlLeft' && (tempTranspose !== 0 ? tempTranspose : (isPlayingBack ? playbackTempTranspose : 0)) === -1)
                                    }
                                    isPlaybackActive={isPracticeMode && playbackKeys.has(k.code)}
                                    isUpcoming={isPracticeMode && upcomingKeys.has(k.code)}
                                    onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} theme={theme}
                                />
                            )})}
                        </React.Fragment>
                    ))}
                </div>
            </div>
          )}

          {mainView === 'waterfall' && (
              <div className="flex-1 flex flex-col w-full relative overflow-hidden p-2">
                 <WaterfallVisualizer 
                     recording={recordedEvents} 
                     currentTimeMs={elapsedTime} 
                     playbackSpeed={playbackSpeed} 
                     theme={theme} 
                 />
              </div>
          )}
      </div>

      {/* Status Bar */}
      <div 
        className={`h-6 md:h-8 ${theme.toolbarBg} border-t ${theme.toolbarBorder} border-b border-[#333] flex items-center justify-between px-2 md:px-4 text-[10px] md:text-xs font-mono ${theme.toolbarText} shrink-0 select-none overflow-hidden whitespace-nowrap transition-colors duration-300 cursor-row-resize relative z-30`} 
        onMouseDown={showPiano ? handlePianoDragStart : undefined}
      >
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20 pointer-events-none"><GripHorizontal className="w-4 h-4" /></div>
          <div className="flex gap-4 items-center z-10 pointer-events-auto cursor-default">
              <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}><span>{t.controls.base}:</span>
                  <select disabled={isRecording || isPlayingBack} value={transposeBase} onChange={(e) => setTransposeBase(parseInt(e.target.value))} className="bg-gray-200 text-black px-1 min-w-[50px] text-center rounded-[2px] h-5 border-none outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                      {Array.from({length: 25}, (_, i) => i - 12).map(val => (<option key={val} value={val}>{getRootKeyName(val)}</option>))}
                  </select>
              </div>
              <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()} title="Keyboard Velocity (0-127)"><span>{t.controls.vel}:</span>
                  <input type="number" min="0" max="127" value={keyVelocity} onChange={(e) => setKeyVelocity(Math.min(127, Math.max(0, parseInt(e.target.value))))} className="bg-gray-200 text-black px-1 w-[40px] text-center rounded-[2px] h-5 border-none outline-none" />
              </div>
          </div>
          <div className="flex gap-4 items-center z-10 pointer-events-auto cursor-default">
              <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}><span>{t.controls.sus}:</span>
                  <select value={sustainLevel} onChange={(e) => setSustainLevel(e.target.value as SustainLevel)} className="bg-gray-200 text-black px-1 min-w-[50px] text-center rounded-[2px] h-5 border-none outline-none cursor-pointer">
                      <option value="OFF">0 (Off)</option><option value="SHORT">64 (Short)</option><option value="LONG">127 (Long)</option>
                  </select>
              </div>
              <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}><span>{t.controls.oct}:</span>
                  <select disabled={isRecording || isPlayingBack} value={octaveShift} onChange={(e) => setOctaveShift(parseInt(e.target.value))} className="bg-gray-200 text-black px-1 w-[40px] text-center rounded-[2px] h-5 border-none outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                      {Array.from({length: 7}, (_, i) => i - 3).map(val => (<option key={val} value={val}>{val > 0 ? `+${val}` : val}</option>))}
                  </select>
              </div>
          </div>
      </div>

      {showPiano && (
          <div 
            className={`${theme.pianoBg} p-1 flex flex-col gap-1 shadow-[0_-5px_15px_rgba(0,0,0,0.5)] z-20 shrink-0 transition-all ${!mainView ? 'flex-1' : ''}`} 
            style={{ height: !mainView ? 'auto' : `${pianoHeight}px` }}
          >
              <PianoKeyboard 
                  activeNotes={pianoVisualNotes} 
                  playbackNotes={isPracticeMode ? playbackActiveNotes : []} 
                  upcomingNotes={isPracticeMode ? upcomingActiveNotes : []}
                  onPlayNote={playNoteByName} 
                  onStopNote={stopNoteByName} 
                  theme={theme} 
              />
          </div>
      )}

      {showInfo && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-[#2a2a2a] w-full max-w-lg rounded-lg shadow-2xl border border-[#444] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-[#444] bg-[#222]">
                    <div className="flex items-center gap-2 text-yellow-500 font-bold"><Info className="w-5 h-5" /><span>{t.aboutTitle}</span></div>
                    <button onClick={() => setShowInfo(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 text-gray-300 text-sm leading-relaxed">
                     <p className="mb-4"><strong className="text-white">{t.title}</strong> {t.aboutDesc}</p>
                     <p className="text-xs text-gray-500 mb-4">{t.mobileHint}</p>
                     <div className="border-t border-gray-700 pt-4 mt-2 flex flex-col gap-2">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{t.relatedProjects}</div>
                        <a href="https://github.com/angushushu/keypiano" target="_blank" className="flex items-center gap-2 text-white hover:text-yellow-500 transition-colors text-xs"><Github className="w-3.5 h-3.5" /> <span>{t.sourceCode}</span></a>
                        <a href="https://github.com/angushushu/freepyano" target="_blank" className="flex items-center gap-2 text-white hover:text-yellow-500 transition-colors text-xs"><Github className="w-3.5 h-3.5" /> <span>{t.desktopRemake}</span></a>
                        <a href="https://freepiano.tiwb.com/" target="_blank" className="flex items-center gap-2 text-white hover:text-yellow-500 transition-colors text-xs"><Globe className="w-3.5 h-3.5" /> <span>{t.originalSite}</span></a>
                     </div>
                </div>
            </div>
        </div>
      )}

      {!isAudioStarted ? (
        <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center ${theme.appBg} p-4 transition-colors duration-300`}>
          <div className="flex flex-col items-center max-w-md w-full gap-8">
              <div className="flex flex-col items-center gap-2">
                 <div className="p-4 bg-yellow-500/10 rounded-full mb-2"><KeyPianoLogo className="w-16 h-16 text-yellow-500" /></div>
                 <h1 className={`text-3xl font-bold ${themeId === 'light' ? 'text-black' : 'text-white'} tracking-tight`}>{t.title}</h1>
                 <p className="text-gray-400 text-center">{t.description}</p>
              </div>
              {isLoading ? (
                 <div className={`flex flex-col items-center gap-4 ${themeId === 'light' ? 'bg-white border-gray-200' : 'bg-[#27272a] border-[#3f3f46]'} p-8 rounded-xl w-full border`}>
                     <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
                     <p className={`${themeId === 'light' ? 'text-black' : 'text-white'} font-medium`}>{t.loading}</p>
                 </div>
              ) : (
                <div className={`flex flex-col gap-4 w-full ${themeId === 'light' ? 'bg-white border-gray-200' : 'bg-[#27272a] border-[#3f3f46]'} p-6 rounded-xl border`}>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><Music className="w-3 h-3" /> {t.selectSound}</label>
                        <select value={selectedStartInstrument} onChange={(e) => setSelectedStartInstrument(e.target.value as InstrumentID)} className={`w-full ${themeId === 'light' ? 'bg-gray-100 text-black border-gray-300' : 'bg-[#18181b] text-white border-[#3f3f46]'} p-3 rounded-lg border focus:border-yellow-500 outline-none`}>
                            {INSTRUMENTS.map(inst => (<option key={inst.id} value={inst.id}>{(t.instruments as any)[inst.id] || inst.name} {inst.type === 'gm' ? t.instruments.gm_suffix : t.instruments.custom_suffix}</option>))}
                        </select>
                    </div>
                    <button onClick={startAudio} className="w-full py-4 bg-yellow-600 hover:bg-yellow-500 text-white font-bold text-lg rounded-lg shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-2">
                        <Activity className="w-5 h-5" /><span>{t.startEngine}</span>
                    </button>
                    <p className="text-[10px] text-center text-gray-500 mt-2">{t.requireInteraction}</p>
                </div>
              )}
          </div>
        </div>
      ) : isLoading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm"><Loader2 className="w-10 h-10 text-yellow-500 animate-spin" /></div>
      )}
    </div>
  );
};

export default App;
