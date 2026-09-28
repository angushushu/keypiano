import assert from 'node:assert/strict';
import { Midi } from '@tonejs/midi';
import { generateMidiFile, parseMidiFile } from '../services/midiIO';
import { ALL_ROWS, getJianpu, getTransposedNote, midiNumberToNote, noteToMidi } from '../constants';
import { RecordedEvent } from '../types';
import { computeActiveEvents } from '../hooks/useAudioScheduler';
import { initialRecordingState, recordingReducer } from '../hooks/useRecordingState';
import { TRANSLATIONS, Language } from '../i18n';
import { SAMPLE_SOURCES, SampleLibrary, getSampleBaseUrl, isSampleSourceID } from '../services/sampleSources';
import { trackEvent } from '../services/analytics';

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

test('MIDI export and import preserve channel, track name and program', async () => {
  const events: RecordedEvent[] = [
    { time: 0, type: 'on', note: 'C4', transpose: 0, instrumentId: 'salamander', velocity: 100, channel: 2, trackName: 'Lead', program: 81 },
    { time: 200, type: 'off', note: 'C4', transpose: 0, instrumentId: 'salamander', channel: 2, trackName: 'Lead', program: 81 },
    { time: 0, type: 'on', note: 'E3', transpose: 0, instrumentId: 'salamander', velocity: 90, channel: 5, trackName: 'Bass', program: 33 },
    { time: 400, type: 'off', note: 'E3', transpose: 0, instrumentId: 'salamander', channel: 5, trackName: 'Bass', program: 33 },
  ];

  const blob = generateMidiFile(events);
  const midi = new Midi(await blob.arrayBuffer());

  // Two source tracks must stay two tracks rather than collapsing onto one channel.
  assert.equal(midi.tracks.length, 2);

  const byName = new Map(midi.tracks.map(track => [track.name, track]));
  assert.deepEqual([...byName.keys()].sort(), ['Bass', 'Lead']);
  assert.equal(byName.get('Lead')?.channel, 2);
  assert.equal(byName.get('Lead')?.instrument.number, 81);
  assert.equal(byName.get('Bass')?.channel, 5);
  assert.equal(byName.get('Bass')?.instrument.number, 33);

  // …and survive a trip back through the importer.
  const onEvents = parseMidiFile(await blob.arrayBuffer()).filter(evt => evt.type === 'on');
  assert.equal(onEvents.length, 2);
  assert.deepEqual(onEvents.map(evt => evt.channel).sort(), [2, 5]);
  assert.deepEqual(onEvents.map(evt => evt.program).sort(), [33, 81]);
  assert.deepEqual(onEvents.map(evt => evt.trackName).sort(), ['Bass', 'Lead']);
});

