import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { audioEngine, SustainLevel, InstrumentID, INSTRUMENTS } from '../services/audioEngine';
import { useSettings } from './SettingsContext';

interface SynthContextValue {
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
  currentInstrument: InstrumentID;
  handleInstrumentChange: (id: InstrumentID) => Promise<void>;
  /**
   * Resumes the audio context, which browsers keep suspended until a user
   * gesture. Must be called synchronously from that gesture. Idempotent:
   * it reuses the sample load already running since mount, and resolves to
   * true once notes can actually sound.
   */
  ensureAudioStarted: () => Promise<boolean>;
  transposeBase: number;
  setTransposeBase: (v: number | ((p: number) => number)) => void;
  octaveShift: number;
  setOctaveShift: (v: number | ((p: number) => number)) => void;
  masterVolume: number;
  setMasterVolume: (v: number) => void;
  keyVelocity: number;
  setKeyVelocity: (v: number) => void;
  sustainLevel: SustainLevel;
  setSustainLevel: (v: SustainLevel) => void;
  cycleSustain: () => void;
  synthStateRef: React.MutableRefObject<{ transposeBase: number; octaveShift: number }>;
  toast: { message: string; variant: 'warning' | 'error' | 'info' } | null;
  setToast: (v: { message: string; variant: 'warning' | 'error' | 'info' } | null) => void;
}

const SynthContext = createContext<SynthContextValue | null>(null);
const SYNTH_STORAGE_KEY = 'keypiano.synth.v1';

const isInstrumentID = (value: unknown): value is InstrumentID => (
  typeof value === 'string' && INSTRUMENTS.some(instrument => instrument.id === value)
);

const readSynthPreferences = () => {
  const fallback = {
    instrument: 'salamander' as InstrumentID,
    masterVolume: 0.8,
    keyVelocity: 100,
    sustainLevel: 'SHORT' as SustainLevel,
  };
  try {
    const parsed = JSON.parse(localStorage.getItem(SYNTH_STORAGE_KEY) ?? '{}') as Record<string, unknown>;
    return {
      instrument: isInstrumentID(parsed.instrument) ? parsed.instrument : fallback.instrument,
      masterVolume: typeof parsed.masterVolume === 'number'
        ? Math.max(0, Math.min(1, parsed.masterVolume))
        : fallback.masterVolume,
      keyVelocity: typeof parsed.keyVelocity === 'number'
        ? Math.max(0, Math.min(127, parsed.keyVelocity))
        : fallback.keyVelocity,
      sustainLevel: parsed.sustainLevel === 'OFF' || parsed.sustainLevel === 'LONG'
        ? parsed.sustainLevel
        : fallback.sustainLevel,
    };
  } catch {
    return fallback;
  }
};

