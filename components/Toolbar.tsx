import React, { useRef } from 'react';
import {
  Volume2, Keyboard, Activity, Loader2, Music,
  Circle, Square, Play, Pause, Timer, Info, ChevronDown, ChevronUp, RotateCcw,
  Download, FileUp, Settings, ScrollText, Piano, GraduationCap, Gauge, ArrowDownToLine, Maximize
} from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useSynth } from '../contexts/SynthContext';
import { useMetronome } from '../contexts/MetronomeContext';
import { INSTRUMENTS, InstrumentID } from '../services/audioEngine';
import { KeyPianoLogo } from './KeyPianoLogo';

const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5];

const formatTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return `${mins}:${secs.toString().padStart(2, '0')}.${tenths}`;
};

interface ToolbarProps {
  isToolbarOpen: boolean;
  setIsToolbarOpen: (v: boolean) => void;
  isRecording: boolean;
  isPlayingBack: boolean;
  recordedEvents: { length: number };
  elapsedTime: number;
  toggleRecording: () => void;
  togglePlayback: () => void;
  stopAndReset: () => void;
  changePlaybackSpeed: (speed: number) => void;
  playbackSpeed: number;
  isPracticeMode: boolean;
  setIsPracticeMode: (v: boolean | ((p: boolean) => boolean)) => void;
  mainView: string;
  setMainView: (v: 'stave' | 'keyboard' | 'waterfall') => void;
  showPiano: boolean;
  setShowPiano: (v: boolean) => void;
  isSustainPedalDown: boolean;
  isLgUp: boolean;
  onImportMidi: () => void;
  onExportMidi: () => void;
  setShowInfo: (v: boolean) => void;
  setShowSettings: (v: boolean) => void;
  showSettings: boolean;
  settingsButtonRef: React.RefObject<HTMLButtonElement>;
}