test('MIDI export clamps out-of-range channel and program values', async () => {
  const events: RecordedEvent[] = [
    { time: 0, type: 'on', note: 'C4', transpose: 0, instrumentId: 'salamander', channel: 99, program: 900 },
    { time: 100, type: 'off', note: 'C4', transpose: 0, instrumentId: 'salamander', channel: 99, program: 900 },
  ];

  const midi = new Midi(await generateMidiFile(events).arrayBuffer());
  assert.equal(midi.tracks.length, 1);
  assert.equal(midi.tracks[0].channel, 15);
  assert.equal(midi.tracks[0].instrument.number, 127);
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

test('every locale defines exactly the same translation keys', () => {
  const flatten = (value: unknown, prefix = ''): string[] => {
    if (value === null || typeof value !== 'object') return [prefix];
    return Object.entries(value as Record<string, unknown>)
      .flatMap(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key));
  };

  // Sorted comparison so a missing OR extra key in either locale fails loudly.
  assert.deepEqual(flatten(TRANSLATIONS.zh).sort(), flatten(TRANSLATIONS.en).sort());
});

test('every described on-screen key is localized in both locales', () => {
  const codes = ALL_ROWS.flat()
    .filter(key => Boolean(key.description))
    .map(key => key.code);
  assert.ok(codes.length >= 15, 'expected the function-key row to carry descriptions');

  for (const language of ['en', 'zh'] as Language[]) {
    for (const code of codes) {
      const text = TRANSLATIONS[language].keyDescriptions[code];
      assert.ok(text, `${language} has no keyDescriptions entry for ${code}`);
      assert.notEqual(text, code, `${language} keyDescriptions.${code} was left untranslated`);
    }
  }
});

test('localized templates keep the placeholders their call sites fill in', () => {
  for (const language of ['en', 'zh'] as Language[]) {
    assert.match(TRANSLATIONS[language].playNote, /\{note\}/);
    assert.match(TRANSLATIONS[language].errors.samplesFailed, /\{count\}/);
  }
});

const SAMPLE_LIBRARIES: SampleLibrary[] = ['salamander', 'hq_piano', 'gm'];

test('the default GitHub sample source keeps the original upstream URLs', () => {
  assert.equal(getSampleBaseUrl('github', 'salamander'), 'https://tonejs.github.io/audio/salamander/');
  assert.equal(getSampleBaseUrl('github', 'hq_piano'), 'https://raw.githubusercontent.com/fuhton/piano-mp3/master/piano-mp3/');
  assert.equal(getSampleBaseUrl('github', 'gm'), 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/');
});

test('every sample source serves every library from an https folder URL', () => {
  for (const source of SAMPLE_SOURCES) {
    for (const library of SAMPLE_LIBRARIES) {
      const url = getSampleBaseUrl(source.id, library);
      assert.match(url, /^https:\/\/[^/]+\/.+\/$/, `${source.id}/${library} is not an https folder URL`);
    }
  }
});

test('jsDelivr mirrors are pinned to a commit so cached samples never change', () => {
  const mirrors = SAMPLE_SOURCES.filter(source => source.id.startsWith('jsdelivr_'));
  assert.ok(mirrors.length > 0, 'expected at least one jsDelivr mirror');
  for (const source of mirrors) {
    for (const library of SAMPLE_LIBRARIES) {
      assert.match(getSampleBaseUrl(source.id, library), /@[0-9a-f]{40}\//, `${source.id}/${library} is not pinned`);
    }
  }
});

test('isSampleSourceID accepts only known sources', () => {
  assert.equal(isSampleSourceID('github'), true);
  assert.equal(isSampleSourceID('jsdelivr_fastly'), true);
  assert.equal(isSampleSourceID('unknown'), false);
  assert.equal(isSampleSourceID(undefined), false);
});

test('every sample source has a label in both locales', () => {
  for (const language of ['en', 'zh'] as Language[]) {
    for (const source of SAMPLE_SOURCES) {
      assert.ok(TRANSLATIONS[language].sampleSource.options[source.id], `${language} has no label for ${source.id}`);
    }
  }
});

test('trackEvent is a no-op without the analytics tag and forwards to it when present', () => {
  const globals = globalThis as { window?: unknown };
  const originalWindow = globals.window;
  try {
    delete globals.window;
    assert.doesNotThrow(() => trackEvent('sample_load', { sample_source: 'github' }));

    const calls: unknown[][] = [];
    globals.window = { gtag: (...args: unknown[]) => { calls.push(args); } };
    trackEvent('sample_load', { sample_source: 'jsdelivr_gcore' });
    assert.deepEqual(calls, [['event', 'sample_load', { sample_source: 'jsdelivr_gcore' }]]);

    globals.window = { gtag: () => { throw new Error('blocked'); } };
    assert.doesNotThrow(() => trackEvent('sample_load'));
  } finally {
    if (originalWindow === undefined) delete globals.window;
    else globals.window = originalWindow;
  }
});

for (const { name, run } of tests) {
  await run();
  console.log(`ok - ${name}`);
}

console.log(`${tests.length} tests passed.`);
