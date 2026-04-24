// Web MIDI API type definitions
// These extend the global types for browsers that support the Web MIDI API.

declare global {
    interface Window {
        webkitAudioContext: typeof AudioContext;
    }

    namespace WebMidi {
        interface MIDIOptions {
            sysex?: boolean;
            software?: boolean;
        }

        interface MIDIInputMap {
            forEach(callbackfn: (value: MIDIInput, key: string, parent: MIDIInputMap) => void, thisArg?: unknown): void;
            get(key: string): MIDIInput | undefined;
            has(key: string): boolean;
            readonly size: number;
            entries(): IterableIterator<[string, MIDIInput]>;
            keys(): IterableIterator<string>;
            values(): IterableIterator<MIDIInput>;
            [Symbol.iterator](): IterableIterator<[string, MIDIInput]>;
        }

        interface MIDIOutputMap {
            forEach(callbackfn: (value: MIDIOutput, key: string, parent: MIDIOutputMap) => void, thisArg?: unknown): void;
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
            onstatechange: ((this: MIDIAccess, ev: MIDIConnectionEvent) => unknown) | null;
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
            onstatechange: ((this: MIDIPort, ev: MIDIConnectionEvent) => unknown) | null;
            open(): Promise<MIDIPort>;
            close(): Promise<MIDIPort>;
        }

        interface MIDIInput extends MIDIPort {
            onmidimessage: ((this: MIDIInput, ev: MIDIMessageEvent) => unknown) | null;
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

export {};
