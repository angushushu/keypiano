
import { NOTE_NAMES } from '../constants';

// Extend Window interface for Webkit Audio Context support
declare global {
    interface Window {
        webkitAudioContext: typeof AudioContext;
    }

    // Web MIDI API Global Definitions
    namespace WebMidi {
        interface MIDIOptions {
            sysex?: boolean;
            software?: boolean;
        }

        interface MIDIInputMap {
            forEach(callbackfn: (value: MIDIInput, key: string, parent: MIDIInputMap) => void, thisArg?: any): void;
            get(key: string): MIDIInput | undefined;
            has(key: string): boolean;
            readonly size: number;
            entries(): IterableIterator<[string, MIDIInput]>;
            keys(): IterableIterator<string>;
            values(): IterableIterator<MIDIInput>;
            [Symbol.iterator](): IterableIterator<[string, MIDIInput]>;
        }

        interface MIDIOutputMap {
            forEach(callbackfn: (value: MIDIOutput, key: string, parent: MIDIOutputMap) => void, thisArg?: any): void;
            get(key: string): MIDIOutput | undefined;
            has(key: string): boolean;
            readonly size: number;
            entries(): IterableIterator<[string, MIDIOutput]>;
            keys(): IterableIterator<string>;
            values(): IterableIterator<MIDIOutput>;
            [Symbol.iterator](): IterableIterator<[string, MIDIOutput]>;
        }

        interface MIDIAccess extends EventTarget {
            inputs: MIDIInputMap;
            outputs: MIDIOutputMap;
            onstatechange: ((this: MIDIAccess, ev: MIDIConnectionEvent) => any) | null;
            sysexEnabled: boolean;
        }

        interface MIDIPort extends EventTarget {
            id: string;
            manufacturer?: string;
            name?: string;
            type: "input" | "output";
            version?: string;
            state: "connected" | "disconnected";
            connection: "open" | "closed" | "pending";
            onstatechange: ((this: MIDIPort, ev: MIDIConnectionEvent) => any) | null;
            open(): Promise<MIDIPort>;
            close(): Promise<MIDIPort>;
        }

        interface MIDIInput extends MIDIPort {
            onmidimessage: ((this: MIDIInput, ev: MIDIMessageEvent) => any) | null;
        }

        interface MIDIOutput extends MIDIPort {
            send(data: number[] | Uint8Array, timestamp?: number): void;
            clear(): void;
        }

        interface MIDIMessageEvent extends Event {
            data: Uint8Array;
        }

        interface MIDIConnectionEvent extends Event {
            port: MIDIPort;
        }
    }

    interface Navigator {
        requestMIDIAccess(options?: WebMidi.MIDIOptions): Promise<WebMidi.MIDIAccess>;
    }
}

// Audio Engine - Sampler Based

// Instrument Definitions
export const INSTRUMENTS = [
    { id: 'salamander', name: 'Yamaha C5 Grand (Pro)', type: 'custom' }, // New Best Option
    { id: 'hq_piano', name: 'Standard Piano (Lite)', type: 'custom' },
    { id: 'electric_grand_piano', name: 'Electric Piano', type: 'gm' },
    { id: 'drawbar_organ', name: 'Organ', type: 'gm' },
    { id: 'acoustic_guitar_steel', name: 'Acoustic Guitar', type: 'gm' },
    { id: 'string_ensemble_1', name: 'String Ensemble', type: 'gm' },
    { id: 'lead_1_square', name: 'Synth Lead', type: 'gm' },
    { id: 'synth_drum', name: 'Synth Drum', type: 'gm' }
] as const;

export type InstrumentID = typeof INSTRUMENTS[number]['id'];

export type MetronomeSound = 'beep' | 'click' | 'woodblock';
export const METRONOME_SOUNDS: {id: MetronomeSound, label: string}[] = [
    { id: 'beep', label: 'Beep' },
    { id: 'click', label: 'Click' },
    { id: 'woodblock', label: 'Wood' }
];

// Source 1: Salamander Grand Piano (Yamaha C5) - Hosted by Tone.js
const SALAMANDER_BASE = 'https://tonejs.github.io/audio/salamander/';
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

// Source 2: Original High Quality Piano (fuhton)
const HQ_PIANO_BASE = 'https://raw.githubusercontent.com/fuhton/piano-mp3/master/piano-mp3/';
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

// Source 3: General MIDI (gleitz/midi-js-soundfonts - Musyng Kite)
const GM_BASE = 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/';

export type SustainLevel = 'OFF' | 'SHORT' | 'LONG';

class AudioEngine {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private compressor: DynamicsCompressorNode | null = null;
    private buffers: Map<string, AudioBuffer> = new Map();
    private activeSources: Map<string, { source: AudioBufferSourceNode, gain: GainNode }> = new Map();
    
    public isLoaded = false;
    private volume: number = 0.5;
    private sustainLevel: SustainLevel = 'SHORT';
    private currentInstrument: InstrumentID = 'salamander';

    // Metronome State
    private nextNoteTime: number = 0.0;
    private timerID: number | null = null;
    private isMetronomePlaying: boolean = false;
    private bpm: number = 120;
    private lookahead: number = 25.0; // ms
    private scheduleAheadTime: number = 0.1; // s
    private metronomeSound: MetronomeSound = 'beep';

    public async init(instrumentId: InstrumentID = 'salamander') {
        // 1. Initialize Audio Context synchronously to capture user gesture
        if (!this.ctx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContextClass();
            
            this.compressor = this.ctx.createDynamicsCompressor();
            this.compressor.threshold.value = -10;
            this.compressor.knee.value = 30;
            this.compressor.ratio.value = 12;
            this.compressor.attack.value = 0.003;
            this.compressor.release.value = 0.25;
            this.compressor.connect(this.ctx.destination);

            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = this.volume;
            this.masterGain.connect(this.compressor);
        }

        this.unlockAudio();

        if (this.currentInstrument !== instrumentId || !this.isLoaded) {
            await this.loadInstrument(instrumentId);
        }
    }
    
