

import { NOTE_NAMES, FLAT_TO_SHARP } from '../constants';
import { DEFAULT_SAMPLE_SOURCE, getSampleBaseUrl, SampleSourceID } from './sampleSources';
import { prepareSustainLoop, type SustainLoop } from './sampleLoop';

// Audio Engine - Sampler Based

// Instrument Definitions
export const INSTRUMENTS = [
    { id: 'salamander', name: 'Yamaha C5 Grand (Pro)', type: 'custom', playback: 'decay' }, // New Best Option
    { id: 'hq_piano', name: 'Standard Piano (Lite)', type: 'custom', playback: 'decay' },
    { id: 'electric_grand_piano', name: 'Electric Piano', type: 'gm', playback: 'decay' },
    { id: 'drawbar_organ', name: 'Organ', type: 'gm', playback: 'sustain', loopAttackSeconds: 0.1 },
    { id: 'acoustic_guitar_steel', name: 'Acoustic Guitar', type: 'gm', playback: 'decay' },
    { id: 'string_ensemble_1', name: 'String Ensemble', type: 'gm', playback: 'sustain', loopAttackSeconds: 0.3 },
    { id: 'lead_1_square', name: 'Synth Lead', type: 'gm', playback: 'sustain', loopAttackSeconds: 0.1 },
    { id: 'synth_drum', name: 'Synth Drum', type: 'gm', playback: 'decay' }
] as const;

export type InstrumentID = typeof INSTRUMENTS[number]['id'];

// ─── Levels ─────────────────────────────────────────────────────
// The sample sets are recorded at very different levels. Measured on C2–C6
// (median RMS over each note's first 0.5 s), Salamander sits near -21 dBFS
// and the others near -30 to -38 dBFS. These gains bring every instrument
// to Salamander's loudness without pushing its peaks above Salamander's
// (-8 dBFS). Strings attack slowly, so their early RMS understates them.
export const INSTRUMENT_LEVEL_DB: Record<InstrumentID, number> = {
    salamander: 0,
    hq_piano: 12,
    electric_grand_piano: 12,
    drawbar_organ: 14,
    acoustic_guitar_steel: 13,
    string_ensemble_1: 9,
    lead_1_square: 8,
    synth_drum: 12,
};

/** Fixed gain ahead of the output limiter: single notes play louder, chords are caught by the limiter. */
export const OUTPUT_BOOST_DB = 6;
/** The volume control goes past 100% because the limiter keeps the extra from clipping. */
export const MAX_MASTER_VOLUME = 1.5;
/** Velocity that plays at unity gain; the computer keyboard's default. */
const REFERENCE_VELOCITY = 100;

export const dbToGain = (db: number) => Math.pow(10, db / 20);

/** Below this level the soft clipper passes audio unchanged (about -1.9 dBFS). */
const SOFT_CLIP_KNEE = 0.8;

/**
 * Transfer curve for the final WaveShaper: linear up to SOFT_CLIP_KNEE, then a
 * tanh shoulder that approaches but never exceeds full scale. The limiter
 * ahead of it cannot stop every transient (12 loud notes at 150% volume still
 * overshot by 1.4 dB); this rounds those off instead of clipping digitally.
 */
export function softClipCurve(size = 4096): Float32Array<ArrayBuffer> {
    const curve = new Float32Array(size);
    for (let i = 0; i < size; i++) {
        const x = (i / (size - 1)) * 2 - 1;
        const magnitude = Math.abs(x);
        const shaped = magnitude <= SOFT_CLIP_KNEE
            ? magnitude
            : SOFT_CLIP_KNEE + (1 - SOFT_CLIP_KNEE) * Math.tanh((magnitude - SOFT_CLIP_KNEE) / (1 - SOFT_CLIP_KNEE));
        curve[i] = Math.sign(x) * shaped;
    }
    return curve;
}

/**
 * Linear velocity response: 100 plays at unity, 64 about -4 dB, 32 about
 * -10 dB. The old 1.5-power curve left medium MIDI velocities 6 dB down.
 */
