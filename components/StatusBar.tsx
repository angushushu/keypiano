import React, { useCallback } from 'react';
import { GripHorizontal } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useSynth } from '../contexts/SynthContext';
import { SustainLevel } from '../services/audioEngine';
import { getRootKeyName } from '../constants';

interface StatusBarProps {
  pianoHeight: number;
  setPianoHeight: (v: number) => void;
  showPiano: boolean;
  isRecording: boolean;
  isPlayingBack: boolean;
}

const StatusBar: React.FC<StatusBarProps> = ({ pianoHeight, setPianoHeight, showPiano, isRecording, isPlayingBack }) => {
  const { theme, t } = useSettings();
  const { transposeBase, setTransposeBase, octaveShift, setOctaveShift, keyVelocity, setKeyVelocity, sustainLevel, setSustainLevel } = useSynth();

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    const startY = e.clientY;
    const startHeight = pianoHeight;
    document.body.style.cursor = 'row-resize';

    const onMove = (ev: MouseEvent) => {
      setPianoHeight(Math.max(50, Math.min(window.innerHeight * 0.6, startHeight + startY - ev.clientY)));
    };
    const onUp = () => {
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [pianoHeight, setPianoHeight]);

  return (
    <div
      className={`flex h-6 md:h-8 ${theme.toolbarBg} border-t ${theme.toolbarBorder} border-b border-[#333] items-center justify-between px-2 md:px-4 text-[10px] md:text-xs font-mono ${theme.toolbarText} shrink-0 select-none overflow-hidden whitespace-nowrap transition-colors duration-300 cursor-row-resize relative z-30`}
      onMouseDown={showPiano ? handleDragStart : undefined}
    >
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20 pointer-events-none"><GripHorizontal className="w-4 h-4" /></div>
      <div className="flex gap-4 items-center z-10 pointer-events-auto cursor-default">
        <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}><span>{t.controls.base}:</span>
          <select disabled={isRecording || isPlayingBack} value={transposeBase} onChange={(e) => setTransposeBase(parseInt(e.target.value))} className="bg-gray-200 text-black px-1 min-w-[50px] text-center rounded-[2px] h-5 border-none outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            {Array.from({ length: 25 }, (_, i) => i - 12).map(val => (<option key={val} value={val}>{getRootKeyName(val)}</option>))}
          </select>
        </div>
        <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()} title="Keyboard Velocity (0-127)"><span>{t.controls.vel}:</span>
          <input type="number" min="0" max="127" value={keyVelocity} onChange={(e) => setKeyVelocity(Math.min(127, Math.max(0, parseInt(e.target.value))))} className="bg-gray-200 text-black px-1 w-[40px] text-center rounded-[2px] h-5 border-none outline-none" />
        </div>
      </div>
      <div className="flex gap-4 items-center z-10 pointer-events-auto cursor-default">
        <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}><span>{t.controls.sus}:</span>
          <select value={sustainLevel} onChange={(e) => setSustainLevel(e.target.value as SustainLevel)} className="bg-gray-200 text-black px-1 min-w-[50px] text-center rounded-[2px] h-5 border-none outline-none cursor-pointer">
            <option value="OFF">0 (Off)</option><option value="SHORT">64 (Short)</option><option value="LONG">127 (Long)</option>
          </select>
        </div>
        <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}><span>{t.controls.oct}:</span>
          <select disabled={isRecording || isPlayingBack} value={octaveShift} onChange={(e) => setOctaveShift(parseInt(e.target.value))} className="bg-gray-200 text-black px-1 w-[40px] text-center rounded-[2px] h-5 border-none outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            {Array.from({ length: 7 }, (_, i) => i - 3).map(val => (<option key={val} value={val}>{val > 0 ? `+${val}` : val}</option>))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default StatusBar;
