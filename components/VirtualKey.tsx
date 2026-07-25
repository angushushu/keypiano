

import React from 'react';
import { Theme } from '../theme';
import { getJianpu } from '../constants';

interface VirtualKeyProps {
  label: string;
  code: string;
  description?: string;
  note?: string; 
  width?: number; // 1u = 4 grid units
  height?: number; // 1 row = 1 grid row (unless spanning)
  isActive: boolean; // User interaction
  isPlaybackActive?: boolean; // Playback/Practice mode interaction
  isUpcoming?: boolean; // Pre-load interaction
  isModifier?: boolean;
  isDummy?: boolean;
  customLabel?: string;
  onMouseDown: (code: string) => void;
  onMouseUp: (code: string) => void;
  isTabStop?: boolean;
  onMoveFocus?: (code: string, direction: 'previous' | 'next' | 'first' | 'last') => void;
  registerKeyRef?: (code: string, element: HTMLDivElement | null) => void;
  theme: Theme; 
}


const VirtualKey: React.FC<VirtualKeyProps> = ({ 
  label, 
  code, 
  description,
  note, 
  width = 1, 
  height = 1,
  isActive, 
  isPlaybackActive,
  isUpcoming,
  isDummy,
  customLabel,
  onMouseDown,
  onMouseUp,
  isTabStop = false,
  onMoveFocus,
  registerKeyRef,
  theme
}) => {
  const mappedNote = note;
  const displayLabel = customLabel || label;
  const accessibleLabel = mappedNote ? `Play note ${mappedNote}` : (description || displayLabel);
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
      stateClass = `bg-transparent border-none shadow-none transition-all ${isActive ? 'opacity-100 scale-95' : `opacity-60 hover:opacity-100`}`;
  } else if (isPlaybackActive && isActive) {
      // Hybrid state: Playback color (guide) but Active geometry (pressed)
      // We manually ensure it looks pressed while keeping the guide color
      stateClass = `${theme.keyPlayback} !translate-y-[2px] !shadow-none`;
  } else if (isPlaybackActive) {
      stateClass = theme.keyPlayback;
  } else if (isActive) {
      stateClass = theme.keyActive;
  } else if (isUpcoming) {
      stateClass = `${theme.keyBase} ${theme.keyUpcoming}`;
  } else {
      stateClass = theme.keyBase;
  }
  
  const handleMouseDown = (e?: React.MouseEvent<HTMLDivElement>) => {
    if (e) {
      // Keep pointer playing from stealing focus from the physical-key mapping.
      e.preventDefault();
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
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
        ref={(element) => registerKeyRef?.(code, element)}
        data-virtual-key-code={isDummy ? undefined : code}
        className={`${baseClasses} ${stateClass}`}
        style={style}
        role={isDummy ? undefined : 'button'}
        aria-hidden={isDummy || undefined}
        aria-label={isDummy ? undefined : accessibleLabel}
        aria-pressed={isDummy ? undefined : isActive || isPlaybackActive || false}
        tabIndex={isDummy ? -1 : isTabStop ? 0 : -1}
        title={description}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave} 
        onMouseEnter={handleMouseEnter}
        onTouchStart={(e) => { e.preventDefault(); handleMouseDown(); }}
        onTouchEnd={(e) => { e.preventDefault(); handleMouseUp(); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleMouseDown();
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            onMoveFocus?.(code, 'previous');
          } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            onMoveFocus?.(code, 'next');
          } else if (e.key === 'Home') {
            e.preventDefault();
            onMoveFocus?.(code, 'first');
          } else if (e.key === 'End') {
            e.preventDefault();
            onMoveFocus?.(code, 'last');
          }
        }}
        onKeyUp={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleMouseUp(); } }}
    >
      {!isFunctionKey && !isCoffee && !isDummy && (
          <span className={`absolute top-[2px] left-[3px] text-[10px] font-sans font-bold leading-none hidden sm:block ${labelTextColor}`}>
            {displayLabel}
          </span>
      )}
      
      {(isFunctionKey || isCoffee) && !isDummy && (
          <span className={`${functionTextClass} ${!isCoffee && !isLargeLabel ? `${theme.keyFunctionText} font-bold font-sans` : ''} ${!isCoffee ? 'hidden sm:block' : ''}`}>
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
