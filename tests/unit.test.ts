import assert from 'node:assert/strict';
import { Midi } from '@tonejs/midi';
import { generateMidiFile, parseMidiFile } from '../services/midiIO';
import { ALL_ROWS, getJianpu, getTransposedNote, midiNumberToNote, noteToMidi } from '../constants';
import { RecordedEvent } from '../types';
import { assignFingering, computeActiveEvents, keysForEvent } from '../hooks/useAudioScheduler';
import { assignPiece, suggestOctave } from '../services/autoFingering';
import { KEYMAP_PRESETS } from '../constants';
import { initialRecordingState, recordingReducer } from '../hooks/useRecordingState';
import { TRANSLATIONS, Language } from '../i18n';
import { SAMPLE_SOURCES, SampleLibrary, getSampleBaseUrl, isSampleSourceID } from '../services/sampleSources';
import { trackEvent } from '../services/analytics';
import { closeOpenNotes, sanitizeEvents, selectTakesToPrune, summarizeEvents } from '../services/takeStore';
import { findNextGate, isGateSatisfied, isWithinGateWindow, remainingNotes, withHit } from '../services/waitGate';
import { GUIDE_NOW, GUIDE_STEPS, approachLevel, guideFillOpacity, nowEntries, sameLevels, upcomingEntries } from '../services/practiceGuide';

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
    assert.match(TRANSLATIONS[language].takes.recordingName, /\{date\}/);
    assert.match(TRANSLATIONS[language].takes.notes, /\{count\}/);
    assert.match(TRANSLATIONS[language].takes.notesOne, /\{count\}/);
    assert.match(TRANSLATIONS[language].waitMode.waiting, /\{count\}/);
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

const on = (time: number, note: string, extra: Partial<RecordedEvent> = {}): RecordedEvent => (
  { time, type: 'on', note, transpose: 0, instrumentId: 'salamander', velocity: 100, ...extra }
);
const off = (time: number, note: string, extra: Partial<RecordedEvent> = {}): RecordedEvent => (
  { time, type: 'off', note, transpose: 0, instrumentId: 'salamander', ...extra }
);

test('summarizeEvents reports duration and note count', () => {
  assert.deepEqual(summarizeEvents([]), { durationMs: 0, noteCount: 0 });
  assert.deepEqual(summarizeEvents([on(0, 'C4'), on(100, 'E4'), off(900, 'C4'), off(1200, 'E4')]), { durationMs: 1200, noteCount: 2 });
});

test('closeOpenNotes ends only the notes still held', () => {
  const events = [on(0, 'C4', { code: 'KeyQ' }), off(200, 'C4', { code: 'KeyQ' }), on(300, 'E4', { code: 'KeyE' })];
  const closed = closeOpenNotes(events, 1000);
  assert.equal(closed.length, 4);
  assert.deepEqual(closed[3], off(1000, 'E4', { code: 'KeyE' }));
  const balanced = events.slice(0, 2);
  assert.equal(closeOpenNotes(balanced, 1000), balanced, 'nothing held means nothing appended');
});

test('closeOpenNotes closes each overlapping instance of the same pitch', () => {
  const closed = closeOpenNotes([on(0, 'C4'), on(100, 'C4')], 500);
  assert.equal(closed.filter(evt => evt.type === 'off').length, 2);
});

test('selectTakesToPrune keeps the newest takes', () => {
  const takes = [1, 5, 3, 4, 2].map(n => ({ id: `t${n}`, createdAt: n }));
  assert.deepEqual(selectTakesToPrune(takes, 3), ['t2', 't1']);
  assert.deepEqual(selectTakesToPrune(takes, 10), []);
});

test('sanitizeEvents drops malformed stored events and sorts by time', () => {
  const events = sanitizeEvents([
    on(500, 'E4'),
    { time: -1, type: 'on', note: 'C4' },
    { time: 10, type: 'hold', note: 'C4' },
    { time: 20, type: 'on', note: '<script>' },
    null,
    { time: 100, type: 'on', note: 'C#4', instrumentId: 'not-an-instrument', velocity: 400 },
  ]);
  assert.deepEqual(events.map(evt => evt.time), [100, 500]);
  assert.equal(events[0].instrumentId, 'salamander');
  assert.equal(events[0].velocity, 127);
  assert.deepEqual(sanitizeEvents('not an array'), []);
});

test('findNextGate groups near-simultaneous notes into one chord', () => {
  const events = [on(0, 'C4'), on(30, 'E4'), on(50, 'G4'), off(400, 'C4'), on(500, 'D4')];
  const first = findNextGate(events, 0);
  assert.deepEqual(first && { timeMs: first.timeMs, endTimeMs: first.endTimeMs, required: first.required }, { timeMs: 0, endTimeMs: 50, required: [60, 64, 67] });
  const second = findNextGate(events, 50, false);
  assert.deepEqual(second?.required, [62]);
  assert.equal(findNextGate(events, 500, false), null);
});

