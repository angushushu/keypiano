import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import VirtualKey from './components/VirtualKey';
import PianoKeyboard from './components/PianoKeyboard';
import { audioEngine, SustainLevel, INSTRUMENTS, InstrumentID, MetronomeSound, METRONOME_SOUNDS } from './services/audioEngine';
import { 
  KEY_TO_NOTE, 
  ALL_ROWS
} from './constants';
import { 
  Volume2, Keyboard, Zap, Activity, ArrowUp, ArrowDown, Loader2, Music, 
  Circle, Square, Play, Pause, Timer, Info, X, ExternalLink
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

interface RecordedEvent {
  time: number;
  type: 'on' | 'off';
  note: string;
  transpose: number;
  instrumentId: InstrumentID;
}

const App: React.FC = () => {
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  const [isAudioStarted, setIsAudioStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  
  // Synth State
  const [transposeBase, setTransposeBase] = useState(0); 
  const [octaveShift, setOctaveShift] = useState(0); 
  const [volume, setVolume] = useState(0.8);
  const [sustainLevel, setSustainLevel] = useState<SustainLevel>('SHORT');
  const [currentInstrument, setCurrentInstrument] = useState<InstrumentID>('hq_piano');
  
  // Modifiers state
  const [tempTranspose, setTempTranspose] = useState(0); 

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingBack, setIsPlayingBack] = useState(false);
  const [recordedEvents, setRecordedEvents] = useState<RecordedEvent[]>([]);
  const [recordingStartTime, setRecordingStartTime] = useState(0);
  
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

  const visualActiveNotes = useMemo(() => {
    const notes: string[] = [];
    const totalSemis = transposeBase + (octaveShift * 12) + tempTranspose;
    
    activeKeys.forEach(code => {
      const baseNote = KEY_TO_NOTE[code];
      if (baseNote) {
        notes.push(getTransposedNote(baseNote, totalSemis));
      }
    });
    return notes;
  }, [activeKeys, transposeBase, octaveShift, tempTranspose]);

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
      // Start recording
      setRecordedEvents([]);
      recordingRef.current = [];
      setRecordingStartTime(Date.now());
      setIsRecording(true);
      // If playing back, stop playback
      if (isPlayingBack) stopPlayback();
    }
  };

  const togglePlayback = () => {
    if (isPlayingBack) {
      stopPlayback();
    } else {
      if (recordedEvents.length === 0) return;
      setIsPlayingBack(true);
      const startT = Date.now();
      
      recordedEvents.forEach(evt => {
         const delay = evt.time;
         const tid = window.setTimeout(() => {
             if (evt.type === 'on') {
                 audioEngine.playNote(evt.note, evt.transpose);
             } else {
                 audioEngine.stopNote(evt.note, evt.transpose);
             }
         }, delay);
         playbackTimeouts.current.push(tid);
      });

      // Auto stop after last event
      const lastEventTime = recordedEvents[recordedEvents.length - 1].time;
      const endTid = window.setTimeout(() => {
          setIsPlayingBack(false);
      }, lastEventTime + 1000);
      playbackTimeouts.current.push(endTid);
    }
  };

  const stopPlayback = () => {
      setIsPlayingBack(false);
      playbackTimeouts.current.forEach(window.clearTimeout);
      playbackTimeouts.current = [];
  };

  const handleStop = () => {
      if (isRecording) {
          setIsRecording(false);
          setRecordedEvents([...recordingRef.current]);
      }
      stopPlayback();
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
         handleStop(); 
         break;
    }
  };

  const playNoteByCode = useCallback((code: string) => {
    if (!isAudioStarted) return;
    
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
  }, [isAudioStarted, sustainLevel, isRecording, recordingStartTime, currentInstrument]);

  const stopNoteByCode = useCallback((code: string) => {
    if (!isAudioStarted) return;
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
    const handleBlur = () => activeKeysRef.current.forEach(code => stopNoteByCode(code));
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [playNoteByCode, stopNoteByCode, updateTransposeMod]);

  const startAudio = async () => {
    setIsLoading(true);
    await audioEngine.init();
    setIsLoading(false);
    setIsAudioStarted(true);
  };

  return (
    <div className="h-screen w-screen bg-[#333333] flex flex-col overflow-hidden font-sans select-none">
      
      {/* 1. Functional Toolbar */}
      <div className="bg-[#2a2a2a] p-2 flex items-center gap-4 border-b border-[#111] shadow-md z-20 h-14 min-h-[3.5rem] shrink-0 overflow-x-auto overflow-y-hidden no-scrollbar">
         <div className="flex items-center gap-2 text-yellow-500 font-bold px-4 border-r border-[#444] shrink-0">
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
                className="bg-black text-white text-sm px-2 py-1 rounded border border-gray-600 focus:outline-none focus:border-yellow-500 cursor-pointer disabled:opacity-50 w-32 md:w-auto"
            >
                {INSTRUMENTS.map(inst => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                ))}
            </select>
         </div>

         <div className="w-px h-6 bg-[#444] shrink-0"></div>
         
         {/* Interactive Volume Control (Increased Max) */}
         <div className="flex items-center gap-2 group relative shrink-0">
            <Volume2 className={`w-4 h-4 ${volume > 0 ? 'text-green-500' : 'text-gray-600'}`} />
            <input 
              type="range" 
              min="0" 
              max="2" 
              step="0.05" 
              value={volume} 
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-20 md:w-28 h-2 bg-black rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-green-400"
            />
            <span className="text-xs text-gray-500 w-8">{Math.round(volume * 100)}%</span>
         </div>

         <div className="w-px h-6 bg-[#444] shrink-0"></div>

         {/* Recorder Controls */}
         <div className="flex items-center gap-2 shrink-0 bg-black/30 p-1 rounded border border-gray-700">
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
                className={`p-1.5 rounded-full transition-all ${isPlayingBack ? 'bg-green-500 text-white' : 'text-green-500 hover:bg-green-900/50 disabled:opacity-30 disabled:hover:bg-transparent'}`}
                title="Play Recording (PrtSc)"
             >
                 {isPlayingBack ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
             </button>
             <button
                onClick={handleStop}
                disabled={!isRecording && !isPlayingBack}
                className={`p-1.5 rounded-full transition-all ${isRecording || isPlayingBack ? 'text-yellow-500 hover:bg-yellow-900/50' : 'text-gray-600'}`}
                title="Stop All (Pause)"
             >
                 <Pause className="w-3 h-3 fill-current" />
             </button>

             <span className="text-xs font-mono text-gray-400 w-12 text-center">
                 {isRecording ? "REC" : isPlayingBack ? "PLAY" : recordedEvents.length > 0 ? `${recordedEvents.length}ev` : "--"}
             </span>
         </div>

         <div className="w-px h-6 bg-[#444] shrink-0"></div>

         {/* Metronome Controls */}
         <div className="flex items-center gap-2 shrink-0 bg-black/30 px-2 py-1 rounded border border-gray-700">
             <button 
                onClick={() => setIsMetronomeOn(!isMetronomeOn)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold transition-colors ${isMetronomeOn ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                title="Toggle Metronome"
             >
                 <Timer className="w-3 h-3" />
                 <span>{bpm}</span>
             </button>
             {isMetronomeOn && (
                 <>
                    <input 
                        type="range" 
                        min="40" 
                        max="240" 
                        value={bpm} 
                        onChange={(e) => setBpm(parseInt(e.target.value))}
                        className="w-16 h-1 bg-gray-600 appearance-none rounded [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:rounded-full"
                    />
                    <select
                        value={metronomeSound}
                        onChange={(e) => setMetronomeSound(e.target.value as MetronomeSound)}
                        className="bg-gray-800 text-white text-xs px-1 py-0.5 rounded border border-gray-600 focus:outline-none cursor-pointer w-16"
                    >
                        {METRONOME_SOUNDS.map(s => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                    </select>
                 </>
             )}
         </div>

         <div className="flex-1"></div>
         
         {/* Info Button */}
         <button 
            onClick={() => setShowInfo(true)}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="About KeyPiano"
         >
             <Info className="w-5 h-5" />
         </button>
      </div>

      {/* 2. Unified Grid Keyboard Area - Responsive Layout */}
      <div className="flex-1 bg-gradient-to-b from-[#505050] to-[#2a2a2a] p-2 sm:p-6 flex items-center justify-center overflow-auto shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] relative w-full">
          
          <div 
            className="grid gap-[3px] transition-transform duration-200 origin-center"
            style={{
                // 23 units wide. 1u = 4 grid columns. Total = 92 columns.
                gridTemplateColumns: `repeat(92, 1fr)`,
                // Responsive width logic:
                // We want it to be as wide as possible but respecting the aspect ratio (approx 23u x 6u ~ 4:1)
                width: '100%', 
                maxWidth: '1600px', // Prevent it from getting absurdly huge on 4k screens
                minWidth: '800px', // Prevent it from getting too small to read
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

      {/* 3. Info Status Bar */}
      <div className="h-8 bg-[#222] border-t border-[#111] border-b border-[#333] flex items-center justify-between px-4 text-[10px] md:text-xs font-mono text-gray-400 shrink-0 select-none">
          <div className="flex gap-4">
              <div className="flex items-center gap-2">
                  <span>Key 1 =</span>
                  <div className="bg-gray-200 text-black px-1 min-w-[30px] text-center rounded-[2px]">{getRootKeyName(transposeBase)}</div>
              </div>
          </div>
          
          <div className="flex gap-4">
              <div className="flex items-center gap-2 cursor-pointer hover:text-white" onClick={cycleSustain} title="Sustain (Esc)">
                  <span>Sustain</span>
                  <div className="bg-gray-200 text-black px-1 min-w-[24px] text-center rounded-[2px]">{getSustainValueDisplay()}</div>
                  <div className="bg-gray-200 text-black px-1 min-w-[24px] text-center rounded-[2px]">{getSustainValueDisplay()}</div>
              </div>
              <div className="flex items-center gap-2 hidden sm:flex">
                  <span>Velocity</span>
                  <div className="bg-gray-200 text-black px-1 min-w-[24px] text-center rounded-[2px]">{Math.min(127, Math.round(volume * 63.5))}</div>
                  <div className="bg-gray-200 text-black px-1 min-w-[24px] text-center rounded-[2px]">100</div>
              </div>
              <div className="flex items-center gap-2">
                  <span>Octave</span>
                  <div className="bg-gray-200 text-black px-1 min-w-[20px] text-center rounded-[2px]">{octaveShift}</div>
                  <div className="bg-gray-200 text-black px-1 min-w-[20px] text-center rounded-[2px]">0</div>
              </div>
          </div>
      </div>

      {/* 4. Piano Visualization */}
      <div className="h-auto bg-[#1a1a1a] p-1 flex flex-col gap-1 shadow-[0_-5px_15px_rgba(0,0,0,0.5)] z-20 shrink-0">
          <PianoKeyboard activeNotes={visualActiveNotes} />
      </div>

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
                        <strong className="text-white">KeyPiano</strong> is a web-based implementation inspired by the legendary Windows software <strong className="text-white">FreePiano</strong>.
                    </p>
                    <p className="mb-4">
                        It transforms your standard computer keyboard into a low-latency, polyphonic piano synthesizer using Web Audio API. The keymap is designed to maximize playability, allowing you to play chords and melodies efficiently using a grid layout.
                    </p>
                    <div className="bg-[#1a1a1a] p-3 rounded border border-[#333] mb-4 space-y-1 font-mono text-xs">
                        <div className="flex justify-between"><span className="text-gray-500">Esc</span> <span>Toggle Sustain</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">F3 / F4</span> <span>Transpose - / +</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">F5 / F6</span> <span>Octave - / +</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">F7 / F8</span> <span>Volume - / +</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">PrtSc / ScrLk / Pause</span> <span>Play / Rec / Stop</span></div>
                    </div>
                    <p className="text-xs text-gray-500 border-t border-[#333] pt-4 mt-4">
                        This project is open source. The KeyPiano name and web implementation are independent of the original FreePiano software by Wispow.
                    </p>
                    <div className="mt-4 flex gap-3">
                         <a href="http://freepiano.tiwb.com/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-400 hover:underline text-xs">
                             <ExternalLink className="w-3 h-3" /> Visit Original FreePiano
                         </a>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Loading/Start Overlays */}
      {!isAudioStarted ? (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
          {isLoading ? (
             <div className="flex flex-col items-center gap-4">
                 <Loader2 className="w-12 h-12 text-yellow-500 animate-spin" />
                 <p className="text-white text-lg font-mono">Loading {INSTRUMENTS.find(i => i.id === currentInstrument)?.name}...</p>
             </div>
          ) : (
            <button
                onClick={startAudio}
                className="group px-8 py-4 bg-yellow-600 text-white font-bold text-xl rounded-full shadow-[0_0_30px_rgba(234,179,8,0.4)] hover:bg-yellow-500 hover:scale-105 transition-all flex items-center gap-3"
            >
                <Activity className="w-6 h-6 animate-pulse" />
                <span>Initialize Audio Engine</span>
            </button>
          )}
          {!isLoading && <p className="mt-4 text-gray-500 text-sm">Downloads sample library (~3MB)</p>}
        </div>
      ) : isLoading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-[#222] p-6 rounded-lg shadow-xl flex flex-col items-center gap-4 border border-gray-700">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                <p className="text-gray-200">Loading {INSTRUMENTS.find(i => i.id === currentInstrument)?.name}...</p>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;