import React, { useRef } from 'react';

interface PianoKeyboardProps {
    activeNotes: string[]; // List of currently playing notes (e.g. "C4", "F#5")
    onPlayNote: (note: string) => void;
    onStopNote: (note: string) => void;
}

const PianoKeyboard: React.FC<PianoKeyboardProps> = ({ activeNotes, onPlayNote, onStopNote }) => {
    // Standard 88-key piano: A0 to C8
    const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    const allKeys = [];
    
    // A0 (Index 0 for loop) to C8 (Index 87)
    for (let i = 0; i < 88; i++) {
        // A0 is MIDI note 21.
        const midi = i + 21;
        const octave = Math.floor(midi / 12) - 1;
        const noteNameIndex = midi % 12;
        const noteName = NOTE_NAMES[noteNameIndex];
        const isBlack = noteName.includes('#');
        const noteId = `${noteName}${octave}`;
        
        allKeys.push({
            midi,
            note: noteName,
            octave,
            isBlack,
            noteId
        });
    }

    const whiteKeys = allKeys.filter(k => !k.isBlack);
    const lastTouchNoteId = useRef<string | null>(null);
    
    // Helper to handle both click and swipe (glissando) for MOUSE
    const handleNoteAction = (noteId: string, action: 'down' | 'up' | 'enter' | 'leave', e: React.MouseEvent) => {
        e.preventDefault(); // Prevent default drag selection behavior
        
        if (action === 'down') {
            onPlayNote(noteId);
        } else if (action === 'up') {
            onStopNote(noteId);
        } else if (action === 'enter') {
            // Glissando: play if mouse is held
            if (e.buttons === 1) onPlayNote(noteId);
        } else if (action === 'leave') {
            // Glissando: stop if mouse is held
            if (e.buttons === 1) onStopNote(noteId);
        }
    };

    // TOUCH HANDLERS
    const handleTouchStart = (e: React.TouchEvent, noteId: string) => {
        // We do not strictly call e.preventDefault() here to allow multi-touch to work smoothly
        // without blocking the main thread significantly, but we rely on CSS touch-action: none.
        
        onPlayNote(noteId);
        lastTouchNoteId.current = noteId;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        // Identify element under finger
        const touch = e.touches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        
        // We look for the data-note-id attribute
        const keyEl = target?.closest('[data-note-id]');
        
        if (keyEl) {
            const noteId = keyEl.getAttribute('data-note-id');
            if (noteId && noteId !== lastTouchNoteId.current) {
                // Stopped previous note
                if (lastTouchNoteId.current) {
                    onStopNote(lastTouchNoteId.current);
                }
                // Start new note
                onPlayNote(noteId);
                lastTouchNoteId.current = noteId;
            }
        } else {
            // Finger moved off keyboard
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
            className="relative h-48 md:h-60 flex select-none overflow-hidden bg-black p-1 rounded border-t-4 border-gray-700 shadow-inner w-full cursor-pointer touch-none"
            style={{ touchAction: 'none' }} // Critical for preventing scroll on mobile
            onMouseLeave={() => {
                // Failsafe for mouse
            }}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
        >
            {whiteKeys.map((k) => {
                 const isActive = activeNotes.includes(k.noteId);
                 
                 return (
                     <div 
                         key={k.noteId}
                         data-note-id={k.noteId} // ID for elementFromPoint lookup
                         className={`flex-1 border-l border-b border-r border-gray-400 rounded-b-[4px] relative ${isActive ? 'bg-yellow-400 !bg-none shadow-[0_0_10px_orange]' : 'bg-gradient-to-b from-white to-gray-200'}`}
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
                     
                     // Find which white key this follows.
                     const prevWhiteIndex = whiteKeys.findIndex(wk => wk.midi === k.midi - 1);
                     if (prevWhiteIndex === -1) return null;

                     // Calculate position.
                     const unitWidthPct = 100 / whiteKeys.length;
                     const blackWidthPct = unitWidthPct * 0.65; // Slightly narrower than white
                     const leftPct = (prevWhiteIndex + 1) * unitWidthPct - (blackWidthPct / 2);
                     
                     const isActive = activeNotes.includes(k.noteId);

                     return (
                         <div 
                             key={k.noteId}
                             data-note-id={k.noteId} // ID for elementFromPoint lookup
                             className={`absolute h-[64%] border-b-4 border-gray-800 rounded-b-[3px] z-10 pointer-events-auto ${isActive ? 'bg-yellow-600 border-yellow-800 shadow-[0_0_10px_orange]' : 'bg-gradient-to-b from-gray-800 to-black'}`}
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