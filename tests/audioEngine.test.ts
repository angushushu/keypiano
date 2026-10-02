import assert from 'node:assert/strict';
import { AudioEngine, type InstrumentID } from '../services/audioEngine';
import { prepareSustainLoop } from '../services/sampleLoop';
import { generateMidiFile, parseMidiFile } from '../services/midiIO';

const sampleRate = 1000;
const makeBuffer = (channels = 1, length = 2000, rate = sampleRate): AudioBuffer => {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return {
        numberOfChannels: channels, length, sampleRate: rate, duration: length / rate,
        getChannelData: (channel: number) => data[channel],
    } as AudioBuffer;
};

const makeSample = (channels = 1): AudioBuffer => {
    const buffer = makeBuffer(channels);
    for (let channel = 0; channel < channels; channel++) {
        const data = buffer.getChannelData(channel);
        for (let i = 0; i < 1500; i++) {
            data[i] = (channel === 0 ? 1 : -1) * 0.2 * Math.min(1, i / 100) * Math.sin(i * 2 * Math.PI / 50);
        }
    }
    return buffer;
};

class MockParam {
    value = 1;
    ramps: { value: number; time: number }[] = [];
    cancelScheduledValues() {}
    setValueAtTime(value: number) { this.value = value; }
    linearRampToValueAtTime(value: number, time: number) { this.ramps.push({ value, time }); }
    exponentialRampToValueAtTime(value: number, time: number) { this.ramps.push({ value, time }); }
}

class MockSource {
    buffer: AudioBuffer | null = null;
    playbackRate = new MockParam();
    loop = false;
    loopStart = 0;
    loopEnd = 0;
    startTime = Infinity;
    stopTime = Infinity;
    disconnected = false;
    ended = false;
    onended: (() => void) | null = null;
    connect() {}
    disconnect() { this.disconnected = true; }
    start(time: number) { this.startTime = time; }
    stop(time: number) { this.stopTime = time; }
    isSounding(time: number) {
        const naturalEnd = this.loop ? Infinity : this.startTime + (this.buffer?.duration ?? 0) / this.playbackRate.value;
        return !this.ended && time >= this.startTime && time < Math.min(this.stopTime, naturalEnd);
    }
}

class MockContext {
    currentTime = 1;
    state = 'running';
    destination = {};
    sources: MockSource[] = [];
    gains: { gain: MockParam; disconnected: boolean; connect: () => void; disconnect: () => void }[] = [];
    preparedCount = 0;
    createBuffer(channels: number, length: number, rate: number) {
        this.preparedCount++;
        return makeBuffer(channels, length, rate);
    }
    createBufferSource() {
        const source = new MockSource();
        this.sources.push(source);
        return source;
    }
    createGain() {
        const gain = { gain: new MockParam(), disconnected: false, connect() {}, disconnect() { this.disconnected = true; } };
        this.gains.push(gain);
        return gain;
    }
    createDynamicsCompressor() {
        return { threshold: new MockParam(), knee: new MockParam(), ratio: new MockParam(), attack: new MockParam(), release: new MockParam(), connect() {}, disconnect() {} };
    }
    createWaveShaper() { return { connect() {}, disconnect() {} }; }
    async decodeAudioData(data: ArrayBuffer) { return new Uint8Array(data)[0] === 0 ? makeBuffer() : makeSample(); }
    async resume() { this.state = 'running'; }
    async close() { this.state = 'closed'; }
    advanceTo(time: number) {
        this.currentTime = time;
        for (const source of this.sources) {
            if (!source.ended && time >= source.startTime && !source.isSounding(time)) {
                source.ended = true;
                source.onended?.();
            }
        }
    }
}

const withEngine = async (instrument: InstrumentID, run: (engine: AudioEngine, ctx: MockContext) => void | Promise<void>, silentPitch?: string) => {
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const previousFetch = globalThis.fetch;
    const previousWarn = console.warn;
    const ctx = new MockContext();
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { AudioContext: function () { return ctx; } } });
    globalThis.fetch = async input => new Response(new Uint8Array([silentPitch && String(input).endsWith(`/${silentPitch}.mp3`) ? 0 : 1]));
    if (silentPitch) console.warn = () => {};
    const engine = new AudioEngine();
    try {
        await engine.init(instrument);
        // Let the background sample batch finish before inspecting cache counts.
        await new Promise(resolve => setTimeout(resolve, 0));
        await run(engine, ctx);
    } finally {
        engine.dispose();
        globalThis.fetch = previousFetch;
        console.warn = previousWarn;
        if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
        else Reflect.deleteProperty(globalThis, 'window');
    }
};

