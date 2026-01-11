
import React from 'react';
import { Theme } from '../theme';

interface VirtualKeyProps {
  label: string;
  code: string;
  note?: string; 
  width?: number; // 1u = 4 grid units
  height?: number; // 1 row = 1 grid row (unless spanning)
  isActive: boolean; // User interaction
  isPlaybackActive?: boolean; // Playback/Practice mode interaction
  isModifier?: boolean;
  isDummy?: boolean;
  customLabel?: string;
  onMouseDown: (code: string) => void;
  onMouseUp: (code: string) => void;
  theme: Theme; 
}

// Helper to convert Note (e.g. C4, F#5) to Jianpu (1, #4 with dots)
const getJianpu = (note: string) => {
  const match = note.match(/([A-G][#b]?)(-?\d+)/);
  if (!match) return null;
  
  let [_, name, octStr] = match;
  let octave = parseInt(octStr);

  // Map Note Name to Number
  const map: Record<string, string> = {
    'C': '1', 'C#': '#1', 'Db': 'b2',
    'D': '2', 'D#': '#2', 'Eb': 'b3',
    'E': '3', 
    'F': '4', 'F#': '#4', 'Gb': 'b5',
    'G': '5', 'G#': '#5', 'Ab': 'b6',
    'A': '6', 'A#': '#6', 'Bb': 'b7',
    'B': '7'
  };

  const number = map[name] || name;
  const diff = octave - 4;
  return { number, diff };
};

const VirtualKey: React.FC<VirtualKeyProps> = ({ 
  label, 
  code, 
  note, 
  width = 1, 
  height = 1,
  isActive, 
  isPlaybackActive,
  isDummy,
  customLabel,
  onMouseDown,
  onMouseUp,
  theme
}) => {
  const mappedNote = note;
  const displayLabel = customLabel || label;
  const jianpu = mappedNote ? getJianpu(mappedNote) : null;

  // GRID UNIT LOGIC
  const colSpan = Math.round(width * 4);
  const rowSpan = height;

  const style: React.CSSProperties = {
    gridColumn: `span ${colSpan}`,
    gridRow: `span ${rowSpan}`,
  };

  const baseClasses = `
    relative rounded-[4px] flex flex-col items-center justify-center 
    select-none transition-all duration-75 box-border cursor-pointer
    w-full h-full 
  `;

  // --- Theme Based Styling ---
  const isFunctionKey = (customLabel || code.startsWith('F') || code === 'Escape') && !mappedNote; 
  const isCoffee = code === 'Coffee';
  const isLargeLabel = customLabel === '#L' || customLabel === 'bL';
  
  // Color logic
  const mainTextColor = isActive ? theme.keyMainLabelActive : theme.keyMainLabel;
  
  const functionTextClass = isLargeLabel 
    ? `text-[12px] sm:text-[18px] font-bold font-mono ${mainTextColor}` 
    : (isCoffee 
        ? `text-[11px] sm:text-[13px] font-medium ${theme.coffeeText} flex items-center justify-center gap-1.5` 
        : `text-[7px] sm:text-[11px] tracking-tight`);

  let stateClass;
  
  if (isDummy) {
      stateClass = theme.keyDummy;
  } else if (isCoffee) {
      stateClass = `bg-transparent border-none shadow-none transition-all ${isActive ? 'opacity-100 scale-95' : `opacity-60 hover:opacity-100 hover:${theme.coffeeHover}`}`;
  } else if (isPlaybackActive && isActive) {
      // Hybrid state: Playback color (guide) but Active geometry (pressed)
      // We manually ensure it looks pressed while keeping the guide color
      stateClass = `${theme.keyPlayback} !translate-y-[2px] !shadow-none`;
  } else if (isPlaybackActive) {
      stateClass = theme.keyPlayback;
  } else if (isActive) {
      stateClass = theme.keyActive;
  } else {
      stateClass = theme.keyBase;
  }
  
  const handleMouseDown = () => {
    if (!isDummy) onMouseDown(code);
  };
  
  const handleMouseUp = () => {
    if (!isDummy) onMouseUp(code);
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (e.buttons === 1 && !isDummy) {
        onMouseDown(code);
    }
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
      if (e.buttons === 1 && !isDummy) {
          onMouseUp(code);
      }
  };

  const renderDots = (count: number) => {
      if (count === 0) return <div className="h-[2px] sm:h-[4px]"></div>;
      const dotColor = 'bg-current'; 

      return (
          <div className="flex gap-[1px] justify-center h-[2px] sm:h-[4px]">
              {Array.from({ length: Math.abs(count) }).map((_, i) => (
                  <div key={i} className={`w-[2px] h-[2px] sm:w-[3px] sm:h-[3px] rounded-full ${dotColor}`}></div>
              ))}
          </div>
      );
  };

  const jianpuTextColor = mainTextColor;
  const labelTextColor = theme.keyText;

  return (
    <div 
        className={`${baseClasses} ${stateClass}`}
        style={style}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave} 
        onMouseEnter={handleMouseEnter}
        onTouchStart={(e) => { e.preventDefault(); handleMouseDown(); }}
        onTouchEnd={(e) => { e.preventDefault(); handleMouseUp(); }}
    >
      {!isFunctionKey && !isCoffee && !isDummy && (
          <span className={`absolute top-[2px] left-[3px] text-[10px] font-sans font-bold leading-none hidden lg:block ${labelTextColor}`}>
            {displayLabel}
          </span>
      )}
      
      {(isFunctionKey || isCoffee) && !isDummy && (
          <span className={`${functionTextClass} ${!isCoffee && !isLargeLabel ? `${theme.keyFunctionText} font-bold font-sans` : ''} ${!isCoffee ? 'hidden lg:block' : ''}`}>
              {displayLabel}
          </span>
      )}

      {jianpu && (
        <div className={`flex flex-col items-center justify-center leading-none ${jianpuTextColor}`}>
          <div className="mb-[1px] sm:mb-[2px]">
             {jianpu.diff > 0 ? renderDots(jianpu.diff) : <div className="h-[2px] sm:h-[4px]"></div>}
          </div>
          
          <span className="text-[9px] sm:text-[18px] font-bold font-mono -my-[1px] sm:-my-[2px]">
             {jianpu.number}
          </span>

          <div className="mt-[1px] sm:mt-[2px]">
             {jianpu.diff < 0 ? renderDots(jianpu.diff) : <div className="h-[2px] sm:h-[4px]"></div>}
          </div>
        </div>
      )}
      
      {code === 'Space' && (
          <span className={`text-[8px] sm:text-[11px] font-sans mt-1 sm:mt-2 tracking-widest uppercase opacity-50 hidden xs:block ${labelTextColor}`}>
            KeyPiano
          </span>
      )}
    </div>
  );
};

export default React.memo(VirtualKey);
