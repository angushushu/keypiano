import assert from 'node:assert/strict';
import { Midi } from '@tonejs/midi';
import { eventsToRollNotes, moveRollNote, moveRollNotes, resizeRollNote, resizeRollNotes, rollNotesToEvents, selectRollNotes, snapTime } from '../services/pianoRoll';
import { generateMidiFile, parseMidiFile } from '../services/midiIO';
import { closeOpenNotes, sanitizeEvents } from '../services/takeStore';
import { computeActiveEvents } from '../hooks/useAudioScheduler';
import type { RecordedEvent } from '../types';

const event = (type: 'on' | 'off', time: number, noteId?: string): RecordedEvent => ({ type, time, note: 'C4', transpose: 0, instrumentId: 'drawbar_organ', ...(noteId ? { noteId } : {}) });

export const pianoRollTests: { name: string; run: () => void | Promise<void> }[] = [
    { name: 'region selection intersects note bars in either drag direction', run: () => {
        const notes = eventsToRollNotes([
            event('on', 0, 'long'), event('off', 1000, 'long'),
            { ...event('on', 500, 'high'), note: 'D4' }, { ...event('off', 700, 'high'), note: 'D4' },
            { ...event('on', 800, 'outside'), note: 'E4' }, { ...event('off', 900, 'outside'), note: 'E4' },
        ]);
        const from = { time: 600, pitch: 62 };
        const to = { time: 750, pitch: 60 };
        assert.deepEqual([...selectRollNotes(notes, from, to)], ['long', 'high']);
        assert.deepEqual(selectRollNotes(notes, from, to), selectRollNotes(notes, to, from));
        assert.equal(selectRollNotes(notes, { time: 1100, pitch: 0 }, { time: 1200, pitch: 127 }).size, 0);
    } },
    { name: 'group moves preserve timing, intervals and unselected notes while snapping the anchor', run: () => {
        const notes = eventsToRollNotes([event('on', 125, 'one'), event('off', 925, 'one'), event('on', 330, 'two'), event('off', 580, 'two'), event('on', 1500, 'other'), event('off', 1800, 'other')]);
        notes[1].pitch = 64;
        const moved = moveRollNotes(notes, new Set(['one', 'two']), 'one', 220, 2, 125);
        assert.deepEqual(moved.map(note => [note.start, note.end, note.pitch]), [[375, 1175, 62], [580, 830, 66], [1500, 1800, 60]]);
        assert.strictEqual(moved[2], notes[2]);
        assert.deepEqual(notes.map(note => note.start), [125, 330, 1500]);
        const pitchOnly = moveRollNotes(notes, new Set(['one', 'two']), 'two', 0, 1, 125);
        assert.deepEqual(pitchOnly.map(note => note.start), [125, 330, 1500], 'pitch-only edits keep recorded onsets intact');
    } },
    { name: 'group movement clamps the whole phrase at time zero and MIDI pitch bounds', run: () => {
        const notes = eventsToRollNotes([event('on', 0, 'one'), event('off', 1000, 'one'), event('on', 300, 'two'), event('off', 700, 'two')]);
        notes[0].pitch = 0; notes[1].pitch = 126;
        const ids = new Set(['one', 'two']);
        assert.deepEqual(moveRollNotes(notes, ids, 'two', -1000, -4, 125).map(note => [note.start, note.pitch]), [[0, 0], [300, 126]]);
        assert.deepEqual(moveRollNotes(notes, ids, 'two', 0, 9, 0).map(note => note.pitch), [1, 127]);
    } },
    { name: 'group resizing preserves starts and length differences without invalidating short recorded notes', run: () => {
        const notes = eventsToRollNotes([event('on', 0, 'one'), event('off', 1000, 'one'), event('on', 200, 'two'), event('off', 250, 'two'), event('on', 900, 'other'), event('off', 1300, 'other')]);
        const ids = new Set(['one', 'two']);
        const grown = resizeRollNotes(notes, ids, 'one', 260, 125);
        assert.deepEqual(grown.map(note => [note.start, note.end]), [[0, 1250], [200, 500], [900, 1300]]);
        const shorter = resizeRollNotes(grown, ids, 'one', -2000, 125);
        assert.deepEqual(shorter.map(note => note.end - note.start), [1075, 125, 400]);
        assert.deepEqual(resizeRollNotes(notes, ids, 'one', -500, 125).map(note => note.end), [1000, 250, 1300]);
    } },
    { name: 'piano-roll note lengths pair crossing unisons by identity', run: () => {
        const events = [event('on', 0, 'long'), event('on', 100, 'short'), event('off', 200, 'short'), event('off', 900, 'long')];
        const notes = eventsToRollNotes(events);
        assert.deepEqual(notes.map(note => [note.id, note.start, note.end]), [['long', 0, 900], ['short', 100, 200]]);
        assert.equal(computeActiveEvents(events, 300).size, 1);
        assert.equal([...computeActiveEvents(events, 300).values()][0].noteId, 'long');
    } },
    { name: 'a held piano-roll bar grows without a fixed length limit', run: () => {
        const notes = eventsToRollNotes([event('on', 1000)], 61_000);
        assert.equal(notes[0].end - notes[0].start, 60_000);
        assert.ok(notes[0].held);
    } },
    { name: 'piano-roll moves snap onset, preserve length and clamp pitch and time', run: () => {
        const note = eventsToRollNotes([event('on', 125), event('off', 925)])[0];
        assert.deepEqual([moveRollNote(note, 220, 2, 125).start, moveRollNote(note, 220, 2, 125).end], [375, 1175]);
        const moved = moveRollNote(note, -1000, -100, 125);
        assert.equal(moved.start, 0);
        assert.equal(moved.end, 800);
        assert.equal(moved.pitch, 0);
        assert.equal(snapTime(374, 125), 375);
    } },
    { name: 'piano-roll resize never produces zero-length or backward notes', run: () => {
        const note = eventsToRollNotes([event('on', 500), event('off', 1000)])[0];
        assert.equal(resizeRollNote(note, -100, 125).end, 625);
        assert.equal(resizeRollNote(note, 1510, 125).end, 1500);
    } },
    { name: 'edited notes preserve track, channel, program and velocity but clear stale physical keys', run: () => {
        const on = { ...event('on', 0), code: 'KeyA', channel: 5, trackName: 'Strings', program: 48, velocity: 73, transpose: 12 };
        const note = eventsToRollNotes([on, { ...on, type: 'off' as const, time: 1000 }])[0];
        const same = rollNotesToEvents([note]);
        assert.equal(same[0].note, 'C5');
        assert.equal(same[0].code, 'KeyA');
        const edited = rollNotesToEvents([moveRollNote(note, 500, 2, 125)]);
        assert.equal(edited[0].note, 'D5');
        assert.equal(edited[0].code, undefined);
        assert.equal(edited[0].velocity, 73);
        for (const evt of edited) {
            assert.equal(evt.channel, 5); assert.equal(evt.program, 48); assert.equal(evt.trackName, 'Strings');
        }
    } },
    { name: 'MIDI download keeps crossing edited note lengths and the selected tempo', run: async () => {
        const source = [event('on', 0, 'long'), event('on', 100, 'short'), event('off', 200, 'short'), event('off', 900, 'long')];
        const blob = generateMidiFile(rollNotesToEvents(eventsToRollNotes(source)), 96);
        const midi = new Midi(await blob.arrayBuffer());
        assert.equal(midi.header.tempos[0].bpm, 96);
        const notes = midi.tracks.flatMap(track => track.notes).sort((a, b) => a.time - b.time);
        assert.equal(notes.length, 2);
        for (const [index, expected] of [900, 100].entries()) assert.ok(Math.abs(notes[index].duration * 1000 - expected) <= 2);
        assert.equal(midi.tracks.length, 2, 'nested unisons use distinct MIDI channels');
        const imported = eventsToRollNotes(parseMidiFile(await blob.arrayBuffer()));
        for (const [index, expected] of [900, 100].entries()) assert.ok(Math.abs(imported[index].end - imported[index].start - expected) <= 2);
    } },
    { name: 'local persistence and recording finalization preserve edited note identities', run: () => {
        const source = [event('on', 0, 'long'), event('on', 100, 'short'), event('off', 200, 'short')];
        const closed = closeOpenNotes(sanitizeEvents(source), 1000);
        assert.equal(closed.length, 4);
        assert.equal(closed[3].noteId, 'long');
        assert.deepEqual(eventsToRollNotes(closed).map(note => note.end), [1000, 200]);
    } },
    { name: 'MIDI export reports channel exhaustion instead of corrupting nested note lengths', run: () => {
        const nested = Array.from({ length: 16 }, (_, index) => [
            event('on', index * 10, `nested-${index}`),
            event('off', 2000 - index * 10, `nested-${index}`),
        ]).flat();
        assert.throws(() => generateMidiFile(nested), /MIDI_CHANNEL_OVERFLOW/);
    } },
];