export const SynthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useSettings();
  const [initialPreferences] = useState(readSynthPreferences);

  const [isLoading, setIsLoading] = useState(false);
  const [currentInstrument, setCurrentInstrument] = useState<InstrumentID>(initialPreferences.instrument);
  const [toast, setToast] = useState<{ message: string; variant: 'warning' | 'error' | 'info' } | null>(null);

  const [transposeBase, setTransposeBase] = useState(0);
  const [octaveShift, setOctaveShift] = useState(0);
  const [masterVolume, setMasterVolume] = useState(initialPreferences.masterVolume);
  const [keyVelocity, setKeyVelocity] = useState(initialPreferences.keyVelocity);
  const [sustainLevel, setSustainLevel] = useState<SustainLevel>(initialPreferences.sustainLevel);

  const synthStateRef = useRef({ transposeBase, octaveShift });
  const instrumentRequestRef = useRef(0);
  const loadPromiseRef = useRef<Promise<boolean> | null>(null);
  const currentInstrumentRef = useRef(currentInstrument);

  useEffect(() => {
    synthStateRef.current = { transposeBase, octaveShift };
  }, [transposeBase, octaveShift]);

  useEffect(() => {
    currentInstrumentRef.current = currentInstrument;
  }, [currentInstrument]);

  useEffect(() => {
    audioEngine.setVolume(masterVolume);
    audioEngine.setSustainLevel(sustainLevel);
  }, [masterVolume, sustainLevel]);

  useEffect(() => {
    try {
      localStorage.setItem(SYNTH_STORAGE_KEY, JSON.stringify({
        instrument: currentInstrument,
        masterVolume,
        keyVelocity,
        sustainLevel,
      }));
    } catch {
      // Preferences remain available for the current session.
    }
  }, [currentInstrument, keyVelocity, masterVolume, sustainLevel]);

  const cycleSustain = useCallback(() => {
    const levels: SustainLevel[] = ['OFF', 'SHORT', 'LONG'];
    setSustainLevel(prev => levels[(levels.indexOf(prev) + 1) % levels.length]);
  }, []);

  const loadInstrument = useCallback(async (id: InstrumentID): Promise<boolean> => {
    const requestId = ++instrumentRequestRef.current;
    setIsLoading(true);
    setToast(null);
    try {
      await audioEngine.init(id);
      if (requestId !== instrumentRequestRef.current) return false;
      setCurrentInstrument(id);
      if (audioEngine.networkErrors.length > 0) {
        setToast({
          message: t.errors.samplesFailed.replace('{count}', String(audioEngine.networkErrors.length)),
          variant: 'warning',
        });
      }
      return true;
    } catch {
      if (requestId === instrumentRequestRef.current) {
        setToast({ message: t.errors.audioInitFailed, variant: 'error' });
      }
      return false;
    } finally {
      if (requestId === instrumentRequestRef.current) {
        setIsLoading(false);
      }
    }
  }, [t.errors.audioInitFailed, t.errors.samplesFailed]);

  const startLoading = useCallback((id: InstrumentID) => {
    const loading = loadInstrument(id).then(ok => {
      // Let a later attempt retry after a failed download.
      if (!ok && loadPromiseRef.current === loading) loadPromiseRef.current = null;
      return ok;
    });
    loadPromiseRef.current = loading;
    return loading;
  }, [loadInstrument]);

  // Fetch and decode samples up front so the very first note is audible. This
  // needs no user gesture -- only resuming the context does.
  useEffect(() => {
    if (!loadPromiseRef.current) startLoading(currentInstrumentRef.current);
  }, [startLoading]);

  const ensureAudioStarted = useCallback((): Promise<boolean> => {
    audioEngine.unlock();
    return loadPromiseRef.current ?? startLoading(currentInstrumentRef.current);
  }, [startLoading]);

  const handleInstrumentChange = useCallback(async (id: InstrumentID) => {
    if (id === currentInstrumentRef.current && audioEngine.isLoaded) return;
    // Picking an instrument is a user gesture, so it can also unlock playback.
    audioEngine.unlock();
    await startLoading(id);
  }, [startLoading]);

  const value = useMemo(() => ({
    isLoading, setIsLoading,
    currentInstrument, handleInstrumentChange, ensureAudioStarted,
    transposeBase, setTransposeBase, octaveShift, setOctaveShift,
    masterVolume, setMasterVolume, keyVelocity, setKeyVelocity,
    sustainLevel, setSustainLevel, cycleSustain,
    synthStateRef, toast, setToast,
  }), [
    isLoading, currentInstrument, handleInstrumentChange, ensureAudioStarted,
    transposeBase, octaveShift, masterVolume, keyVelocity,
    sustainLevel, cycleSustain, toast,
  ]);

  return (
    <SynthContext.Provider value={value}>
      {children}
    </SynthContext.Provider>
  );
};

export function useSynth() {
  const ctx = useContext(SynthContext);
  if (!ctx) throw new Error('useSynth must be used within SynthProvider');
  return ctx;
}
