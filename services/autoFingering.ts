import { ALL_ROWS, IMMUNE_TO_MODIFIERS, getTransposedNote, noteToMidi } from '../constants';
import { RecordedEvent } from '../types';
import { CHORD_WINDOW_MS } from './waitGate';

// Chooses computer keys for notes that carry no recorded key (imported MIDI),
// following how a keyboard piano is played: the left hand on the two lower
// letter rows, the right hand on the Q row and the number row, black keys as
// Shift (+1) or Ctrl (-1) on a neighbouring key, and each hand staying near
// where it already is. The numpad and arrow keys are only used when the
// player has them.

export type Hand = 'left' | 'right';
/** Semitones added by the held modifier: Shift +1, Ctrl -1. */
export type Modifier = 0 | 1 | -1;

export interface KeyAssignment {
    code: string;
    modifier: Modifier;
    hand: Hand;
}

export interface FingeringOptions {
    /** The player has a numpad and arrow keys to use. */
    useNumpad: boolean;
}

/** Below this pitch (C4) a note belongs to the left hand when nothing else decides. */
export const HAND_SPLIT_MIDI = 60;
/** A single-note line only moves to the left hand once it drops below F3. */
const MELODY_LEFT_BELOW_MIDI = 53;

const RIGHT_HAND_ROWS = new Set([1, 2]);
const LEFT_HAND_ROWS = new Set([3, 4]);

// Costs for choosing between keys that produce the same pitch.
const ROW_MOVE_COST = 1.5;
const COLUMN_MOVE_COST = 0.25;
const OTHER_HAND_AREA_COST = 8;
const NUMPAD_AREA_COST = 6;
const MODIFIER_COST = 1.5;
// Sharps are read as "raise" (Shift), flats as "lower" (Ctrl), as in jianpu.
const SPELLING_COST = 1;
const UNREACHABLE_COST = 100;

interface KeyPosition { row: number; x: number }
interface KeySlot extends KeyPosition { code: string; midi: number; isImmune: boolean }

/** Physical position of every key in the on-screen layout, in key units. */
const KEY_POSITIONS: Map<string, KeyPosition> = (() => {
    const positions = new Map<string, KeyPosition>();
    ALL_ROWS.forEach((row, rowIndex) => {
        let x = 0;
        for (const key of row) {
            const width = key.width ?? 1;
            if (!key.isDummy) positions.set(key.code, { row: rowIndex, x: x + width / 2 });
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
    const chords: RecordedEvent[][] = [];
    for (const evt of [...ons].sort((a, b) => a.time - b.time)) {
        const current = chords[chords.length - 1];
        if (current && evt.time - current[0].time <= CHORD_WINDOW_MS) current.push(evt);
        else chords.push([evt]);
    }
    return chords;
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

const soundingMidi = (slot: KeySlot, modifier: Modifier) => (slot.isImmune ? slot.midi : slot.midi + modifier);

function spellingCost(evt: RecordedEvent, modifier: Modifier): number {
    if (modifier === 0) return 0;
    const isFlat = /^[A-G]b/.test(evt.note);
    const isSharp = evt.note.includes('#');
    return (modifier === 1 && isSharp) || (modifier === -1 && isFlat) ? 0 : SPELLING_COST;
}

function slotCost(slot: KeySlot, hand: Hand, from: KeyPosition): number {
    const handRows = hand === 'right' ? RIGHT_HAND_ROWS : LEFT_HAND_ROWS;
    const areaCost = slot.isImmune ? NUMPAD_AREA_COST : handRows.has(slot.row) ? 0 : OTHER_HAND_AREA_COST;
    return areaCost + Math.abs(slot.row - from.row) * ROW_MOVE_COST + Math.abs(slot.x - from.x) * COLUMN_MOVE_COST;
}

function bestSlot(slots: KeySlot[], midi: number, hand: Hand, modifier: Modifier, from: KeyPosition) {
    let best: { slot: KeySlot; cost: number } | null = null;
    for (const slot of slots) {
        if (soundingMidi(slot, modifier) !== midi) continue;
        const cost = slotCost(slot, hand, from);
        if (!best || cost < best.cost) best = { slot, cost };
    }
    return best;
}

/**
 * Keys for every note-on without a recorded key. A modifier is held for the
 * whole chord (it transposes every non-numpad key pressed with it), so each
 * chord uses the single modifier state that reaches its notes best.
 */
export function assignPiece(
    events: RecordedEvent[],
    keymap: Record<string, string>,
    offset: number,
    options: FingeringOptions,
): Map<RecordedEvent, KeyAssignment> {
    const slots = buildKeySlots(keymap, offset).filter(slot => options.useNumpad || !slot.isImmune);
    const ons = events.filter(evt => evt.type === 'on' && !evt.code);
    const hands = assignHands(ons);
    const positions: Record<Hand, KeyPosition> = { ...HAND_ANCHORS };
    const assignments = new Map<RecordedEvent, KeyAssignment>();

    for (const chord of groupChords(ons)) {
        let best: { total: number; modifier: Modifier; picks: (KeySlot | null)[] } | null = null;
        for (const modifier of [0, 1, -1] as Modifier[]) {
            let total = modifier === 0 ? 0 : MODIFIER_COST;
            const picks = chord.map(evt => {
                const hand = hands.get(evt) ?? 'right';
                const pick = bestSlot(slots, eventMidi(evt), hand, modifier, positions[hand]);
                total += pick ? pick.cost + spellingCost(evt, modifier) : UNREACHABLE_COST;
                return pick?.slot ?? null;
            });
            if (!best || total < best.total) best = { total, modifier, picks };
        }
        if (!best) continue;
        const { picks, modifier } = best;

        chord.forEach((evt, index) => {
            const hand = hands.get(evt) ?? 'right';
            let slot = picks[index];
            let noteModifier = modifier;
            if (!slot) {
                // No key reaches this note with the chord's modifier (e.g. F# in
                // D-F#-A without a numpad). Give it its own modifier: the player
                // rolls the chord, pressing it with Shift or Ctrl just before or after.
                const fallback = ([1, -1, 0] as Modifier[])
                    .filter(candidate => candidate !== modifier)
                    .flatMap(candidate => {
                        const pick = bestSlot(slots, eventMidi(evt), hand, candidate, positions[hand]);
                        return pick ? [{ candidate, slot: pick.slot, cost: pick.cost + spellingCost(evt, candidate) }] : [];
                    })
                    .sort((a, b) => a.cost - b.cost)[0];
                if (!fallback) return;
                slot = fallback.slot;
                noteModifier = fallback.candidate;
            }
            assignments.set(evt, { code: slot.code, modifier: slot.isImmune ? 0 : noteModifier, hand });
            positions[hand] = { row: slot.row, x: slot.x };
        });
    }
    return assignments;
}

/** Note-ons without a recorded key that no key can play at this transposition. */
export function countUnreachable(
    events: RecordedEvent[],
    keymap: Record<string, string>,
    offset: number,
    options: FingeringOptions,
): number {
    const ons = events.filter(evt => evt.type === 'on' && !evt.code);
    if (ons.length === 0) return 0;
    return ons.length - assignPiece(events, keymap, offset, options).size;
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
    options: FingeringOptions,
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