export const audioEngineTests: { name: string; run: () => void | Promise<void> }[] = [
    {
        name: 'edited note identities release the right unison without cutting off live keyboard input',
        run: () => withEngine('drawbar_organ', (engine, ctx) => {
            engine.setSustainLevel('OFF');
            engine.playNote('C4', 0, 100, 0, 'long');
            engine.playNote('C4', 0, 80, 0, 'short');
            engine.playNote('C4');
            engine.stopNote('C4', 0, 2, 'short');
            assert.equal(ctx.sources[0].stopTime, Infinity);
            assert.equal(ctx.sources[1].stopTime, 2.03);
            assert.equal(ctx.sources[2].stopTime, Infinity);
            engine.stopNote('C4');
            assert.equal(ctx.sources[2].stopTime, 1.03);
        }),
    },
    {
        name: 'sustain loops preserve the attack, exclude the silent tail and crossfade every channel',
        run: () => {
            const input = makeSample(2);
            const original = input.getChannelData(0).slice();
            const loop = prepareSustainLoop({ createBuffer: makeBuffer }, input, 0.1);
            assert.ok(loop);
            assert.ok(loop.start >= 0.1);
            assert.ok(loop.end <= 1.5);
            assert.ok(loop.end - loop.start >= 0.1);
            assert.deepEqual(input.getChannelData(0), original, 'do not mutate shared decoded samples');
            assert.deepEqual(loop.buffer.getChannelData(0).slice(0, 100), original.slice(0, 100));
            for (let channel = 0; channel < 2; channel++) {
                const data: Float32Array = loop.buffer.getChannelData(channel);
                const start = Math.round(loop.start * sampleRate);
                assert.equal(data[data.length - 1], input.getChannelData(channel)[start - 1], 'the seam continues directly into the loop head');
            }
        },
    },
    {
        name: 'a loud transient does not disqualify a quieter sustained region',
        run: () => {
            const input = makeSample();
            const data = input.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] *= 0.1;
            for (let i = 100; i < 120; i++) data[i] *= 50;
            const loop = prepareSustainLoop({ createBuffer: makeBuffer }, input, 0.1);
            assert.ok(loop, 'a quiet plateau remains usable after a loud organ attack');
            assert.ok(loop.start >= 0.12, 'the brief transient should not replay in the loop');
        },
    },
    {
        name: 'silent and unusably short samples do not get invalid loop points',
        run: () => {
            assert.equal(prepareSustainLoop({ createBuffer: makeBuffer }, makeBuffer(), 0.1), null);
            assert.equal(prepareSustainLoop({ createBuffer: makeBuffer }, makeBuffer(1, 50), 0.1), null);
        },
    },
    {
        name: 'organ, strings and synth lead sound past the sample duration until note-off',
        run: async () => {
            for (const id of ['drawbar_organ', 'string_ensemble_1', 'lead_1_square'] as const) {
                await withEngine(id, (engine, ctx) => {
                    const preparedCount = ctx.preparedCount;
                    engine.setSustainLevel('OFF');
                    engine.playNote('C4');
                    engine.playNote('C4', 1, 80);
                    assert.equal(ctx.preparedCount, preparedCount, 'loop preparation belongs to loading, not playing');
                    for (const source of ctx.sources) {
                        assert.ok(source.loop, id);
                        assert.ok(source.loopStart > 0 && source.loopEnd <= source.buffer!.duration);
                    }
                    ctx.advanceTo(61);
                    assert.ok(ctx.sources.every(source => source.isSounding(ctx.currentTime)), id);
                    engine.stopNote('C4');
                    assert.equal(ctx.sources[0].stopTime, 61.03);
                    assert.equal(ctx.sources[1].stopTime, Infinity, 'release only the matching transposition');
                    ctx.advanceTo(61.1);
                    assert.ok(ctx.sources[0].disconnected);
                    assert.ok(ctx.sources[1].isSounding(ctx.currentTime));
                });
            }
        },
    },
    {
        name: 'an unusable sustain sample falls back to a sounding loop at the nearest pitch',
        run: () => withEngine('drawbar_organ', (engine, ctx) => {
            assert.ok(engine.networkErrors.includes('C4'));
            engine.playNote('C4');
            const source = ctx.sources[0];
            assert.ok(source.loop, 'a missing loop must not turn a sustained instrument into a one-shot');
            assert.ok(source.playbackRate.value !== 1, 'transpose a usable neighboring sample');
            ctx.advanceTo(60);
            assert.ok(source.isSounding(60));
        }, 'C4'),
    },
    {
        name: 'piano, electric piano, guitar and drums retain their natural decay',
        run: async () => {
            for (const id of ['salamander', 'hq_piano', 'electric_grand_piano', 'acoustic_guitar_steel', 'synth_drum'] as const) {
                await withEngine(id, (engine, ctx) => {
                    engine.playNote('C4');
                    assert.equal(ctx.sources[0].loop, false, id);
                    ctx.advanceTo(10);
                    assert.equal(ctx.sources[0].isSounding(10), false, id);
                    assert.ok(ctx.sources[0].disconnected);
                });
            }
        },
    },
    {
        name: 'overlapping unisons each sustain until their own note-off and retain release tails',
        run: () => withEngine('drawbar_organ', (engine, ctx) => {
            engine.playNote('C4');
            engine.playNote('C4');
            ctx.advanceTo(40);
            engine.stopNote('C4');
            assert.equal(ctx.sources[0].stopTime, 40.5);
            assert.equal(ctx.sources[1].stopTime, Infinity);
            ctx.advanceTo(41);
            engine.overrideSustain(true);
            engine.stopNote('C4');
            assert.equal(ctx.sources[1].stopTime, 43);
            ctx.advanceTo(44);
            assert.ok(ctx.sources.every(source => source.disconnected));
            assert.ok(ctx.gains.slice(1).every(gain => gain.disconnected));
        }),
    },
    {
        name: 'scheduled long notes continue until the scheduled note-off',
        run: () => withEngine('drawbar_organ', (engine, ctx) => {
            engine.setSustainLevel('OFF');
            engine.playNote('C4', 0, 90, 5);
            engine.stopNote('C4', 0, 45);
            const source = ctx.sources[0];
            assert.equal(source.startTime, 5);
            assert.equal(source.stopTime, 45.03);
            ctx.advanceTo(44.9);
            assert.ok(source.isSounding(44.9));
            ctx.advanceTo(46);
            assert.ok(source.disconnected);
        }),
    },
    {
        name: 'stop-all cancels held, releasing and future looped voices',
        run: () => withEngine('drawbar_organ', (engine, ctx) => {
            engine.playNote('C4');
            engine.playNote('E4');
            engine.stopNote('E4');
            engine.playNote('G4', 0, 100, 10);
            engine.stopAllNotes();
            assert.ok(ctx.sources.every(source => source.stopTime === 1.1));
            ctx.advanceTo(11);
            assert.ok(ctx.sources.every(source => !source.isSounding(11) && source.disconnected));
        }),
    },
    {
        name: 'switching instruments and disposing cannot leave a sustained voice running',
        run: () => withEngine('drawbar_organ', async (engine, ctx) => {
            engine.playNote('C4');
            const organ = ctx.sources[0];
            await engine.init('hq_piano');
            ctx.advanceTo(2);
            assert.ok(organ.disconnected);
            await engine.init('drawbar_organ');
            engine.playNote('E4');
            engine.dispose();
            ctx.advanceTo(3);
            assert.ok(ctx.sources.every(source => source.disconnected));
            assert.equal(ctx.state, 'closed');
        }),
    },
    {
        name: 'a one-minute held note retains its complete duration through MIDI export and import',
        run: async () => {
            const events = [
                { type: 'on' as const, time: 0, note: 'C4', transpose: 0, instrumentId: 'drawbar_organ' as const, velocity: 100 },
                { type: 'off' as const, time: 60_000, note: 'C4', transpose: 0, instrumentId: 'drawbar_organ' as const },
            ];
            const roundTrip = parseMidiFile(await generateMidiFile(events).arrayBuffer());
            assert.equal(roundTrip.length, 2);
            assert.equal(roundTrip[0].type, 'on');
            assert.equal(roundTrip[1].type, 'off');
            assert.equal(roundTrip[1].time - roundTrip[0].time, 60_000);
        },
    },
];
