import React from 'react';

interface PianoKeyboardProps {
    activeNotes: string[]; // List of currently playing notes (e.g. "C4", "F#5")
}

const PianoKeyboard: React.FC<PianoKeyboardProps> = ({ activeNotes }) => {
    // Standard 88-key piano: A0 to C8
    const START_NOTE_INDEX = 9; // A is 9th note (starting from C=0) ?? 
    // Easier: Just generate the sequence A0, A#0, B0, C1... C8
    
    const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    const allKeys = [];
    
    // A0 (Index 0 for loop) to C8 (Index 87)
    // 88 keys
    
    // Logic: 
    // A0 is key 1.
    // C8 is key 88.
    
    // Let's generate note objects
    for (let i = 0; i < 88; i++) {
        // A0 is MIDI note 21. C4 is 60.
        // n = i + 21
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
    
    return (
        <div className="relative h-48 md:h-60 flex select-none overflow-hidden bg-black p-1 rounded border-t-4 border-gray-700 shadow-inner w-full">
            {whiteKeys.map((k) => {
                 const isActive = activeNotes.includes(k.noteId);
                 // We need to handle enharmonics for active check if passed as C# but rendered as Db?
                 // Current system uses C# everywhere, so direct check is okay.
                 
                 return (
                     <div 
                         key={k.noteId}
                         className={`flex-1 border-l border-b border-r border-gray-400 rounded-b-[4px] relative active:bg-gray-200 ${isActive ? 'bg-yellow-400 !bg-none shadow-[0_0_10px_orange]' : 'bg-gradient-to-b from-white to-gray-200'}`}
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
                A black key sits between two white keys.
                C# sits between C and D.
            */}
            <div className="absolute inset-0 flex pointer-events-none pl-1 pr-1"> 
                 {/* The padding matches the container padding to align with white keys row */}
                 
                 {allKeys.map((k) => {
                     if (!k.isBlack) return null;
                     
                     // Find which white key this follows.
                     // C# follows C. D# follows D. F# follows F.
                     // We need the index of the PREVIOUS white key in the whiteKeys array.
                     const prevWhiteIndex = whiteKeys.findIndex(wk => wk.midi === k.midi - 1);
                     if (prevWhiteIndex === -1) return null;

                     // Calculate position.
                     // Each white key is (100% / whiteKeys.length).
                     // Black key center is exactly at the border between prevWhite and nextWhite.
                     // Left = (prevWhiteIndex + 1) * unitWidth - (blackWidth / 2)
                     
                     const unitWidthPct = 100 / whiteKeys.length;
                     const blackWidthPct = unitWidthPct * 0.65; // Slightly narrower than white
                     const leftPct = (prevWhiteIndex + 1) * unitWidthPct - (blackWidthPct / 2);
                     
                     const isActive = activeNotes.includes(k.noteId);

                     return (
                         <div 
                             key={k.noteId}
                             className={`absolute h-[64%] border-b-4 border-gray-800 rounded-b-[3px] z-10 ${isActive ? 'bg-yellow-600 border-yellow-800 shadow-[0_0_10px_orange]' : 'bg-gradient-to-b from-gray-800 to-black'}`}
                             style={{
                                 left: `${leftPct}%`,
                                 width: `${blackWidthPct}%`
                             }}
                         ></div>
                     );
                 })}
            </div>
        </div>
    );
};

export default PianoKeyboard;