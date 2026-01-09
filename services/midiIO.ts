import { InstrumentID } from './audioEngine';

// Interfaces for internal use
export interface MidiEvent {
    deltaTime: number;
    type: string;
    channel: number;
    note: number;
    velocity: number;
    subtype?: string; // For meta events
}

export interface AppEvent {
    time: number;
    type: 'on' | 'off';
    note: string;
    transpose: number;
    instrumentId: InstrumentID;
    velocity?: number;
}

// Helper: Note Name to MIDI Number (C4 = 60)
const NOTE_TO_MIDI: Record<string, number> = {};
const MIDI_TO_NOTE: Record<number, string> = {};
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

(function initNotes() {
    for (let i = 0; i < 128; i++) {
        const octave = Math.floor(i / 12) - 1;
        const nameIdx = i % 12;
        const name = `${NOTE_NAMES[nameIdx]}${octave}`;
        NOTE_TO_MIDI[name] = i;
        MIDI_TO_NOTE[i] = name;
    }
})();

// Helper: Write Variable Length Quantity
function writeVarInt(value: number): number[] {
    const bytes = [];
    let buffer = value & 0x7F;
    while ((value >>= 7)) {
        buffer <<= 8;
        buffer |= ((value & 0x7F) | 0x80);
    }
    while (true) {
        bytes.push(buffer & 0xFF);
        if (buffer & 0x80) buffer >>= 8;
        else break;
    }
    return bytes;
}

// Helper: Read Variable Length Quantity
function readVarInt(view: DataView, offset: number): { value: number; length: number } {
    let result = 0;
    let length = 0;
    let byte = 0;
    
    do {
        byte = view.getUint8(offset + length);
        result = (result << 7) | (byte & 0x7f);
        length++;
    } while (byte & 0x80);

    return { value: result, length };
}

// Helper: String to Bytes
function stringToBytes(str: string): number[] {
    return str.split('').map(c => c.charCodeAt(0));
}

// --- EXPORT FUNCTION ---
export function generateMidiFile(events: AppEvent[]): Blob {
    // 1. Sort events by time
    const sortedEvents = [...events].sort((a, b) => a.time - b.time);

    // 2. Constants
    const PPQ = 480; // Ticks per quarter note
    const BPM = 120; // Assume 120 BPM for generic export (1ms = ~0.96 ticks at 120bpm/480ppq? No, math below)
    // Formula: ms_per_tick = 60000 / (BPM * PPQ)
    // 60000 / (120 * 480) = 1.0416 ms per tick.
    // So ticks = ms / 1.0416
    const MS_PER_TICK = 60000 / (BPM * PPQ);

    const trackBytes: number[] = [];
    let lastTime = 0;

    // 3. Convert Events to MIDI Bytes
    sortedEvents.forEach(evt => {
        // Calculate Delta Time
        const deltaMs = evt.time - lastTime;
        const deltaTicks = Math.round(deltaMs / MS_PER_TICK);
        lastTime = evt.time;

        // Write Delta Time (VLQ)
        trackBytes.push(...writeVarInt(deltaTicks));

        // Determine MIDI Note
        let midiNum = NOTE_TO_MIDI[evt.note];
        if (midiNum === undefined) return;
        midiNum += evt.transpose;
        // Clamp to 0-127
        midiNum = Math.max(0, Math.min(127, midiNum));

        // Status Byte
        const channel = 0;
        if (evt.type === 'on') {
            // Note On: 0x90
            trackBytes.push(0x90 | channel);
            trackBytes.push(midiNum);
            trackBytes.push(evt.velocity || 80); // Default velocity
        } else {
            // Note Off: 0x80 (or Note On vel 0)
            trackBytes.push(0x80 | channel);
            trackBytes.push(midiNum);
            trackBytes.push(0);
        }
    });

    // End of Track Meta Event: FF 2F 00
    trackBytes.push(0x00, 0xFF, 0x2F, 0x00);

    // 4. Construct Full File
    // Header Chunk
    const header = [
        0x4D, 0x54, 0x68, 0x64, // "MThd"
        0x00, 0x00, 0x00, 0x06, // Chunk size (6)
        0x00, 0x00,             // Format 0 (single track)
        0x00, 0x01,             // 1 Track
        (PPQ >> 8) & 0xFF, PPQ & 0xFF // PPQ
    ];

    // Track Chunk Header
    const trackHeader = [
        0x4D, 0x54, 0x72, 0x6B, // "MTrk"
        (trackBytes.length >> 24) & 0xFF,
        (trackBytes.length >> 16) & 0xFF,
        (trackBytes.length >> 8) & 0xFF,
        trackBytes.length & 0xFF
    ];

    const fileBytes = new Uint8Array([...header, ...trackHeader, ...trackBytes]);
    return new Blob([fileBytes], { type: 'audio/midi' });
}


