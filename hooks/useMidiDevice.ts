import { useState, useEffect, useRef } from 'react';
import { audioEngine, InstrumentID } from '../services/audioEngine';
import { midiNumberToNote } from '../constants';
import { RecordedEvent } from '../types'; // Extracted types will live here

interface UseMidiDeviceProps {
    currentInstrument: InstrumentID;
    isRecording: boolean;
    recordingStartTime: number;
    addRecordingEvent: (evt: RecordedEvent) => void;
    setTriggerNotes: (updater: (prev: any[]) => any[]) => void;
    setActiveMidiNotes: (updater: (prev: Set<string>) => Set<string>) => void;
}

export function useMidiDevice({
    currentInstrument,
    isRecording,
    recordingStartTime,
    addRecordingEvent,
    setTriggerNotes,
    setActiveMidiNotes
}: UseMidiDeviceProps) {
    const [midiAccess, setMidiAccess] = useState<WebMidi.MIDIAccess | null>(null);
    const [isSustainPedalDown, setIsSustainPedalDown] = useState(false);

    // Refs for stale closure prevention
    const recordingStartTimeRef = useRef(recordingStartTime);
    const currentInstrumentRef = useRef(currentInstrument);
    const isRecordingRef = useRef(isRecording);

    useEffect(() => { recordingStartTimeRef.current = recordingStartTime; }, [recordingStartTime]);
    useEffect(() => { currentInstrumentRef.current = currentInstrument; }, [currentInstrument]);
    useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

    // Request MIDI Access
    useEffect(() => {
        if (navigator.requestMIDIAccess) {
            navigator.requestMIDIAccess().then(
                (ma) => {
                    setMidiAccess(ma);
                },
                (err) => console.warn('Web MIDI API access denied or not supported.', err)
            );
        }
    }, []);

    // Stable handler ref
    const handleMidiMessageRef = useRef<(e: WebMidi.MIDIMessageEvent) => void>(() => {});

    useEffect(() => {
        handleMidiMessageRef.current = (e: WebMidi.MIDIMessageEvent) => {
            const { data } = e;
            if (!data || data.length < 2) return;

            const [status, data1, data2] = data;
            const command = status & 0xf0;
            const channel = status & 0x0f;

            // Note On / Off (Commands 144 / 128)
            if (command === 144 || command === 128) {
                const noteNum = data1;
                const velocity = data2;
                const noteName = midiNumberToNote(noteNum);
                
                // Note On
                if (command === 144 && velocity > 0) {
                    audioEngine.playNote(noteName, 0, velocity); 
                    setActiveMidiNotes(prev => new Set(prev).add(noteName));
                    setTriggerNotes(prev => [...prev, { note: noteName, time: Date.now(), type: 'user' }]);
            
                    if (isRecordingRef.current) {
                        addRecordingEvent({
                            time: Date.now() - recordingStartTimeRef.current,
                            type: 'on',
                            note: noteName,
                            transpose: 0,
                            instrumentId: currentInstrumentRef.current,
                            velocity: velocity
                        });
                    }
                } 
                // Note Off
                else if (command === 128 || (command === 144 && velocity === 0)) {
                    audioEngine.stopNote(noteName, 0);
                    setActiveMidiNotes(prev => {
                        const s = new Set(prev);
                        s.delete(noteName);
                        return s;
                    });
                    
                    if (isRecordingRef.current) {
                        addRecordingEvent({
                            time: Date.now() - recordingStartTimeRef.current,
                            type: 'off',
                            note: noteName,
                            transpose: 0,
                            instrumentId: currentInstrumentRef.current
                        });
                    }
                }
            }
            // Control Change (Command 176)
            else if (command === 176) {
                const controllerNumber = data1;
                const controllerValue = data2;
                
                // CC 64 = Sustain Pedal (Damper)
                if (controllerNumber === 64) {
                    const isDown = controllerValue >= 64;
                    setIsSustainPedalDown(isDown);
                    audioEngine.overrideSustain(isDown);
                }
            }
        };
    }, [addRecordingEvent, setActiveMidiNotes, setTriggerNotes]);

    // Attach listeners
    useEffect(() => {
        if (!midiAccess) return;
        
        const listener = (e: WebMidi.MIDIMessageEvent) => handleMidiMessageRef.current(e);

        const inputs = Array.from(midiAccess.inputs.values());
        inputs.forEach((input: any) => {
            input.onmidimessage = listener;
        });

        midiAccess.onstatechange = (e: WebMidi.MIDIConnectionEvent) => {
            const port = e.port as WebMidi.MIDIInput;
            if (port.type === 'input') {
                if (port.state === 'connected') {
                    (port as any).onmidimessage = listener;
                } else {
                    (port as any).onmidimessage = null;
                }
            }
        };
        
        return () => {
            inputs.forEach((input: any) => input.onmidimessage = null);
        };
    }, [midiAccess]);

    return {
        isSustainPedalDown
    };
}
