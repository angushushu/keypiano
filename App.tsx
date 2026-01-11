

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import VirtualKey from './components/VirtualKey';
import PianoKeyboard from './components/PianoKeyboard';
import StaveVisualizer, { NoteType } from './components/StaveVisualizer';
import LandscapePrompt from './components/LandscapePrompt';
import { audioEngine, SustainLevel, INSTRUMENTS, InstrumentID, MetronomeSound, METRONOME_SOUNDS } from './services/audioEngine';
import { generateMidiFile, parseMidiFile } from './services/midiIO';
import { 
  KEYMAP_PRESETS,
  KeymapID,
  IMMUNE_TO_MODIFIERS,
  ALL_ROWS,
  getTransposedNote,
  getRootKeyName,
  midiNumberToNote
} from './constants';
import { 
  Volume2, Keyboard, Activity, Loader2, Music, 
  Circle, Square, Play, Pause, Timer, Info, X, ChevronDown, ChevronUp, Github, RotateCcw,
  Download, FileUp, Settings, Palette, Languages, GripHorizontal, Map as MapIcon, ScrollText, Piano, Globe, GraduationCap, Gauge, Plug
} from 'lucide-react';
import { THEMES, TRANSLATIONS, ThemeID, Language } from './theme';

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
  code?: string; // Store the physical key code for visual playback
  transpose: number;
  instrumentId: InstrumentID;
  velocity?: number;
}

const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5];

