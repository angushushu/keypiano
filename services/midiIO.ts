
import { Midi } from '@tonejs/midi';
import { InstrumentID } from './audioEngine';
import { NOTE_NAMES } from '../constants';

// Internal App Event Structure
export interface AppEvent {
    time: number; // in milliseconds
    type: 'on' | 'off';
    note: string;
    transpose: number;
    instrumentId: InstrumentID;
    velocity?: number;
}

// Helper: Convert MIDI Number (60) to Note Name (C4)
const midiToNote = (midi: number): string => {
    const octave = Math.floor(midi / 12) - 1;
    const nameIdx = midi % 12;
    return `${NOTE_NAMES[nameIdx]}${octave}`;
};

// Helper: Convert Note Name (C4) to MIDI Number (60)
const noteToMidi = (note: string): number => {
    const match = note.match(/([A-G][#b]?)(-?\d+)/);
    if (!match) return 60; // default Middle C
    let [_, name, octStr] = match;
    const octave = parseInt(octStr);
    
    // Handle flats
    const flatMap: Record<string, string> = {'Db':'C#', 'Eb':'D#', 'Gb':'F#', 'Ab':'G#', 'Bb':'A#'};
    if (flatMap[name]) name = flatMap[name];
    
    const idx = NOTE_NAMES.indexOf(name);
    return (octave + 1) * 12 + idx;
};

// --- IMPORT FUNCTION ---
export function parseMidiFile(buffer: ArrayBuffer): AppEvent[] {
    try {
        // 1. Load buffer into Tonejs/Midi
        const midi = new Midi(buffer);
        const events: AppEvent[] = [];

        // 2. Iterate all tracks
        midi.tracks.forEach(track => {
            // Tonejs/Midi automatically handles:
            // - Converting Ticks to Seconds (handling tempo changes map)
            // - Parsing Running Status
            // - Pairing NoteOn/NoteOff into "Note" objects with duration
            
            track.notes.forEach(note => {
                // Create Note ON event
                events.push({
                    time: note.time * 1000, // Convert seconds to ms
                    type: 'on',
                    note: note.name, // e.g., "C4", "F#5"
                    transpose: 0,
                    instrumentId: 'salamander', // Default, logic could be enhanced to map MIDI programs
                    velocity: Math.round(note.velocity * 127)
                });

                // Create Note OFF event
                events.push({
                    time: (note.time + note.duration) * 1000, // Seconds to ms
                    type: 'off',
                    note: note.name,
                    transpose: 0,
                    instrumentId: 'salamander'
                });
            });
        });

        // 3. Sort Events
        // Important: If times are identical, Note OFF should come before Note ON 
        // to handle legato properly on monophonic channels or same-key presses.
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
export function generateMidiFile(events: AppEvent[]): Blob {
    // 1. Create a new MIDI object
    const midi = new Midi();
    
    // 2. Create a track
    const track = midi.addTrack();
    
    // 3. Reconstruct "Notes" from "Events"
    // Our app stores separate ON and OFF events. 
    // We need to pair them to creating valid MIDI Note objects.
    
    const pendingNotes: Record<string, { startTime: number, velocity: number }> = {};
    
    // Ensure chronological order
    const sortedEvents = [...events].sort((a, b) => a.time - b.time);

    sortedEvents.forEach(evt => {
        // Calculate effective note (apply transpose)
        const rawMidi = noteToMidi(evt.note);
        const finalMidi = rawMidi + evt.transpose;
        // Clamp to 0-127
        const clampedMidi = Math.max(0, Math.min(127, finalMidi));
        const finalNoteName = midiToNote(clampedMidi);
        
        // Use a unique key for polyphony handling (Note + Transpose)
        // Actually, just using the calculated MIDI number is safer for the map key
        const key = finalMidi;

        if (evt.type === 'on') {
            // Store start time (in Seconds)
            pendingNotes[key] = {
                startTime: evt.time / 1000,
                velocity: (evt.velocity || 80) / 127
            };
        } else if (evt.type === 'off') {
            const pending = pendingNotes[key];
            if (pending) {
                const endTime = evt.time / 1000;
                let duration = endTime - pending.startTime;
                
                // Prevent zero or negative duration bugs
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

                // Remove from pending
                delete pendingNotes[key];
            }
        }
    });

    // 4. Export to Uint8Array and then Blob
    const array = midi.toArray();
    // Casting array to any to bypass the specific TypeScript definition mismatch
    // between Uint8Array<ArrayBufferLike> and BlobPart (which expects ArrayBuffer).
    return new Blob([array as any], { type: 'audio/midi' });
}
