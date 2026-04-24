import React from 'react';
import { Activity, Loader2, Music } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useSynth } from '../contexts/SynthContext';
import { INSTRUMENTS } from '../services/audioEngine';
import { KeyPianoLogo } from './KeyPianoLogo';

const StartScreen: React.FC = () => {
  const { theme, themeId, t } = useSettings();
  const { isAudioStarted, isLoading, selectedStartInstrument, setSelectedStartInstrument, startAudio } = useSynth();

  if (!isAudioStarted) {
    return (
      <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center ${theme.appBg} p-4 transition-colors duration-300`}>
        <div className="flex flex-col items-center max-w-md w-full gap-8">
          <div className="flex flex-col items-center gap-2">
            <div className="p-4 bg-yellow-500/10 rounded-full mb-2"><KeyPianoLogo className="w-16 h-16 text-yellow-500" /></div>
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
                <select value={selectedStartInstrument} onChange={(e) => setSelectedStartInstrument(e.target.value as any)} className={`w-full ${themeId === 'light' ? 'bg-gray-100 text-black border-gray-300' : 'bg-[#18181b] text-white border-[#3f3f46]'} p-3 rounded-lg border focus:border-yellow-500 outline-none`}>
                  {INSTRUMENTS.map(inst => (<option key={inst.id} value={inst.id}>{(t.instruments)[inst.id] || inst.name} {inst.type === 'gm' ? t.instruments.gm_suffix : t.instruments.custom_suffix}</option>))}
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
    );
  }

  if (isLoading) {
    return (
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm"><Loader2 className="w-10 h-10 text-yellow-500 animate-spin" /></div>
    );
  }

  return null;
};

export default StartScreen;
