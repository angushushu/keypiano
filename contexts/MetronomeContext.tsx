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

const readMetronomePreferences = (): { bpm: number; sound: MetronomeSound } => {
  try {
    const parsed = JSON.parse(localStorage.getItem('keypiano.metronome.v1') ?? '{}') as Record<string, unknown>;
    const bpm = typeof parsed.bpm === 'number' ? Math.max(40, Math.min(240, parsed.bpm)) : 120;
    const sound = METRONOME_SOUNDS.some(item => item.id === parsed.sound)
      ? parsed.sound as MetronomeSound
      : 'beep';
    return { bpm, sound };
  } catch {
    return { bpm: 120, sound: 'beep' };
  }
};

export const MetronomeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAudioStarted } = useSynth();
  const [initialPreferences] = useState(readMetronomePreferences);

  const [isMetronomeOn, setIsMetronomeOn] = useState(false);
  const [bpm, setBpm] = useState(initialPreferences.bpm);
  const [metronomeSound, setMetronomeSound] = useState<MetronomeSound>(initialPreferences.sound);

  useEffect(() => {
    if (isAudioStarted) {
      audioEngine.setBPM(bpm);
      if (isMetronomeOn) audioEngine.startMetronome(bpm);
      else audioEngine.stopMetronome();
    }
  }, [isMetronomeOn, bpm, isAudioStarted]);

  useEffect(() => {
    audioEngine.setMetronomeSound(metronomeSound);
    try {
      localStorage.setItem('keypiano.metronome.v1', JSON.stringify({ bpm, sound: metronomeSound }));
    } catch {
      // Preferences remain available for the current session.
    }
  }, [bpm, metronomeSound]);

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