// --- IMPORT FUNCTION ---
export function parseMidiFile(buffer: ArrayBuffer): AppEvent[] {
    const view = new DataView(buffer);
    let cursor = 0;

    // 1. Read Header
    const headerId = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    if (headerId !== 'MThd') throw new Error('Invalid MIDI header');
    
    cursor += 8; // Skip ID and length
    const format = view.getUint16(cursor); cursor += 2;
    const numTracks = view.getUint16(cursor); cursor += 2;
    const timeDivision = view.getUint16(cursor); cursor += 2;

    let ppq = 480;
    if (!(timeDivision & 0x8000)) {
        ppq = timeDivision;
    }

    // Default Tempo (120 BPM) -> Microseconds per quarter note = 500,000
    let usPerBeat = 500000; 

    const events: AppEvent[] = [];

    // 2. Read Tracks
    for (let t = 0; t < numTracks; t++) {
        const trackId = String.fromCharCode(view.getUint8(cursor), view.getUint8(cursor+1), view.getUint8(cursor+2), view.getUint8(cursor+3));
        cursor += 4;
        const trackLen = view.getUint32(cursor);
        cursor += 4;
        
        const endOfTrack = cursor + trackLen;
        let currentTimeTicks = 0;
        let currentTimeMs = 0;
        
        // Running Status
        let lastStatus = 0;

        while (cursor < endOfTrack) {
            // Read Delta Time
            const { value: deltaTicks, length: deltaLen } = readVarInt(view, cursor);
            cursor += deltaLen;
            
            currentTimeTicks += deltaTicks;
            
            // Convert Ticks to MS
            // ms = (ticks * usPerBeat) / (PPQ * 1000)
            const deltaMs = (deltaTicks * usPerBeat) / (ppq * 1000);
            currentTimeMs += deltaMs;

            // Read Event
            let status = view.getUint8(cursor);
            
            if (status & 0x80) {
                lastStatus = status;
                cursor++;
            } else {
                status = lastStatus;
            }

            const eventType = status >> 4;
            // const channel = status & 0x0F;

            if (eventType === 0x8) { // Note Off
                const note = view.getUint8(cursor++);
                const velocity = view.getUint8(cursor++);
                events.push({
                    time: currentTimeMs,
                    type: 'off',
                    note: MIDI_TO_NOTE[note] || 'C4',
                    transpose: 0,
                    instrumentId: 'salamander', // Default
                    velocity: velocity
                });
            } else if (eventType === 0x9) { // Note On
                const note = view.getUint8(cursor++);
                const velocity = view.getUint8(cursor++);
                
                if (velocity === 0) { // Note On with Vel 0 is Note Off
                    events.push({
                        time: currentTimeMs,
                        type: 'off',
                        note: MIDI_TO_NOTE[note] || 'C4',
                        transpose: 0,
                        instrumentId: 'salamander',
                        velocity: 0
                    });
                } else {
                    events.push({
                        time: currentTimeMs,
                        type: 'on',
                        note: MIDI_TO_NOTE[note] || 'C4',
                        transpose: 0,
                        instrumentId: 'salamander',
                        velocity: velocity
                    });
                }
            } else if (eventType === 0xF) { // Meta / Sysex
                if (status === 0xFF) { // Meta
                    const type = view.getUint8(cursor++);
                    const { value: len, length: lenBytes } = readVarInt(view, cursor);
                    cursor += lenBytes;
                    
                    if (type === 0x51) { // Set Tempo
                        const micros = (view.getUint8(cursor) << 16) | (view.getUint8(cursor+1) << 8) | view.getUint8(cursor+2);
                        usPerBeat = micros;
                    }
                    cursor += len;
                } else {
                    // Skip Sysex or other F events
                    // This is a naive skipper, standard MIDI is complex
                    // For simplified files, this usually works.
                    cursor++; 
                }
            } else {
                // Control Change, Program Change, Pitch Bend etc.
                // We just skip the data bytes.
                if (eventType === 0xC || eventType === 0xD) {
                    cursor++; // 1 data byte
                } else {
                    cursor += 2; // 2 data bytes
                }
            }
        }
    }
    
    // Sort imported events by time (merging tracks)
    return events.sort((a, b) => a.time - b.time);
}