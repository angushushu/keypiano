import React from 'react';

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
    
    // Helper to handle both click and swipe (glissando)
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

    return (
        <div 
            className="relative h-48 md:h-60 flex select-none overflow-hidden bg-black p-1 rounded border-t-4 border-gray-700 shadow-inner w-full cursor-pointer"
            onMouseLeave={() => {
                // Failsafe: if mouse leaves entire piano area, we might want to ensure notes stop?
                // But individual keys handle 'leave', so it should be fine.
            }}
        >
            {whiteKeys.map((k) => {
                 const isActive = activeNotes.includes(k.noteId);
                 
                 return (
                     <div 
                         key={k.noteId}
                         className={`flex-1 border-l border-b border-r border-gray-400 rounded-b-[4px] relative ${isActive ? 'bg-yellow-400 !bg-none shadow-[0_0_10px_orange]' : 'bg-gradient-to-b from-white to-gray-200'}`}
                         onMouseDown={(e) => handleNoteAction(k.noteId, 'down', e)}
                         onMouseUp={(e) => handleNoteAction(k.noteId, 'up', e)}
                         onMouseEnter={(e) => handleNoteAction(k.noteId, 'enter', e)}
                         onMouseLeave={(e) => handleNoteAction(k.noteId, 'leave', e)}
                     >
                        {k.note === 'C' && (
                            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-gray-500 font-bold hidden sm:block">C{k.octave}</span>
                        )}
                     </div>
                 );
            })}
            
            {/* Render Black Keys Overlay */}
            {/* 
                We position black keys based on the white keys. 
                Using pointer-events-none on container, but pointer-events-auto on keys to allow interaction.
            */}
            <div className="absolute inset-0 pointer-events-none pl-1 pr-1"> 
                 {/* The padding matches the container padding to align with white keys row */}
                 
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
                             className={`absolute h-[64%] border-b-4 border-gray-800 rounded-b-[3px] z-10 pointer-events-auto ${isActive ? 'bg-yellow-600 border-yellow-800 shadow-[0_0_10px_orange]' : 'bg-gradient-to-b from-gray-800 to-black'}`}
                             style={{
                                 left: `${leftPct}%`,
                                 width: `${blackWidthPct}%`
                             }}
                             onMouseDown={(e) => { e.stopPropagation(); handleNoteAction(k.noteId, 'down', e); }}
                             onMouseUp={(e) => { e.stopPropagation(); handleNoteAction(k.noteId, 'up', e); }}
                             onMouseEnter={(e) => handleNoteAction(k.noteId, 'enter', e)}
                             onMouseLeave={(e) => handleNoteAction(k.noteId, 'leave', e)}
                         ></div>
                     );
                 })}
            </div>
        </div>
    );
};

export default PianoKeyboard;