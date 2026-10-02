import { RecordedEvent } from '../types';
import { getTransposedNote, noteToMidi } from '../constants';

// Practice "wait mode": playback halts at each upcoming note (or chord) until
// the player has pressed every pitch in it.

/** Note-ons this close together are one chord and must all be pressed. */
export const CHORD_WINDOW_MS = 60;
/** Presses this far ahead of a gate (in real time) still count for it. */
export const EARLY_WINDOW_MS = 400;

export interface WaitGate {
    /** Track time the clock halts at: the chord's first note-on. */
    timeMs: number;
    /** Track time of the chord's last note-on; the next gate starts after it. */
    endTimeMs: number;
    /** MIDI pitches the player must press, compared numerically so C#4 matches Db4. */
    required: number[];
    hit: number[];
}

export const eventPitch = (evt: RecordedEvent) => noteToMidi(getTransposedNote(evt.note, evt.transpose));
export const noteQueueKey = (evt: RecordedEvent) => JSON.stringify([
    evt.noteId, evt.code, evt.channel, evt.trackName, evt.program, evt.instrumentId, eventPitch(evt),
]);

/** Repeated attacks start a new chord; simultaneous unisons stay together. */
export function groupNoteChords(events: RecordedEvent[]): RecordedEvent[][] {
    const ons = events.filter(evt => evt.type === 'on').sort((a, b) => a.time - b.time || eventPitch(a) - eventPitch(b));
    const chords: RecordedEvent[][] = [];
    for (let index = 0; index < ons.length;) {
        const batch = [ons[index++]];
        while (index < ons.length && ons[index].time === batch[0].time) batch.push(ons[index++]);
        const current = chords[chords.length - 1];
        if (current && batch[0].time - current[0].time <= CHORD_WINDOW_MS
            && !batch.some(evt => current.some(previous => eventPitch(previous) === eventPitch(evt)))) current.push(...batch);
        else chords.push(batch);
    }
    return chords;
}

/**
 * The first chord starting at or after `fromMs` (strictly after it when
 * `inclusive` is false), or null when the piece has no notes left.
 */
export function findNextGate(events: RecordedEvent[], fromMs: number, inclusive = true): WaitGate | null {
    const first = events.find(evt => evt.type === 'on' && (inclusive ? evt.time >= fromMs : evt.time > fromMs));
    if (!first) return null;

    const candidates = events.filter(evt => (
        evt.type === 'on' && evt.time >= first.time && evt.time <= first.time + CHORD_WINDOW_MS
    ));
    const chord = groupNoteChords(candidates)[0];
    return {
        timeMs: first.time,
        endTimeMs: Math.max(...chord.map(evt => evt.time)),
        required: [...new Set(chord.map(eventPitch))],
        hit: [],
    };
}

/** Records a press; returns the same gate when the pitch is not part of it. */
export function withHit(gate: WaitGate, pitch: number): WaitGate {
    if (!gate.required.includes(pitch) || gate.hit.includes(pitch)) return gate;
    return { ...gate, hit: [...gate.hit, pitch] };
}

export const isGateSatisfied = (gate: WaitGate) => gate.required.every(pitch => gate.hit.includes(pitch));

export const remainingNotes = (gate: WaitGate) => gate.required.filter(pitch => !gate.hit.includes(pitch)).length;

/** Whether a press at `trackTimeMs` is close enough to count toward the gate. */
export const isWithinGateWindow = (gate: WaitGate, trackTimeMs: number, speed: number) => (
    trackTimeMs >= gate.timeMs - EARLY_WINDOW_MS * speed
);
