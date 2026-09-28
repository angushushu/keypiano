import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import VirtualKey from './components/VirtualKey';
import PianoKeyboard from './components/PianoKeyboard';
import StaveVisualizer from './components/StaveVisualizer';
import WaterfallVisualizer from './components/WaterfallVisualizer';
import LandscapePrompt from './components/LandscapePrompt';
import Toast from './components/Toast';
import Toolbar, { preventMouseFocus } from './components/Toolbar';
import StatusBar from './components/StatusBar';
import SettingsPanel from './components/SettingsPanel';
import InfoModal from './components/InfoModal';
import TakesPanel from './components/TakesPanel';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { SynthProvider, useSynth } from './contexts/SynthContext';
import { MetronomeProvider, useMetronome } from './contexts/MetronomeContext';
import { audioEngine } from './services/audioEngine';
import { generateMidiFile, parseMidiFile } from './services/midiIO';
import {
  ALL_ROWS,
  getTransposedNote
} from './constants';
import { Loader2, Minimize } from 'lucide-react';
import { TriggerNote } from './types';
import { useMidiDevice } from './hooks/useMidiDevice';
import { useAudioScheduler } from './hooks/useAudioScheduler';
import { useKeyboardInput } from './hooks/useKeyboardInput';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useRecordingState } from './hooks/useRecordingState';
import { useTakeHistory } from './hooks/useTakeHistory';
import { assignPiece, suggestOctave } from './services/autoFingering';

// ─── Inner App (consumes contexts) ──────────────────────────────

const MAX_TRIGGER_NOTES = 500;
const WAIT_MODE_STORAGE_KEY = 'keypiano.waitMode.v1';
const NUMPAD_HINTS_STORAGE_KEY = 'keypiano.numpadHints.v1';