    public get currentTime() {
        return this.ctx?.currentTime || 0;
    }

    private unlockAudio() {
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(e => console.error("Audio resume failed", e));
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
        } else if (this.metronomeSound === 'woodblock') {
            const osc = this.ctx.createOscillator();
            osc.frequency.value = 800;
            osc.connect(gain);
            gain.gain.setValueAtTime(0.7, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08); // shorter decay
            osc.start(time);
            osc.stop(time + 0.08);
        } else if (this.metronomeSound === 'click') {
            const bufferSize = this.ctx.sampleRate * 0.05; // 50ms
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
        }
    }

    private async loadInstrument(instrumentId: InstrumentID) {
        this.isLoaded = false;
        this.buffers.clear(); 
        this.currentInstrument = instrumentId;

        const instDef = INSTRUMENTS.find(i => i.id === instrumentId);
        if (!instDef) return;

        if (instrumentId === 'salamander') {
            await this.loadSamples(SALAMANDER_BASE, SALAMANDER_MAP);
        } else if (instrumentId === 'hq_piano') {
            await this.loadSamples(HQ_PIANO_BASE, HQ_PIANO_MAP);
        } else {
            // GM Logic
            const map: Record<string, string> = {};
            for (let i = 21; i <= 108; i += 3) {
                const noteName = this.getNoteNameForGM(i);
                map[this.midiToStandard(i)] = `${noteName}.mp3`;
            }
            if (!map['C4']) map['C4'] = 'C4.mp3';
            await this.loadSamples(`${GM_BASE}${instrumentId}-mp3/`, map);
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

    private async loadSamples(baseUrl: string, map: Record<string, string>) {
        const promises = Object.entries(map).map(async ([note, file]) => {
            try {
                const url = `${baseUrl}${file}`;
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const arrayBuffer = await response.arrayBuffer();
                
                if (this.ctx) {
                    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
                    this.buffers.set(note, audioBuffer);
                }
            } catch (e) { }
        });

        await Promise.all(promises);
    }

    public setVolume(val: number) {
        this.volume = val * 2.0; 
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
            this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime);
            this.masterGain.gain.linearRampToValueAtTime(this.volume, this.ctx.currentTime + 0.1);
        }
    }

    public setSustainLevel(level: SustainLevel) {
        this.sustainLevel = level;
    }

    private getNoteNumber(note: string): number {
        const match = note.match(/([A-G][#b]?)(-?\d+)/);
        if (!match) return 0;
        let [_, name, octStr] = match;
        if (name.endsWith('b')) {
             const sharpMap: any = {'Db':'C#', 'Eb':'D#', 'Gb':'F#', 'Ab':'G#', 'Bb':'A#'};
             if (sharpMap[name]) name = sharpMap[name];
        }
        const index = NOTE_NAMES.indexOf(name);
        const octave = parseInt(octStr);
        return octave * 12 + index + 12; 
    }

    private getClosestBuffer(midi: number): { buffer: AudioBuffer, distance: number } | null {
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
            return { buffer: this.buffers.get(closestNote)!, distance: minDist };
        }
        return null;
    }

    public playNote(note: string, transpose: number = 0, velocity: number = 100, when: number = 0) {
        if (!this.ctx || !this.isLoaded || !this.masterGain) return;
        
        if (when === 0) this.resumeIfSuspended();

        const mapKey = `${note}_${transpose}`;
        
        if (when === 0) {
            this.stopNote(note, transpose); 
        }

        const baseMidi = this.getNoteNumber(note);
        if (baseMidi === 0) return;
        
        const targetMidi = baseMidi + transpose;
        const match = this.getClosestBuffer(targetMidi);
        
        if (!match) return;

        const source = this.ctx.createBufferSource();
        source.buffer = match.buffer;
        source.playbackRate.value = Math.pow(2, match.distance / 12);

        const gain = this.ctx.createGain();
        const normalizedVel = Math.max(0, Math.min(127, velocity)) / 127;
        const gainValue = normalizedVel * normalizedVel; 
        
        gain.gain.value = gainValue;

        source.connect(gain);
        gain.connect(this.masterGain);
        
        const startTime = when || this.ctx.currentTime;
        source.start(startTime);

        this.activeSources.set(mapKey, { source, gain });
    }

    public stopNote(note: string, transpose: number = 0, when: number = 0) {
        const mapKey = `${note}_${transpose}`;
        const active = this.activeSources.get(mapKey);
        
        if (active && this.ctx) {
            const { source, gain } = active;
            const t = when || this.ctx.currentTime;
            
            let release = 0.2;
            if (this.sustainLevel === 'LONG') release = 2.0;
            else if (this.sustainLevel === 'SHORT') release = 0.5;
            
            if (this.currentInstrument === 'string_ensemble_1' || this.currentInstrument === 'lead_1_square') {
                if (this.sustainLevel === 'SHORT') release = 1.0;
            }

            try {
                gain.gain.cancelScheduledValues(t);
                gain.gain.setValueAtTime(gain.gain.value, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + release);
                source.stop(t + release);
            } catch(e) {}
            
            setTimeout(() => {
                source.disconnect();
                gain.disconnect();
            }, (when ? (when - this.ctx.currentTime) : 0) * 1000 + release * 1000 + 100);

            this.activeSources.delete(mapKey);
        }
    }
}

export const audioEngine = new AudioEngine();