export const velocityToGain = (velocity: number) => Math.max(0, Math.min(127, velocity)) / REFERENCE_VELOCITY;

export type MetronomeSound = 'beep' | 'click' | 'woodblock';
// Display labels live in i18n.ts (`t.metronome`), keyed by these ids.
export const METRONOME_SOUNDS: { id: MetronomeSound }[] = [
    { id: 'beep' },
    { id: 'click' },
    { id: 'woodblock' }
];

// Sample sets. Base URLs depend on the chosen download source (see sampleSources.ts).

// Set 1: Salamander Grand Piano (Yamaha C5) - Hosted by Tone.js
const SALAMANDER_MAP: Record<string, string> = {
    'A0': 'A0.mp3', 'C1': 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3', 'A1': 'A1.mp3',
    'C2': 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3', 'A2': 'A2.mp3',
    'C3': 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3', 'A3': 'A3.mp3',
    'C4': 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3', 'A4': 'A4.mp3',
    'C5': 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3', 'A5': 'A5.mp3',
    'C6': 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3', 'A6': 'A6.mp3',
    'C7': 'C7.mp3', 'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3', 'A7': 'A7.mp3',
    'C8': 'C8.mp3'
};

// Set 2: Original High Quality Piano (fuhton)
const HQ_PIANO_MAP: Record<string, string> = {
  'A0': 'A0.mp3', 
  'C1': 'C1.mp3', 'D#1': 'Eb1.mp3', 'F#1': 'Gb1.mp3', 'A1': 'A1.mp3',
  'C2': 'C2.mp3', 'D#2': 'Eb2.mp3', 'F#2': 'Gb2.mp3', 'A2': 'A2.mp3',
  'C3': 'C3.mp3', 'D#3': 'Eb3.mp3', 'F#3': 'Gb3.mp3', 'A3': 'A3.mp3',
  'C4': 'C4.mp3', 'D#4': 'Eb4.mp3', 'F#4': 'Gb4.mp3', 'A4': 'A4.mp3',
  'C5': 'C5.mp3', 'D#5': 'Eb5.mp3', 'F#5': 'Gb5.mp3', 'A5': 'A5.mp3',
  'C6': 'C6.mp3', 'D#6': 'Eb6.mp3', 'F#6': 'Gb6.mp3', 'A6': 'A6.mp3',
  'C7': 'C7.mp3', 'D#7': 'Eb7.mp3', 'F#7': 'Gb7.mp3', 'A7': 'A7.mp3',
  'C8': 'C8.mp3'
};

// Set 3: General MIDI (gleitz/midi-js-soundfonts - Musyng Kite), one folder per instrument

export type SustainLevel = 'OFF' | 'SHORT' | 'LONG';

interface ActiveSource {
    source: AudioBufferSourceNode;
    gain: GainNode;
    instrumentId: InstrumentID;
}

interface Sample {
    buffer: AudioBuffer;
    loop: SustainLoop | null;
}

export class AudioEngine {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private compressor: DynamicsCompressorNode | null = null;
    private softClipper: WaveShaperNode | null = null;
    private buffers: Map<string, Sample> = new Map();
    private activeSources: Map<string, ActiveSource[]> = new Map();
    private liveSources = new Set<ActiveSource>();
    private loadGeneration = 0;
    private loadAbortController: AbortController | null = null;
    
    public isLoaded = false;
    public networkErrors: string[] = [];
    private volume: number = 0.5;
    private sustainLevel: SustainLevel = 'SHORT';
    private isSustainOverrideDown: boolean = false; // For physical MIDI CC 64 pedal
    private currentInstrument: InstrumentID = 'salamander';
    private sampleSource: SampleSourceID = DEFAULT_SAMPLE_SOURCE;

    // Metronome State
    private nextNoteTime: number = 0.0;
    private timerID: number | null = null;
    private isMetronomePlaying: boolean = false;
    private bpm: number = 120;
    private lookahead: number = 25.0; // ms
    private scheduleAheadTime: number = 0.1; // s
    private metronomeSound: MetronomeSound = 'beep';