test('findNextGate compares sounding pitch, so transposed and enharmonic notes match', () => {
  const gate = findNextGate([on(0, 'C4', { transpose: 1 })], 0);
  assert.ok(gate);
  assert.deepEqual(gate.required, [61]);
  assert.equal(isGateSatisfied(withHit(gate, 61)), true);
});

test('a wait gate is satisfied only when every chord note has been pressed', () => {
  const gate = findNextGate([on(0, 'C4'), on(10, 'E4')], 0);
  assert.ok(gate);
  const wrong = withHit(gate, 62);
  assert.equal(wrong, gate, 'a wrong note leaves the gate unchanged');
  const half = withHit(gate, 60);
  assert.equal(isGateSatisfied(half), false);
  assert.equal(remainingNotes(half), 1);
  assert.equal(withHit(half, 60), half, 'repeating a note does not count twice');
  assert.equal(isGateSatisfied(withHit(half, 64)), true);
});

test('presses shortly before a gate count toward it, scaled by playback speed', () => {
  const gate = findNextGate([on(1000, 'C4')], 0);
  assert.ok(gate);
  assert.equal(isWithinGateWindow(gate, 700, 1), true);
  assert.equal(isWithinGateWindow(gate, 500, 1), false);
  assert.equal(isWithinGateWindow(gate, 850, 0.25), false);
  assert.equal(isWithinGateWindow(gate, 950, 0.25), true);
});

test('approachLevel brightens in steps as a note nears and never reaches "now"', () => {
  assert.equal(approachLevel(0, 1500), 0, 'a note due now is not "approaching"');
  assert.equal(approachLevel(1600, 1500), 0, 'outside the lookahead');
  const far = approachLevel(1450, 1500);
  const near = approachLevel(50, 1500);
  assert.equal(far, 1 / GUIDE_STEPS);
  assert.equal(near, (GUIDE_STEPS - 1) / GUIDE_STEPS);
  assert.ok(near < GUIDE_NOW);
});

test('wait mode lights only the unpressed notes of the held chord', () => {
  const events = [on(0, 'C3'), off(5000, 'C3'), on(1000, 'C4'), on(1020, 'E4'), off(1500, 'C4'), off(1500, 'E4')]
    .sort((a, b) => a.time - b.time);
  const gate = findNextGate(events, 500, true);
  assert.ok(gate);
  const sounding = [...computeActiveEvents(events, gate.timeMs).values()];
  // C3 is still held from earlier, but needs no new press.
  assert.deepEqual(nowEntries(sounding, events, withHit(gate, 60), true).map(entry => entry.evt.note), ['E4']);
  assert.deepEqual(nowEntries(sounding, events, null, true), [], 'nothing is "now" while the clock runs');
  assert.deepEqual(nowEntries(sounding, events, null, false).map(entry => entry.evt.note), ['C3', 'C4'],
    'without wait mode every sounding note is lit');
});

test('upcomingEntries fades in future notes and skips chord notes already pressed', () => {
  const events = [on(1000, 'C4'), on(1010, 'E4'), on(1400, 'G4'), on(3000, 'C5')];
  const gate = findNextGate(events, 0);
  assert.ok(gate);
  const entries = upcomingEntries(events, 0, 1500, withHit(gate, 60), false);
  assert.deepEqual(entries.map(entry => entry.evt.note), ['E4', 'G4'], 'C4 was pressed early; C5 is beyond the lookahead');
  assert.ok(entries[0].level > entries[1].level, 'E4 (nearer) is brighter than G4');
  assert.deepEqual(upcomingEntries(events, 1000, 1500, gate, true).map(entry => entry.evt.note), ['G4'],
    'while waiting, the held chord is "now", not upcoming');
});

test('guideFillOpacity is visible for every approaching step and off otherwise', () => {
  assert.equal(guideFillOpacity(0), 0);
  assert.equal(guideFillOpacity(GUIDE_NOW), 0, '"now" uses the full playback style instead');
  assert.ok(guideFillOpacity(1 / GUIDE_STEPS) >= 0.25);
  assert.ok(guideFillOpacity(0.8) > guideFillOpacity(0.2));
});

test('sameLevels compares guide maps by content', () => {
  assert.equal(sameLevels(new Map([['KeyQ', 0.4]]), new Map([['KeyQ', 0.4]])), true);
  assert.equal(sameLevels(new Map([['KeyQ', 0.4]]), new Map([['KeyQ', 0.6]])), false);
  assert.equal(sameLevels(new Map(), new Map([['KeyQ', 1]])), false);
});