// Laptops have no numpad, so practice hints stay on the main block unless
// the player says otherwise.
const readNumpadHintsPreference = () => {
  try {
    return localStorage.getItem(NUMPAD_HINTS_STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
};

const formatOctave = (octave: number) => (octave > 0 ? `+${octave}` : String(octave));

// Wait mode is on unless the player turned it off: it is what makes practice
// mode usable for someone still learning a piece.
const readWaitModePreference = () => {
  try {
    return localStorage.getItem(WAIT_MODE_STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
};

const isInteractiveTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    ['input', 'textarea', 'select', 'button'].includes(tagName) ||
    target.closest('[contenteditable="true"], input, textarea, select, button, [role="button"]') !== null
  );
};

// Inputs that take typed text; every other control is a click target.
const NON_TEXT_INPUT_TYPES = new Set(['button', 'checkbox', 'color', 'file', 'image', 'radio', 'range', 'reset', 'submit']);
const isTextEntryTarget = (target: HTMLElement): boolean => (
  target.isContentEditable
  || target instanceof HTMLTextAreaElement
  || (target instanceof HTMLInputElement && !NON_TEXT_INPUT_TYPES.has(target.type))
);

const EMPTY_GUIDE = new Map<string, number>();

const AppInner: React.FC = () => {
  const { theme, t, isZenMode, setIsZenMode } = useSettings();
  const {
    isLoading, ensureAudioStarted, currentInstrument, keyVelocity, setKeyVelocity,
    transposeBase, setTransposeBase, octaveShift, setOctaveShift,
    cycleSustain, synthStateRef, toast, setToast,
  } = useSynth();
  const { setIsMetronomeOn } = useMetronome();

  // View state
  const [mainView, setMainView] = useState<'stave' | 'keyboard' | 'waterfall'>('keyboard');
  const [showPiano, setShowPiano] = useState(true);
  const [pianoHeight, setPianoHeight] = useState(180);
  const [isToolbarOpen, setIsToolbarOpen] = useState(true);
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [isWaitMode, setIsWaitMode] = useState(readWaitModePreference);
  const [useNumpadHints, setUseNumpadHints] = useState(readNumpadHintsPreference);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  // UI panels
  const [showInfo, setShowInfo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTakes, setShowTakes] = useState(false);
  const takesButtonRef = useRef<HTMLButtonElement>(null);
  const closeTakes = useCallback(() => setShowTakes(false), []);
  const settingsRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const infoButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const closeSettings = useCallback(() => setShowSettings(false), []);
  const closeInfo = useCallback(() => setShowInfo(false), []);

  // Recording state (useReducer-based)
  const {
    isRecording, recordedEvents, recordingStartTime, elapsedTime,
    recordingRef, addRecordingEvent,
    stopAndReset: recordingStopAndReset,
    toggleRecording: recordingToggle,
    loadMidiEvents,
    dispatch: recordingDispatch,
  } = useRecordingState();

  // Visualization state
  const [triggerNotes, setTriggerNotesRaw] = useState<TriggerNote[]>([]);
  const setTriggerNotes = useCallback((updater: (prev: TriggerNote[]) => TriggerNote[]) => {
    setTriggerNotesRaw(prev => {
      const next = updater(prev);
      return next.length > MAX_TRIGGER_NOTES ? next.slice(next.length - MAX_TRIGGER_NOTES) : next;
    });
  }, []);
  const [playbackKeys, setPlaybackKeys] = useState<Set<string>>(new Set());
  const [playbackNotes, setPlaybackNotes] = useState<Set<string>>(new Set());
  const [guideKeys, setGuideKeys] = useState<Map<string, number>>(EMPTY_GUIDE);
  const [guideNotes, setGuideNotes] = useState<Map<string, number>>(EMPTY_GUIDE);
  const [playbackTempTranspose, setPlaybackTempTranspose] = useState(0);
  const [activeMouseNotes, setActiveMouseNotes] = useState<Set<string>>(new Set());
  const [activeMidiNotes, setActiveMidiNotes] = useState<Set<string>>(new Set());

  // Responsive
  const isNarrowViewport = useMediaQuery('(max-width: 1023px)');
  const isLgUp = useMediaQuery('(min-width: 1024px)');
  useEffect(() => { setShowPiano(!isNarrowViewport); setPianoHeight(isNarrowViewport ? 120 : 180); setIsToolbarOpen(!isNarrowViewport); }, [isNarrowViewport]);

  useEffect(() => {
    const checkLayout = () => { const w = window.innerWidth; setIsPortraitMobile(window.innerHeight > w && w < 1024); };
    checkLayout(); window.addEventListener('resize', checkLayout); return () => window.removeEventListener('resize', checkLayout);
  }, []);

  // Close settings on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (showSettings && settingsRef.current && !settingsRef.current.contains(e.target as Node) && !settingsButtonRef.current?.contains(e.target as Node)) setShowSettings(false);
    };
    document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler);
  }, [showSettings]);

  // Keyboard hook
  const {
    activeKeys, setActiveKeys, keymapId, setKeymapId, currentKeyMap, tempTranspose,
    handleKeyDown, handleKeyUp, getEffectiveTranspose, activeKeysRef, resetKeyboardState,
  } = useKeyboardInput('freepiano');
  const focusableVirtualCodes = useMemo(
    () => Array.from(new Set(ALL_ROWS.flat().filter(key => !key.isDummy).map(key => key.code))),
    []
  );
  const [focusedVirtualKeyCode, setFocusedVirtualKeyCode] = useState(focusableVirtualCodes[0] ?? '');
  const virtualKeyRefs = useRef(new Map<string, HTMLDivElement>());
  const registerVirtualKeyRef = useCallback((code: string, element: HTMLDivElement | null) => {
    if (element) virtualKeyRefs.current.set(code, element);
    else virtualKeyRefs.current.delete(code);
  }, []);
  const moveVirtualKeyFocus = useCallback((
    code: string,
    direction: 'previous' | 'next' | 'first' | 'last'
  ) => {
    const currentIndex = focusableVirtualCodes.indexOf(code);
    let nextIndex = currentIndex;
    if (direction === 'previous') nextIndex = Math.max(0, currentIndex - 1);
    if (direction === 'next') nextIndex = Math.min(focusableVirtualCodes.length - 1, currentIndex + 1);
    if (direction === 'first') nextIndex = 0;
    if (direction === 'last') nextIndex = focusableVirtualCodes.length - 1;
    const nextCode = focusableVirtualCodes[nextIndex];
    if (!nextCode) return;
    setFocusedVirtualKeyCode(nextCode);
    requestAnimationFrame(() => virtualKeyRefs.current.get(nextCode)?.focus());
  }, [focusableVirtualCodes]);

  // Keys for imported notes, chosen once per piece, keymap and transposition
  // so a hinted note never jumps to another key while it approaches.
  const fingeringOptions = useMemo(() => ({ useNumpad: useNumpadHints }), [useNumpadHints]);
  const keyAssignments = useMemo(
    () => assignPiece(recordedEvents, currentKeyMap, transposeBase + octaveShift * 12, fingeringOptions),
    [recordedEvents, currentKeyMap, transposeBase, octaveShift, fingeringOptions],
  );
  const octaveAdvice = useMemo(
    () => (isPracticeMode ? suggestOctave(recordedEvents, currentKeyMap, transposeBase, octaveShift, fingeringOptions) : null),
    [isPracticeMode, recordedEvents, currentKeyMap, transposeBase, octaveShift, fingeringOptions],
  );

  // Playback clear helper
  const clearPlaybackVisuals = useCallback(() => { setPlaybackKeys(new Set()); setPlaybackNotes(new Set()); setGuideKeys(EMPTY_GUIDE); setGuideNotes(EMPTY_GUIDE); }, []);

  useEffect(() => {
    try {
      localStorage.setItem(WAIT_MODE_STORAGE_KEY, isWaitMode ? 'on' : 'off');
    } catch {
      // The preference still applies for this session.
    }
  }, [isWaitMode]);

  useEffect(() => {
    try {
      localStorage.setItem(NUMPAD_HINTS_STORAGE_KEY, useNumpadHints ? 'on' : 'off');
    } catch {
      // The preference still applies for this session.
    }
  }, [useNumpadHints]);

  // Audio scheduler
  const {
    isPlayingBack, togglePlayback, pausePlayback, changePlaybackSpeedAnchor,
    waitingRemaining, registerUserNote, skipWaitingNotes,
  } = useAudioScheduler({
    recordingRef, isPracticeMode, isWaitMode, playbackSpeed,
    keyAssignments,
    setPlaybackKeys, setPlaybackNotes, setTriggerNotes, setPlaybackTempTranspose,
    setGuideKeys, setGuideNotes, setElapsedTime: (t: number) => recordingDispatch({ type: 'SET_ELAPSED', elapsed: t }), elapsedTime,
  });

  // MIDI device hook
  const { isSustainPedalDown, midiStatus, midiInputCount, requestMidiAccess } = useMidiDevice({
    currentInstrument, isRecording, recordingStartTime,
    addRecordingEvent, setTriggerNotes, setActiveMidiNotes,
    onUserNote: registerUserNote,
  });

  // Saved recordings and imports (IndexedDB)
  const {
    takes, currentTakeId, isStorageAvailable, saveImport, openTake, deleteTake,
  } = useTakeHistory({
    isRecording, recordingStartTime, recordingRef,
    hasEvents: recordedEvents.length > 0,
    loadEvents: events => loadMidiEvents(events, pausePlayback),
  });
  // Every take is saved as it is made, so replacing one only needs a warning
  // when the browser refused to store it.
  const confirmDiscardUnsavedTake = useCallback(() => (
    isStorageAvailable !== false || recordedEvents.length === 0 || window.confirm(t.takes.confirmDiscard)
  ), [isStorageAvailable, recordedEvents.length, t.takes.confirmDiscard]);

  // Computed visual notes
  const userActiveNotes = useMemo(() => {
    const notes: string[] = [];
    activeKeys.forEach((code: string) => { const baseNote = currentKeyMap[code]; if (baseNote) { notes.push(getTransposedNote(baseNote, transposeBase + (octaveShift * 12) + getEffectiveTranspose(code))); } });
    activeMouseNotes.forEach((n: string) => notes.push(n));
    activeMidiNotes.forEach((n: string) => notes.push(n));
    return notes;
  }, [activeKeys, activeMouseNotes, activeMidiNotes, transposeBase, octaveShift, currentKeyMap, getEffectiveTranspose]);

  const pianoVisualNotes = useMemo(() => { const s = new Set(userActiveNotes); if (!isPracticeMode) playbackNotes.forEach(n => s.add(n)); return s; }, [isPracticeMode, userActiveNotes, playbackNotes]);

  // ─── NOTE ACTIONS ────────────────────────────────────────────
  const activeKeyParamsRef = useRef<Map<string, { note: string; transpose: number }>>(new Map());
  const activeMouseNotesRef = useRef<Set<string>>(new Set());

  const playNoteByCode = useCallback((code: string) => {
    if (['Escape', 'Coffee'].includes(code) || code.startsWith('F')) handleFunctionKey(code);
    const note = currentKeyMap[code];
    if (note) {
      if (activeKeyParamsRef.current.has(code)) return;
      const effectiveTranspose = getEffectiveTranspose(code);
      const totalTranspose = synthStateRef.current.transposeBase + (synthStateRef.current.octaveShift * 12) + effectiveTranspose;
      const vel = Math.min(127, Math.max(0, keyVelocity));
      const finalNote = getTransposedNote(note, totalTranspose);
      activeKeyParamsRef.current.set(code, { note, transpose: totalTranspose });
      if (audioEngine.isLoaded) {
        audioEngine.playNote(note, totalTranspose, vel);
      } else {
        // First interaction: unlock the engine, then sound the note if still held.
        void ensureAudioStarted().then(isReady => {
          if (isReady && activeKeyParamsRef.current.has(code)) {
            audioEngine.playNote(note, totalTranspose, vel);
          }
        });
      }
      setTriggerNotes(prev => [...prev, { note: finalNote, time: Date.now(), type: 'user' }]);
      registerUserNote(finalNote);
      if (isRecording) {
        recordingRef.current.push({ time: Date.now() - recordingStartTime, type: 'on', note, code, transpose: totalTranspose, instrumentId: currentInstrument, velocity: vel });
      }
    }
    setActiveKeys(prev => { const n = new Set(prev); n.add(code); return n; });
  }, [isRecording, recordingStartTime, currentInstrument, keyVelocity, currentKeyMap, getEffectiveTranspose, ensureAudioStarted, synthStateRef, setActiveKeys, setTriggerNotes, registerUserNote]);

  const stopNoteByCode = useCallback((code: string) => {
    const activeParams = activeKeyParamsRef.current.get(code);
    if (activeParams) {
      audioEngine.stopNote(activeParams.note, activeParams.transpose);
      activeKeyParamsRef.current.delete(code);
      if (isRecording) {
        recordingRef.current.push({ time: Date.now() - recordingStartTime, type: 'off', note: activeParams.note, code, transpose: activeParams.transpose, instrumentId: currentInstrument });
      }
    }
    setActiveKeys(prev => { const n = new Set(prev); n.delete(code); return n; });
  }, [isRecording, recordingStartTime, currentInstrument, setActiveKeys]);

  const playNoteByName = useCallback((noteName: string) => {
    if (activeMouseNotesRef.current.has(noteName)) return;
    activeMouseNotesRef.current.add(noteName);
    const velocity = Math.min(127, Math.max(0, keyVelocity));
    if (audioEngine.isLoaded) {
      audioEngine.playNote(noteName, 0, velocity);
    } else {
      // First interaction: unlock the engine, then sound the note if still held.
      void ensureAudioStarted().then(isReady => {
        if (isReady && activeMouseNotesRef.current.has(noteName)) {
          audioEngine.playNote(noteName, 0, velocity);
        }
      });
    }
    setTriggerNotes(prev => [...prev, { note: noteName, time: Date.now(), type: 'user' }]);
    registerUserNote(noteName);
    setActiveMouseNotes(new Set(activeMouseNotesRef.current));
    if (isRecording) {
      recordingRef.current.push({
        time: Date.now() - recordingStartTime,
        type: 'on',
        note: noteName,
        code: `Piano:${noteName}`,
        transpose: 0,
        instrumentId: currentInstrument,
        velocity,
      });
    }
  }, [currentInstrument, ensureAudioStarted, isRecording, keyVelocity, recordingRef, recordingStartTime, setTriggerNotes, registerUserNote]);

  const stopNoteByName = useCallback((noteName: string) => {
    if (!activeMouseNotesRef.current.has(noteName)) return;
    activeMouseNotesRef.current.delete(noteName);
    audioEngine.stopNote(noteName, 0);
    setActiveMouseNotes(new Set(activeMouseNotesRef.current));
    if (isRecording) {
      recordingRef.current.push({
        time: Date.now() - recordingStartTime,
        type: 'off',
        note: noteName,
        code: `Piano:${noteName}`,
        transpose: 0,
        instrumentId: currentInstrument,
      });
    }
  }, [currentInstrument, isRecording, recordingRef, recordingStartTime]);

  // Function key handler
  const handleFunctionKey = (code: string) => {
    const actions: Record<string, () => void> = {
      'Escape': cycleSustain,
      'F1': () => setOctaveShift(o => Math.max(-3, o - 1)),
      'F2': () => setOctaveShift(o => Math.min(3, o + 1)),
      'F3': () => setTransposeBase(t => t - 1),
      'F4': () => setTransposeBase(t => t + 1),
      'F5': () => setKeyVelocity(Math.max(0, keyVelocity - 10)),
      'F6': () => setKeyVelocity(Math.min(127, keyVelocity + 10)),
      'F7': () => setIsMetronomeOn(prev => !prev),
      'F8': () => setMainView(prev => prev === 'stave' ? 'keyboard' : 'stave'),
      'F9': togglePlayback,
      'F10': () => toggleRecording(),
      'F11': () => stopAndReset(),
      'F12': () => { setTransposeBase(0); setOctaveShift(0); audioEngine.stopAllNotes(); },
      'Coffee': () => window.open('https://paypal.me/angushushu', '_blank', 'noopener,noreferrer')
    };
    if ((isRecording || isPlayingBack) && ['F1', 'F2', 'F3', 'F4'].includes(code)) return;
    if (actions[code]) actions[code]();
  };

  // Recording actions
  const stopAndReset = useCallback(() => {
    recordingStopAndReset(pausePlayback);
  }, [recordingStopAndReset, pausePlayback]);

  const toggleRecording = useCallback(() => {
    if (!isRecording && !confirmDiscardUnsavedTake()) return;
    recordingToggle(clearPlaybackVisuals, pausePlayback);
  }, [isRecording, confirmDiscardUnsavedTake, recordingToggle, clearPlaybackVisuals, pausePlayback]);

  const changePlaybackSpeed = useCallback((newSpeed: number) => {
    changePlaybackSpeedAnchor(newSpeed);
    setPlaybackSpeed(newSpeed);
  }, [changePlaybackSpeedAnchor]);

  // Stable refs for event listeners
  const playNoteByCodeRef = useRef(playNoteByCode);
  const stopNoteByCodeRef = useRef(stopNoteByCode);
  const handleKeyDownRef = useRef(handleKeyDown);
  const handleKeyUpRef = useRef(handleKeyUp);
  const stopNoteByNameRef = useRef(stopNoteByName);
  const currentKeyMapRef = useRef(currentKeyMap);
  useEffect(() => { playNoteByCodeRef.current = playNoteByCode; }, [playNoteByCode]);
  useEffect(() => { stopNoteByCodeRef.current = stopNoteByCode; }, [stopNoteByCode]);
  useEffect(() => { handleKeyDownRef.current = handleKeyDown; }, [handleKeyDown]);
  useEffect(() => { handleKeyUpRef.current = handleKeyUp; }, [handleKeyUp]);
  useEffect(() => { stopNoteByNameRef.current = stopNoteByName; }, [stopNoteByName]);
  useEffect(() => { currentKeyMapRef.current = currentKeyMap; }, [currentKeyMap]);

  useEffect(() => {
    if (!isPortraitMobile) return;
    [...activeKeyParamsRef.current.keys()].forEach(code => stopNoteByCodeRef.current(code));
    [...activeMouseNotesRef.current].forEach(note => stopNoteByNameRef.current(note));
    audioEngine.stopAllNotes();
    audioEngine.overrideSustain(false);
    resetKeyboardState();
    setActiveMouseNotes(new Set());
    setActiveMidiNotes(new Set());
  }, [isPortraitMobile, resetKeyboardState]);

  // Browsers keep audio suspended until a user gesture, so unlock on the first
  // one regardless of where it lands (a key, a toolbar button, the metronome).
  useEffect(() => {
    const unlockAudio = () => { void ensureAudioStarted(); };
    const options = { capture: true, once: true } as const;
    window.addEventListener('pointerdown', unlockAudio, options);
    window.addEventListener('keydown', unlockAudio, options);
    return () => {
      window.removeEventListener('pointerdown', unlockAudio, { capture: true });
      window.removeEventListener('keydown', unlockAudio, { capture: true });
    };
  }, [ensureAudioStarted]);

  // Browsers leave focus on whatever was clicked (a toolbar button, a select,
  // the volume slider), and keys aimed at a focused control are not played.
  // Remember the last click so a key press can hand focus back to the page.
  const lastPointerTargetRef = useRef<Element | null>(null);
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      lastPointerTargetRef.current = e.target instanceof Element ? e.target : null;
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, []);

  // Window event listeners (registered once)
  useEffect(() => {
    // True for a non-text control the pointer focused. A control reached with
    // the keyboard keeps its own keys (Enter, Space, arrows).
    const isClickFocusedControl = (target: EventTarget | null): target is HTMLElement => {
      const clicked = lastPointerTargetRef.current;
      return target instanceof HTMLElement && !isTextEntryTarget(target) && clicked !== null && target.contains(clicked);
    };
    const onKeyD = (e: KeyboardEvent) => {
      if (isInteractiveTarget(e.target)) {
        // Escape belongs to the open panel (it closes it), not to sustain.
        if (e.key === 'Escape' || !isClickFocusedControl(e.target)) return;
        e.target.blur();
      }
      // Block defaults on auto-repeat too: a held Tab would otherwise walk focus
      // onto a toolbar button, after which every key is ignored as interactive.
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'ControlLeft' || e.code === 'ControlRight') e.preventDefault();
      else if (currentKeyMapRef.current[e.code] || e.code.startsWith('F') || ['Tab', 'Quote', 'Slash', 'Space'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      handleKeyDownRef.current(e as globalThis.KeyboardEvent);
      playNoteByCodeRef.current(e.code);
    };
    const onKeyU = (e: KeyboardEvent) => {
      const wasPlaying = activeKeyParamsRef.current.has(e.code) || activeKeysRef.current.has(e.code);
      if (isInteractiveTarget(e.target) && !wasPlaying) return;
      handleKeyUpRef.current(e as globalThis.KeyboardEvent);
      stopNoteByCodeRef.current(e.code);
    };
    const handleBlur = () => {
      [...activeKeyParamsRef.current.keys()].forEach(code => stopNoteByCodeRef.current(code));
      [...activeMouseNotesRef.current].forEach(note => stopNoteByNameRef.current(note));
      audioEngine.stopAllNotes();
      audioEngine.overrideSustain(false);
      activeKeyParamsRef.current.clear();
      activeMouseNotesRef.current.clear();
      resetKeyboardState();
      setActiveMouseNotes(new Set());
      setActiveMidiNotes(new Set());
    };
    window.addEventListener('keydown', onKeyD); window.addEventListener('keyup', onKeyU); window.addEventListener('blur', handleBlur);
    return () => { window.removeEventListener('keydown', onKeyD); window.removeEventListener('keyup', onKeyU); window.removeEventListener('blur', handleBlur); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKeysRef, resetKeyboardState]);

  // MIDI file handlers
  const handleExportMidi = useCallback(() => {
    if (recordedEvents.length === 0) return;
    const blob = generateMidiFile(recordedEvents);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `KeyPiano_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.mid`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    // Revoking in the same tick can cancel the download before it starts.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [recordedEvents]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (isRecording) {
      setToast({ message: t.errors.importDuringRecording, variant: 'warning' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (!confirmDiscardUnsavedTake()) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    try {
      const events = parseMidiFile(await file.arrayBuffer());
      loadMidiEvents(events, pausePlayback);
      void saveImport(events, file.name);
    } catch {
      setToast({ message: t.errors.midiParseFailed, variant: 'error' });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [isRecording, confirmDiscardUnsavedTake, pausePlayback, loadMidiEvents, saveImport, setToast, t.errors.importDuringRecording, t.errors.midiParseFailed]);

  // ─── RENDER ──────────────────────────────────────────────────
  if (isPortraitMobile) {
    return (
      <div className={`h-screen w-screen ${theme.appBg}`}>
        <LandscapePrompt title={t.landscape.title} message={t.landscape.message} />
      </div>
    );
  }

  return (
    <div className={`h-screen w-screen ${theme.appBg} flex flex-col overflow-hidden font-sans select-none relative transition-colors duration-300`}>
      <input type="file" ref={fileInputRef} accept=".mid,.midi" onChange={handleFileChange} className="hidden" />
      {toast && <Toast message={toast.message} variant={toast.variant} dismissLabel={t.dismiss} onDismiss={() => setToast(null)} />}

      {isZenMode && (
        <button onClick={() => setIsZenMode(false)} className="absolute top-4 right-4 z-50 p-2 bg-black/50 text-white/50 hover:text-white rounded hover:bg-black/70 transition-colors backdrop-blur-md" title={t.exitZenMode} aria-label={t.exitZenMode}>
          <Minimize className="w-6 h-6" />
        </button>
      )}

      {!isZenMode && (
        <Toolbar
          isToolbarOpen={isToolbarOpen} setIsToolbarOpen={setIsToolbarOpen}
          isRecording={isRecording} isPlayingBack={isPlayingBack}
          recordedEvents={recordedEvents} elapsedTime={elapsedTime}
          toggleRecording={toggleRecording} togglePlayback={togglePlayback}
          stopAndReset={stopAndReset} changePlaybackSpeed={changePlaybackSpeed}
          playbackSpeed={playbackSpeed} isPracticeMode={isPracticeMode} setIsPracticeMode={setIsPracticeMode}
          isWaitMode={isWaitMode} setIsWaitMode={setIsWaitMode}
          showTakes={showTakes} setShowTakes={setShowTakes} takesButtonRef={takesButtonRef}
          mainView={mainView} setMainView={setMainView} showPiano={showPiano} setShowPiano={setShowPiano}
          isSustainPedalDown={isSustainPedalDown} isLgUp={isLgUp}
          onImportMidi={() => fileInputRef.current?.click()} onExportMidi={handleExportMidi}
          setShowInfo={setShowInfo} setShowSettings={setShowSettings} showSettings={showSettings}
          settingsButtonRef={settingsButtonRef} infoButtonRef={infoButtonRef}
        />
      )}

      <SettingsPanel
        show={showSettings}
        onClose={closeSettings}
        panelRef={settingsRef}
        keymapId={keymapId}
        setKeymapId={setKeymapId}
        settingsButtonRef={settingsButtonRef}
        midiStatus={midiStatus}
        midiInputCount={midiInputCount}
        requestMidiAccess={requestMidiAccess}
        isSampleSourceLocked={isRecording || isPlayingBack}
        useNumpadHints={useNumpadHints}
        setUseNumpadHints={setUseNumpadHints}
      />

      <TakesPanel
        show={showTakes}
        onClose={closeTakes}
        toggleButtonRef={takesButtonRef}
        takes={takes}
        currentTakeId={currentTakeId}
        isStorageAvailable={isStorageAvailable}
        isLocked={isRecording}
        onOpen={id => { if (confirmDiscardUnsavedTake()) void openTake(id); }}
        onDelete={id => { void deleteTake(id); }}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {octaveAdvice && !isPlayingBack && !isRecording && (
          <div role="status" aria-live="polite" className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 rounded-full bg-amber-700/90 px-4 py-1.5 text-xs text-white shadow-lg backdrop-blur-md">
            <span>
              {t.practiceRange.message
                .replace('{count}', String(octaveAdvice.unreachableNow))
                .replace('{octave}', formatOctave(octaveAdvice.octave))
                .replace('{after}', String(octaveAdvice.unreachableThen))}
            </span>
            <button type="button" onMouseDown={preventMouseFocus} onClick={() => setOctaveShift(octaveAdvice.octave)} className="rounded-full bg-white/15 px-2 py-0.5 hover:bg-white/30">
              {t.practiceRange.apply}
            </button>
          </div>
        )}
        {waitingRemaining !== null && (
          <div role="status" aria-live="polite" className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 rounded-full bg-purple-700/90 px-4 py-1.5 text-xs text-white shadow-lg backdrop-blur-md">
            <span>{t.waitMode.waiting.replace('{count}', String(waitingRemaining))}</span>
            <button type="button" onMouseDown={preventMouseFocus} onClick={skipWaitingNotes} className="rounded-full bg-white/15 px-2 py-0.5 hover:bg-white/30">
              {t.waitMode.skip}
            </button>
          </div>
        )}
        {mainView === 'stave' && <div className="flex-1 overflow-hidden relative bg-black/10"><StaveVisualizer triggerNotes={triggerNotes} theme={theme} /></div>}
        {mainView === 'keyboard' && (
          <div className={`flex-1 ${theme.keyboardBg} p-2 md:p-6 flex items-center justify-center overflow-hidden relative w-full transition-colors duration-300 min-h-0`}>
            <div className="grid gap-[3px] sm:gap-[4px] lg:gap-[5px] flex-shrink-0" style={{ gridTemplateColumns: 'repeat(92, 1fr)', gridTemplateRows: 'repeat(6, 1fr)', width: '100%', maxWidth: '1600px', aspectRatio: '23 / 6', maxHeight: '100%' }}>
              {ALL_ROWS.map((row, rowIdx) => (
                <React.Fragment key={rowIdx}>
                  {row.map((k, idx) => {
                    const baseNote = currentKeyMap[k.code];
                    let displayedNote = baseNote;
                    if (baseNote) {
                      const visualTemp = tempTranspose !== 0 ? tempTranspose : (isPlayingBack ? playbackTempTranspose : 0);
                      let eff = visualTemp;
                      if (k.code.startsWith('Numpad') || k.code.startsWith('Arrow') || ['Insert', 'Home', 'PageUp', 'Delete', 'End', 'PageDown'].includes(k.code)) eff = 0;
                      displayedNote = getTransposedNote(baseNote, transposeBase + (octaveShift * 12) + eff);
                    }
                    return (
                      <VirtualKey key={k.code + idx} {...k} note={displayedNote}
                        customLabel={k.code === 'Coffee' ? t.buyCoffee : k.customLabel}
                        description={t.keyDescriptions[k.code] ?? k.description}
                        playNoteTemplate={t.playNote}
                        isActive={activeKeys.has(k.code) || (!isPracticeMode && playbackKeys.has(k.code)) || (k.code === 'ShiftLeft' && (tempTranspose !== 0 ? tempTranspose : (isPlayingBack ? playbackTempTranspose : 0)) === 1) || (k.code === 'ControlLeft' && (tempTranspose !== 0 ? tempTranspose : (isPlayingBack ? playbackTempTranspose : 0)) === -1)}
                        guideLevel={isPracticeMode ? guideKeys.get(k.code) ?? 0 : 0}
                        onMouseDown={playNoteByCode} onMouseUp={stopNoteByCode} theme={theme}
                        isTabStop={focusedVirtualKeyCode === k.code}
                        onMoveFocus={moveVirtualKeyFocus}
                        registerKeyRef={registerVirtualKeyRef}
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
        {mainView === 'waterfall' && (
          <div className="flex-1 flex flex-col w-full relative overflow-hidden p-2">
            <WaterfallVisualizer recording={recordedEvents} currentTimeMs={elapsedTime} playbackSpeed={playbackSpeed} theme={theme} />
          </div>
        )}
      </div>

      {!isZenMode && <StatusBar pianoHeight={pianoHeight} setPianoHeight={setPianoHeight} showPiano={showPiano} isRecording={isRecording} isPlayingBack={isPlayingBack} />}

      {!isZenMode && showPiano && (
        <div className={`${theme.pianoBg} p-1 flex flex-col gap-1 shadow-[0_-5px_15px_rgba(0,0,0,0.5)] z-20 shrink-0 transition-all`} style={{ height: `${pianoHeight}px` }}>
          <PianoKeyboard activeNotes={pianoVisualNotes} guideNotes={isPracticeMode ? guideNotes : EMPTY_GUIDE} onPlayNote={playNoteByName} onStopNote={stopNoteByName} theme={theme} ariaLabel={t.pianoKeyboard} />
        </div>
      )}

      <InfoModal show={showInfo} onClose={closeInfo} returnFocusRef={infoButtonRef} />

      {isLoading && (
        <div
          role="status"
          aria-live="polite"
          className="absolute bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-black/70 px-3 py-2 text-xs text-white shadow-lg backdrop-blur-md pointer-events-none"
        >
          <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />
          <span>{t.loading}</span>
        </div>
      )}
    </div>
  );
};

// ─── Root App (provides contexts) ───────────────────────────────

const App: React.FC = () => {
  return (
    <SettingsProvider>
      <SynthProvider>
        <MetronomeProvider>
          <AppInner />
        </MetronomeProvider>
      </SynthProvider>
    </SettingsProvider>
  );
};

export default App;
