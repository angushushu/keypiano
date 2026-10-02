import { ALL_ROWS, IMMUNE_TO_MODIFIERS, getTransposedNote, noteToMidi } from '../constants';
import { RecordedEvent } from '../types';
import { groupNoteChords } from './waitGate';
import { searchFingering, DEFAULT_FINGERING_OPTIONS, type Hand, type FingeringOptions, type KeyAssignment, type FingeringPlan, type KeyPosition, type KeySlot } from './fingeringPlanner';
export { DEFAULT_FINGERING_OPTIONS, noteEndTimes } from './fingeringPlanner';
export type { Finger, Hand, Modifier, KeyAssignment, FingeringOptions, FingeringPlan, FingeringIssue } from './fingeringPlanner';

// Chooses computer keys for notes that carry no recorded key (imported MIDI),
// using a full-size keyboard by default: the right hand plays unmodified
// notes on the numpad/navigation keys, leaving the left hand on the main
// block for Shift (+1) or Ctrl (-1). Without a numpad, hands split between
// the lower and upper main rows. Each hand stays near where it already is.

/** Below this pitch (C4) a note belongs to the left hand when nothing else decides. */
export const HAND_SPLIT_MIDI = 60;
/** A single-note line only moves to the left hand once it drops below F3. */
const MELODY_LEFT_BELOW_MIDI = 53;

/** Physical position of every key in the on-screen layout, in key units. */
const KEY_POSITIONS: Map<string, KeyPosition> = (() => {
    const positions = new Map<string, KeyPosition>();
    ALL_ROWS.forEach((row, rowIndex) => {
        let x = 0;
        for (const key of row) {
            const width = key.width ?? 1;
            if (!key.isDummy) positions.set(key.code, { row: rowIndex + ((key.height ?? 1) - 1) / 2, x: x + width / 2 });
            x += width;
        }
    });
    return positions;
})();

// Where each hand rests before its first note: the middle of its home row.
const HAND_ANCHORS: Record<Hand, KeyPosition> = {
    right: KEY_POSITIONS.get('KeyY') ?? { row: 2, x: 7 },
    left: KEY_POSITIONS.get('KeyF') ?? { row: 3, x: 5 },
};
const NUMPAD_ANCHOR = KEY_POSITIONS.get('Numpad5') ?? { row: 3, x: 22 };

/** Every mapped key with the pitch it sounds at the given transposition. */
export function buildKeySlots(keymap: Record<string, string>, offset: number): KeySlot[] {
    const slots: KeySlot[] = [];
    for (const [code, note] of Object.entries(keymap)) {
        const position = KEY_POSITIONS.get(code);
        if (!position) continue;
        slots.push({ code, ...position, midi: noteToMidi(getTransposedNote(note, offset)), isImmune: IMMUNE_TO_MODIFIERS.has(code) });
    }
    return slots;
}

const eventMidi = (evt: RecordedEvent) => noteToMidi(getTransposedNote(evt.note, evt.transpose));

/** Note-ons starting within CHORD_WINDOW_MS of each other, in time order. */
export function groupChords(ons: RecordedEvent[]): RecordedEvent[][] {
    return groupNoteChords(ons);
}

const trackKey = (evt: RecordedEvent) => `${evt.channel ?? ''}|${evt.trackName ?? ''}`;

/**
 * Hand per note. A file with several tracks usually keeps one hand per track,
 * so tracks are split by average pitch. Otherwise each chord's top note goes
 * to the right hand and the rest split at middle C.
 */