    /**
     * Downloads and decodes an instrument. Safe to call without a user gesture:
     * the context stays suspended until `unlock()` runs inside one, but samples
     * can already be fetched and decoded so the first note is audible at once.
     */
    public async init(
        instrumentId: InstrumentID = 'salamander',
        sampleSource: SampleSourceID = this.sampleSource
    ) {
        this.ensureContext();

        if (this.currentInstrument !== instrumentId || this.sampleSource !== sampleSource || !this.isLoaded) {
            await this.loadInstrument(instrumentId, sampleSource);
        }
    }

    private ensureContext() {
        if (this.ctx) return;

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContextClass();

        // Used as a limiter: it only acts on peaks, which the output boost
        // makes more frequent when chords stack up.
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -6;
        this.compressor.knee.value = 3;
        this.compressor.ratio.value = 12;
        this.compressor.attack.value = 0.002;
        this.compressor.release.value = 0.2;

        this.softClipper = this.ctx.createWaveShaper();
        this.softClipper.curve = softClipCurve();
        this.softClipper.oversample = '2x';
        this.compressor.connect(this.softClipper);
        this.softClipper.connect(this.ctx.destination);

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.outputGain();
        this.masterGain.connect(this.compressor);
    }

    /**
     * Resumes playback. Must be called synchronously from a user gesture --
     * browsers keep the context suspended until then.
     */
    public unlock() {
        this.ensureContext();
        this.unlockAudio();
    }

    /**
     * Releases everything the engine owns: in-flight downloads, the metronome
     * timer, sounding voices, decoded buffers and the AudioContext itself.
     *
     * Deliberately NOT wired to React unmount. The engine is a module singleton
     * and React StrictMode mounts effects twice in development, so closing the
     * context on unmount would tear down audio the remount still needs. The
     * correct trigger is `pagehide` (see index.tsx), which also makes the
     * lifecycle explicit for tests.
     */
    public dispose() {
        this.loadAbortController?.abort();
        this.loadAbortController = null;
        this.loadGeneration++;

        this.stopMetronome();
        this.stopAllNotes();
        this.buffers.clear();
        this.networkErrors = [];
        this.isLoaded = false;

        try {
            this.masterGain?.disconnect();
            this.compressor?.disconnect();
            this.softClipper?.disconnect();
        } catch {
            // Nodes may already be detached; there is nothing left to release.
        }

        const ctx = this.ctx;
        this.ctx = null;
        this.masterGain = null;
        this.compressor = null;
        this.softClipper = null;

        if (ctx && ctx.state !== 'closed') {
            // Rejections here are not actionable: the page is going away.
            void ctx.close().catch(() => {});
        }
    }
    
    public get currentTime() {
        return this.ctx?.currentTime || 0;
    }

