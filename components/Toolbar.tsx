import React from 'react';
import {
  Volume2, Keyboard, Activity, Music,
  Circle, Square, Play, Pause, Timer, Info, ChevronDown, ChevronUp, RotateCcw,
  Download, FileUp, Settings, ScrollText, Piano, GraduationCap, Gauge, ArrowDownToLine, Maximize,
  History, Hourglass, ListMusic
} from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useSynth } from '../contexts/SynthContext';
import { useMetronome } from '../contexts/MetronomeContext';
import { INSTRUMENTS, InstrumentID, MAX_MASTER_VOLUME, MetronomeSound } from '../services/audioEngine';
import { KeyPianoLogo } from './KeyPianoLogo';
import type { MainView } from '../types';

const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5];

const isInstrumentID = (value: string): value is InstrumentID => (
  INSTRUMENTS.some(inst => inst.id === value)
);

export const preventMouseFocus = (event: Pick<React.MouseEvent, 'preventDefault'>) => {
  event.preventDefault();
};

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
  isPracticePreparing: boolean;
  practicePreparationLabel: string;
  stopAndReset: () => void;
  changePlaybackSpeed: (speed: number) => void;
  playbackSpeed: number;
  isPracticeMode: boolean;
  setIsPracticeMode: (v: boolean | ((p: boolean) => boolean)) => void;
  isWaitMode: boolean;
  setIsWaitMode: (v: boolean) => void;
  showTakes: boolean;
  setShowTakes: (v: boolean) => void;
  takesButtonRef: React.RefObject<HTMLButtonElement>;
  mainView: MainView;
  setMainView: (v: MainView) => void;
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
  infoButtonRef: React.RefObject<HTMLButtonElement>;
}

