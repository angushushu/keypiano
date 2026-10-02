import { midiNumberToNote } from '../constants';
import type { RecordedEvent } from '../types';
import { eventPitch, noteQueueKey } from './waitGate';

export interface RollNote {
    id: string;
    pitch: number;
    start: number;
    end: number;
    event: RecordedEvent;
    held: boolean;
}

/** Pair by note identity/source, keeping overlapping unisons separate. */
export function eventsToRollNotes(events: readonly RecordedEvent[], now = 0): RollNote[] {
    const notes: RollNote[] = [];
    const pending = new Map<string, RollNote[]>();
    events.forEach((event, index) => {
        const key = noteQueueKey(event);
        const queue = pending.get(key) ?? [];
        if (event.type === 'on') {
            const note: RollNote = {
                id: event.noteId ?? `event-${index}`, pitch: eventPitch(event),
                start: event.time, end: Math.max(event.time + 1, now), event, held: true,
            };
            queue.push(note);
            notes.push(note);
            pending.set(key, queue);
        } else {
            const note = queue.shift();
            if (note) { note.end = Math.max(note.start + 1, event.time); note.held = false; }
            if (!queue.length) pending.delete(key);
        }
    });
    return notes;
}

/** Edited notes have explicit identities so crossing note-offs keep their lengths. */
export function rollNotesToEvents(notes: readonly RollNote[]): RecordedEvent[] {
    const events: RecordedEvent[] = [];
    for (const note of notes) {
        const pitch = Math.max(0, Math.min(127, Math.round(note.pitch)));
        const start = Math.max(0, note.start);
        const on: RecordedEvent = {
            ...note.event, noteId: note.id, type: 'on', time: start,
            note: midiNumberToNote(pitch), transpose: 0,
        };
        if (pitch !== eventPitch(note.event)) delete on.code;
        const { velocity: _velocity, ...off } = on;
        events.push(on, { ...off, type: 'off', time: Math.max(start + 1, note.end) });
    }
    return events.sort((a, b) => a.time - b.time || (a.type === b.type ? 0 : a.type === 'off' ? -1 : 1));
}

export const snapTime = (time: number, step: number) => Math.max(0, step > 0 ? Math.round(time / step) * step : time);

export function moveRollNote(note: RollNote, deltaTime: number, deltaPitch: number, step: number): RollNote {
    const start = snapTime(note.start + deltaTime, step);
    return { ...note, start, end: start + note.end - note.start, pitch: Math.max(0, Math.min(127, note.pitch + Math.round(deltaPitch))) };
}

export function resizeRollNote(note: RollNote, end: number, step: number): RollNote {
    return { ...note, end: Math.max(note.start + Math.max(10, step), snapTime(end, step)) };
}
