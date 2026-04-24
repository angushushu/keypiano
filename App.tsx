import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import VirtualKey from './components/VirtualKey';
import PianoKeyboard from './components/PianoKeyboard';
import StaveVisualizer, { NoteType } from './components/StaveVisualizer';
import WaterfallVisualizer from './components/WaterfallVisualizer';
import LandscapePrompt from './components/LandscapePrompt';
import Toast from './components/Toast';
import Toolbar from './components/Toolbar';
import StatusBar from './components/StatusBar';
import SettingsPanel from './components/SettingsPanel';
import InfoModal from './components/InfoModal';
import StartScreen from './components/StartScreen';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { SynthProvider, useSynth } from './contexts/SynthContext';
import { MetronomeProvider } from './contexts/MetronomeContext';
import { audioEngine, SustainLevel } from './services/audioEngine';
import { generateMidiFile, parseMidiFile } from './services/midiIO';
import {
  ALL_ROWS,
  getTransposedNote,
  KEYMAP_PRESETS,
  KeymapID
} from './constants';
import { Minimize } from 'lucide-react';
import { RecordedEvent } from './types';
import { useMidiDevice } from './hooks/useMidiDevice';
import { useAudioScheduler } from './hooks/useAudioScheduler';
import { useKeyboardInput } from './hooks/useKeyboardInput';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useRecordingState } from './hooks/useRecordingState';

// ─── Inner App (consumes contexts) ──────────────────────────────

const MAX_TRIGGER_NOTES = 500;