const Toolbar: React.FC<ToolbarProps> = ({
  isToolbarOpen, setIsToolbarOpen,
  isRecording, isPlayingBack, recordedEvents, elapsedTime,
  toggleRecording, togglePlayback, stopAndReset, isPracticePreparing, practicePreparationLabel,
  changePlaybackSpeed, playbackSpeed,
  isPracticeMode, setIsPracticeMode,
  isWaitMode, setIsWaitMode,
  showTakes, setShowTakes, takesButtonRef,
  mainView, setMainView, showPiano, setShowPiano,
  isSustainPedalDown, isLgUp,
  onImportMidi, onExportMidi,
  setShowInfo, setShowSettings, showSettings,
  settingsButtonRef, infoButtonRef,
}) => {
  const { theme, t, setIsZenMode } = useSettings();
  // Controls have no hue of their own: at rest they use the text colour, and
  // only a switched-on control takes the theme's accent.
  const controlClass = (isOn: boolean) => (isOn ? theme.controlOn : theme.controlOff);
  const { currentInstrument, handleInstrumentChange, masterVolume, setMasterVolume, isLoading } = useSynth();
  const { isMetronomeOn, setIsMetronomeOn, bpm, setBpm, metronomeSound, setMetronomeSound, METRONOME_SOUNDS } = useMetronome();
  const isMetronomeSound = (value: string): value is MetronomeSound => (
    METRONOME_SOUNDS.some(sound => sound.id === value)
  );

  return (
    <div className={`${theme.toolbarBg} ${theme.toolbarBorder} flex flex-col 2xl:flex-row 2xl:items-center border-b shadow-md z-40 shrink-0 transition-colors duration-300 relative`}>
      <div className={`flex items-center justify-between p-2 2xl:p-0 w-full 2xl:w-auto 2xl:border-r ${theme.toolbarBorder} 2xl:mr-2`}>
        <div className={`flex items-center gap-2 font-bold 2xl:px-4 ${theme.toolbarText}`}>
          <KeyPianoLogo className={`w-5 h-5 ${theme.accentText}`} />
          <span className="inline">{t.title}</span>
          {isSustainPedalDown && <div className="ml-1 w-2 h-2 rounded-full bg-[color:var(--kp-guide)]" title={t.sustain}></div>}
        </div>
        <button
          onClick={() => setIsToolbarOpen(!isToolbarOpen)}
          className={`lg:hidden min-w-11 min-h-11 p-2.5 rounded transition-colors ${theme.controlOff}`}
          aria-label={isToolbarOpen ? t.closeToolbar : t.openToolbar}
          aria-expanded={isToolbarOpen}
          aria-controls="keypiano-toolbar-controls"
        >
          {isToolbarOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      <div id="keypiano-toolbar-controls" className={`${isToolbarOpen ? 'flex' : 'hidden'} lg:flex lg:flex-1 flex-wrap gap-x-2 gap-y-2 p-2 items-center w-full overflow-x-auto no-scrollbar`}>
        {/* Instruments */}
        <div className={`flex items-center gap-2 shrink-0 ${theme.panelBg} ${theme.panelBorder} px-2 py-1 rounded border`}>
          <Music className={`w-4 h-4 ${theme.mutedText}`} />
          <select
            id="toolbar-instrument"
            aria-label={t.instrument}
            value={currentInstrument}
            onChange={(e) => {
              const value = e.target.value;
              if (isInstrumentID(value)) handleInstrumentChange(value);
            }}
            disabled={isLoading || isRecording || isPlayingBack}
            className={`bg-transparent text-xs py-1 outline-none cursor-pointer disabled:opacity-50 max-w-[120px] md:max-w-none ${theme.toolbarText}`}
          >
            {INSTRUMENTS.map(inst => (
              <option key={inst.id} value={inst.id}>
                {(t.instruments)[inst.id] || inst.name} {inst.type === 'gm' ? t.instruments.gm_suffix : t.instruments.custom_suffix}
              </option>
            ))}
          </select>
        </div>

        {/* Master Volume */}
        <div className={`flex items-center gap-2 shrink-0 ${theme.panelBg} ${theme.panelBorder} px-2 py-1 rounded border`}>
          <Volume2 className={`w-4 h-4 ${theme.mutedText} ${masterVolume > 0 ? '' : 'opacity-50'}`} />
          <input
            aria-label={t.masterVolume}
            type="range" min="0" max={MAX_MASTER_VOLUME} step="0.01" value={masterVolume}
            onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
            className="w-16 md:w-24 cursor-pointer accent-[color:var(--kp-played)]"
            title={t.masterVolume}
          />
          <span className={`text-[10px] font-mono w-8 text-right ${theme.mutedText}`}>
            {Math.round(masterVolume * 100)}%
          </span>
        </div>

        {/* Metronome */}
        <div className={`flex items-center gap-3 shrink-0 ${theme.panelBg} ${theme.panelBorder} px-2 py-1 rounded border`}>
          <button
            onClick={() => setIsMetronomeOn(prev => !prev)}
            className={`transition-colors p-1 rounded-full ${controlClass(isMetronomeOn)}`}
            aria-label={t.metronomeToggle}
            aria-pressed={isMetronomeOn}
          >
            {isMetronomeOn ? <Activity className="w-4 h-4" /> : <Timer className="w-4 h-4" />}
          </button>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold font-mono ${theme.mutedText}`}>{t.controls.bpm}</span>
              <input aria-label={t.controls.bpm} type="number" min="40" max="240" value={bpm} onChange={(e) => setBpm(Math.max(40, Math.min(240, parseInt(e.target.value) || 120)))}
                className={`text-[10px] w-10 text-center rounded border outline-none ${theme.field}`} />
              <select value={metronomeSound} onChange={(e) => {
                const value = e.target.value;
                if (isMetronomeSound(value)) setMetronomeSound(value);
              }} aria-label={t.metronomeToggle} className={`text-[10px] h-4 ml-1 rounded outline-none border cursor-pointer ${theme.field}`}>
                {METRONOME_SOUNDS.map(s => <option key={s.id} value={s.id}>{t.metronome[s.id]}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Recorder & MIDI Actions Combined */}
        <div className={`flex items-center gap-2 shrink-0 ${theme.panelBg} ${theme.panelBorder} px-2 py-1 rounded border`}>
          <div className={`flex items-center gap-1 border-r pr-2 mr-1 ${theme.panelBorder}`}>
            <button onClick={onImportMidi} disabled={isRecording || isLoading} className={`p-1.5 rounded disabled:cursor-not-allowed disabled:opacity-30 ${theme.controlOff}`} title={t.importMidi} aria-label={t.importMidi}>
              <FileUp className="w-3.5 h-3.5" />
            </button>
            <button onClick={onExportMidi} disabled={recordedEvents.length === 0} className={`p-1.5 rounded disabled:opacity-30 ${theme.controlOff}`} title={t.exportMidi} aria-label={t.exportMidi}>
              <Download className="w-3.5 h-3.5" />
            </button>
            <button ref={takesButtonRef} onClick={() => setShowTakes(!showTakes)} className={`p-1.5 rounded ${controlClass(showTakes)}`} title={t.takes.title} aria-label={t.takes.title} aria-expanded={showTakes} aria-controls="keypiano-takes-panel">
              <History className="w-3.5 h-3.5" />
            </button>
          </div>

          <button onMouseDown={preventMouseFocus} onClick={toggleRecording} className={`p-1.5 rounded-full transition-all ${isRecording ? 'bg-[color:var(--kp-rec)] text-white animate-pulse' : 'text-[color:var(--kp-rec)] hover:bg-[color:var(--kp-hover-bg)]'}`} title={t.record} aria-label={t.record} aria-pressed={isRecording}>
            {isRecording ? <Square className="w-3 h-3 fill-current" /> : <Circle className="w-3 h-3 fill-current" />}
          </button>
          <button onMouseDown={preventMouseFocus} onClick={togglePlayback} disabled={isRecording || recordedEvents.length === 0 || (isPracticePreparing && !isPlayingBack)} className={`p-1.5 rounded-full transition-all disabled:opacity-30 ${controlClass(isPlayingBack)}`} title={isPracticePreparing ? practicePreparationLabel : t.playPause} aria-label={t.playPause} aria-pressed={isPlayingBack}>
            {isPlayingBack ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
          </button>
          <button onMouseDown={preventMouseFocus} onClick={stopAndReset} className={`p-1.5 rounded-full ${theme.controlOff}`} title={t.stopReset} aria-label={t.stopReset}>
            <RotateCcw className="w-3 h-3" />
          </button>
          <div className={`px-1 font-mono text-xs font-bold min-w-[50px] text-center transition-colors ${isRecording ? 'text-[color:var(--kp-rec)]' : isPlayingBack ? theme.accentText : elapsedTime > 0 ? theme.toolbarText : theme.mutedText}`}>{formatTime(elapsedTime)}</div>
        </div>

        {/* View Toggles & Practice Mode */}
        <div className={`flex items-center gap-1 ${theme.panelBg} ${theme.panelBorder} px-1 py-1 rounded border`}>
          <div className={`flex items-center text-[10px] px-1 font-bold ${theme.mutedText}`}>{t.view}:</div>
          <button onClick={() => setMainView('stave')} className={`p-1.5 rounded ${controlClass(mainView === 'stave')}`} title={t.toggleStave} aria-label={t.toggleStave} aria-pressed={mainView === 'stave'}>
            <ScrollText className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setMainView('keyboard')} className={`p-1.5 rounded ${controlClass(mainView === 'keyboard')}`} title={t.toggleKeyboard} aria-label={t.toggleKeyboard} aria-pressed={mainView === 'keyboard'}>
            <Keyboard className="w-3.5 h-3.5" />
          </button>
          {isLgUp && (
            <button onClick={() => setMainView('arrange')} className={`p-1.5 rounded flex items-center gap-1 ${controlClass(mainView === 'arrange')}`} title={t.arrange.title} aria-label={t.arrange.title} aria-pressed={mainView === 'arrange'}>
              <ListMusic className="w-3.5 h-3.5" /><span className="text-xs">{t.arrange.title}</span>
            </button>
          )}
          {!isLgUp && (
            <button onClick={() => setMainView('arrange')} className={`p-1.5 rounded ${controlClass(mainView === 'arrange')}`} title={t.arrange.title} aria-label={t.arrange.title} aria-pressed={mainView === 'arrange'}>
              <ListMusic className="w-3.5 h-3.5" />
            </button>
          )}
          {isLgUp && (
            <button onClick={() => setMainView('waterfall')} className={`p-1.5 rounded ${controlClass(mainView === 'waterfall')}`} title={t.waterfall} aria-label={t.waterfall} aria-pressed={mainView === 'waterfall'}>
              <ArrowDownToLine className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={() => setShowPiano(!showPiano)} className={`p-1.5 rounded ${controlClass(showPiano)}`} title={t.togglePiano} aria-label={t.togglePiano} aria-pressed={showPiano}>
            <Piano className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-[color:var(--kp-panel-border)] mx-0.5"></div>
          <button
            onMouseDown={preventMouseFocus}
            onClick={() => {
              const nextMode = !isPracticeMode;
              setIsPracticeMode(nextMode);
              if (!nextMode) changePlaybackSpeed(1.0);
            }}
            className={`p-1.5 rounded flex items-center gap-1 ${controlClass(isPracticeMode)}`}
            title={t.practiceMode}
            aria-label={t.practiceMode}
            aria-pressed={isPracticeMode}
          >
            <GraduationCap className="w-3.5 h-3.5" />
          </button>

          {isPracticeMode && (
            <div className="flex items-center ml-1">
              <Gauge className={`w-3 h-3 mr-1 ${theme.mutedText}`} />
              <select
                value={playbackSpeed}
                aria-label={t.speed}
                onChange={(e) => changePlaybackSpeed(parseFloat(e.target.value))}
                className={`text-[10px] h-5 rounded outline-none border cursor-pointer w-12 ${theme.field}`}
              >
                {PLAYBACK_SPEEDS.map(s => <option key={s} value={s}>{s}x</option>)}
              </select>
              <button
                onMouseDown={preventMouseFocus}
                onClick={() => setIsWaitMode(!isWaitMode)}
                className={`ml-1 p-1 rounded ${controlClass(isWaitMode)}`}
                title={t.waitMode.toggle}
                aria-label={t.waitMode.toggle}
                aria-pressed={isWaitMode}
              >
                <Hourglass className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 2xl:block hidden"></div>
        <button onClick={() => setIsZenMode(true)} className={`p-2 rounded transition-colors ${theme.controlOff}`} title={t.zenMode} aria-label={t.zenMode}>
          <Maximize className="w-5 h-5" />
        </button>
        <button ref={infoButtonRef} onClick={() => setShowInfo(true)} className={`p-2 rounded transition-colors ${theme.controlOff}`} title={t.aboutTitle} aria-label={t.aboutTitle}>
          <Info className="w-5 h-5" />
        </button>
        <div className="relative">
          <button ref={settingsButtonRef} onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded transition-colors ${controlClass(showSettings)}`} aria-label={t.settings} aria-expanded={showSettings} aria-controls="keypiano-settings-panel"><Settings className="w-5 h-5" /></button>
        </div>
      </div>
    </div>
  );
};

export default Toolbar;