    private unlockAudio() {
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') {
            // Outside a user gesture this is expected to fail; the next gesture retries.
            this.ctx.resume().catch(() => {});
        }
        try {
            const buffer = this.ctx.createBuffer(1, 1, 22050);
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(this.ctx.destination);
            source.start(0);
        } catch (e) {
            console.error("Silent buffer playback failed", e);
        }
    }

    public async resumeIfSuspended() {
        if (this.ctx && this.ctx.state === 'suspended') {
            try {
                await this.ctx.resume();
            } catch (e) {
                console.error("Audio Context resume failed", e);
            }
        }
    }

    // --- Metronome Logic ---
    public setBPM(bpm: number) {
        this.bpm = bpm;
    }

    public setMetronomeSound(sound: MetronomeSound) {
        this.metronomeSound = sound;
    }

    public startMetronome(bpm: number) {
        if (this.isMetronomePlaying) return;
        this.bpm = bpm;
        this.isMetronomePlaying = true;
        if (this.ctx) {
            this.nextNoteTime = this.ctx.currentTime + 0.05;
            this.scheduler();
        }
    }

    public stopMetronome() {
        this.isMetronomePlaying = false;
        if (this.timerID) {
            window.clearTimeout(this.timerID);
            this.timerID = null;
        }
    }

    private scheduler() {
        if (!this.ctx) return;
        while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
            this.scheduleMetronomeTick(this.nextNoteTime);
            this.nextNextNoteTime();
        }
        if (this.isMetronomePlaying) {
             this.timerID = window.setTimeout(() => this.scheduler(), this.lookahead);
        }
    }

    private nextNextNoteTime() {
        const secondsPerBeat = 60.0 / this.bpm;
        this.nextNoteTime += secondsPerBeat;
    }

    private scheduleMetronomeTick(time: number) {
        if (!this.ctx || !this.masterGain) return;
        const gain = this.ctx.createGain();
        gain.connect(this.masterGain);

        if (this.metronomeSound === 'beep') {
            const osc = this.ctx.createOscillator();
            osc.frequency.value = 1000; 
            osc.connect(gain);
            gain.gain.setValueAtTime(0.5, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
            osc.start(time);
            osc.stop(time + 0.1);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); };
        } else if (this.metronomeSound === 'woodblock') {
            const osc = this.ctx.createOscillator();
            osc.frequency.value = 800;
            osc.connect(gain);
            gain.gain.setValueAtTime(0.7, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
            osc.start(time);
            osc.stop(time + 0.08);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); };
        } else if (this.metronomeSound === 'click') {
            const bufferSize = this.ctx.sampleRate * 0.05;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            
            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            
            const filter = this.ctx.createBiquadFilter();
            filter.type = "highpass";
            filter.frequency.value = 1000;
            
            noise.connect(filter);
            filter.connect(gain);

            gain.gain.setValueAtTime(0.4, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
            
            noise.start(time);
            noise.onended = () => { noise.disconnect(); filter.disconnect(); gain.disconnect(); };
        }
    }

    private async loadInstrument(instrumentId: InstrumentID, sampleSource: SampleSourceID) {
        const generation = ++this.loadGeneration;
        this.loadAbortController?.abort();
        const controller = new AbortController();
        this.loadAbortController = controller;

        this.isLoaded = false;
        this.stopAllNotes();
        this.buffers.clear();
        this.networkErrors = [];
        this.currentInstrument = instrumentId;
        this.sampleSource = sampleSource;

        const instDef = INSTRUMENTS.find(i => i.id === instrumentId);
        if (!instDef) throw new Error(`Unknown instrument: ${instrumentId}`);

        if (instrumentId === 'salamander') {
            await this.loadSamples(getSampleBaseUrl(sampleSource, 'salamander'), SALAMANDER_MAP, generation, controller.signal);
        } else if (instrumentId === 'hq_piano') {
            await this.loadSamples(getSampleBaseUrl(sampleSource, 'hq_piano'), HQ_PIANO_MAP, generation, controller.signal);
        } else {
            // GM Logic
            const map: Record<string, string> = {};
            for (let i = 21; i <= 108; i += 3) {
                const noteName = this.getNoteNameForGM(i);
                map[this.midiToStandard(i)] = `${noteName}.mp3`;
            }
            if (!map['C4']) map['C4'] = 'C4.mp3';
            const gmBase = getSampleBaseUrl(sampleSource, 'gm');
            const loopAttack = instDef.playback === 'sustain' ? instDef.loopAttackSeconds : undefined;
            await this.loadSamples(`${gmBase}${instrumentId}-mp3/`, map, generation, controller.signal, loopAttack);
        }

        if (generation !== this.loadGeneration || controller.signal.aborted) return;

        // Individual sample failures are swallowed by loadSamples (they are only
        // recorded in networkErrors), so decoding nothing at all would otherwise
        // leave the engine marked "loaded" while every note stays silent forever.
        // Reject instead: the caller then reports an error and stays retryable.
        if (this.buffers.size === 0) {
            throw new Error(`No audio samples could be loaded for instrument: ${instrumentId}`);
        }

        this.isLoaded = true;
    }

    private midiToStandard(midi: number): string {
        const name = NOTE_NAMES[midi % 12];
        const oct = Math.floor(midi / 12) - 1;
        return `${name}${oct}`;
    }

    private getNoteNameForGM(midi: number): string {
        const names = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
        const name = names[midi % 12];
        const oct = Math.floor(midi / 12) - 1;
        return `${name}${oct}`;
    }

    private async loadSamples(
        baseUrl: string,
        map: Record<string, string>,
        generation: number,
        signal: AbortSignal,
        loopAttackSeconds?: number,
    ) {
        const entries = Object.entries(map);

        // Priority notes for immediate start (middle octaves)
        const priorityKeys = ['C3', 'E3', 'A3', 'C4', 'E4', 'A4', 'C5', 'E5', 'A5'];
        
        let priorityEntries = entries.filter(([note]) => priorityKeys.includes(note));
        const backgroundEntries = entries.filter(([note]) => !priorityKeys.includes(note));

        // If no matching priority keys (different naming scheme), just take first few
        if (priorityEntries.length === 0 && backgroundEntries.length > 5) {
            priorityEntries = backgroundEntries.splice(0, 5);
        }

        const fetchSubset = (list: [string, string][]) => {
            return Promise.all(list.map(async ([note, file]) => {
                try {
                    const url = `${baseUrl}${file}`;
                    const response = await fetch(url, { signal });
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const arrayBuffer = await response.arrayBuffer();

                    if (this.ctx && generation === this.loadGeneration && !signal.aborted) {
                        const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
                        if (generation === this.loadGeneration && !signal.aborted) {
                            const loop = loopAttackSeconds === undefined ? null : prepareSustainLoop(this.ctx, audioBuffer, loopAttackSeconds);
                            // Unusable samples fall back to the nearest loaded
                            // pitch, just like a download/decode failure. A held
                            // instrument must never quietly become one-shot.
                            if (loopAttackSeconds !== undefined && !loop) throw new Error('No audible sustain region');
                            this.buffers.set(note, { buffer: loop?.buffer ?? audioBuffer, loop });
                        }
                    }
                } catch (e) {
                    if (signal.aborted || (e instanceof DOMException && e.name === 'AbortError')) return;
                    console.warn(`Failed to open sample ${file}:`, e);
                    if (generation === this.loadGeneration) this.networkErrors.push(note);
                }
            }));
        };

        // Wait for priority samples to load first
        await fetchSubset(priorityEntries);

        // Fire and forget the rest in the background to unblock initialization
        if (backgroundEntries.length > 0) {
            fetchSubset(backgroundEntries).then(() => {
                if (generation === this.loadGeneration && this.networkErrors.length > 0) {
                    console.warn(`${this.networkErrors.length} background samples failed to load`);
                }
            }).catch((error) => {
                if (!signal.aborted) console.error(error);
            });
        }
    }

    private outputGain() {
        return this.volume * dbToGain(OUTPUT_BOOST_DB);
    }

    public setVolume(val: number) {
        this.volume = Math.max(0, Math.min(MAX_MASTER_VOLUME, val));
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
            this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime);
            this.masterGain.gain.linearRampToValueAtTime(this.outputGain(), this.ctx.currentTime + 0.1);
        }
    }

    public setSustainLevel(level: SustainLevel) {
        this.sustainLevel = level;
    }

    public overrideSustain(isDown: boolean) {
        this.isSustainOverrideDown = isDown;
    }

    private getNoteNumber(note: string): number {
        const match = note.match(/([A-G][#b]?)(-?\d+)/);
        if (!match) return 0;
        let [_, name, octStr] = match;
        if (name.endsWith('b')) {
             if (FLAT_TO_SHARP[name]) name = FLAT_TO_SHARP[name];
        }
        const index = NOTE_NAMES.indexOf(name);
        const octave = parseInt(octStr);
        return octave * 12 + index + 12; 
    }

    private getClosestBuffer(midi: number): (Sample & { distance: number }) | null {
        if (this.buffers.size === 0) return null;

        let minDist = Infinity;
        let closestNote = '';

        for (const note of this.buffers.keys()) {
            const bufferMidi = this.getNoteNumber(note);
            const dist = midi - bufferMidi;
            if (Math.abs(dist) < Math.abs(minDist)) {
                minDist = dist;
                closestNote = note;
            }
        }

        if (closestNote && this.buffers.has(closestNote)) {
            return { ...this.buffers.get(closestNote)!, distance: minDist };
        }
        return null;
    }

    public playNote(note: string, transpose: number = 0, velocity: number = 100, when: number = 0, voiceId?: string) {
        if (!this.ctx || !this.isLoaded || !this.masterGain) return;
        
        if (when === 0) this.resumeIfSuspended();

        const mapKey = voiceId === undefined ? `${note}_${transpose}` : `voice:${voiceId}`;

        const baseMidi = this.getNoteNumber(note);
        if (baseMidi === 0) return;
        
        const targetMidi = baseMidi + transpose;
        const match = this.getClosestBuffer(targetMidi);
        
        if (!match) return;

        const source = this.ctx.createBufferSource();
        source.buffer = match.buffer;
        source.playbackRate.value = Math.pow(2, match.distance / 12);
        if (match.loop) {
            source.loop = true;
            source.loopStart = match.loop.start;
            source.loopEnd = match.loop.end;
        }

        const gain = this.ctx.createGain();
        gain.gain.value = velocityToGain(velocity) * dbToGain(INSTRUMENT_LEVEL_DB[this.currentInstrument]);

        source.connect(gain);
        gain.connect(this.masterGain);
        
        const startTime = when || this.ctx.currentTime;
        source.start(startTime);

        const active = { source, gain, instrumentId: this.currentInstrument };
        const queue = this.activeSources.get(mapKey) ?? [];
        queue.push(active);
        this.activeSources.set(mapKey, queue);
        this.liveSources.add(active);

        source.onended = () => {
            source.disconnect();
            gain.disconnect();
            this.liveSources.delete(active);
            const currentQueue = this.activeSources.get(mapKey);
            if (!currentQueue) return;
            const nextQueue = currentQueue.filter(entry => entry.source !== source);
            if (nextQueue.length > 0) this.activeSources.set(mapKey, nextQueue);
            else this.activeSources.delete(mapKey);
        };
    }

    public stopNote(note: string, transpose: number = 0, when: number = 0, voiceId?: string) {
        const mapKey = voiceId === undefined ? `${note}_${transpose}` : `voice:${voiceId}`;
        const queue = this.activeSources.get(mapKey);
        const active = queue?.shift();
        
        if (active && this.ctx) {
            const { source, gain, instrumentId } = active;
            const t = when || this.ctx.currentTime;
            
            let release = 0.03; // Fast 30ms fade-out for OFF state to prevent clicks
            const effectiveSustain = this.isSustainOverrideDown ? 'LONG' : this.sustainLevel;

            if (effectiveSustain === 'LONG') release = 2.0;
            else if (effectiveSustain === 'SHORT') release = 0.5;

            if (instrumentId === 'string_ensemble_1' || instrumentId === 'lead_1_square') {
                if (effectiveSustain === 'SHORT') release = 1.0;
            }

            try {
                gain.gain.cancelScheduledValues(t);
                gain.gain.setValueAtTime(gain.gain.value, t);
                
                if (release <= 0.05) {
                    gain.gain.linearRampToValueAtTime(0, t + release);
                } else {
                    gain.gain.exponentialRampToValueAtTime(0.001, t + release);
                }
                
                source.stop(t + release);
            } catch(e) { console.warn('AudioEngine stopNote cleanup:', e); }
            
            if (queue && queue.length > 0) this.activeSources.set(mapKey, queue);
            else this.activeSources.delete(mapKey);
        }
    }

    public stopAllNotes() {
        if (!this.ctx) return;
        this.liveSources.forEach(({ source, gain }) => {
            try {
                gain.gain.cancelScheduledValues(this.ctx!.currentTime);
                gain.gain.setValueAtTime(gain.gain.value, this.ctx!.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + 0.1);
                source.stop(this.ctx!.currentTime + 0.1);
            } catch (e) {
                console.warn('Error stopping note', e);
            }
        });
        this.activeSources.clear();
        this.liveSources.clear();
    }
}

export const audioEngine = new AudioEngine();
