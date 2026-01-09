import React from 'react';
import { KEY_TO_NOTE } from '../constants';

interface VirtualKeyProps {
  label: string;
  code: string;
  width?: number; // 1u = 4 grid units
  height?: number; // 1 row = 1 grid row (unless spanning)
  isActive: boolean;
  isModifier?: boolean;
  isDummy?: boolean;
  customLabel?: string;
  onMouseDown: (code: string) => void;
  onMouseUp: (code: string) => void;
}

// Helper to convert Note (e.g. C4, F#5) to Jianpu (1, #4 with dots)
const getJianpu = (note: string) => {
  const match = note.match(/([A-G][#b]?)(-?\d+)/);
  if (!match) return null;
  
  let [_, name, octStr] = match;
  let octave = parseInt(octStr);

  // Map Note Name to Number
  // C=1, D=2, E=3, F=4, G=5, A=6, B=7
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
  
  // Calculate Dots
  // Base is Octave 4 (Middle C range)
  // Octave 4: No dots
  // Octave 5: 1 dot up
  // Octave 3: 1 dot down
  const diff = octave - 4;
  
  return { number, diff };
};

const VirtualKey: React.FC<VirtualKeyProps> = ({ 
  label, 
  code, 
  width = 1, 
  height = 1,
  isActive, 
  isDummy,
  customLabel,
  onMouseDown,
  onMouseUp
}) => {
  const mappedNote = KEY_TO_NOTE[code];
  const displayLabel = customLabel || label;
  const jianpu = mappedNote ? getJianpu(mappedNote) : null;

  // GRID UNIT LOGIC
  // 1u = 4 grid columns.
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

  // Visual Styling - Mimic standard physical keys slightly better
  const normalLook = "bg-gradient-to-b from-[#fbfbfb] to-[#e0e0e0] shadow-[0_1px_0px_#999,0_2px_0px_#777,0_3px_2px_rgba(0,0,0,0.3)] border-t border-l border-r border-white/50";
  const activeLook = "bg-[#ccc] translate-y-[2px] shadow-[inset_0_1px_4px_rgba(0,0,0,0.4)] border-none";
  const dummyLook = "opacity-0 pointer-events-none"; // Invisible

  const isFunctionKey = (customLabel || code.startsWith('F') || code === 'Escape') && !mappedNote; 
  const isCoffee = code === 'Coffee';

  // Special handling for #L and bL to make them look like Jianpu symbols
  const isLargeLabel = customLabel === '#L' || customLabel === 'bL';
  
  const functionTextClass = isLargeLabel 
    ? "text-[12px] sm:text-[18px] font-bold font-mono" // Larger, like Jianpu
    : (isCoffee 
        ? "text-[11px] sm:text-[13px] font-medium text-white-500 flex items-center justify-center gap-1.5" 
        : "text-[7px] sm:text-[11px] tracking-tight"); // Smaller, for F-keys

  let stateClass;
  
  if (isDummy) {
      stateClass = dummyLook;
  } else if (isCoffee) {
      // Coffee Button: Transparent, text only, fades in on hover
      stateClass = `bg-transparent border-none shadow-none transition-all ${isActive ? 'opacity-100 scale-95' : 'opacity-40 hover:opacity-100'}`;
  } else if (isActive) {
      stateClass = activeLook;
  } else {
      stateClass = normalLook;
  }
  
  const handleMouseDown = () => {
    if (!isDummy) onMouseDown(code);
  };
  
  const handleMouseUp = () => {
    if (!isDummy) onMouseUp(code);
  };

  // Glissando / Swipe Logic
  const handleMouseEnter = (e: React.MouseEvent) => {
    // If mouse button is held down (buttons === 1) and we enter a key, trigger it
    if (e.buttons === 1 && !isDummy) {
        onMouseDown(code);
    }
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
      // If mouse button is held down and we leave a key, release it
      if (e.buttons === 1 && !isDummy) {
          onMouseUp(code);
      }
  };

  // Render dots for Jianpu
  const renderDots = (count: number) => {
      if (count === 0) return <div className="h-[2px] sm:h-[4px]"></div>;
      return (
          <div className="flex gap-[1px] justify-center h-[2px] sm:h-[4px]">
              {Array.from({ length: Math.abs(count) }).map((_, i) => (
                  <div key={i} className="w-[2px] h-[2px] sm:w-[3px] sm:h-[3px] rounded-full bg-black/70"></div>
              ))}
          </div>
      );
  };

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
      {/* Top Left Label (QWERTY) */}
      {!isFunctionKey && !isCoffee && !isDummy && (
          // Hide on mobile/tablet (hidden by default), show only on large screens (lg:block)
          <span className="absolute top-[2px] left-[3px] text-[10px] font-sans text-gray-400 font-bold leading-none hidden lg:block">
            {displayLabel}
          </span>
      )}
      
      {/* Center Label (Function Keys & #L/bL & Coffee) */}
      {(isFunctionKey || isCoffee) && !isDummy && (
          // Hide on mobile/tablet if regular function key, but show if it's Coffee
          <span className={`${functionTextClass} ${!isCoffee && !isLargeLabel ? 'text-gray-600 font-bold font-sans' : ''} ${!isCoffee ? 'hidden lg:block' : ''}`}>
              {displayLabel}
          </span>
      )}

      {/* Jianpu Notation Label */}
      {jianpu && (
        <div className={`flex flex-col items-center justify-center leading-none ${isActive ? 'text-blue-900' : 'text-gray-800'}`}>
          {/* Top Dots (if diff > 0) */}
          <div className="mb-[1px] sm:mb-[2px]">
             {jianpu.diff > 0 ? renderDots(jianpu.diff) : <div className="h-[2px] sm:h-[4px]"></div>}
          </div>
          
          {/* Main Number - Heavily reduced for mobile (9px) vs Desktop (18px) */}
          <span className="text-[9px] sm:text-[18px] font-bold font-mono -my-[1px] sm:-my-[2px]">
             {jianpu.number}
          </span>

          {/* Bottom Dots (if diff < 0) */}
          <div className="mt-[1px] sm:mt-[2px]">
             {jianpu.diff < 0 ? renderDots(jianpu.diff) : <div className="h-[2px] sm:h-[4px]"></div>}
          </div>
        </div>
      )}
      
      {/* Spacebar branding */}
      {code === 'Space' && (
          <span className="text-gray-400 text-[8px] sm:text-[11px] font-sans mt-1 sm:mt-2 tracking-widest uppercase opacity-50 hidden xs:block">KeyPiano</span>
      )}
    </div>
  );
};

export default VirtualKey;