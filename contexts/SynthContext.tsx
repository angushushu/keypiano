import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { audioEngine, SustainLevel, InstrumentID, INSTRUMENTS } from '../services/audioEngine';
import { useSettings } from './SettingsContext';

interface SynthContextValue {
  isAudioStarted: boolean;
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
  currentInstrument: InstrumentID;
  selectedStartInstrument: InstrumentID;
  setSelectedStartInstrument: (id: InstrumentID) => void;
  handleInstrumentChange: (id: InstrumentID) => Promise<void>;
  startAudio: () => Promise<void>;
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

  const [isAudioStarted, setIsAudioStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentInstrument, setCurrentInstrument] = useState<InstrumentID>(initialPreferences.instrument);
  const [selectedStartInstrument, setSelectedStartInstrument] = useState<InstrumentID>(initialPreferences.instrument);
  const [toast, setToast] = useState<{ message: string; variant: 'warning' | 'error' | 'info' } | null>(null);

  const [transposeBase, setTransposeBase] = useState(0);
  const [octaveShift, setOctaveShift] = useState(0);
  const [masterVolume, setMasterVolume] = useState(initialPreferences.masterVolume);
  const [keyVelocity, setKeyVelocity] = useState(initialPreferences.keyVelocity);
  const [sustainLevel, setSustainLevel] = useState<SustainLevel>(initialPreferences.sustainLevel);

  const synthStateRef = useRef({ transposeBase, octaveShift });
  const instrumentRequestRef = useRef(0);

  useEffect(() => {
    synthStateRef.current = { transposeBase, octaveShift };
  }, [transposeBase, octaveShift]);

  useEffect(() => {
    audioEngine.setVolume(masterVolume);
    audioEngine.setSustainLevel(sustainLevel);
  }, [masterVolume, sustainLevel]);

  useEffect(() => {
    try {
      localStorage.setItem(SYNTH_STORAGE_KEY, JSON.stringify({
        instrument: selectedStartInstrument,
        masterVolume,
        keyVelocity,
        sustainLevel,
      }));
    } catch {
      // Preferences remain available for the current session.
    }
  }, [keyVelocity, masterVolume, selectedStartInstrument, sustainLevel]);

  const cycleSustain = useCallback(() => {
    const levels: SustainLevel[] = ['OFF', 'SHORT', 'LONG'];
    setSustainLevel(prev => levels[(levels.indexOf(prev) + 1) % levels.length]);
  }, []);

  const startAudio = useCallback(async () => {
    const requestId = ++instrumentRequestRef.current;
    setIsLoading(true);
    setToast(null);
    try {
      await audioEngine.init(selectedStartInstrument);
      if (requestId === instrumentRequestRef.current) {
        setCurrentInstrument(selectedStartInstrument);
        if (audioEngine.networkErrors.length > 0) {
          setToast({
            message: `${audioEngine.networkErrors.length} samples failed to load. Using pitch-shift fallback.`,
            variant: 'warning',
          });
        }
        setIsAudioStarted(true);
      }
    } catch {
      if (requestId === instrumentRequestRef.current) {
        setToast({ message: t.errors.audioInitFailed, variant: 'error' });
      }
    } finally {
      if (requestId === instrumentRequestRef.current) {
        setIsLoading(false);
      }
    }
  }, [selectedStartInstrument, t.errors.audioInitFailed]);

  const handleInstrumentChange = useCallback(async (id: InstrumentID) => {
    if (id === currentInstrument) return;
    const requestId = ++instrumentRequestRef.current;
    setIsLoading(true);
    setToast(null);
    try {
      await audioEngine.init(id);
      if (requestId === instrumentRequestRef.current) {
        setCurrentInstrument(id);
        setSelectedStartInstrument(id);
        if (audioEngine.networkErrors.length > 0) {
          setToast({
            message: `${audioEngine.networkErrors.length} samples failed to load. Using fallback.`,
            variant: 'warning',
          });
        }
      }
    } catch {
      if (requestId === instrumentRequestRef.current) {
        setToast({ message: t.errors.audioInitFailed, variant: 'error' });
      }
    } finally {
      if (requestId === instrumentRequestRef.current) {
        setIsLoading(false);
      }
    }
  }, [currentInstrument, t.errors.audioInitFailed]);

  const value = useMemo(() => ({
    isAudioStarted, isLoading, setIsLoading,
    currentInstrument, selectedStartInstrument, setSelectedStartInstrument,
    handleInstrumentChange, startAudio,
    transposeBase, setTransposeBase, octaveShift, setOctaveShift,
    masterVolume, setMasterVolume, keyVelocity, setKeyVelocity,
    sustainLevel, setSustainLevel, cycleSustain,
    synthStateRef, toast, setToast,
  }), [
    isAudioStarted, isLoading, currentInstrument, selectedStartInstrument,
    handleInstrumentChange, startAudio,
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