const FREEPIANO = KEYMAP_PRESETS.freepiano.map;
const LAPTOP = { useNumpad: false };
const fingerNotes = (events: RecordedEvent[], options = LAPTOP, offset = 0) => {
  const assignments = assignPiece(events, FREEPIANO, offset, options);
  return events.map(evt => {
    const a = assignments.get(evt);
    if (!a) return null;
    return `${a.modifier === 1 ? 'Shift+' : a.modifier === -1 ? 'Ctrl+' : ''}${a.code}`;
  });
};

test('a melody stays on the Q row, continuing up it instead of jumping rows', () => {
  const scale = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5'].map((note, i) => on(i * 500, note));
  assert.deepEqual(fingerNotes(scale), ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP']);
});

test('bass goes to the left-hand rows and melody to the right-hand rows', () => {
  const events = [on(0, 'C3'), on(0, 'E5'), on(500, 'G2'), on(500, 'D5')];
  assert.deepEqual(fingerNotes(events), ['KeyA', 'KeyP', 'KeyB', 'KeyO']);
});

test('without a numpad no hint uses the numpad or arrow keys', () => {
  const events = ['G3', 'C4', 'E4', 'G4', 'C5', 'C3', 'E3', 'C6'].map((note, i) => on(i * 300, note));
  for (const code of fingerNotes(events)) {
    assert.ok(code && !/Numpad|Arrow|Insert|Home|PageUp|Delete|End|PageDown/.test(code), `${code} is not on the main block`);
  }
});

test('sharps are Shift on the key below', () => {
  assert.deepEqual(fingerNotes([on(0, 'F#4')]), ['Shift+KeyR']);
});

test('a chord mixing black and white keys still hints every note', () => {
  // D-F#-A cannot share one modifier on a main block without black keys,
  // so the F# keeps its own Shift and the chord is rolled.
  assert.deepEqual(fingerNotes([on(0, 'D4'), on(0, 'F#4'), on(0, 'A4')]), ['KeyW', 'Shift+KeyR', 'KeyY']);
  const withNumpad = fingerNotes([on(0, 'D4'), on(0, 'F#4'), on(0, 'A4')], { useNumpad: true });
  assert.equal(withNumpad[1], 'Shift+KeyR');
  assert.ok(withNumpad[0]?.startsWith('Numpad') && withNumpad[2]?.startsWith('Numpad'),
    'with a numpad the white notes move to keys Shift does not affect');
});

test('two MIDI tracks are split into hands by average pitch', () => {
  const events = [
    on(0, 'E4', { trackName: 'RH' }), on(0, 'C4', { trackName: 'LH' }),
    on(500, 'G4', { trackName: 'RH' }), on(500, 'G3', { trackName: 'LH' }),
  ];
  const assignments = assignPiece(events, FREEPIANO, 0, LAPTOP);
  assert.deepEqual(events.map(evt => assignments.get(evt)?.hand), ['right', 'left', 'right', 'left']);
  assert.equal(assignments.get(events[1])?.code, 'KeyK', "the left hand plays C4 from its own row");
});

test('recorded key presses are never re-fingered', () => {
  const recorded = on(0, 'C4', { code: 'Numpad1' });
  assert.equal(assignPiece([recorded], FREEPIANO, 0, LAPTOP).size, 0);
  assert.deepEqual(keysForEvent(recorded, new Map()), ['Numpad1']);
});

test('transposition changes which key plays a note', () => {
  assert.deepEqual(fingerNotes([on(0, 'C5')], LAPTOP, 12), ['KeyQ'], 'one octave up, Q sounds C5');
});

test('suggestOctave finds the octave that fits a piece out of range', () => {
  const high = ['C6', 'E6', 'G6', 'C7', 'E7'].map((note, i) => on(i * 300, note));
  assert.deepEqual(suggestOctave(high, FREEPIANO, 0, 0, LAPTOP), { octave: 1, unreachableNow: 2, unreachableThen: 0 });
  assert.equal(suggestOctave(high, FREEPIANO, 0, 1, LAPTOP), null, 'already the best octave');
});

test('assignFingering lights the assigned key and its modifier', () => {
  const sharp = on(0, 'F#4');
  const assignments = assignPiece([sharp], FREEPIANO, 0, LAPTOP);
  const { activeKeys, activeNotes } = assignFingering(new Map([['a', sharp]]), assignments);
  assert.deepEqual([...activeNotes], ['F#4']);
  assert.deepEqual([...activeKeys].sort(), ['KeyR', 'ShiftLeft']);
});

for (const { name, run } of tests) {
  await run();
  console.log(`ok - ${name}`);
}

console.log(`${tests.length} tests passed.`);