const App: React.FC = () => {
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  
  // Theme & Language State
  const [language, setLanguage] = useState<Language>('en');
  const [themeId, setThemeId] = useState<ThemeID>('dark');
  const [keymapId, setKeymapId] = useState<KeymapID>('freepiano');

  // VIEW STATES
  // Exclusive Main View: 'stave' | 'keyboard'
  const [mainView, setMainView] = useState<'stave' | 'keyboard'>('keyboard');
  const [showPiano, setShowPiano] = useState(true);

  // Mobile Toolbar State
  const [isToolbarOpen, setIsToolbarOpen] = useState(true);

  // Practice Mode State
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  const theme = THEMES[themeId];
  const t = TRANSLATIONS[language];
  const currentKeyMap = KEYMAP_PRESETS[keymapId].map;
  
  // Derived state for light theme detection
  const isLightTheme = themeId === 'light' || themeId === 'minimalist' || themeId === 'pastel';

  // Separate state for keys active during playback (Computer Keyboard)
  const [playbackKeys, setPlaybackKeys] = useState<Set<string>>(new Set());
  const [playbackNotes, setPlaybackNotes] = useState<Set<string>>(new Set());

  // Track notes clicked via the Piano Visualizer directly
  const [activeMouseNotes, setActiveMouseNotes] = useState<Set<string>>(new Set());

  // Track notes played via Physical MIDI Device
  const [activeMidiNotes, setActiveMidiNotes] = useState<Set<string>>(new Set());
  const [midiAccess, setMidiAccess] = useState<WebMidi.MIDIAccess | null>(null);

  const [isAudioStarted, setIsAudioStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Mobile/Landscape state
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  
  // Resizable Heights
  const [pianoHeight, setPianoHeight] = useState(180); 
  
  // Synth State
  const [transposeBase, setTransposeBase] = useState(0); 
  const [octaveShift, setOctaveShift] = useState(0); 
  const [volume, setVolume] = useState(0.8);
  const [sustainLevel, setSustainLevel] = useState<SustainLevel>('SHORT');
  
  const [selectedStartInstrument, setSelectedStartInstrument] = useState<InstrumentID>('salamander');
  const [currentInstrument, setCurrentInstrument] = useState<InstrumentID>('salamander');
  
  // Modifiers state
  const [tempTranspose, setTempTranspose] = useState(0); 

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingBack, setIsPlayingBack] = useState(false);
  const [recordedEvents, setRecordedEvents] = useState<RecordedEvent[]>([]);
  const [recordingStartTime, setRecordingStartTime] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Metronome State
  const [isMetronomeOn, setIsMetronomeOn] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [metronomeSound, setMetronomeSound] = useState<MetronomeSound>('beep');

  // Stave Visualization State
  const [triggerNotes, setTriggerNotes] = useState<{note: string, time: number, type: NoteType}[]>([]);

  // Refs
  const activeKeysRef = useRef<Set<string>>(new Set());
  const synthStateRef = useRef({ transposeBase: 0, octaveShift: 0 });
  const tempTransposeRef = useRef(0);
  const recordingRef = useRef<RecordedEvent[]>([]);
  const isPracticeModeRef = useRef(false);
  const isRecordingRef = useRef(false); // Ref for recording state for MIDI callbacks
  
  // Playback Refs
  const animFrameRef = useRef<number | null>(null);
  const audioContextStartTimeRef = useRef<number>(0);
  const audioCursorRef = useRef<number>(0);
  const playbackStartOffsetRef = useRef<number>(0); // Store start offset (ms) in Ref to avoid stale closure
  const playbackSpeedRef = useRef<number>(1.0); // Ref for speed to avoid closure issues in scheduler

  const workerRef = useRef<Worker | null>(null); 
  const playbackKeysRef = useRef<Set<string>>(new Set());
  const playbackNotesRef = useRef<Set<string>>(new Set());
  const lastStaveIndexRef = useRef<number>(0); // Track which events have been sent to Stave

  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastShiftLeftReleaseTime = useRef<number>(0);

  // Drag Resize Refs
  const isDraggingPiano = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(0);
  const settingsRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    isPracticeModeRef.current = isPracticeMode;
  }, [isPracticeMode]);

  useEffect(() => {
      isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
  }, [playbackSpeed]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (showSettings && 
            settingsRef.current && 
            !settingsRef.current.contains(event.target as Node) &&
            !settingsButtonRef.current?.contains(event.target as Node)) {
            setShowSettings(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettings]);

  useEffect(() => {
    const checkLayout = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setIsPortraitMobile(height > width && width < 1024);
      
      // Auto-collapse toolbar on mobile initially
      if (width < 768) {
          setIsToolbarOpen(false);
      } else {
          setIsToolbarOpen(true);
      }
    };
    checkLayout();
    window.addEventListener('resize', checkLayout);
    return () => window.removeEventListener('resize', checkLayout);
  }, []);

  // --- WEB MIDI API ---
  useEffect(() => {
    if (navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess().then(
            (ma) => {
                setMidiAccess(ma);
                // Attach listeners to existing inputs
                Array.from(ma.inputs.values()).forEach(input => {
                    input.onmidimessage = handleMidiMessage;
                });
                
                // Handle hot-plugging
                ma.onstatechange = (e: WebMidi.MIDIConnectionEvent) => {
                   const port = e.port as WebMidi.MIDIInput;
                   if (port.type === 'input' && port.state === 'connected') {
                       port.onmidimessage = handleMidiMessage;
                   }
                };
            },
            () => console.warn('Web MIDI API access denied or not supported.')
        );
    }
  }, [currentInstrument, volume]); // Dependencies needed if handling logic uses closure, but handleMidiMessage needs access to Refs

  const handleMidiMessage = (e: WebMidi.MIDIMessageEvent) => {
    const { data } = e;
    if (!data || data.length < 2) return;

    const [status, noteNum, velocity] = data;
    const command = status & 0xf0;
    // const channel = status & 0x0f; 

    // Note On: 144 (0x90)
    // Note Off: 128 (0x80)
    // Note: Some devices send Note On with Velocity 0 as Note Off
    
    const noteName = midiNumberToNote(noteNum);
    
    if (command === 144 && velocity > 0) {
        // NOTE ON
        audioEngine.playNote(noteName, 0, velocity); 
        setActiveMidiNotes(prev => new Set(prev).add(noteName));
        setTriggerNotes([{ note: noteName, time: Date.now(), type: 'user' }]);

        if (isRecordingRef.current) {
            recordingRef.current.push({
                time: Date.now() - recordingStartTime, // recordingStartTime needs to be ref or this closure is stale? 
                // Wait, functional component closure issue. recordingStartTime is state.
                // We need a REF for start time if we want to use it here without re-binding listener.
                // OR we can't use state directly here easily.
                // Simplified fix: use Date.now() for now, we might need a Ref for start time.
                // Let's assume we fix `recordingStartTime` to be a ref below.
                type: 'on',
                note: noteName,
                transpose: 0,
                instrumentId: currentInstrument, // This is also closure stale...
                velocity: velocity
            });
        }
    } else if (command === 128 || (command === 144 && velocity === 0)) {
        // NOTE OFF
        audioEngine.stopNote(noteName, 0);
        setActiveMidiNotes(prev => {
            const s = new Set(prev);
            s.delete(noteName);
            return s;
        });
        
        if (isRecordingRef.current) {
            recordingRef.current.push({
                time: Date.now() - recordingStartTime,
                type: 'off',
                note: noteName,
                transpose: 0,
                instrumentId: currentInstrument
            });
        }
    }
  };
  
  // FIX: To handle stale state in MIDI callback, we use a ref for recording start time and current instrument
  const recordingStartTimeRef = useRef(0);
  const currentInstrumentRef = useRef<InstrumentID>('salamander');

  useEffect(() => {
      recordingStartTimeRef.current = recordingStartTime;
  }, [recordingStartTime]);

  useEffect(() => {
      currentInstrumentRef.current = currentInstrument;
  }, [currentInstrument]);
  
  // Re-define handleMidiMessage to use Refs for values that change
  // Note: We can't easily re-bind 'onmidimessage' every render.
  // Best practice: The handler calls a ref-based function or accesses refs directly.
  const handleMidiMessageRef = useRef<(e: WebMidi.MIDIMessageEvent) => void>(() => {});
  
  useEffect(() => {
    handleMidiMessageRef.current = (e: WebMidi.MIDIMessageEvent) => {
        const { data } = e;
        if (!data || data.length < 2) return;
    
        const [status, noteNum, velocity] = data;
        const command = status & 0xf0;
        const noteName = midiNumberToNote(noteNum);
        
        if (command === 144 && velocity > 0) {
            // Note On
            // Use current volume as a scaler if needed, but MIDI usually respects device velocity
            audioEngine.playNote(noteName, 0, velocity); 
            setActiveMidiNotes(prev => {
                const s = new Set(prev);
                s.add(noteName);
                return s;
            });
            // Direct set state for visualizer trigger might be heavy on high freq, but OK for piano
            setTriggerNotes([{ note: noteName, time: Date.now(), type: 'user' }]);
    
            if (isRecordingRef.current) {
                recordingRef.current.push({
                    time: Date.now() - recordingStartTimeRef.current,
                    type: 'on',
                    note: noteName,
                    transpose: 0,
                    instrumentId: currentInstrumentRef.current,
                    velocity: velocity
                });
            }
        } else if (command === 128 || (command === 144 && velocity === 0)) {
            // Note Off
            audioEngine.stopNote(noteName, 0);
            setActiveMidiNotes(prev => {
                const s = new Set(prev);
                s.delete(noteName);
                return s;
            });
            
            if (isRecordingRef.current) {
                recordingRef.current.push({
                    time: Date.now() - recordingStartTimeRef.current,
                    type: 'off',
                    note: noteName,
                    transpose: 0,
                    instrumentId: currentInstrumentRef.current
                });
            }
        }
    };
  }, []); // Empty dependency, refs are stable

  // Attach the stable listener wrapper
  useEffect(() => {
    if (!midiAccess) return;
    
    const listener = (e: WebMidi.MIDIMessageEvent) => handleMidiMessageRef.current(e);

    const inputs = Array.from(midiAccess.inputs.values());
    inputs.forEach(input => {
        input.onmidimessage = listener;
    });

    midiAccess.onstatechange = (e: WebMidi.MIDIConnectionEvent) => {
        const port = e.port as WebMidi.MIDIInput;
        if (port.type === 'input' && port.state === 'connected') {
            port.onmidimessage = listener;
        }
    };
    
    return () => {
        inputs.forEach(input => input.onmidimessage = null);
    };
  }, [midiAccess]);


  // Helper to calculate effective transpose given immunity rules
  const getEffectiveTranspose = useCallback((code: string | undefined) => {
      let effectiveTranspose = tempTransposeRef.current;
      if (code && IMMUNE_TO_MODIFIERS.has(code)) {
          effectiveTranspose = 0;
      } else if (code && effectiveTranspose === 0 && code.startsWith('Numpad')) {
          // Fallback OS Numpad Shift Fix
          if (Date.now() - lastShiftLeftReleaseTime.current < 100) {
              return 1;
          }
      }
      return effectiveTranspose;
  }, []);

  // Compute User Active Notes (Manual Interaction)
  const userActiveNotes = useMemo(() => {
    const notes: string[] = [];
    
    // 1. Process Manual Computer Keys
    activeKeys.forEach(code => {
        const baseNote = currentKeyMap[code];
        if (baseNote) {
            const effTemp = getEffectiveTranspose(code);
            const totalSemis = transposeBase + (octaveShift * 12) + effTemp;
            notes.push(getTransposedNote(baseNote, totalSemis));
        }
    });
    
    // 2. Process Mouse Interaction
    activeMouseNotes.forEach(n => notes.push(n));

    // 3. Process External MIDI Device
    activeMidiNotes.forEach(n => notes.push(n));

    return notes;
  }, [activeKeys, activeMouseNotes, activeMidiNotes, transposeBase, octaveShift, currentKeyMap, getEffectiveTranspose]);

  // Compute Playback Active Notes
  const playbackActiveNotes = useMemo(() => {
      const notes: string[] = [];
      playbackNotes.forEach(note => notes.push(note));
      return notes;
  }, [playbackNotes]);

  // Combine notes for visualizer when NOT in practice mode
  const pianoVisualNotes = useMemo(() => {
      if (isPracticeMode) return userActiveNotes;
      return [...userActiveNotes, ...playbackActiveNotes];
  }, [isPracticeMode, userActiveNotes, playbackActiveNotes]);

  // Splitted Key Map for Advanced Visualization (Fingering Reconstruction)
  const { leftHandMap, rightHandMap } = useMemo(() => {
    const l = new Map<string, string>();
    const r = new Map<string, string>();
    
    Object.entries(currentKeyMap).forEach(([code, note]) => {
        // IMMUNE_TO_MODIFIERS roughly equates to the "Right Side" (Numpad, Nav, Arrows) in FreePiano
        if (IMMUNE_TO_MODIFIERS.has(code)) {
            // Prefer Numpad over arrows if possible for "Right Hand" piano feel
            if (!r.has(note) || code.startsWith('Numpad')) {
                r.set(note, code);
            }
        } else {
            // Main keyboard area (Left Hand / Melody + Shift)
            if (!l.has(note)) {
                l.set(note, code);
            }
        }
    });
    return { leftHandMap: l, rightHandMap: r };
  }, [currentKeyMap]);

  // Reverse Key Map for Visualization (Note Name -> Key Code)
  // Legacy single map fallback
  const noteToKeyMap = useMemo(() => {
    const map = new Map<string, string>();
    Object.entries(currentKeyMap).forEach(([code, note]) => {
        const isNumpad = code.startsWith('Numpad');
        const existingCode = map.get(note);
        if (!existingCode) {
            map.set(note, code);
        } else {
            if (isNumpad && !existingCode.startsWith('Numpad')) {
                map.set(note, code);
            }
        }
    });
    return map;
  }, [currentKeyMap]);

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
      audioEngine.setBPM(bpm);
      if (isMetronomeOn) audioEngine.startMetronome(bpm);
      else audioEngine.stopMetronome();
    }
  }, [isMetronomeOn, bpm, isAudioStarted]);

  useEffect(() => {
      audioEngine.setMetronomeSound(metronomeSound);
  }, [metronomeSound]);

  // Timer Effect for Recording (Display Only)
  useEffect(() => {
    let interval: number;
    if (isRecording) {
      interval = window.setInterval(() => {
        setElapsedTime(Date.now() - recordingStartTime);
      }, 50);
    } 
    return () => clearInterval(interval);
  }, [isRecording, recordingStartTime]);

  const cycleSustain = () => {
      const levels: SustainLevel[] = ['OFF', 'SHORT', 'LONG'];
      const nextIdx = (levels.indexOf(sustainLevel) + 1) % levels.length;
      setSustainLevel(levels[nextIdx]);
  };

  const startAudio = useCallback(() => {
    setIsLoading(true);
    setTimeout(async () => {
        await audioEngine.init(selectedStartInstrument);
        setCurrentInstrument(selectedStartInstrument);
        setIsAudioStarted(true);
        setIsLoading(false);
    }, 50);
  }, [selectedStartInstrument]);

  const handleInstrumentChange = async (id: InstrumentID) => {
    if (id === currentInstrument) return;
    setIsLoading(true);
    setCurrentInstrument(id);
    setTimeout(async () => {
        await audioEngine.init(id);
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
    }
  };

  const togglePlayback = () => {
    if (isPlayingBack) pausePlayback();
    else startPlayback();
  };

  const changePlaybackSpeed = (newSpeed: number) => {
      if (isPlayingBack) {
          // Re-anchor logic to maintain smooth playback when speed changes
          const now = audioEngine.currentTime;
          // Calculate where we are in the track currently
          const currentTrackTimeSec = (now - audioContextStartTimeRef.current) * playbackSpeedRef.current;
          
          // Re-calculate the audioContext anchor time so that (now - newAnchor) * newSpeed == currentTrackTime
          // newAnchor = now - (currentTrackTime / newSpeed)
          audioContextStartTimeRef.current = now - (currentTrackTimeSec / newSpeed);
      }
      setPlaybackSpeed(newSpeed);
      playbackSpeedRef.current = newSpeed;
  };

  // --- WORKER & SCHEDULER ---
  useEffect(() => {
      const workerCode = `
          let intervalId;
          self.onmessage = function(e) {
              if (e.data === 'start') {
                  if (intervalId) clearInterval(intervalId);
                  intervalId = setInterval(() => { self.postMessage('tick'); }, 25);
              } else if (e.data === 'stop') {
                  if (intervalId) clearInterval(intervalId);
              }
          };
      `;
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      workerRef.current = new Worker(URL.createObjectURL(blob));
      workerRef.current.onmessage = (e) => {
          if (e.data === 'tick') runAudioScheduler();
      };
      return () => workerRef.current?.terminate();
  }, []);

  const runAudioScheduler = () => {
      if (recordingRef.current.length === 0) return;

      const currentCtxTime = audioEngine.currentTime;
      const speed = playbackSpeedRef.current;
      const startOffsetSec = playbackStartOffsetRef.current / 1000;
      
      // Calculate current position in track time (seconds)
      const trackPlayTime = (currentCtxTime - audioContextStartTimeRef.current) * speed + startOffsetSec; 
      
      const scheduleUntil = trackPlayTime + 0.1 * speed; // Lookahead, scaled by speed
      const events = recordingRef.current;
      let nextIdx = audioCursorRef.current;

      while(nextIdx < events.length) {
          const evt = events[nextIdx];
          const evtTimeSec = evt.time / 1000;
          if (evtTimeSec > scheduleUntil) break; 

          // Calculate when to play this note relative to audio context
          // evtTime = (absTime - anchor) * speed + offset
          // absTime - anchor = (evtTime - offset) / speed
          // absTime = anchor + (evtTime - offset) / speed
          const absolutePlayTime = audioContextStartTimeRef.current + (evtTimeSec - startOffsetSec) / speed;
          
          if (evt.type === 'on') {
               if (absolutePlayTime > currentCtxTime - 0.05) {
                   // PRACTICE MODE: Only play sound if Practice Mode is OFF
                   if (!isPracticeModeRef.current) {
                       audioEngine.playNote(evt.note, evt.transpose, evt.velocity, absolutePlayTime);
                   }
               }
          } else {
               audioEngine.stopNote(evt.note, evt.transpose, absolutePlayTime);
          }
          nextIdx++;
      }
      audioCursorRef.current = nextIdx;
      
      const lastEvent = events[events.length - 1];
      // Check if we passed end of song
      if (lastEvent && trackPlayTime > (lastEvent.time / 1000) + 1.0) {
          workerRef.current?.postMessage('stop');
          pausePlayback();
          setElapsedTime(0);
          playbackStartOffsetRef.current = 0;
      }
  };

  const visualLoop = () => {
      const events = recordingRef.current;
      if (events.length === 0 || !workerRef.current) return;

      const currentCtxTime = audioEngine.currentTime;
      const speed = playbackSpeedRef.current;
      const currentTrackTimeMs = ((currentCtxTime - audioContextStartTimeRef.current) * speed * 1000) + playbackStartOffsetRef.current;
      
      setElapsedTime(currentTrackTimeMs > 0 ? currentTrackTimeMs : 0);
      
      // 1. Collect all active notes for this frame
      const currentHeldEvents: RecordedEvent[] = [];
      
      // We iterate to find what's currently ON
      // A note is ON if we passed its 'on' event but haven't passed its 'off' event
      // Optimization: We can track active notes statefully or scan from a safe window.
      // For simplicity/accuracy in this app structure, we scan or use a map.
      // Given the events are sorted:
      const activeNotesMap = new Map<string, RecordedEvent>(); // Key: note_transpose
      
      for(const evt of events) {
          if (evt.time > currentTrackTimeMs) break;
          // Use midi identifier logic
          const key = evt.code || `${evt.note}_${evt.transpose}`;
          if (evt.type === 'on') activeNotesMap.set(key, evt);
          else activeNotesMap.delete(key);
      }
      
      const activeK = new Set<string>();
      const activeN = new Set<string>();
      
      const notesArray = Array.from(activeNotesMap.values());
      
      // --- FINGERING RECONSTRUCTION ALGORITHM ---
      
      // 1. Analyze Frame: Do we have black keys (Accidentals)?
      // Note: we check the note string for '#' or 'b'. 
      // FreePiano style: If accidental exists, Left Hand (Main) typically handles modifiers.
      // Right Hand (Numpad) typically handles Naturals.
      const hasBlackKeys = notesArray.some(evt => evt.note.includes('#') || evt.note.includes('b'));
      
      let rightHandFingerCount = 0; // Constraints: Max 5 fingers on right hand
      
      // Sort notes to ensure consistent assignment order (e.g., low to high)
      // This helps with "which naturals go to right hand first"
      notesArray.sort((a, b) => {
          // Compare notes simply by string or transpose roughly
          return a.note.localeCompare(b.note);
      });

      notesArray.forEach((evt) => {
          const visualNote = getTransposedNote(evt.note, evt.transpose);
          activeN.add(visualNote);
          
          if (evt.code) {
             // Physical key recorded? Use it directly.
             activeK.add(evt.code);
          } else {
             // Imported MIDI: Reconstruct fingering
             const isBlackKey = evt.note.includes('#') || evt.note.includes('b');
             let assignedCode: string | undefined;

             if (isBlackKey) {
                 // Rule: Transposed/Black notes go to LEFT HAND (Main Panel)
                 // Logic: Find Base Note (semitone down) in LeftHandMap, assume Shift is pressed.
                 const baseNote = getTransposedNote(evt.note, -1);
                 const baseCode = leftHandMap.get(baseNote);
                 if (baseCode) {
                     assignedCode = baseCode;
                     activeK.add('ShiftLeft'); // Trigger Shift visualization
                 } else {
                     // Fallback if not found in Left Map (unlikely for standard range)
                     assignedCode = noteToKeyMap.get(evt.note);
                 }
             } else {
                 // It's a White Key (Natural)
                 if (hasBlackKeys) {
                     // Rule: If black keys exist, Naturals go to RIGHT HAND (Numpad/Nav)
                     // Constraint: Max 5 keys
                     const rightCode = rightHandMap.get(evt.note);
                     if (rightCode && rightHandFingerCount < 5) {
                         assignedCode = rightCode;
                         rightHandFingerCount++;
                     } else {
                         // Overflow or no mapping -> Left Hand
                         assignedCode = leftHandMap.get(evt.note);
                     }
                 } else {
                     // Rule: Only Naturals playing? 
                     // Prefer Right Hand for melody logic (standard FreePiano feel), fallback to Left.
                     const rightCode = rightHandMap.get(evt.note);
                     if (rightCode && rightHandFingerCount < 5) {
                         assignedCode = rightCode;
                         rightHandFingerCount++;
                     } else {
                         assignedCode = leftHandMap.get(evt.note) || noteToKeyMap.get(evt.note);
                     }
                 }
             }

             if (assignedCode) activeK.add(assignedCode);
          }
      });

      let changed = false;
      if (activeK.size !== playbackKeysRef.current.size || activeN.size !== playbackNotesRef.current.size) changed = true;
      else {
          for(const k of activeK) if (!playbackKeysRef.current.has(k)) { changed = true; break; }
          if (!changed) {
              for(const n of activeN) if (!playbackNotesRef.current.has(n)) { changed = true; break; }
          }
      }

      if (changed) {
          playbackKeysRef.current = activeK;
          playbackNotesRef.current = activeN;
          setPlaybackKeys(activeK);
          setPlaybackNotes(activeN);
      }

      // 2. Handle Discrete Note Triggers (Stave Visualizer)
      // Scan for new 'on' events since the last checked index
      const newTriggerNotes: {note: string, time: number, type: NoteType}[] = [];
      let i = lastStaveIndexRef.current;
      while(i < events.length && events[i].time <= currentTrackTimeMs) {
          if (events[i].type === 'on') {
              const evt = events[i];
              const visualNote = getTransposedNote(evt.note, evt.transpose);
              // Determine note type based on practice mode
              const type: NoteType = isPracticeModeRef.current ? 'practice' : 'user';
              newTriggerNotes.push({ note: visualNote, time: Date.now(), type: type });
          }
          i++;
      }
      lastStaveIndexRef.current = i;
      
      if (newTriggerNotes.length > 0) {
          setTriggerNotes(newTriggerNotes);
      }

      if (workerRef.current) animFrameRef.current = requestAnimationFrame(visualLoop);
  };

  const startPlayback = () => {
    if (recordingRef.current.length === 0) return;
    audioEngine.resumeIfSuspended();

    const lastEventTime = recordingRef.current[recordingRef.current.length - 1].time;

    if (elapsedTime >= lastEventTime) {
        // Restart from beginning
        setElapsedTime(0);
        playbackStartOffsetRef.current = 0;
        audioCursorRef.current = 0;
        lastStaveIndexRef.current = 0;
    } else {
        // Resume
        playbackStartOffsetRef.current = elapsedTime;
        // Fast forward cursors
        let idx = 0;
        while(idx < recordingRef.current.length && recordingRef.current[idx].time < elapsedTime) idx++;
        audioCursorRef.current = idx;
        lastStaveIndexRef.current = idx;
    }

    audioContextStartTimeRef.current = audioEngine.currentTime;
    setIsPlayingBack(true);
    
    workerRef.current?.postMessage('start');
    
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(visualLoop);
  };

  const pausePlayback = () => {
      setIsPlayingBack(false);
      workerRef.current?.postMessage('stop');
      if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
      }
      audioEngine.stopNote("C4", 0); 
      playbackKeysRef.current.clear();
      playbackNotesRef.current.clear();
      setPlaybackKeys(new Set());
      setPlaybackNotes(new Set());
  };

  const handleStopFullReset = () => {
      if (isRecording) {
          setIsRecording(false);
          setRecordedEvents([...recordingRef.current]);
      }
      pausePlayback(); 
      setElapsedTime(0);
      playbackStartOffsetRef.current = 0;
      audioCursorRef.current = 0;
      lastStaveIndexRef.current = 0;
  };
  
  // --- FILE I/O ---
  const handleExportMidi = () => {
      if (recordedEvents.length === 0) return;
      const blob = generateMidiFile(recordedEvents);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `KeyPiano_Recording_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.mid`;
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
          playbackStartOffsetRef.current = 0;
          lastStaveIndexRef.current = 0;
          alert(`Successfully imported MIDI: ${events.length} events loaded.`);
      } catch (err) {
          console.error(err);
          alert("Failed to parse MIDI file.");
      }
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
    if (isDraggingPiano.current) {
        const delta = dragStartYRef.current - e.clientY; 
        setPianoHeight(Math.max(50, Math.min(window.innerHeight * 0.6, dragStartHeightRef.current + delta)));
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    isDraggingPiano.current = false;
    document.body.style.cursor = '';
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
  }, [handleDragMove]);

  // --- KEY LOGIC ---
  const updateModifiers = (code: string, isDown: boolean) => {
      if (code === 'ShiftLeft') {
          if (!isDown) lastShiftLeftReleaseTime.current = Date.now();
          const isCtrl = activeKeysRef.current.has('ControlLeft');
          const newT = isCtrl ? (isDown ? 0 : -1) : (isDown ? 1 : 0);
          tempTransposeRef.current = newT;
          setTempTranspose(newT);
      } else if (code === 'ControlLeft') {
          const isShift = activeKeysRef.current.has('ShiftLeft');
          const newT = isShift ? (isDown ? 0 : 1) : (isDown ? -1 : 0);
          tempTransposeRef.current = newT;
          setTempTranspose(newT);
      }
  };

  const handleFunctionKey = (code: string) => {
      const actions: Record<string, () => void> = {
          'Escape': cycleSustain,
          'F1': () => setOctaveShift(o => Math.max(-3, o - 1)), // Octave Down
          'F2': () => setOctaveShift(o => Math.min(3, o + 1)),  // Octave Up
          'F3': () => setTransposeBase(t => t - 1),
          'F4': () => setTransposeBase(t => t + 1),
          'F5': () => setVolume(v => Math.max(0, parseFloat((v - 0.1).toFixed(2)))), // Volume Down
          'F6': () => setVolume(v => Math.min(2, parseFloat((v + 0.1).toFixed(2)))), // Volume Up
          'F7': () => setIsMetronomeOn(prev => !prev), // Metronome Toggle
          'F8': () => setMainView(prev => prev === 'stave' ? 'keyboard' : 'stave'), // View Toggle
          'F9': togglePlayback, // PLAY
          'F10': toggleRecording, // RECORD
          'F11': handleStopFullReset, // STOP (Transport)
          'F12': () => { // RESET (State)
              setTransposeBase(0);
              setOctaveShift(0);
              audioEngine.stopAllNotes(); // Proper Panic/Reset
          },
          'Coffee': () => window.open('https://paypal.me/angushushu', '_blank')
      };
      if (actions[code]) actions[code]();
  };

  const playNoteByCode = useCallback((code: string) => {
    if (['Escape', 'Coffee'].includes(code) || code.startsWith('F')) {
        handleFunctionKey(code);
    }
    updateModifiers(code, true);

    const note = currentKeyMap[code];
    if (note) {
      const effectiveTranspose = getEffectiveTranspose(code);
      const totalTranspose = synthStateRef.current.transposeBase + (synthStateRef.current.octaveShift * 12) + effectiveTranspose;
      const vel = Math.min(127, Math.floor(volume * 100)); 
      
      const finalNote = getTransposedNote(note, totalTranspose);
      audioEngine.playNote(note, totalTranspose, vel);
      
      // Update Stave Visualizer with USER type
      setTriggerNotes([{ note: finalNote, time: Date.now(), type: 'user' }]);

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

    setActiveKeys(prev => {
      const newSet = new Set(prev);
      newSet.add(code);
      activeKeysRef.current = newSet;
      return newSet;
    });
  }, [isAudioStarted, sustainLevel, isRecording, recordingStartTime, currentInstrument, elapsedTime, isPlayingBack, volume, currentKeyMap, getEffectiveTranspose]);

  const stopNoteByCode = useCallback((code: string) => {
    updateModifiers(code, false);

    const note = currentKeyMap[code];
    if (note) {
      const base = synthStateRef.current.transposeBase + (synthStateRef.current.octaveShift * 12);
      const effectiveTranspose = getEffectiveTranspose(code);
      const totalTranspose = base + effectiveTranspose;
      
      audioEngine.stopNote(note, totalTranspose);
      audioEngine.stopNote(note, base); 
      audioEngine.stopNote(note, base + 1); 
      audioEngine.stopNote(note, base - 1);

      if (isRecording) {
          recordingRef.current.push({
              time: Date.now() - recordingStartTime,
              type: 'off',
              note: note,
              code: code,
              transpose: totalTranspose,
              instrumentId: currentInstrument
          });
      }
    }

    setActiveKeys(prev => {
      const newSet = new Set(prev);
      newSet.delete(code);
      activeKeysRef.current = newSet;
      return newSet;
    });
  }, [isAudioStarted, isRecording, recordingStartTime, currentInstrument, currentKeyMap, getEffectiveTranspose]);

  const playNoteByName = useCallback((noteName: string) => {
      audioEngine.playNote(noteName, 0, Math.min(127, Math.floor(volume * 100))); 
      // Update Stave Visualizer with USER type
      setTriggerNotes([{ note: noteName, time: Date.now(), type: 'user' }]);
      setActiveMouseNotes(prev => new Set(prev).add(noteName));
  }, [volume]);

  const stopNoteByName = useCallback((noteName: string) => {
      audioEngine.stopNote(noteName, 0);
      setActiveMouseNotes(prev => {
          const s = new Set(prev);
          s.delete(noteName);
          return s;
      });
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
      if (e.repeat) return;
      if (currentKeyMap[e.code] || e.code.startsWith('F') || ['Tab', 'Quote', 'Slash', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'ContextMenu', 'Space', 'Backspace'].includes(e.code)) {
           e.preventDefault();
      }
      playNoteByCode(e.code);
  }, [playNoteByCode, currentKeyMap]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
      stopNoteByCode(e.code);
  }, [stopNoteByCode]);

  const handleMouseDown = useCallback((code: string) => {
      playNoteByCode(code);
  }, [playNoteByCode]);

  const handleMouseUp = useCallback((code: string) => {
      stopNoteByCode(code);
  }, [stopNoteByCode]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    const handleBlur = () => {
        activeKeysRef.current.forEach(code => stopNoteByCode(code));
        setActiveMouseNotes(new Set());
    };
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [handleKeyDown, handleKeyUp, stopNoteByCode]);

  return (
    <div className={`h-screen w-screen ${theme.appBg} flex flex-col overflow-hidden font-sans select-none relative transition-colors duration-300`}>
      <input type="file" ref={fileInputRef} accept=".mid,.midi" onChange={handleFileChange} className="hidden" />
      {isPortraitMobile && <LandscapePrompt title={t.landscape.title} message={t.landscape.message} />}

      {/* Toolbar Container */}
      <div className={`${theme.toolbarBg} ${theme.toolbarBorder} flex flex-col md:flex-row md:items-center border-b shadow-md z-20 shrink-0 transition-colors duration-300 relative`}>
         
         {/* Mobile Header */}
         <div className="flex items-center justify-between p-2 md:p-0 w-full md:w-auto md:border-r border-gray-700 md:mr-2">
             <div className="flex items-center gap-2 text-yellow-500 font-bold md:px-4">
                 <Keyboard className="w-5 h-5" />
                 <span className="inline">{t.title}</span>
                 {midiAccess && <div className="ml-1 w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_lime]" title="MIDI Device Connected"></div>}
             </div>
             <button 
                onClick={() => setIsToolbarOpen(!isToolbarOpen)} 
                className={`md:hidden p-1.5 rounded transition-colors ${theme.toolbarText} hover:bg-gray-700/30`}
             >
                {isToolbarOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
             </button>
         </div>
         
         {/* Collapsible Content Area */}
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
            
            {/* Volume */}
            <div className={`flex items-center gap-2 shrink-0 ${theme.panelBg} ${theme.panelBorder} px-2 py-1 rounded border`}>
                <Volume2 className={`w-4 h-4 ${volume > 0 ? 'text-green-500' : 'text-gray-500'}`} />
                <input 
                type="range" min="0" max="2" step="0.05" value={volume} 
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-16 md:w-24 h-2 bg-black rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-green-400"
                />
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
                    <input type="range" min="40" max="240" step="1" value={bpm} onChange={(e) => setBpm(parseInt(e.target.value))}
                    className="w-32 h-1 bg-black rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-cyan-600 [&::-webkit-slider-thumb]:rounded-full" />
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
                <button onClick={() => setMainView(mainView === 'stave' ? 'keyboard' : 'stave')} className={`p-1.5 rounded ${mainView === 'stave' ? 'bg-yellow-600 text-white' : 'text-gray-500 hover:bg-gray-700 hover:text-gray-300'}`} title={t.toggleStave}>
                    <ScrollText className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setMainView(mainView === 'keyboard' ? 'stave' : 'keyboard')} className={`p-1.5 rounded ${mainView === 'keyboard' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-700 hover:text-gray-300'}`} title={t.toggleKeyboard}>
                    <Keyboard className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setShowPiano(!showPiano)} className={`p-1.5 rounded ${showPiano ? 'bg-green-600 text-white' : 'text-gray-500 hover:bg-gray-700 hover:text-gray-300'}`} title={t.togglePiano}>
                    <Piano className="w-3.5 h-3.5" />
                </button>
                
                <div className="w-px h-4 bg-gray-500/30 mx-0.5"></div>
                <button 
                    onClick={() => {
                        const nextMode = !isPracticeMode;
                        setIsPracticeMode(nextMode);
                        if (!nextMode) changePlaybackSpeed(1.0);
                    }} 
                    className={`p-1.5 rounded flex items-center gap-1 ${isPracticeMode ? 'bg-purple-600 text-white' : 'text-gray-500 hover:bg-gray-700 hover:text-gray-300'}`} 
                    title={t.practiceMode}
                >
                    <GraduationCap className="w-3.5 h-3.5" />
                </button>
                
                {/* Speed Control */}
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

            {/* Info Button */}
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
          
          {/* Main View: Stave OR Keyboard (Mutual Exclusive in Flex Space) */}
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
                                // Dynamic Note Calculation for Visuals
                                const baseNote = currentKeyMap[k.code];
                                let displayedNote = baseNote;
                                
                                if (baseNote) {
                                    // Logic mimics playNoteByCode to accurately reflect what pitch would play
                                    let effectiveTranspose = tempTranspose;
                                    if (IMMUNE_TO_MODIFIERS.has(k.code)) effectiveTranspose = 0;
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
                                        (k.code === 'ShiftLeft' && tempTranspose === 1 && playbackKeys.has('ShiftLeft')) || // Ensure Shift key lights up if in playbackKeys
                                        (k.code === 'ShiftLeft' && tempTranspose === 1) || 
                                        (k.code === 'ControlLeft' && tempTranspose === -1)
                                    }
                                    isPlaybackActive={isPracticeMode && playbackKeys.has(k.code)}
                                    onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} theme={theme}
                                />
                            )})}
                        </React.Fragment>
                    ))}
                </div>
            </div>
          )}

      </div>

      {/* Status Bar (Serves as Piano Drag Handle) */}
      <div 
        className={`h-6 md:h-8 ${theme.toolbarBg} border-t ${theme.toolbarBorder} border-b border-[#333] flex items-center justify-between px-2 md:px-4 text-[10px] md:text-xs font-mono ${theme.toolbarText} shrink-0 select-none overflow-hidden whitespace-nowrap transition-colors duration-300 cursor-row-resize relative z-30`} 
        onMouseDown={showPiano ? handlePianoDragStart : undefined}
      >
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20 pointer-events-none"><GripHorizontal className="w-4 h-4" /></div>
          <div className="flex gap-4 items-center z-10 pointer-events-auto cursor-default">
              <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}><span>{t.controls.base}:</span>
                  <select value={transposeBase} onChange={(e) => setTransposeBase(parseInt(e.target.value))} className="bg-gray-200 text-black px-1 min-w-[50px] text-center rounded-[2px] h-5 border-none outline-none cursor-pointer">
                      {Array.from({length: 25}, (_, i) => i - 12).map(val => (<option key={val} value={val}>{getRootKeyName(val)}</option>))}
                  </select>
              </div>
              <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}><span>{t.controls.vel}:</span>
                  <input type="number" min="0" max="200" value={Math.round(volume * 100)} onChange={(e) => setVolume(Math.min(2, Math.max(0, parseInt(e.target.value) / 100)))} className="bg-gray-200 text-black px-1 w-[40px] text-center rounded-[2px] h-5 border-none outline-none" />
              </div>
          </div>
          <div className="flex gap-4 items-center z-10 pointer-events-auto cursor-default">
              <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}><span>{t.controls.sus}:</span>
                  <select value={sustainLevel} onChange={(e) => setSustainLevel(e.target.value as SustainLevel)} className="bg-gray-200 text-black px-1 min-w-[50px] text-center rounded-[2px] h-5 border-none outline-none cursor-pointer">
                      <option value="OFF">0 (Off)</option><option value="SHORT">64 (Short)</option><option value="LONG">127 (Long)</option>
                  </select>
              </div>
              <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}><span>{t.controls.oct}:</span>
                  <select value={octaveShift} onChange={(e) => setOctaveShift(parseInt(e.target.value))} className="bg-gray-200 text-black px-1 w-[40px] text-center rounded-[2px] h-5 border-none outline-none cursor-pointer">
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
                onPlayNote={playNoteByName} 
                onStopNote={stopNoteByName} 
                theme={theme} 
              />
          </div>
      )}

      {/* Overlays */}
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
                 <div className="p-4 bg-yellow-500/10 rounded-full mb-2"><Keyboard className="w-16 h-16 text-yellow-500" /></div>
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