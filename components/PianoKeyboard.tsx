
import React, { useRef, useMemo } from 'react';
import { Theme } from '../theme';
import { NOTE_NAMES } from '../constants';

interface PianoKeyboardProps {
    activeNotes: string[]; // User triggered notes (Strong)
    playbackNotes?: string[]; // Playback/Practice triggered notes (Ghost)
    onPlayNote: (note: string) => void;
    onStopNote: (note: string) => void;
    theme?: Theme;
}

const PianoKeyboard: React.FC<PianoKeyboardProps> = ({ activeNotes, playbackNotes = [], onPlayNote, onStopNote, theme }) => {
    // Fallback if no theme provided
    const t = theme || {
        pianoBg: 'bg-black',
        pianoWhiteKey: 'bg-gradient-to-b from-white to-gray-200',
        pianoWhiteKeyActive: 'bg-yellow-400',
        pianoWhiteKeyPlayback: 'bg-green-300',
        pianoBlackKey: 'bg-gradient-to-b from-gray-800 to-black',
        pianoBlackKeyActive: 'bg-yellow-600',
        pianoBlackKeyPlayback: 'bg-green-700',
    };
    
    // Memoize keys generation to avoid recalculation on every render
    const { allKeys, whiteKeys } = useMemo(() => {
        const keys = [];
        for (let i = 0; i < 88; i++) {
            const midi = i + 21;
            const octave = Math.floor(midi / 12) - 1;
            const noteNameIndex = midi % 12;
            const noteName = NOTE_NAMES[noteNameIndex];
            const isBlack = noteName.includes('#');
            const noteId = `${noteName}${octave}`;
            
            keys.push({
                midi,
                note: noteName,
                octave,
                isBlack,
                noteId
            });
        }
        return { 
            allKeys: keys, 
            whiteKeys: keys.filter(k => !k.isBlack) 
        };
    }, []);

    const lastTouchNoteId = useRef<string | null>(null);
    
    // Helper to handle both click and swipe (glissando) for MOUSE
    const handleNoteAction = (noteId: string, action: 'down' | 'up' | 'enter' | 'leave', e: React.MouseEvent) => {
        e.preventDefault(); 
        
        if (action === 'down') {
            onPlayNote(noteId);
        } else if (action === 'up') {
            onStopNote(noteId);
        } else if (action === 'enter') {
            if (e.buttons === 1) onPlayNote(noteId);
        } else if (action === 'leave') {
            if (e.buttons === 1) onStopNote(noteId);
        }
    };

    // TOUCH HANDLERS
    const handleTouchStart = (e: React.TouchEvent, noteId: string) => {
        onPlayNote(noteId);
        lastTouchNoteId.current = noteId;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        const keyEl = target?.closest('[data-note-id]');
        
        if (keyEl) {
            const noteId = keyEl.getAttribute('data-note-id');
            if (noteId && noteId !== lastTouchNoteId.current) {
                if (lastTouchNoteId.current) {
                    onStopNote(lastTouchNoteId.current);
                }
                onPlayNote(noteId);
                lastTouchNoteId.current = noteId;
            }
        } else {
            if (lastTouchNoteId.current) {
                onStopNote(lastTouchNoteId.current);
                lastTouchNoteId.current = null;
            }
        }
    };

    const handleTouchEnd = () => {
        if (lastTouchNoteId.current) {
            onStopNote(lastTouchNoteId.current);
            lastTouchNoteId.current = null;
        }
    };

    return (
        <div 
            className={`relative h-48 md:h-60 flex select-none overflow-hidden p-1 rounded w-full cursor-pointer touch-none ${t.pianoBg}`}
            style={{ touchAction: 'none' }}
            onMouseLeave={() => {}}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
        >
            {whiteKeys.map((k) => {
                 const isUserActive = activeNotes.includes(k.noteId);
                 const isPlaybackActive = playbackNotes.includes(k.noteId);
                 
                 let keyClass = t.pianoWhiteKey;
                 // Priority changed: Playback color stays even if pressed (User requested)
                 // But we add brightness to indicate press if needed
                 if (isPlaybackActive) keyClass = t.pianoWhiteKeyPlayback;
                 else if (isUserActive) keyClass = t.pianoWhiteKeyActive;

                 // Visual feedback for press on top of color
                 const extraClass = (isUserActive && isPlaybackActive) ? '!brightness-110' : '';

                 return (
                     <div 
                         key={k.noteId}
                         data-note-id={k.noteId} 
                         className={`flex-1 border-l border-b border-r border-gray-400 rounded-b-[4px] relative ${keyClass} ${extraClass}`}
                         onMouseDown={(e) => handleNoteAction(k.noteId, 'down', e)}
                         onMouseUp={(e) => handleNoteAction(k.noteId, 'up', e)}
                         onMouseEnter={(e) => handleNoteAction(k.noteId, 'enter', e)}
                         onMouseLeave={(e) => handleNoteAction(k.noteId, 'leave', e)}
                         onTouchStart={(e) => handleTouchStart(e, k.noteId)}
                     >
                        {k.note === 'C' && (
                            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-gray-500 font-bold hidden sm:block">C{k.octave}</span>
                        )}
                     </div>
                 );
            })}
            
            {/* Render Black Keys Overlay */}
            <div className="absolute inset-0 pointer-events-none pl-1 pr-1"> 
                 {allKeys.map((k) => {
                     if (!k.isBlack) return null;
                     
                     const prevWhiteIndex = whiteKeys.findIndex(wk => wk.midi === k.midi - 1);
                     if (prevWhiteIndex === -1) return null;

                     const unitWidthPct = 100 / whiteKeys.length;
                     const blackWidthPct = unitWidthPct * 0.65;
                     const leftPct = (prevWhiteIndex + 1) * unitWidthPct - (blackWidthPct / 2);
                     
                     const isUserActive = activeNotes.includes(k.noteId);
                     const isPlaybackActive = playbackNotes.includes(k.noteId);

                     let keyClass = t.pianoBlackKey;
                     if (isPlaybackActive) keyClass = t.pianoBlackKeyPlayback;
                     else if (isUserActive) keyClass = t.pianoBlackKeyActive;

                     const extraClass = (isUserActive && isPlaybackActive) ? '!brightness-125' : '';

                     return (
                         <div 
                             key={k.noteId}
                             data-note-id={k.noteId} 
                             className={`absolute h-[64%] border-b-4 rounded-b-[3px] z-10 pointer-events-auto ${keyClass} ${extraClass}`}
                             style={{
                                 left: `${leftPct}%`,
                                 width: `${blackWidthPct}%`
                             }}
                             onMouseDown={(e) => { e.stopPropagation(); handleNoteAction(k.noteId, 'down', e); }}
                             onMouseUp={(e) => { e.stopPropagation(); handleNoteAction(k.noteId, 'up', e); }}
                             onMouseEnter={(e) => handleNoteAction(k.noteId, 'enter', e)}
                             onMouseLeave={(e) => handleNoteAction(k.noteId, 'leave', e)}
                             onTouchStart={(e) => { e.stopPropagation(); handleTouchStart(e, k.noteId); }}
                         ></div>
                     );
                 })}
            </div>
        </div>
    );
};

export default PianoKeyboard;
