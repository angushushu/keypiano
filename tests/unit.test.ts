import assert from 'node:assert/strict';
import { Midi } from '@tonejs/midi';
import { generateMidiFile } from '../services/midiIO';
import { getJianpu, getTransposedNote, midiNumberToNote, noteToMidi } from '../constants';
import { RecordedEvent } from '../types';
import { computeActiveEvents } from '../hooks/useAudioScheduler';
import { initialRecordingState, recordingReducer } from '../hooks/useRecordingState';

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

const tests: TestCase[] = [];

const test = (name: string, run: TestCase['run']) => {
  tests.push({ name, run });
};

test('getTransposedNote handles octaves and accidentals', () => {
  assert.equal(getTransposedNote('C4', 12), 'C5');
  assert.equal(getTransposedNote('C4', -12), 'C3');
  assert.equal(getTransposedNote('Bb3', 1), 'B3');
  assert.equal(getTransposedNote('C4', -1), 'B3');
});

test('MIDI note conversion handles common boundaries', () => {
  assert.equal(noteToMidi('A0'), 21);
  assert.equal(noteToMidi('C4'), 60);
  assert.equal(noteToMidi('C8'), 108);
  assert.equal(midiNumberToNote(21), 'A0');
  assert.equal(midiNumberToNote(60), 'C4');
  assert.equal(midiNumberToNote(108), 'C8');
});

test('getJianpu returns scale number and octave diff', () => {
  assert.deepEqual(getJianpu('C4'), { number: '1', diff: 0 });
  assert.deepEqual(getJianpu('F#5'), { number: '#4', diff: 1 });
  assert.deepEqual(getJianpu('Bb3'), { number: 'b7', diff: -1 });
});

test('generateMidiFile preserves overlapping notes of the same pitch', async () => {
  const events: RecordedEvent[] = [
    { time: 0, type: 'on', note: 'C4', transpose: 0, instrumentId: 'salamander', velocity: 100 },
    { time: 100, type: 'on', note: 'C4', transpose: 0, instrumentId: 'salamander', velocity: 90 },
    { time: 300, type: 'off', note: 'C4', transpose: 0, instrumentId: 'salamander' },
    { time: 500, type: 'off', note: 'C4', transpose: 0, instrumentId: 'salamander' },
  ];

  const blob = generateMidiFile(events);
  const midi = new Midi(await blob.arrayBuffer());
  const notes = midi.tracks.flatMap(track => track.notes);

  assert.equal(notes.length, 2);
  assert.deepEqual(notes.map(note => Math.round(note.time * 1000)), [0, 100]);
  assert.deepEqual(notes.map(note => Math.round(note.duration * 1000)), [300, 400]);
});

test('playback state preserves overlapping note instances until matching note-offs', () => {
  const events: RecordedEvent[] = [
    { time: 0, type: 'on', note: 'C4', transpose: 0, instrumentId: 'salamander' },
    { time: 100, type: 'on', note: 'C4', transpose: 0, instrumentId: 'salamander' },
    { time: 300, type: 'off', note: 'C4', transpose: 0, instrumentId: 'salamander' },
    { time: 500, type: 'off', note: 'C4', transpose: 0, instrumentId: 'salamander' },
  ];

  assert.equal(computeActiveEvents(events, 150).size, 2);
  assert.equal(computeActiveEvents(events, 350).size, 1);
  assert.equal(computeActiveEvents(events, 550).size, 0);
});

test('loading MIDI events always exits recording mode and resets the timer', () => {
  const recording = {
    ...initialRecordingState,
    isRecording: true,
    recordingStartTime: 123,
    elapsedTime: 456,
  };
  const events: RecordedEvent[] = [
    { time: 0, type: 'on', note: 'A4', transpose: 0, instrumentId: 'salamander' },
  ];

  const next = recordingReducer(recording, { type: 'SET_EVENTS', events });
  assert.equal(next.isRecording, false);
  assert.equal(next.recordingStartTime, 0);
  assert.equal(next.elapsedTime, 0);
  assert.equal(next.recordedEvents, events);
});

for (const { name, run } of tests) {
  await run();
  console.log(`ok - ${name}`);
}

console.log(`${tests.length} tests passed.`);
