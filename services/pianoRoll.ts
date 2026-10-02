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

export interface RollPoint { time: number; pitch: number }

/** Any bar touching the region is selected, regardless of drag direction. */
export function selectRollNotes(notes: readonly RollNote[], from: RollPoint, to: RollPoint): Set<string> {
    const start = Math.min(from.time, to.time);
    const end = Math.max(from.time, to.time);
    const low = Math.min(from.pitch, to.pitch);
    const high = Math.max(from.pitch, to.pitch);
    return new Set(notes.filter(note => note.pitch >= low && note.pitch <= high && note.start <= end && note.end >= start).map(note => note.id));
}

/** Snap the anchor, then apply one bounded offset to preserve the whole phrase. */
export function moveRollNotes(notes: readonly RollNote[], ids: ReadonlySet<string>, anchorId: string, deltaTime: number, deltaPitch: number, step: number): RollNote[] {
    const selected = notes.filter(note => ids.has(note.id));
    const anchor = selected.find(note => note.id === anchorId);
    if (!anchor) return [...notes];
    const time = deltaTime === 0 ? 0 : Math.max(-Math.min(...selected.map(note => note.start)), snapTime(anchor.start + deltaTime, step) - anchor.start);
    const pitch = Math.max(-Math.min(...selected.map(note => note.pitch)), Math.min(127 - Math.max(...selected.map(note => note.pitch)), Math.round(deltaPitch)));
    return notes.map(note => ids.has(note.id) ? { ...note, start: note.start + time, end: note.end + time, pitch: note.pitch + pitch } : note);
}

/** Keep length differences and constrain shortening by the shortest selected note. */
export function resizeRollNotes(notes: readonly RollNote[], ids: ReadonlySet<string>, anchorId: string, deltaTime: number, step: number): RollNote[] {
    const selected = notes.filter(note => ids.has(note.id));
    const anchor = selected.find(note => note.id === anchorId);
    if (!anchor) return [...notes];
    const shortest = Math.min(...selected.map(note => note.end - note.start));
    const minimum = Math.min(shortest, Math.max(10, step));
    const delta = Math.max(minimum - shortest, snapTime(anchor.end + deltaTime, step) - anchor.end);
    return notes.map(note => ids.has(note.id) ? { ...note, end: note.end + delta } : note);
}
