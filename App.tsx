import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import VirtualKey from './components/VirtualKey';
import PianoKeyboard from './components/PianoKeyboard';
import LandscapePrompt from './components/LandscapePrompt';
import { audioEngine, SustainLevel, INSTRUMENTS, InstrumentID, MetronomeSound, METRONOME_SOUNDS } from './services/audioEngine';
import { 
  KEY_TO_NOTE, 
  ALL_ROWS
} from './constants';
import { 
  Volume2, Keyboard, Activity, Loader2, Music, 
  Circle, Square, Play, Pause, Timer, Info, X, ExternalLink, ChevronDown, ChevronUp, Github, RotateCcw
} from 'lucide-react';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const getTransposedNote = (note: string, semitones: number): string => {
  const match = note.match(/([A-G][#b]?)(-?\d+)/);
  if (!match) return note;
  let [_, name, octStr] = match;
  let octave = parseInt(octStr);
  const flatMap: Record<string, string> = {'Db':'C#', 'Eb':'D#', 'Gb':'F#', 'Ab':'G#', 'Bb':'A#'};
  if (flatMap[name]) name = flatMap[name];
  let index = NOTE_NAMES.indexOf(name);
  if (index === -1) return note;
  let totalIndex = index + (octave * 12) + semitones;
  const newOctave = Math.floor(totalIndex / 12);
  const newIndex = ((totalIndex % 12) + 12) % 12; 
  return `${NOTE_NAMES[newIndex]}${newOctave}`;
};

// Helper to get root key name based on transpose
const getRootKeyName = (transpose: number): string => {
  // Base is C(0). 
  let idx = transpose % 12;
  if (idx < 0) idx += 12;
  return `${NOTE_NAMES[idx]}(${Math.floor(transpose / 12)})`;
};

// Time Formatter (MM:SS.s)
const formatTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return `${mins}:${secs.toString().padStart(2, '0')}.${tenths}`;
};

interface RecordedEvent {
  time: number;
  type: 'on' | 'off';
  note: string;
  transpose: number;
  instrumentId: InstrumentID;
}

const App: React.FC = () => {
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  // Track notes clicked via the Piano Visualizer directly
  const [activeMouseNotes, setActiveMouseNotes] = useState<Set<string>>(new Set());

  const [isAudioStarted, setIsAudioStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  
  // Mobile/Landscape state
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  
  // Layout State
  const [showPianoViz, setShowPianoViz] = useState(true);

  // Synth State
  const [transposeBase, setTransposeBase] = useState(0); 
  const [octaveShift, setOctaveShift] = useState(0); 
  const [volume, setVolume] = useState(0.8);
  const [sustainLevel, setSustainLevel] = useState<SustainLevel>('SHORT');
  
  // Start Screen Selection
  const [selectedStartInstrument, setSelectedStartInstrument] = useState<InstrumentID>('salamander');
  const [currentInstrument, setCurrentInstrument] = useState<InstrumentID>('salamander');
  
  // Modifiers state
  const [tempTranspose, setTempTranspose] = useState(0); 

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingBack, setIsPlayingBack] = useState(false);
  const [recordedEvents, setRecordedEvents] = useState<RecordedEvent[]>([]);
  const [recordingStartTime, setRecordingStartTime] = useState(0);
  const [playbackStartTime, setPlaybackStartTime] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Metronome State
  const [isMetronomeOn, setIsMetronomeOn] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [metronomeSound, setMetronomeSound] = useState<MetronomeSound>('beep');

  // Refs
  const activeKeysRef = useRef<Set<string>>(new Set());
  const synthStateRef = useRef({ transposeBase: 0, octaveShift: 0 });
  const tempTransposeRef = useRef(0);
  const recordingRef = useRef<RecordedEvent[]>([]);
  const playbackTimeouts = useRef<number[]>([]);
  // Track currently playing notes during playback to stop them on Pause/Stop
  const activePlaybackNotes = useRef<Set<string>>(new Set()); 

  // Orientation & Screen Size Check
  useEffect(() => {
    const checkLayout = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      const isPortrait = height > width;
      const isSmallScreen = width < 1024;
      
      setIsPortraitMobile(isPortrait && isSmallScreen);
      
      // Determine if height is compact (like landscape phone)
      // Usually < 600px height is tight
      const isCompact = height < 600;
      
      // Auto-hide piano visualization on compact screens if it hasn't been manually toggled yet
      // We check if it is explicitly NOT disabled by user interaction (which we don't track perfectly here, but this works for init)
      if (isCompact) {
          setShowPianoViz(false);
      } else {
          setShowPianoViz(true);
      }
    };

    checkLayout();
    window.addEventListener('resize', checkLayout);
    return () => window.removeEventListener('resize', checkLayout);
  }, []);

  const visualActiveNotes = useMemo(() => {
    const notes: string[] = [];
    const totalSemis = transposeBase + (octaveShift * 12) + tempTranspose;
    
    // Notes from keyboard
    activeKeys.forEach(code => {
      const baseNote = KEY_TO_NOTE[code];
      if (baseNote) {
        notes.push(getTransposedNote(baseNote, totalSemis));
      }
    });

    // Notes from direct mouse interaction on Piano
    activeMouseNotes.forEach(n => {
        notes.push(n);
    });

    return notes;
  }, [activeKeys, activeMouseNotes, transposeBase, octaveShift, tempTranspose]);

  useEffect(() => {
    synthStateRef.current = { transposeBase, octaveShift };
  }, [transposeBase, octaveShift]);

  useEffect(() => {
    audioEngine.setVolume(volume);
    audioEngine.setSustainLevel(sustainLevel);
  }, [volume, sustainLevel]);

  // Metronome Effect
  useEffect(() => {
    if (isAudioStarted) {
      // Ensure BPM is updated even if metronome is already running
      audioEngine.setBPM(bpm);
      
      if (isMetronomeOn) {
        audioEngine.startMetronome(bpm);
      } else {
        audioEngine.stopMetronome();
      }
    }
  }, [isMetronomeOn, bpm, isAudioStarted]);

  useEffect(() => {
      audioEngine.setMetronomeSound(metronomeSound);
  }, [metronomeSound]);

  // Timer Effect for Recording/Playback
  useEffect(() => {
    let interval: number;
    if (isRecording) {
      interval = window.setInterval(() => {
        setElapsedTime(Date.now() - recordingStartTime);
      }, 50);
    } else if (isPlayingBack) {
      // Logic for Playback Timer:
      // We know when we started (playbackStartTime) which includes the offset calculation.
      interval = window.setInterval(() => {
        const t = Date.now() - playbackStartTime;
        setElapsedTime(t);
      }, 50);
    } else {
      // If paused, we don't update time, but we don't reset it either
      // unless we explicitly hit Stop (which handles reset separately).
    }
    return () => clearInterval(interval);
  }, [isRecording, isPlayingBack, recordingStartTime, playbackStartTime]);

  const updateTransposeMod = useCallback((shift: boolean, ctrl: boolean) => {
    let t = 0;
    if (shift) t += 1;
    if (ctrl) t -= 1;
    if (t !== tempTransposeRef.current) {
      tempTransposeRef.current = t;
      setTempTranspose(t);
    }
  }, []);

  const cycleSustain = () => {
      const levels: SustainLevel[] = ['OFF', 'SHORT', 'LONG'];
      const nextIdx = (levels.indexOf(sustainLevel) + 1) % levels.length;
      setSustainLevel(levels[nextIdx]);
  };

  const getSustainValueDisplay = () => {
      if (sustainLevel === 'OFF') return '0';
      if (sustainLevel === 'SHORT') return '64';
      return '127';
  };

  const handleInstrumentChange = async (id: InstrumentID) => {
    if (id === currentInstrument) return;
    setIsLoading(true);
    setCurrentInstrument(id);
    // Slight delay to allow UI to render loader
    setTimeout(async () => {
        await audioEngine.init(id);
        setIsLoading(false);
    }, 50);
  };

  // --- Recorder Logic ---
  const toggleRecording = () => {
    if (isRecording) {
      // Stop recording
      setIsRecording(false);
      setRecordedEvents([...recordingRef.current]);
    } else {
      // Start recording - Reset everything
      handleStopFullReset(); // Ensure clean state
      setRecordedEvents([]);
      recordingRef.current = [];
      setRecordingStartTime(Date.now());
      setIsRecording(true);
    }
  };

  const togglePlayback = () => {
    if (isPlayingBack) {
      pausePlayback();
    } else {
      startPlayback();
    }
  };

  const startPlayback = () => {
    if (recordedEvents.length === 0) return;
    
    // Resume Logic:
    // If we are at the end, start from 0.
    // If we are in the middle (paused), start from current elapsedTime.
    const lastEventTime = recordedEvents[recordedEvents.length - 1].time;
    let startOffset = elapsedTime;
    
    if (startOffset >= lastEventTime) {
        startOffset = 0;
        setElapsedTime(0);
    }

    // Calculate the logical start time (Current Real Time - Offset)
    const startT = Date.now() - startOffset;
    setPlaybackStartTime(startT);
    setIsPlayingBack(true);
    
    // Filter events that haven't happened yet
    const eventsToPlay = recordedEvents.filter(e => e.time >= startOffset);
    
    eventsToPlay.forEach(evt => {
        const delay = evt.time - startOffset;
        const tid = window.setTimeout(() => {
            if (evt.type === 'on') {
                audioEngine.playNote(evt.note, evt.transpose);
                // Track this note to stop it if paused
                activePlaybackNotes.current.add(`${evt.note}_${evt.transpose}`);
            } else {
                audioEngine.stopNote(evt.note, evt.transpose);
                activePlaybackNotes.current.delete(`${evt.note}_${evt.transpose}`);
            }
        }, delay);
        playbackTimeouts.current.push(tid);
    });

    // Auto Pause/Stop after last event
    const timeUntilEnd = lastEventTime - startOffset + 500; // +500ms buffer
    if (timeUntilEnd > 0) {
        const endTid = window.setTimeout(() => {
            pausePlayback(); // Just pause at end, don't reset to 0 immediately
        }, timeUntilEnd);
        playbackTimeouts.current.push(endTid);
    }
  };

  const pausePlayback = () => {
      setIsPlayingBack(false);
      
      // Clear scheduled future events
      playbackTimeouts.current.forEach(window.clearTimeout);
      playbackTimeouts.current = [];

      // Silence currently playing notes from playback
      // Otherwise they sustain indefinitely until resumed
      activePlaybackNotes.current.forEach(key => {
          const [note, transpose] = key.split('_');
          audioEngine.stopNote(note, parseInt(transpose));
      });
      activePlaybackNotes.current.clear();
  };

  const handleStopFullReset = () => {
      // 1. Stop recording if active
      if (isRecording) {
          setIsRecording(false);
          setRecordedEvents([...recordingRef.current]);
      }
      
      // 2. Stop Playback logic
      pausePlayback(); 
      
      // 3. Reset Time to 0
      setElapsedTime(0);
  };
  // ----------------------

  const handleFunctionKey = (code: string) => {
    switch (code) {
      case 'Escape': cycleSustain(); break;
      case 'F3': setTransposeBase(t => t - 1); break;
      case 'F4': setTransposeBase(t => t + 1); break;
      case 'F5': setOctaveShift(o => Math.max(-3, o - 1)); break;
      case 'F6': setOctaveShift(o => Math.min(3, o + 1)); break;
      case 'F7': 
        setVolume(v => Math.max(0, parseFloat((v - 0.1).toFixed(2)))); 
        break;
      case 'F8': 
        setVolume(v => Math.min(2, parseFloat((v + 0.1).toFixed(2)))); 
        break;
      // Map physical keys to functions
      case 'PrintScreen': 
         togglePlayback(); 
         break;
      case 'ScrollLock': 
         toggleRecording(); 
         break;
      case 'Pause': 
         handleStopFullReset(); 
         break;
    }
  };

  const playNoteByCode = useCallback((code: string) => {
    // DO NOT return if !isAudioStarted here, because on mobile, 
    // the first touch might be trying to wake up the engine if it was suspended.
    // AudioEngine handles the safety checks.

    // Handle Special Function Keys
    if (code === 'Escape' || (code.startsWith('F') && code.length > 1 && !isNaN(parseInt(code.slice(1)))) || 
        code === 'PrintScreen' || code === 'ScrollLock' || code === 'Pause') {
      handleFunctionKey(code);
    }

    const note = KEY_TO_NOTE[code];
    if (note) {
      const totalTranspose = synthStateRef.current.transposeBase + (synthStateRef.current.octaveShift * 12) + tempTransposeRef.current;
      
      audioEngine.playNote(note, totalTranspose);

      // Record
      if (isRecording) {
          const evt: RecordedEvent = {
              time: Date.now() - recordingStartTime,
              type: 'on',
              note: note,
              transpose: totalTranspose,
              instrumentId: currentInstrument
          };
          recordingRef.current.push(evt);
      }
    }

    setActiveKeys(prev => {
      const newSet = new Set(prev);
      newSet.add(code);
      activeKeysRef.current = newSet;
      return newSet;
    });
  }, [isAudioStarted, sustainLevel, isRecording, recordingStartTime, currentInstrument, elapsedTime, isPlayingBack]);

  const stopNoteByCode = useCallback((code: string) => {
    const note = KEY_TO_NOTE[code];
    if (note) {
      const base = synthStateRef.current.transposeBase + (synthStateRef.current.octaveShift * 12);
      const totalTranspose = base + tempTransposeRef.current;
      
      // Stop logic: try to stop possible variants due to modifier key changes during hold
      audioEngine.stopNote(note, totalTranspose);
      audioEngine.stopNote(note, base); 
      audioEngine.stopNote(note, base + 1); 
      audioEngine.stopNote(note, base - 1);

      // Record
      if (isRecording) {
          const evt: RecordedEvent = {
              time: Date.now() - recordingStartTime,
              type: 'off',
              note: note,
              transpose: totalTranspose,
              instrumentId: currentInstrument
          };
          recordingRef.current.push(evt);
      }
    }
    setActiveKeys(prev => {
      const newSet = new Set(prev);
      newSet.delete(code);
      activeKeysRef.current = newSet;
      return newSet;
    });
  }, [isAudioStarted, isRecording, recordingStartTime, currentInstrument]);

  // Direct Note Playing (for Piano Visualizer interaction)
  const playNoteByName = useCallback((noteName: string) => {
      // Direct playing has no transpose in this context, or we could assume C4 means C4.
      // We do not record these events currently, or should we?
      // For simplicity, let's treat it as pure performance.
      audioEngine.playNote(noteName, 0); 
      
      setActiveMouseNotes(prev => {
          const newSet = new Set(prev);
          newSet.add(noteName);
          return newSet;
      });
  }, []);

  const stopNoteByName = useCallback((noteName: string) => {
      audioEngine.stopNote(noteName, 0);
      
      setActiveMouseNotes(prev => {
          const newSet = new Set(prev);
          newSet.delete(noteName);
          return newSet;
      });
  }, []);

  const handleMouseDown = (code: string) => playNoteByCode(code);
  const handleMouseUp = (code: string) => stopNoteByCode(code);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isControlKey = ['F3','F4','F5','F6','F7','F8'].includes(e.code);
      if (e.repeat && !isControlKey) return;

      updateTransposeMod(e.shiftKey, e.ctrlKey);
      
      // Prevent default browser behavior for common keys we use
      if (KEY_TO_NOTE[e.code] || e.code === 'Space' || e.code === 'Tab' || e.key.startsWith('F') || e.code === 'Escape') {
        e.preventDefault();
      }
      // Explicitly prevent default for the transport keys
      if (e.code === 'PrintScreen' || e.code === 'ScrollLock' || e.code === 'Pause') {
          e.preventDefault();
      }
      
      playNoteByCode(e.code);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      updateTransposeMod(e.shiftKey, e.ctrlKey);
      stopNoteByCode(e.code);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    const handleBlur = () => {
        activeKeysRef.current.forEach(code => stopNoteByCode(code));
        setActiveMouseNotes(new Set()); // Also clear mouse notes on blur
    };
    window.addEventListener('blur', handleBlur);
    // Add global mouse up listener to catch drags that release outside the keys
    const handleGlobalMouseUp = () => {
        // We can't easily know WHICH key was released if we are outside, 
        // but we can clear active mouse notes if we want to be safe, 
        // OR rely on the fact that 'activeKeys' are handled by specific key codes.
        // For the visual piano, we might want to clear active mouse notes if mouse up happens anywhere.
        if (activeKeysRef.current.size > 0 || activePlaybackNotes.current.size > 0) {
           // Keep logic simple for now. 
        }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [playNoteByCode, stopNoteByCode, updateTransposeMod]);

  const startAudio = async () => {
    setIsLoading(true);
    // Initialize with selected instrument
    setCurrentInstrument(selectedStartInstrument);
    await audioEngine.init(selectedStartInstrument); 
    setIsLoading(false);
    setIsAudioStarted(true);
  };

  return (
    <div className="h-screen w-screen bg-[#333333] flex flex-col overflow-hidden font-sans select-none relative">
      
      {/* 0. Landscape Warning Overlay */}
      {isPortraitMobile && <LandscapePrompt />}

      {/* 1. Functional Toolbar */}
      <div className="bg-[#2a2a2a] p-1.5 md:p-2 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#111] shadow-md z-20 shrink-0 overflow-x-auto overflow-y-hidden no-scrollbar">
         <div className="flex items-center gap-2 text-yellow-500 font-bold px-2 md:px-4 md:border-r border-[#444] shrink-0">
             <Keyboard className="w-5 h-5" />
             <span className="hidden lg:inline">KeyPiano</span>
         </div>
         
         {/* Instrument Selector */}
         <div className="flex items-center gap-2 shrink-0">
            <Music className="w-4 h-4 text-blue-400" />
            <select 
                value={currentInstrument}
                onChange={(e) => handleInstrumentChange(e.target.value as InstrumentID)}
                disabled={!isAudioStarted || isLoading}
                className="bg-black text-white text-xs px-2 py-1.5 rounded border border-gray-600 focus:outline-none focus:border-yellow-500 cursor-pointer disabled:opacity-50 max-w-[120px] md:max-w-none"
            >
                {INSTRUMENTS.map(inst => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                ))}
            </select>
         </div>

         <div className="w-px h-6 bg-[#444] shrink-0 hidden md:block"></div>
         
         {/* Volume Control */}
         <div className="flex items-center gap-2 group relative shrink-0">
            <Volume2 className={`w-4 h-4 ${volume > 0 ? 'text-green-500' : 'text-gray-600'}`} />
            <input 
              type="range" 
              min="0" 
              max="2" 
              step="0.05" 
              value={volume} 
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-16 md:w-24 h-2 bg-black rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-green-400"
            />
         </div>

         <div className="w-px h-6 bg-[#444] shrink-0 hidden md:block"></div>
         
         {/* Metronome Controls - EXPANDED */}
         <div className="flex items-center gap-3 shrink-0 bg-black/20 p-1 px-2 rounded border border-white/5">
            <button 
                onClick={() => setIsMetronomeOn(!isMetronomeOn)}
                className={`transition-colors p-1 rounded-full ${isMetronomeOn ? 'bg-cyan-900/50 text-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}
                title="Toggle Metronome"
            >
                {isMetronomeOn ? <Activity className="w-4 h-4" /> : <Timer className="w-4 h-4" />}
            </button>
            
            <div className="flex flex-col gap-1">
                 <div className="flex items-center gap-2">
                     <span className="text-[10px] text-gray-500 font-bold font-mono">BPM</span>
                     {/* Editable BPM Input */}
                     <input 
                        type="number"
                        min="40"
                        max="240"
                        value={bpm}
                        onChange={(e) => setBpm(Math.max(40, Math.min(240, parseInt(e.target.value) || 120)))}
                        className="bg-black/50 text-white text-[10px] w-10 text-center rounded border border-gray-700 focus:border-cyan-500 outline-none"
                     />
                     
                     <select 
                        value={metronomeSound}
                        onChange={(e) => setMetronomeSound(e.target.value as MetronomeSound)}
                        className="bg-transparent text-[10px] text-gray-400 hover:text-white border-none p-0 outline-none cursor-pointer"
                     >
                         {METRONOME_SOUNDS.map(s => (
                             <option key={s.id} value={s.id}>{s.label}</option>
                         ))}
                     </select>
                 </div>
                 {/* Slider for quick adjustment */}
                 <input 
                   type="range" 
                   min="40" 
                   max="240" 
                   step="1" 
                   value={bpm} 
                   onChange={(e) => setBpm(parseInt(e.target.value))}
                   className="w-32 h-1 bg-black rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-cyan-600 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-cyan-400"
                 />
            </div>
         </div>

         <div className="w-px h-6 bg-[#444] shrink-0 hidden md:block"></div>

         {/* Recorder Controls + Timer */}
         <div className="flex items-center gap-3 shrink-0 bg-black/30 p-1 rounded border border-gray-700 scale-90 md:scale-100 origin-left">
             <button 
                onClick={toggleRecording} 
                className={`p-1.5 rounded-full transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-red-500 hover:bg-red-900/50'}`}
                title="Record (ScrLk)"
             >
                 {isRecording ? <Square className="w-3 h-3 fill-current" /> : <Circle className="w-3 h-3 fill-current" />}
             </button>
             <button 
                onClick={togglePlayback}
                disabled={isRecording || recordedEvents.length === 0}
                className={`p-1.5 rounded-full transition-all ${isPlayingBack ? 'bg-yellow-500 text-black' : 'text-green-500 hover:bg-green-900/50 disabled:opacity-30 disabled:hover:bg-transparent'}`}
                title="Play/Pause (PrtSc)"
             >
                 {isPlayingBack ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
             </button>
             <button
                onClick={handleStopFullReset}
                disabled={!isRecording && !isPlayingBack && elapsedTime === 0}
                className={`p-1.5 rounded-full transition-all ${isRecording || isPlayingBack || elapsedTime > 0 ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-600'}`}
                title="Stop & Reset (Pause)"
             >
                 <RotateCcw className="w-3 h-3" />
             </button>

             {/* Timer Display */}
             <div className={`px-2 font-mono text-xs font-bold w-[60px] text-center transition-colors ${
                 isRecording ? 'text-red-500' : isPlayingBack ? 'text-green-500' : elapsedTime > 0 ? 'text-yellow-500' : 'text-gray-500'
             }`}>
                 {formatTime(elapsedTime)}
             </div>
         </div>

         <div className="flex-1"></div>
         
         {/* Toggle Piano Visualization Button */}
         <button 
            onClick={() => setShowPianoViz(!showPianoViz)}
            className={`p-1.5 rounded border ${showPianoViz ? 'border-yellow-600 text-yellow-500' : 'border-gray-700 text-gray-500'} hover:text-white transition-colors`}
            title="Toggle Piano Visualization"
         >
             {showPianoViz ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
         </button>

         {/* Info Button */}
         <button 
            onClick={() => setShowInfo(true)}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="About KeyPiano"
         >
             <Info className="w-5 h-5" />
         </button>
      </div>

      {/* 2. Unified Grid Keyboard Area */}
      <div className="flex-1 bg-gradient-to-b from-[#505050] to-[#2a2a2a] p-2 md:p-6 flex items-center justify-center overflow-hidden shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] relative w-full">
          
          <div 
            className="grid gap-[2px] sm:gap-[3px] flex-shrink-0"
            style={{
                gridTemplateColumns: `repeat(92, 1fr)`,
                width: '100%', 
                maxWidth: '1600px',
                aspectRatio: '23 / 6',
                maxHeight: '100%', 
            }}
          >
              {ALL_ROWS.map((row, rowIdx) => (
                  <React.Fragment key={rowIdx}>
                      {row.map((k, idx) => (
                          <VirtualKey
                            key={k.code + idx}
                            {...k}
                            isActive={
                                activeKeys.has(k.code) || 
                                (k.code === 'ShiftLeft' && tempTranspose === 1) ||
                                (k.code === 'ControlLeft' && tempTranspose === -1)
                            }
                            onMouseDown={handleMouseDown}
                            onMouseUp={handleMouseUp}
                          />
                      ))}
                  </React.Fragment>
              ))}
          </div>
      </div>

      {/* 3. Info Status Bar - Interactive Inputs */}
      <div className="h-6 md:h-8 bg-[#222] border-t border-[#111] border-b border-[#333] flex items-center justify-between px-2 md:px-4 text-[10px] md:text-xs font-mono text-gray-400 shrink-0 select-none overflow-hidden whitespace-nowrap">
          <div className="flex gap-4 items-center">
              {/* Base / Transpose Select */}
              <div className="flex items-center gap-1 md:gap-2">
                  <span>Base:</span>
                  <select 
                      value={transposeBase}
                      onChange={(e) => setTransposeBase(parseInt(e.target.value))}
                      className="bg-gray-200 text-black px-1 min-w-[50px] text-center rounded-[2px] h-5 border-none outline-none cursor-pointer"
                  >
                      {Array.from({length: 25}, (_, i) => i - 12).map(val => (
                          <option key={val} value={val}>
                              {getRootKeyName(val)}
                          </option>
                      ))}
                  </select>
              </div>

              {/* Volume / Velocity Input */}
              <div className="flex items-center gap-1 md:gap-2">
                  <span>Vel:</span>
                  <input 
                      type="number"
                      min="0"
                      max="200"
                      value={Math.round(volume * 100)}
                      onChange={(e) => setVolume(Math.min(2, Math.max(0, parseInt(e.target.value) / 100)))}
                      className="bg-gray-200 text-black px-1 w-[40px] text-center rounded-[2px] h-5 border-none outline-none"
                  />
              </div>
          </div>
          
          <div className="flex gap-4 items-center">
              {/* Sustain Select */}
              <div className="flex items-center gap-1 md:gap-2">
                  <span>Sus:</span>
                  <select
                      value={sustainLevel}
                      onChange={(e) => setSustainLevel(e.target.value as SustainLevel)}
                      className="bg-gray-200 text-black px-1 min-w-[50px] text-center rounded-[2px] h-5 border-none outline-none cursor-pointer"
                  >
                      <option value="OFF">0 (Off)</option>
                      <option value="SHORT">64 (Short)</option>
                      <option value="LONG">127 (Long)</option>
                  </select>
              </div>

              {/* Octave Select */}
              <div className="flex items-center gap-1 md:gap-2">
                  <span>Oct:</span>
                  <select
                      value={octaveShift}
                      onChange={(e) => setOctaveShift(parseInt(e.target.value))}
                      className="bg-gray-200 text-black px-1 w-[40px] text-center rounded-[2px] h-5 border-none outline-none cursor-pointer"
                  >
                      {Array.from({length: 7}, (_, i) => i - 3).map(val => (
                           <option key={val} value={val}>{val > 0 ? `+${val}` : val}</option>
                      ))}
                  </select>
              </div>
          </div>
      </div>

      {/* 4. Piano Visualization - Collapsible */}
      {showPianoViz && (
          <div className="h-24 md:h-auto md:max-h-48 bg-[#1a1a1a] p-1 flex flex-col gap-1 shadow-[0_-5px_15px_rgba(0,0,0,0.5)] z-20 shrink-0 transition-all">
              <PianoKeyboard 
                  activeNotes={visualActiveNotes} 
                  onPlayNote={playNoteByName}
                  onStopNote={stopNoteByName}
              />
          </div>
      )}

      {/* Info Modal */}
      {showInfo && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-[#2a2a2a] w-full max-w-lg rounded-lg shadow-2xl border border-[#444] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-[#444] bg-[#222]">
                    <div className="flex items-center gap-2 text-yellow-500 font-bold">
                        <Info className="w-5 h-5" />
                        <span>About KeyPiano</span>
                    </div>
                    <button onClick={() => setShowInfo(false)} className="text-gray-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 text-gray-300 text-sm leading-relaxed">
                     <p className="mb-4">
                        <strong className="text-white">KeyPiano</strong> is a browser-based polyphonic synthesizer inspired by FreePiano.
                    </p>
                    <div className="bg-[#1a1a1a] p-3 rounded border border-[#333] mb-4 space-y-1 font-mono text-xs">
                         <div className="flex justify-between"><span className="text-gray-500">Esc</span> <span>Sustain</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">F3-F6</span> <span>Transpose/Octave</span></div>
                    </div>
                     <p className="text-xs text-gray-500 mb-6">
                        For mobile users: The keyboard scales to fit your screen in landscape mode.
                    </p>
                    
                    <div className="border-t border-[#444] pt-4 space-y-3">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Related Projects</h3>
                        
                        <a href="https://github.com/angushushu/keypiano" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white hover:text-yellow-500 transition-colors text-xs">
                            <Github className="w-3 h-3" /> 
                            <span>KeyPiano (Web) - Source Code</span>
                        </a>

                        <a href="https://github.com/angushushu/freepyano" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white hover:text-yellow-500 transition-colors text-xs">
                            <Github className="w-3 h-3" /> 
                            <span>FreePyano (Python) - Desktop Remake</span>
                        </a>

                        <a href="http://freepiano.tiwb.com/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 hover:underline transition-colors text-xs mt-2">
                             <ExternalLink className="w-3 h-3" /> 
                             <span>Original FreePiano Website</span>
                        </a>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Loading/Start Overlays - Redesigned */}
      {!isAudioStarted ? (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#18181b] p-4">
          
          <div className="flex flex-col items-center max-w-md w-full gap-8">
              <div className="flex flex-col items-center gap-2">
                 <div className="p-4 bg-yellow-500/10 rounded-full mb-2">
                     <Keyboard className="w-16 h-16 text-yellow-500" />
                 </div>
                 <h1 className="text-3xl font-bold text-white tracking-tight">KeyPiano</h1>
                 <p className="text-gray-400 text-center">Web-based polyphonic synthesizer</p>
              </div>

              {isLoading ? (
                 <div className="flex flex-col items-center gap-4 bg-[#27272a] p-8 rounded-xl w-full border border-[#3f3f46]">
                     <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
                     <div className="flex flex-col items-center">
                        <p className="text-white font-medium">Loading Sounds...</p>
                        <p className="text-sm text-gray-500">{INSTRUMENTS.find(i => i.id === selectedStartInstrument)?.name}</p>
                     </div>
                 </div>
              ) : (
                <div className="flex flex-col gap-4 w-full bg-[#27272a] p-6 rounded-xl border border-[#3f3f46]">
                    
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                            <Music className="w-3 h-3" /> Select Sound Source
                        </label>
                        <select 
                            value={selectedStartInstrument}
                            onChange={(e) => setSelectedStartInstrument(e.target.value as InstrumentID)}
                            className="w-full bg-[#18181b] text-white p-3 rounded-lg border border-[#3f3f46] focus:border-yellow-500 focus:outline-none appearance-none cursor-pointer"
                        >
                            {INSTRUMENTS.map(inst => (
                                <option key={inst.id} value={inst.id}>
                                    {inst.name} {inst.type === 'gm' ? '(Fast)' : '(High Quality)'}
                                </option>
                            ))}
                        </select>
                         <p className="text-[10px] text-gray-500">
                             {selectedStartInstrument === 'salamander' ? 'Requires ~3MB download. Best quality.' : 'Faster load time. Lower quality.'}
                         </p>
                    </div>

                    <button
                        onClick={startAudio}
                        className="w-full py-4 bg-yellow-600 hover:bg-yellow-500 text-white font-bold text-lg rounded-lg shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-2"
                    >
                        <Activity className="w-5 h-5" />
                        <span>Start Engine</span>
                    </button>
                    
                    <p className="text-[10px] text-center text-gray-500 mt-2">
                        Audio requires interaction to unlock. 
                    </p>
                </div>
              )}
          </div>
        </div>
      ) : isLoading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
            <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
        </div>
      )}
    </div>
  );
};

export default App;