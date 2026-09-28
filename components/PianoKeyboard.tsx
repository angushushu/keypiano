
import React, { useRef, useMemo, useState } from 'react';
import { Theme } from '../theme';
import { NOTE_NAMES } from '../constants';
import { guideFillOpacity } from '../services/practiceGuide';

const EMPTY_GUIDE = new Map<string, number>();

interface PianoKeyboardProps {
    activeNotes: Set<string>;
    /** Practice guide brightness per note: rising as it approaches, 1 = press now. */
    guideNotes?: Map<string, number>;
    onPlayNote: (note: string) => void;
    onStopNote: (note: string) => void;
    theme?: Theme;
    ariaLabel?: string;
}

const PianoKeyboard: React.FC<PianoKeyboardProps> = ({
    activeNotes,
    guideNotes = EMPTY_GUIDE,
    onPlayNote,
    onStopNote,
    theme,
    ariaLabel = '88-key piano keyboard',
}) => {
    const t = theme || {
        pianoBg: 'bg-black',
        pianoWhiteKey: 'bg-gradient-to-b from-white to-gray-200',
        pianoWhiteKeyActive: 'bg-yellow-400',
        pianoWhiteKeyPlayback: 'bg-green-300',
        pianoWhiteKeyGuide: 'bg-green-300',
        pianoBlackKey: 'bg-gradient-to-b from-gray-800 to-black',
        pianoBlackKeyActive: 'bg-yellow-600',
        pianoBlackKeyPlayback: 'bg-green-600',
        pianoBlackKeyGuide: 'bg-green-600'
    };

    const { allKeys, whiteKeys, midiToWhiteIdx } = useMemo(() => {
        const keys = [];
        for (let i = 0; i < 88; i++) {
            const midi = i + 21;
            const octave = Math.floor(midi / 12) - 1;
            const noteNameIndex = midi % 12;
            const noteName = NOTE_NAMES[noteNameIndex];
            const isBlack = noteName.includes('#');
            const noteId = `${noteName}${octave}`;

            keys.push({ midi, note: noteName, octave, isBlack, noteId });
        }
        const wk = keys.filter(k => !k.isBlack);
        const idxMap = new Map<number, number>();
        wk.forEach((k, i) => idxMap.set(k.midi, i));
        return { allKeys: keys, whiteKeys: wk, midiToWhiteIdx: idxMap };
    }, []);

    const lastTouchNoteId = useRef<string | null>(null);
    const keyRefs = useRef(new Map<string, HTMLDivElement>());
    const keyboardPressedRef = useRef(new Set<string>());
    const [focusedNote, setFocusedNote] = useState('C4');

    const moveKeyboardFocus = (noteId: string, direction: 'previous' | 'next' | 'first' | 'last') => {
        const currentIndex = allKeys.findIndex(key => key.noteId === noteId);
        let nextIndex = currentIndex;
        if (direction === 'previous') nextIndex = Math.max(0, currentIndex - 1);
        if (direction === 'next') nextIndex = Math.min(allKeys.length - 1, currentIndex + 1);
        if (direction === 'first') nextIndex = 0;
        if (direction === 'last') nextIndex = allKeys.length - 1;
        const nextNote = allKeys[nextIndex]?.noteId;
        if (!nextNote) return;
        setFocusedNote(nextNote);
        requestAnimationFrame(() => keyRefs.current.get(nextNote)?.focus());
    };

    const handleKeyboardDown = (e: React.KeyboardEvent, noteId: string) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!keyboardPressedRef.current.has(noteId)) {
                keyboardPressedRef.current.add(noteId);
                onPlayNote(noteId);
            }
            return;
        }
        const directions: Record<string, 'previous' | 'next' | 'first' | 'last'> = {
            ArrowLeft: 'previous',
            ArrowDown: 'previous',
            ArrowRight: 'next',
            ArrowUp: 'next',
            Home: 'first',
            End: 'last',
        };
        const direction = directions[e.key];
        if (direction) {
            e.preventDefault();
            moveKeyboardFocus(noteId, direction);
        }
    };

    const handleKeyboardUp = (e: React.KeyboardEvent, noteId: string) => {
        if ((e.key === 'Enter' || e.key === ' ') && keyboardPressedRef.current.delete(noteId)) {
            e.preventDefault();
            onStopNote(noteId);
        }
    };

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

    const handleTouchStart = (e: React.TouchEvent, noteId: string) => {
        e.preventDefault();
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

    const unitWidthPct = 100 / whiteKeys.length;
    const blackWidthPct = unitWidthPct * 0.65;

    return (
        <div
            className={`relative h-48 md:h-60 flex select-none overflow-hidden p-1 rounded w-full cursor-pointer touch-none ${t.pianoBg}`}
            style={{ touchAction: 'none' }}
            role="group"
            aria-label={ariaLabel}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
        >
            {whiteKeys.map((k) => {
                 const isUserActive = activeNotes.has(k.noteId);
                 const guideLevel = guideNotes.get(k.noteId) ?? 0;
                 const isPlaybackActive = guideLevel >= 1;

                 let keyClass = t.pianoWhiteKey;
                 if (isPlaybackActive) keyClass = t.pianoWhiteKeyPlayback;
                 else if (isUserActive) keyClass = t.pianoWhiteKeyActive;
                 const guideOpacity = !isUserActive ? guideFillOpacity(guideLevel) : 0;
                 const extraClass = (isUserActive && isPlaybackActive) ? '!brightness-110' : '';
                 return (
                     <div
                         ref={(element) => {
                             if (element) keyRefs.current.set(k.noteId, element);
                             else keyRefs.current.delete(k.noteId);
                         }}
                         key={k.noteId}
                         data-note-id={k.noteId}
                         role="button"
                         aria-label={`${k.noteId}${k.note === 'C' ? ` (C${k.octave})` : ''}`}
                         aria-pressed={isUserActive || isPlaybackActive || false}
                         tabIndex={focusedNote === k.noteId ? 0 : -1}
                         className={`flex-1 border-l border-b border-r border-gray-400 rounded-b-[4px] relative focus:outline-none focus:ring-2 focus:ring-inset focus:ring-yellow-500 ${keyClass} ${extraClass}`}
                         onFocus={() => setFocusedNote(k.noteId)}
                         onKeyDown={(e) => handleKeyboardDown(e, k.noteId)}
                         onKeyUp={(e) => handleKeyboardUp(e, k.noteId)}
                         onBlur={() => {
                             if (keyboardPressedRef.current.delete(k.noteId)) onStopNote(k.noteId);
                         }}
                         onMouseDown={(e) => handleNoteAction(k.noteId, 'down', e)}
                         onMouseUp={(e) => handleNoteAction(k.noteId, 'up', e)}
                         onMouseEnter={(e) => handleNoteAction(k.noteId, 'enter', e)}
                         onMouseLeave={(e) => handleNoteAction(k.noteId, 'leave', e)}
                         onTouchStart={(e) => handleTouchStart(e, k.noteId)}
                     >
                        <span aria-hidden="true" className={`absolute inset-0 rounded-b-[4px] pointer-events-none transition-opacity duration-150 ${t.pianoWhiteKeyGuide}`} style={{ opacity: guideOpacity }} />
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

                     const prevWhiteIndex = midiToWhiteIdx.get(k.midi - 1);
                     if (prevWhiteIndex === undefined) return null;

                     const leftPct = (prevWhiteIndex + 1) * unitWidthPct - (blackWidthPct / 2);

                     const isUserActive = activeNotes.has(k.noteId);
                     const guideLevel = guideNotes.get(k.noteId) ?? 0;
                     const isPlaybackActive = guideLevel >= 1;

                     let keyClass = t.pianoBlackKey;
                     if (isPlaybackActive) keyClass = t.pianoBlackKeyPlayback;
                     else if (isUserActive) keyClass = t.pianoBlackKeyActive;
                     const guideOpacity = !isUserActive ? guideFillOpacity(guideLevel) : 0;

                     const extraClass = (isUserActive && isPlaybackActive) ? '!brightness-125' : '';

                     return (
                         <div
                             ref={(element) => {
                                 if (element) keyRefs.current.set(k.noteId, element);
                                 else keyRefs.current.delete(k.noteId);
                             }}
                             key={k.noteId}
                             data-note-id={k.noteId}
                             role="button"
                             aria-label={k.noteId}
                             aria-pressed={isUserActive || isPlaybackActive || false}
                             tabIndex={focusedNote === k.noteId ? 0 : -1}
                             className={`absolute h-[64%] border-b-4 rounded-b-[3px] z-10 pointer-events-auto focus:outline-none focus:ring-2 focus:ring-inset focus:ring-yellow-400 ${keyClass} ${extraClass}`}
                             style={{
                                 left: `${leftPct}%`,
                                 width: `${blackWidthPct}%`
                             }}
                             onFocus={() => setFocusedNote(k.noteId)}
                             onKeyDown={(e) => handleKeyboardDown(e, k.noteId)}
                             onKeyUp={(e) => handleKeyboardUp(e, k.noteId)}
                             onBlur={() => {
                                 if (keyboardPressedRef.current.delete(k.noteId)) onStopNote(k.noteId);
                             }}
                             onMouseDown={(e) => { e.stopPropagation(); handleNoteAction(k.noteId, 'down', e); }}
                             onMouseUp={(e) => { e.stopPropagation(); handleNoteAction(k.noteId, 'up', e); }}
                             onMouseEnter={(e) => handleNoteAction(k.noteId, 'enter', e)}
                             onMouseLeave={(e) => handleNoteAction(k.noteId, 'leave', e)}
                             onTouchStart={(e) => { e.stopPropagation(); handleTouchStart(e, k.noteId); }}
                         >
                             <span aria-hidden="true" className={`absolute inset-0 rounded-b-[3px] pointer-events-none transition-opacity duration-150 ${t.pianoBlackKeyGuide}`} style={{ opacity: guideOpacity }} />
                         </div>
                     );
                 })}
            </div>
        </div>
    );
};

export default React.memo(PianoKeyboard);
