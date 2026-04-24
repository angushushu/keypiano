
import { Midi } from '@tonejs/midi';
import { InstrumentID } from './audioEngine';
import { NOTE_NAMES, noteToMidi, midiNumberToNote, FLAT_TO_SHARP } from '../constants';
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

    const pendingNotes: Record<number, { startTime: number, velocity: number }> = {};

    const sortedEvents = [...events].sort((a, b) => a.time - b.time);

    sortedEvents.forEach(evt => {
        const rawMidi = noteToMidi(evt.note);
        const finalMidi = rawMidi + evt.transpose;
        const clampedMidi = Math.max(0, Math.min(127, finalMidi));
        const finalNoteName = midiNumberToNote(clampedMidi);

        const key = finalMidi;

        if (evt.type === 'on') {
            pendingNotes[key] = {
                startTime: evt.time / 1000,
                velocity: (evt.velocity || 80) / 127
            };
        } else if (evt.type === 'off') {
            const pending = pendingNotes[key];
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

                delete pendingNotes[key];
            }
        }
    });

    const array = midi.toArray();
    return new Blob([new Uint8Array(array)], { type: 'audio/midi' });
}
