import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { audioEngine, MetronomeSound, METRONOME_SOUNDS } from '../services/audioEngine';
import { useSynth } from './SynthContext';

interface MetronomeContextValue {
  isMetronomeOn: boolean;
  setIsMetronomeOn: (v: boolean | ((p: boolean) => boolean)) => void;
  bpm: number;
  setBpm: (v: number) => void;
  metronomeSound: MetronomeSound;
  setMetronomeSound: (v: MetronomeSound) => void;
  METRONOME_SOUNDS: typeof METRONOME_SOUNDS;
}

const MetronomeContext = createContext<MetronomeContextValue | null>(null);

export const MetronomeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAudioStarted } = useSynth();

  const [isMetronomeOn, setIsMetronomeOn] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [metronomeSound, setMetronomeSound] = useState<MetronomeSound>('beep');

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

  const value = useMemo(() => ({
    isMetronomeOn, setIsMetronomeOn,
    bpm, setBpm,
    metronomeSound, setMetronomeSound,
    METRONOME_SOUNDS,
  }), [isMetronomeOn, bpm, metronomeSound]);

  return (
    <MetronomeContext.Provider value={value}>
      {children}
    </MetronomeContext.Provider>
  );
};

export function useMetronome() {
  const ctx = useContext(MetronomeContext);
  if (!ctx) throw new Error('useMetronome must be used within MetronomeProvider');
  return ctx;
}