export function assignHands(ons: RecordedEvent[]): Map<RecordedEvent, Hand> {
    const hands = new Map<RecordedEvent, Hand>();
    const tracks = new Map<string, RecordedEvent[]>();
    for (const evt of ons) {
        const notes = tracks.get(trackKey(evt));
        if (notes) notes.push(evt);
        else tracks.set(trackKey(evt), [evt]);
    }

    if (tracks.size >= 2) {
        const averages = [...tracks].map(([key, notes]) => [key, notes.reduce((sum, evt) => sum + eventMidi(evt), 0) / notes.length] as const);
        const highest = Math.max(...averages.map(([, avg]) => avg));
        const lowest = Math.min(...averages.map(([, avg]) => avg));
        if (highest > lowest) {
            const middle = (highest + lowest) / 2;
            const trackHand = new Map(averages.map(([key, avg]) => [key, avg >= middle ? 'right' : 'left'] as const));
            ons.forEach(evt => hands.set(evt, trackHand.get(trackKey(evt)) ?? 'right'));
            return hands;
        }
    }

    let melodyHand: Hand | null = null;
    for (const chord of groupChords(ons)) {
        if (chord.length === 1) {
            // A single line keeps its hand across middle C instead of flipping on every step.
            const midi = eventMidi(chord[0]);
            if (midi >= HAND_SPLIT_MIDI) melodyHand = 'right';
            else if (midi < MELODY_LEFT_BELOW_MIDI || melodyHand === null) melodyHand = 'left';
            hands.set(chord[0], melodyHand);
            continue;
        }
        const top = chord.reduce((best, evt) => (eventMidi(evt) > eventMidi(best) ? evt : best), chord[0]);
        for (const evt of chord) {
            const isMelody = chord.length > 1 && evt === top && eventMidi(evt) >= HAND_SPLIT_MIDI - 5;
            hands.set(evt, isMelody || eventMidi(evt) >= HAND_SPLIT_MIDI ? 'right' : 'left');
        }
    }
    return hands;
}

/** Plan the whole piece, retaining alternative postures across chord boundaries. */
export function planPiece(
    events: RecordedEvent[], keymap: Record<string, string>, offset: number,
    options: FingeringOptions = DEFAULT_FINGERING_OPTIONS,
): FingeringPlan {
    const slots = buildKeySlots(keymap, offset).filter(slot => options.useNumpad || !slot.isImmune);
    const ons = events.filter(evt => evt.type === 'on' && !evt.code);
    const anchors = { ...HAND_ANCHORS, right: options.useNumpad ? NUMPAD_ANCHOR : HAND_ANCHORS.right };
    return searchFingering(events, groupChords(ons), slots, assignHands(ons), options, anchors, KEY_POSITIONS);
}

/** Compatibility wrapper for playback callers that only need key assignments. */
export function assignPiece(
    events: RecordedEvent[], keymap: Record<string, string>, offset: number,
    options: FingeringOptions = DEFAULT_FINGERING_OPTIONS,
): Map<RecordedEvent, KeyAssignment> {
    return planPiece(events, keymap, offset, options).assignments;
}

/** Note-ons without a recorded key that no key can play at this transposition. */
export function countUnreachable(
    events: RecordedEvent[],
    keymap: Record<string, string>,
    offset: number,
    options: FingeringOptions = DEFAULT_FINGERING_OPTIONS,
): number {
    const ons = events.filter(evt => evt.type === 'on' && !evt.code);
    if (ons.length === 0) return 0;
    // Range advice concerns pitch availability, not fingering difficulty.
    // Avoid running the sequence search seven times just to compare octaves.
    const playable = new Set(buildKeySlots(keymap, offset)
        .filter(slot => options.useNumpad || !slot.isImmune)
        .flatMap(slot => slot.isImmune ? [slot.midi] : [slot.midi - 1, slot.midi, slot.midi + 1]));
    return ons.filter(evt => !playable.has(eventMidi(evt))).length;
}

export const OCTAVE_RANGE = { min: -3, max: 3 };

/**
 * The octave setting that leaves the fewest notes unplayable, or null when the
 * current one is already best. Ties keep the octave nearest the current one.
 */
export function suggestOctave(
    events: RecordedEvent[],
    keymap: Record<string, string>,
    transposeBase: number,
    currentOctave: number,
    options: FingeringOptions = DEFAULT_FINGERING_OPTIONS,
): { octave: number; unreachableNow: number; unreachableThen: number } | null {
    const unreachableNow = countUnreachable(events, keymap, transposeBase + currentOctave * 12, options);
    if (unreachableNow === 0) return null;
    let best = { octave: currentOctave, unreachable: unreachableNow };
    for (let octave = OCTAVE_RANGE.min; octave <= OCTAVE_RANGE.max; octave++) {
        if (octave === currentOctave) continue;
        const unreachable = countUnreachable(events, keymap, transposeBase + octave * 12, options);
        const isCloser = Math.abs(octave - currentOctave) < Math.abs(best.octave - currentOctave);
        if (unreachable < best.unreachable || (unreachable === best.unreachable && isCloser && best.octave !== currentOctave)) {
            best = { octave, unreachable };
        }
    }
    return best.octave === currentOctave ? null : { octave: best.octave, unreachableNow, unreachableThen: best.unreachable };
}