const AppInner: React.FC = () => {
  const { theme, isLightTheme, isZenMode, setIsZenMode } = useSettings();
  const {
    isAudioStarted, isLoading, currentInstrument, keyVelocity,
    transposeBase, setTransposeBase, octaveShift, setOctaveShift,
    sustainLevel, cycleSustain, synthStateRef, toast, setToast,
  } = useSynth();

  // View state
  const [mainView, setMainView] = useState<'stave' | 'keyboard' | 'waterfall'>('keyboard');
  const [showPiano, setShowPiano] = useState(true);
  const [pianoHeight, setPianoHeight] = useState(180);
  const [isToolbarOpen, setIsToolbarOpen] = useState(true);
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  // UI panels
  const [showInfo, setShowInfo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const [triggerNotes, setTriggerNotesRaw] = useState<{ note: string; time: number; type: NoteType }[]>([]);
  const setTriggerNotes = useCallback((updater: (prev: { note: string; time: number; type: NoteType }[]) => { note: string; time: number; type: NoteType }[]) => {
    setTriggerNotesRaw(prev => {
      const next = updater(prev);
      return next.length > MAX_TRIGGER_NOTES ? next.slice(next.length - MAX_TRIGGER_NOTES) : next;
    });
  }, []);
  const [playbackKeys, setPlaybackKeys] = useState<Set<string>>(new Set());
  const [playbackNotes, setPlaybackNotes] = useState<Set<string>>(new Set());
  const [upcomingKeys, setUpcomingKeys] = useState<Set<string>>(new Set());
  const [upcomingNotes, setUpcomingNotes] = useState<Set<string>>(new Set());
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
  const { activeKeys, setActiveKeys, keymapId, setKeymapId, currentKeyMap, tempTranspose, handleKeyDown, handleKeyUp, getEffectiveTranspose, activeKeysRef } = useKeyboardInput('freepiano');

  // Fingering maps
  const { leftHandMap, rightHandMap, noteToKeyMap } = useMemo(() => {
    const l = new Map<string, string>(), r = new Map<string, string>(), full = new Map<string, string>();
    Object.entries(currentKeyMap).forEach(([code, note]: [string, string]) => {
      const isNumpad = code.startsWith('Numpad');
      if (isNumpad || code.startsWith('Arrow') || ['Insert', 'Home', 'PageUp', 'Delete', 'End', 'PageDown'].includes(code)) { if (!r.has(note) || isNumpad) r.set(note, code); }
      else { if (!l.has(note)) l.set(note, code); }
      if (!full.has(note) || (isNumpad && !full.get(note)!.startsWith('Numpad'))) full.set(note, code);
    });
    return { leftHandMap: l, rightHandMap: r, noteToKeyMap: full };
  }, [currentKeyMap]);

  // Playback clear helper
  const clearPlaybackVisuals = useCallback(() => { setPlaybackKeys(new Set()); setPlaybackNotes(new Set()); setUpcomingKeys(new Set()); setUpcomingNotes(new Set()); }, []);

  // Audio scheduler
  const { isPlayingBack, togglePlayback, pausePlayback, changePlaybackSpeedAnchor } = useAudioScheduler({
    recordingRef, isPracticeMode, playbackSpeed,
    leftHandMap, rightHandMap, noteToKeyMap,
    setPlaybackKeys, setPlaybackNotes, setTriggerNotes, setPlaybackTempTranspose,
    setUpcomingKeys, setUpcomingNotes, setElapsedTime: (t: number) => recordingDispatch({ type: 'SET_ELAPSED', elapsed: t }), elapsedTime,
  });

  // MIDI device hook
  const { isSustainPedalDown } = useMidiDevice({
    currentInstrument, isRecording, recordingStartTime,
    addRecordingEvent, setTriggerNotes, setActiveMidiNotes,
  });

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

  const playNoteByCode = useCallback((code: string) => {
    if (['Escape', 'Coffee'].includes(code) || code.startsWith('F')) handleFunctionKey(code);
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
        recordingRef.current.push({ time: Date.now() - recordingStartTime, type: 'on', note, code, transpose: totalTranspose, instrumentId: currentInstrument, velocity: vel });
      }
    }
    setActiveKeys(prev => { const n = new Set(prev); n.add(code); return n; });
  }, [isRecording, recordingStartTime, currentInstrument, keyVelocity, currentKeyMap, getEffectiveTranspose, synthStateRef, setActiveKeys, setTriggerNotes]);

  const stopNoteByCode = useCallback((code: string) => {
    const activeParams = activeKeyParamsRef.current.get(code);
    if (activeParams) {
      audioEngine.stopNote(activeParams.note, activeParams.transpose);
      activeKeyParamsRef.current.delete(code);
      if (isRecording) {
        recordingRef.current.push({ time: Date.now() - recordingStartTime, type: 'off', note: activeParams.note, code, transpose: activeParams.transpose, instrumentId: currentInstrument });
      }
    } else {
      const note = currentKeyMap[code];
      if (note) audioEngine.stopNote(note, synthStateRef.current.transposeBase + (synthStateRef.current.octaveShift * 12));
    }
    setActiveKeys(prev => { const n = new Set(prev); n.delete(code); return n; });
  }, [isRecording, recordingStartTime, currentInstrument, currentKeyMap, synthStateRef, setActiveKeys]);

  const playNoteByName = useCallback((noteName: string) => { audioEngine.playNote(noteName, 0, keyVelocity); setTriggerNotes(prev => [...prev, { note: noteName, time: Date.now(), type: 'user' }]); setActiveMouseNotes(prev => new Set(prev).add(noteName)); }, [keyVelocity, setTriggerNotes]);
  const stopNoteByName = useCallback((noteName: string) => { audioEngine.stopNote(noteName, 0); setActiveMouseNotes(prev => { const s = new Set(prev); s.delete(noteName); return s; }); }, []);

  // Function key handler
  const handleFunctionKey = (code: string) => {
    const actions: Record<string, () => void> = {
      'Escape': cycleSustain,
      'F1': () => setOctaveShift(o => Math.max(-3, o - 1)),
      'F2': () => setOctaveShift(o => Math.min(3, o + 1)),
      'F3': () => setTransposeBase(t => t - 1),
      'F4': () => setTransposeBase(t => t + 1),
      'F5': () => {},
      'F6': () => {},
      'F7': () => {},
      'F8': () => setMainView(prev => prev === 'stave' ? 'keyboard' : 'stave'),
      'F9': togglePlayback,
      'F10': () => toggleRecording(),
      'F11': () => stopAndReset(),
      'F12': () => { setTransposeBase(0); setOctaveShift(0); audioEngine.stopAllNotes(); },
      'Coffee': () => window.open('https://paypal.me/angushushu', '_blank')
    };
    if ((isRecording || isPlayingBack) && ['F1', 'F2', 'F3', 'F4'].includes(code)) return;
    if (actions[code]) actions[code]();
  };

  // Recording actions
  const stopAndReset = useCallback(() => {
    recordingStopAndReset(pausePlayback);
  }, [recordingStopAndReset, pausePlayback]);

  const toggleRecording = useCallback(() => {
    recordingToggle(clearPlaybackVisuals, pausePlayback);
  }, [recordingToggle, clearPlaybackVisuals, pausePlayback]);

  const changePlaybackSpeed = useCallback((newSpeed: number) => {
    changePlaybackSpeedAnchor(newSpeed);
    setPlaybackSpeed(newSpeed);
  }, [changePlaybackSpeedAnchor]);

  // Stable refs for event listeners
  const playNoteByCodeRef = useRef(playNoteByCode);
  const stopNoteByCodeRef = useRef(stopNoteByCode);
  const handleKeyDownRef = useRef(handleKeyDown);
  const handleKeyUpRef = useRef(handleKeyUp);
  const currentKeyMapRef = useRef(currentKeyMap);
  useEffect(() => { playNoteByCodeRef.current = playNoteByCode; }, [playNoteByCode]);
  useEffect(() => { stopNoteByCodeRef.current = stopNoteByCode; }, [stopNoteByCode]);
  useEffect(() => { handleKeyDownRef.current = handleKeyDown; }, [handleKeyDown]);
  useEffect(() => { handleKeyUpRef.current = handleKeyUp; }, [handleKeyUp]);
  useEffect(() => { currentKeyMapRef.current = currentKeyMap; }, [currentKeyMap]);

  // Window event listeners (registered once)
  useEffect(() => {
    const onKeyD = (e: KeyboardEvent) => { if (e.repeat) return; if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'ControlLeft' || e.code === 'ControlRight') e.preventDefault(); else if (currentKeyMapRef.current[e.code] || e.code.startsWith('F') || ['Tab', 'Quote', 'Slash', 'Space'].includes(e.code)) e.preventDefault(); handleKeyDownRef.current(e as globalThis.KeyboardEvent); playNoteByCodeRef.current(e.code); };
    const onKeyU = (e: KeyboardEvent) => { handleKeyUpRef.current(e as globalThis.KeyboardEvent); stopNoteByCodeRef.current(e.code); };
    const handleBlur = () => { activeKeysRef.current.forEach(code => stopNoteByCodeRef.current(code)); setActiveMouseNotes(new Set()); };
    window.addEventListener('keydown', onKeyD); window.addEventListener('keyup', onKeyU); window.addEventListener('blur', handleBlur);
    return () => { window.removeEventListener('keydown', onKeyD); window.removeEventListener('keyup', onKeyU); window.removeEventListener('blur', handleBlur); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // MIDI file handlers
  const handleExportMidi = useCallback(() => {
    if (recordedEvents.length === 0) return;
    const blob = generateMidiFile(recordedEvents);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `KeyPiano_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.mid`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }, [recordedEvents]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const events = parseMidiFile(await file.arrayBuffer());
      loadMidiEvents(events, pausePlayback);
    } catch {
      setToast({ message: 'Failed to parse MIDI file.', variant: 'error' });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [pausePlayback, loadMidiEvents, setToast]);

  // ─── RENDER ──────────────────────────────────────────────────
  return (
    <div className={`h-screen w-screen ${theme.appBg} flex flex-col overflow-hidden font-sans select-none relative transition-colors duration-300`}>
      <input type="file" ref={fileInputRef} accept=".mid,.midi" onChange={handleFileChange} className="hidden" />
      {isPortraitMobile && <LandscapePrompt title="" message="" />}

      {toast && <Toast message={toast.message} variant={toast.variant} onDismiss={() => setToast(null)} />}

      {isZenMode && (
        <button onClick={() => setIsZenMode(false)} className="absolute top-4 right-4 z-50 p-2 bg-black/50 text-white/50 hover:text-white rounded hover:bg-black/70 transition-colors backdrop-blur-md" title="Exit Zen Mode">
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
          mainView={mainView} setMainView={setMainView} showPiano={showPiano} setShowPiano={setShowPiano}
          isSustainPedalDown={isSustainPedalDown} isLgUp={isLgUp}
          onImportMidi={() => fileInputRef.current?.click()} onExportMidi={handleExportMidi}
          setShowInfo={setShowInfo} setShowSettings={setShowSettings} showSettings={showSettings}
          settingsButtonRef={settingsButtonRef}
        />
      )}

      <SettingsPanel show={showSettings} onClose={() => setShowSettings(false)} panelRef={settingsRef} keymapId={keymapId} setKeymapId={setKeymapId} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
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
                        customLabel={k.code === 'Coffee' ? '☕ Buy me a Coffee' : k.customLabel}
                        isActive={activeKeys.has(k.code) || (!isPracticeMode && playbackKeys.has(k.code)) || (k.code === 'ShiftLeft' && (tempTranspose !== 0 ? tempTranspose : (isPlayingBack ? playbackTempTranspose : 0)) === 1) || (k.code === 'ControlLeft' && (tempTranspose !== 0 ? tempTranspose : (isPlayingBack ? playbackTempTranspose : 0)) === -1)}
                        isPlaybackActive={isPracticeMode && playbackKeys.has(k.code)} isUpcoming={isPracticeMode && upcomingKeys.has(k.code)}
                        onMouseDown={playNoteByCode} onMouseUp={stopNoteByCode} theme={theme}
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
          <PianoKeyboard activeNotes={pianoVisualNotes} playbackNotes={isPracticeMode ? playbackNotes : new Set()} upcomingNotes={isPracticeMode ? upcomingNotes : new Set()} onPlayNote={playNoteByName} onStopNote={stopNoteByName} theme={theme} />
        </div>
      )}

      <InfoModal show={showInfo} onClose={() => setShowInfo(false)} />
      <StartScreen />
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
