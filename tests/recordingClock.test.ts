import assert from 'node:assert/strict';
import { RecordingClock } from '../services/recordingClock';
import { closeOpenNotes } from '../services/takeStore';
import type { RecordedEvent } from '../types';

export const recordingClockTests: { name: string; run: () => void }[] = [
    { name: 'continuous recording retains silence and append offsets', run: () => {
        const clock = new RecordingClock();
        clock.start(1000, 'continuous', 5000);
        clock.noteOn(5100); clock.noteOff(5400);
        assert.equal(clock.read(6000), 2000);
        assert.equal(clock.paused, false);
        assert.equal(clock.stop(6500), 2500);
        assert.equal(clock.read(9000), 2500);
    } },
    { name: 'pressed recording excludes idle gaps while preserving held duration', run: () => {
        const clock = new RecordingClock();
        clock.start(250, 'pressed', 1000);
        assert.equal(clock.read(2000), 250);
        assert.equal(clock.paused, true);
        clock.noteOn(3000);
        assert.equal(clock.read(3500), 750);
        clock.noteOff(4000);
        assert.equal(clock.read(9000), 1250);
        assert.equal(clock.paused, true);
        clock.noteOn(10000);
        assert.equal(clock.read(10200), 1450);
        assert.equal(clock.paused, false);
    } },
    { name: 'pressed recording pauses only after the last key of a chord is released', run: () => {
        const clock = new RecordingClock();
        clock.start(0, 'pressed', 0);
        clock.noteOn(100); clock.noteOn(150); clock.noteOff(200);
        assert.equal(clock.paused, false);
        assert.equal(clock.read(300), 200);
        clock.noteOff(400);
        assert.equal(clock.read(2000), 300);
        assert.equal(clock.paused, true);
        clock.noteOff(3000);
        assert.equal(clock.read(4000), 300, 'extra note-offs cannot extend a paused take');
    } },
    { name: 'stopping a paused take does not append wall-clock silence', run: () => {
        const clock = new RecordingClock();
        clock.start(800, 'pressed', 1000);
        clock.noteOn(1100); clock.noteOff(1500);
        assert.equal(clock.stop(9000), 1200);
        assert.equal(clock.active, false);
        assert.equal(clock.paused, false);
        clock.start(1200, 'pressed', 10000);
        assert.equal(clock.read(15000), 1200);
    } },
    { name: 'recording snapshots close held notes at compressed musical time', run: () => {
        const clock = new RecordingClock();
        clock.start(0, 'pressed', 0);
        clock.noteOn(100); clock.noteOff(500); clock.noteOn(10000);
        const events: RecordedEvent[] = [{ type: 'on', note: 'C4', noteId: 'held', instrumentId: 'drawbar_organ', transpose: 0, time: clock.read(10000) }];
        const snapshot = closeOpenNotes(events, clock.read(10600));
        assert.equal(snapshot[0].time, 400);
        assert.equal(snapshot[1].time, 1000);
        assert.equal(snapshot[1].time - snapshot[0].time, 600);
    } },
    { name: 'a new take resets abandoned held-key counts and timing', run: () => {
        const clock = new RecordingClock();
        clock.start(0, 'pressed', 0); clock.noteOn(100);
        assert.equal(clock.stop(400), 300);
        clock.start(0, 'pressed', 1000);
        assert.equal(clock.paused, true);
        clock.noteOn(2000); clock.noteOff(2500);
        assert.equal(clock.read(3000), 500);
    } },
];
