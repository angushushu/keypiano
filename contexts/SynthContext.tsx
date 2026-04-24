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
  startAudio: () => void;
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

export const SynthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useSettings();

  const [isAudioStarted, setIsAudioStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentInstrument, setCurrentInstrument] = useState<InstrumentID>('salamander');
  const [selectedStartInstrument, setSelectedStartInstrument] = useState<InstrumentID>('salamander');
  const [toast, setToast] = useState<{ message: string; variant: 'warning' | 'error' | 'info' } | null>(null);

  const [transposeBase, setTransposeBase] = useState(0);
  const [octaveShift, setOctaveShift] = useState(0);
  const [masterVolume, setMasterVolume] = useState(0.8);
  const [keyVelocity, setKeyVelocity] = useState(100);
  const [sustainLevel, setSustainLevel] = useState<SustainLevel>('SHORT');

  const synthStateRef = useRef({ transposeBase, octaveShift });

  useEffect(() => {
    synthStateRef.current = { transposeBase, octaveShift };
  }, [transposeBase, octaveShift]);

  useEffect(() => {
    audioEngine.setVolume(masterVolume);
    audioEngine.setSustainLevel(sustainLevel);
  }, [masterVolume, sustainLevel]);

  const cycleSustain = useCallback(() => {
    const levels: SustainLevel[] = ['OFF', 'SHORT', 'LONG'];
    setSustainLevel(prev => levels[(levels.indexOf(prev) + 1) % levels.length]);
  }, []);

  const initInstrument = useCallback(async (id: InstrumentID) => {
    setIsLoading(true);
    setToast(null);
    try {
      await audioEngine.init(id);
      setCurrentInstrument(id);
      if (audioEngine.networkErrors.length > 0) {
        setToast({
          message: `${audioEngine.networkErrors.length} samples failed to load. Using pitch-shift fallback.`,
          variant: 'warning',
        });
      }
      setIsAudioStarted(true);
    } catch {
      setToast({ message: t.errors.audioInitFailed, variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [t.errors.audioInitFailed]);

  const startAudio = useCallback(() => {
    setIsLoading(true);
    setTimeout(async () => {
      try {
        await audioEngine.init(selectedStartInstrument);
        setCurrentInstrument(selectedStartInstrument);
        if (audioEngine.networkErrors.length > 0) {
          setToast({
            message: `${audioEngine.networkErrors.length} samples failed to load. Using pitch-shift fallback.`,
            variant: 'warning',
          });
        }
        setIsAudioStarted(true);
      } catch {
        setToast({ message: t.errors.audioInitFailed, variant: 'error' });
      } finally {
        setIsLoading(false);
      }
    }, 50);
  }, [selectedStartInstrument, t.errors.audioInitFailed]);

  const handleInstrumentChange = useCallback(async (id: InstrumentID) => {
    if (id === currentInstrument) return;
    setIsLoading(true);
    setToast(null);
    setCurrentInstrument(id);
    setTimeout(async () => {
      try {
        await audioEngine.init(id);
        if (audioEngine.networkErrors.length > 0) {
          setToast({
            message: `${audioEngine.networkErrors.length} samples failed to load. Using fallback.`,
            variant: 'warning',
          });
        }
      } catch {
        setToast({ message: t.errors.audioInitFailed, variant: 'error' });
      } finally {
        setIsLoading(false);
      }
    }, 50);
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
