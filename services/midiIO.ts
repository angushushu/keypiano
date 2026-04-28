
import { Midi } from '@tonejs/midi';
import { noteToMidi } from '../constants';
import { RecordedEvent } from '../types';

// --- IMPORT FUNCTION ---
export function parseMidiFile(buffer: ArrayBuffer): RecordedEvent[] {
    try {
        const midi = new Midi(buffer);
        const events: RecordedEvent[] = [];

        midi.tracks.forEach(track => {
            track.notes.forEach(note => {
                events.push({
                    time: note.time * 1000,
                    type: 'on',
                    note: note.name,
                    transpose: 0,
                    instrumentId: 'salamander',
                    velocity: Math.round(note.velocity * 127)
                });

                events.push({
                    time: (note.time + note.duration) * 1000,
                    type: 'off',
                    note: note.name,
                    transpose: 0,
                    instrumentId: 'salamander'
                });
            });
        });

        return events.sort((a, b) => {
            if (Math.abs(a.time - b.time) < 0.1) {
                const typeA = a.type === 'off' ? 0 : 1;
                const typeB = b.type === 'off' ? 0 : 1;
                return typeA - typeB;
            }
            return a.time - b.time;
        });

    } catch (e) {
        console.error("Failed to parse MIDI with library:", e);
        throw e;
    }
}

// --- EXPORT FUNCTION ---
export function generateMidiFile(events: RecordedEvent[]): Blob {
    const midi = new Midi();
    const track = midi.addTrack();

    const pendingNotes: Record<number, { startTime: number, velocity: number }[]> = {};

    const sortedEvents = [...events].sort((a, b) => a.time - b.time);

    sortedEvents.forEach(evt => {
        const rawMidi = noteToMidi(evt.note);
        const finalMidi = rawMidi + evt.transpose;
        const clampedMidi = Math.max(0, Math.min(127, finalMidi));

        const key = finalMidi;

        if (evt.type === 'on') {
            if (!pendingNotes[key]) pendingNotes[key] = [];
            pendingNotes[key].push({
                startTime: evt.time / 1000,
                velocity: (evt.velocity || 80) / 127
            });
        } else if (evt.type === 'off') {
            const pending = pendingNotes[key]?.shift();
            if (pending) {
                const endTime = evt.time / 1000;
                let duration = endTime - pending.startTime;

                if (duration <= 0) duration = 0.05;

                try {
                    track.addNote({
                        midi: clampedMidi,
                        time: pending.startTime,
                        duration: duration,
                        velocity: pending.velocity
                    });
                } catch (e) {
                    console.warn("Skipping invalid note export", e);
                }

                if (pendingNotes[key].length === 0) delete pendingNotes[key];
            } else {
                console.warn("Skipping unmatched note-off during MIDI export", evt);
            }
        }
    });

    const lastEventSec = sortedEvents.length > 0 ? sortedEvents[sortedEvents.length - 1].time / 1000 : 0;
    Object.entries(pendingNotes).forEach(([midiKey, pendingQueue]) => {
        const midi = Math.max(0, Math.min(127, parseInt(midiKey, 10)));
        pendingQueue.forEach(pending => {
            const duration = Math.max(0.05, lastEventSec - pending.startTime || 0.5);
            try {
                track.addNote({
                    midi,
                    time: pending.startTime,
                    duration,
                    velocity: pending.velocity
                });
            } catch (e) {
                console.warn("Skipping unterminated note export", e);
            }
        });
    });

    const array = midi.toArray();
    return new Blob([new Uint8Array(array)], { type: 'audio/midi' });
}
