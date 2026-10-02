
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

        midi.tracks.forEach((track, trackIndex) => {
            // Keep the source track identity so exporting the same events again
            // does not merge a multi-track file onto a single channel.
            const channel = readChannel(track.channel) ?? 0;
            const trackName = track.name || undefined;
            const program = readProgram(track.instrument?.number);

            track.notes.forEach((note, noteIndex) => {
                const noteId = `midi-${trackIndex}-${noteIndex}`;
                events.push({
                    noteId,
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
                    noteId,
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
    const pendingNotes: Record<string, { midi: number, startTime: number, velocity: number }[]> = {};

    events.forEach(evt => {
        const rawMidi = noteToMidi(evt.note);
        const finalMidi = rawMidi + evt.transpose;
        const clampedMidi = Math.max(0, Math.min(127, finalMidi));

        const key = evt.noteId ?? `pitch:${finalMidi}`;

        if (evt.type === 'on') {
            if (!pendingNotes[key]) pendingNotes[key] = [];
            pendingNotes[key].push({
                midi: clampedMidi,
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
    Object.values(pendingNotes).forEach(pendingQueue => {
        pendingQueue.forEach(pending => {
            const duration = Math.max(0.05, lastEventSec - pending.startTime || 0.5);
            try {
                track.addNote({
                    midi: pending.midi,
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

export function generateMidiFile(events: RecordedEvent[], bpm = 120): Blob {
    const midi = new Midi();
    midi.header.setTempo(Number.isFinite(bpm) ? clamp(bpm, 20, 300) : 120);
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

    // MIDI 1 note-offs identify pitch/channel, not a note instance. Nested
    // unisons need separate channels or readers pair their durations FIFO.
    const usedChannels = new Set(midi.tracks.map(track => track.channel));
    const freeChannels = Array.from({ length: 16 }, (_, index) => index).filter(channel => channel !== 9 && !usedChannels.has(channel));
    for (const track of [...midi.tracks]) {
        const lanes: { track: ExportTrack; notes: typeof track.notes; ends: Map<number, number> }[] = [{ track, notes: [], ends: new Map() }];
        for (const note of [...track.notes].sort((a, b) => a.time - b.time)) {
            const end = note.time + note.duration;
            let lane = lanes.find(entry => (entry.ends.get(note.midi) ?? -Infinity) <= end);
            if (!lane) {
                const channel = freeChannels.shift();
                if (channel === undefined) throw new Error('MIDI_CHANNEL_OVERFLOW');
                const extra = midi.addTrack();
                extra.channel = channel;
                extra.name = track.name;
                extra.instrument.number = track.instrument.number;
                lane = { track: extra, notes: [], ends: new Map() };
                lanes.push(lane);
            }
            lane.notes.push(note);
            lane.ends.set(note.midi, end);
        }
        for (const lane of lanes) lane.track.notes = lane.notes;
    }

    const array = midi.toArray();
    return new Blob([new Uint8Array(array)], { type: 'audio/midi' });
}