const Toolbar: React.FC<ToolbarProps> = ({
  isToolbarOpen, setIsToolbarOpen,
  isRecording, isPlayingBack, recordedEvents, elapsedTime,
  toggleRecording, togglePlayback, stopAndReset,
  changePlaybackSpeed, playbackSpeed,
  isPracticeMode, setIsPracticeMode,
  mainView, setMainView, showPiano, setShowPiano,
  isSustainPedalDown, isLgUp,
  onImportMidi, onExportMidi,
  setShowInfo, setShowSettings, showSettings,
  settingsButtonRef,
}) => {
  const { theme, t, isLightTheme, setIsZenMode } = useSettings();
  const { currentInstrument, handleInstrumentChange, masterVolume, setMasterVolume, isAudioStarted, isLoading } = useSynth();
  const { isMetronomeOn, setIsMetronomeOn, bpm, setBpm, metronomeSound, setMetronomeSound, METRONOME_SOUNDS } = useMetronome();

  return (
    <div className={`${theme.toolbarBg} ${theme.toolbarBorder} flex flex-col md:flex-row md:items-center border-b shadow-md z-40 shrink-0 transition-colors duration-300 relative`}>
      <div className="flex items-center justify-between p-2 md:p-0 w-full md:w-auto md:border-r border-gray-700 md:mr-2">
        <div className="flex items-center gap-2 text-yellow-500 font-bold md:px-4">
          <KeyPianoLogo className="w-5 h-5" />
          <span className="inline">{t.title}</span>
          {isSustainPedalDown && <div className="ml-1 w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_5px_cyan]" title="Sustain Pedal Active"></div>}
        </div>
        <button
          onClick={() => setIsToolbarOpen(!isToolbarOpen)}
          className={`md:hidden p-1.5 rounded transition-colors ${theme.toolbarText} hover:bg-gray-700/30`}
        >
          {isToolbarOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

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
                {(t.instruments)[inst.id] || inst.name} {inst.type === 'gm' ? t.instruments.gm_suffix : t.instruments.custom_suffix}
              </option>
            ))}
          </select>
        </div>

        {/* Master Volume */}
        <div className={`flex items-center gap-2 shrink-0 ${theme.panelBg} ${theme.panelBorder} px-2 py-1 rounded border`}>
          <Volume2 className={`w-4 h-4 ${masterVolume > 0 ? 'text-green-500' : 'text-gray-500'}`} />
          <input
            type="range" min="0" max="1" step="0.01" value={masterVolume}
            onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
            className="w-16 md:w-24 h-2 bg-black rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-green-400"
            title="Master Output Volume"
          />
          <span className={`text-[10px] font-mono w-8 text-right ${isLightTheme ? 'text-black' : 'text-gray-300'}`}>
            {Math.round(masterVolume * 100)}%
          </span>
        </div>

        {/* Metronome */}
        <div className={`flex items-center gap-3 shrink-0 ${theme.panelBg} ${theme.panelBorder} px-2 py-1 rounded border`}>
          <button onClick={() => setIsMetronomeOn(prev => !prev)} className={`transition-colors p-1 rounded-full ${isMetronomeOn ? 'bg-cyan-900/50 text-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}>
            {isMetronomeOn ? <Activity className="w-4 h-4" /> : <Timer className="w-4 h-4" />}
          </button>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 font-bold font-mono">{t.controls.bpm}</span>
              <input type="number" min="40" max="240" value={bpm} onChange={(e) => setBpm(Math.max(40, Math.min(240, parseInt(e.target.value) || 120)))}
                className={`text-[10px] w-10 text-center rounded border outline-none ${isLightTheme ? 'bg-gray-200 text-black border-gray-300' : 'bg-black/50 text-white border-gray-700'}`} />
              <select value={metronomeSound} onChange={(e) => setMetronomeSound(e.target.value as any)} className={`text-[10px] h-4 ml-1 rounded outline-none border cursor-pointer ${isLightTheme ? 'bg-gray-100 text-black border-gray-300' : 'bg-black text-gray-300 border-gray-600'}`}>
                {METRONOME_SOUNDS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Recorder & MIDI Actions Combined */}
        <div className={`flex items-center gap-2 shrink-0 ${theme.panelBg} ${theme.panelBorder} px-2 py-1 rounded border`}>
          <div className="flex items-center gap-1 border-r border-gray-500/30 pr-2 mr-1">
            <button onClick={onImportMidi} className="p-1.5 rounded text-blue-400 hover:bg-gray-700 hover:text-white" title={t.importMidi}>
              <FileUp className="w-3.5 h-3.5" />
            </button>
            <button onClick={onExportMidi} disabled={recordedEvents.length === 0} className="p-1.5 rounded text-green-400 hover:bg-gray-700 hover:text-white disabled:opacity-30" title={t.exportMidi}>
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>

          <button onClick={toggleRecording} className={`p-1.5 rounded-full transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-red-500 hover:bg-red-900/50'}`} title={t.record}>
            {isRecording ? <Square className="w-3 h-3 fill-current" /> : <Circle className="w-3 h-3 fill-current" />}
          </button>
          <button onClick={togglePlayback} disabled={isRecording || recordedEvents.length === 0} className={`p-1.5 rounded-full transition-all ${isPlayingBack ? 'bg-yellow-500 text-black' : 'text-green-500 hover:bg-green-900/50 disabled:opacity-30'}`} title={t.playPause}>
            {isPlayingBack ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
          </button>
          <button onClick={stopAndReset} className={`p-1.5 rounded-full text-gray-500 hover:text-white hover:bg-gray-700`} title="Stop / Reset">
            <RotateCcw className="w-3 h-3" />
          </button>
          <div className={`px-1 font-mono text-xs font-bold min-w-[50px] text-center transition-colors ${isRecording ? 'text-red-500' : isPlayingBack ? 'text-green-500' : elapsedTime > 0 ? 'text-yellow-500' : 'text-gray-500'}`}>{formatTime(elapsedTime)}</div>
        </div>

        {/* View Toggles & Practice Mode */}
        <div className={`flex items-center gap-1 ${theme.panelBg} ${theme.panelBorder} px-1 py-1 rounded border`}>
          <div className="flex items-center text-[10px] text-gray-500 px-1 font-bold">{t.view}:</div>
          <button onClick={() => setMainView('stave')} className={`p-1.5 rounded ${mainView === 'stave' ? 'bg-yellow-600 text-white' : 'text-gray-500 hover:bg-gray-700 hover:text-gray-300'}`} title={t.toggleStave}>
            <ScrollText className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setMainView('keyboard')} className={`p-1.5 rounded ${mainView === 'keyboard' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-700 hover:text-gray-300'}`} title={t.toggleKeyboard}>
            <Keyboard className="w-3.5 h-3.5" />
          </button>
          {isLgUp && (
            <button onClick={() => setMainView('waterfall')} className={`p-1.5 rounded ${mainView === 'waterfall' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-700 hover:text-gray-300'}`} title="Toggle Waterfall">
              <ArrowDownToLine className="w-3.5 h-3.5" />
            </button>
          )}
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
        <button onClick={() => setIsZenMode(true)} className={`p-2 rounded hover:bg-gray-700 transition-colors ${theme.toolbarText}`} title="Zen Mode">
          <Maximize className="w-5 h-5" />
        </button>
        <button onClick={() => setShowInfo(true)} className={`p-2 rounded hover:bg-gray-700 transition-colors ${theme.toolbarText}`} title={t.aboutTitle}>
          <Info className="w-5 h-5" />
        </button>
        <div className="relative">
          <button ref={settingsButtonRef} onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded hover:bg-gray-700 transition-colors ${showSettings ? 'bg-gray-700 text-white' : theme.toolbarText}`} aria-label="Settings" aria-expanded={showSettings}><Settings className="w-5 h-5" /></button>
        </div>
      </div>
    </div>
  );
};

export default Toolbar;
