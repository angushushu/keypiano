
import { Midi } from '@tonejs/midi';
import { noteToMidi } from '../constants';
import { RecordedEvent } from '../types';

type ExportTrack = ReturnType<Midi['addTrack']>;

const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

const readChannel = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value)
        ? clamp(Math.round(value), 0, 15)
        : undefined;

const readProgram = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value)
        ? clamp(Math.round(value), 0, 127)
        : undefined;

// --- IMPORT FUNCTION ---
export function parseMidiFile(buffer: ArrayBuffer): RecordedEvent[] {
    try {
        const midi = new Midi(buffer);
        const events: RecordedEvent[] = [];

        midi.tracks.forEach(track => {
            // Keep the source track identity so exporting the same events again
            // does not merge a multi-track file onto a single channel.
            const channel = readChannel(track.channel) ?? 0;
            const trackName = track.name || undefined;
            const program = readProgram(track.instrument?.number);

            track.notes.forEach(note => {
                events.push({
                    time: note.time * 1000,
                    type: 'on',
                    note: note.name,
                    transpose: 0,
                    instrumentId: 'salamander',
                    velocity: Math.round(note.velocity * 127),
                    channel,
                    trackName,
                    program
                });

                events.push({
                    time: (note.time + note.duration) * 1000,
                    type: 'off',
                    note: note.name,
                    transpose: 0,
                    instrumentId: 'salamander',
                    channel,
                    trackName,
                    program
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

interface ExportGroup {
    channel: number;
    trackName: string;
    program: number | null;
    events: RecordedEvent[];
}

const groupKey = (channel: number, trackName: string, program: number | null): string =>
    `${channel}\u0000${trackName}\u0000${program ?? -1}`;

/** Pairs note-on/note-off events into notes on a single track. */
function writeGroup(track: ExportTrack, events: RecordedEvent[]): void {
    const pendingNotes: Record<number, { startTime: number, velocity: number }[]> = {};

    events.forEach(evt => {
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

    const lastEventSec = events.length > 0 ? events[events.length - 1].time / 1000 : 0;
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
}

export function generateMidiFile(events: RecordedEvent[]): Blob {
    const midi = new Midi();
    const sortedEvents = [...events].sort((a, b) => a.time - b.time);

    // Imported files can carry several tracks. Group first so a round trip
    // preserves them instead of flattening every note onto channel 1.
    const groups = new Map<string, ExportGroup>();
    for (const evt of sortedEvents) {
        const channel = readChannel(evt.channel) ?? 0;
        const trackName = evt.trackName ?? '';
        const program = readProgram(evt.program) ?? null;
        const key = groupKey(channel, trackName, program);

        let group = groups.get(key);
        if (!group) {
            group = { channel, trackName, program, events: [] };
            groups.set(key, group);
        }
        group.events.push(evt);
    }

    for (const group of groups.values()) {
        const track = midi.addTrack();
        track.channel = group.channel;
        if (group.trackName) track.name = group.trackName;
        if (group.program !== null) {
            // An unknown program still resolves to a concrete GM instrument so
            // the file plays back predictably in other sequencers.
            track.instrument.number = group.program;
        }
        writeGroup(track, group.events);
    }

    const array = midi.toArray();
    return new Blob([new Uint8Array(array)], { type: 'audio/midi' });
}
