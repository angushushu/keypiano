import { useState, useEffect, useRef, useCallback } from 'react';
import { audioEngine, InstrumentID } from '../services/audioEngine';
import { midiNumberToNote } from '../constants';
import { RecordedEvent, TriggerNote } from '../types';

interface UseMidiDeviceProps {
    currentInstrument: InstrumentID;
    isRecording: boolean;
    recordingStartTime: number;
    addRecordingEvent: (evt: RecordedEvent) => void;
    setTriggerNotes: (updater: (prev: TriggerNote[]) => TriggerNote[]) => void;
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
    const getMidiRequest = () => Reflect.get(navigator, 'requestMIDIAccess') as
        (() => Promise<WebMidi.MIDIAccess>) | undefined;
    const [midiAccess, setMidiAccess] = useState<WebMidi.MIDIAccess | null>(null);
    const [isSustainPedalDown, setIsSustainPedalDown] = useState(false);
    const [midiStatus, setMidiStatus] = useState<'idle' | 'requesting' | 'connected' | 'denied' | 'unsupported'>(
        getMidiRequest() ? 'idle' : 'unsupported'
    );
    const [midiInputCount, setMidiInputCount] = useState(0);

    // Refs for stale closure prevention
    const recordingStartTimeRef = useRef(recordingStartTime);
    const currentInstrumentRef = useRef(currentInstrument);
    const isRecordingRef = useRef(isRecording);
    const midiNoteCountsRef = useRef(new Map<string, number>());

    useEffect(() => { recordingStartTimeRef.current = recordingStartTime; }, [recordingStartTime]);
    useEffect(() => { currentInstrumentRef.current = currentInstrument; }, [currentInstrument]);
    useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

    const requestMidiAccess = useCallback(async () => {
        const midiRequest = getMidiRequest();
        if (!midiRequest) {
            setMidiStatus('unsupported');
            return;
        }

        setMidiStatus('requesting');
        try {
            const access = await midiRequest.call(navigator);
            setMidiAccess(access);
            setMidiInputCount(access.inputs.size);
            setMidiStatus('connected');
        } catch (error) {
            console.warn('Web MIDI API access denied.', error);
            setMidiStatus('denied');
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
            // Note On / Off (Commands 144 / 128)
            if (command === 144 || command === 128) {
                const noteNum = data1;
                const velocity = data2;
                const noteName = midiNumberToNote(noteNum);
                
                // Note On
                if (command === 144 && velocity > 0) {
                    audioEngine.playNote(noteName, 0, velocity); 
                    midiNoteCountsRef.current.set(noteName, (midiNoteCountsRef.current.get(noteName) ?? 0) + 1);
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
                    const remainingCount = Math.max(0, (midiNoteCountsRef.current.get(noteName) ?? 1) - 1);
                    if (remainingCount > 0) midiNoteCountsRef.current.set(noteName, remainingCount);
                    else midiNoteCountsRef.current.delete(noteName);
                    setActiveMidiNotes(prev => {
                        const s = new Set(prev);
                        if (remainingCount === 0) s.delete(noteName);
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

    const releaseAllMidiNotes = useCallback(() => {
        midiNoteCountsRef.current.forEach((count, noteName) => {
            for (let index = 0; index < count; index++) audioEngine.stopNote(noteName, 0);
        });
        midiNoteCountsRef.current.clear();
        setActiveMidiNotes(() => new Set());
        setIsSustainPedalDown(false);
        audioEngine.overrideSustain(false);
    }, [setActiveMidiNotes]);

    // Attach listeners
    useEffect(() => {
        if (!midiAccess) return;
        
        const listener = (e: WebMidi.MIDIMessageEvent) => handleMidiMessageRef.current(e);

        const inputs = Array.from(midiAccess.inputs.values());
        inputs.forEach((input) => {
            input.onmidimessage = listener;
        });

        midiAccess.onstatechange = (e: WebMidi.MIDIConnectionEvent) => {
            const port = e.port as WebMidi.MIDIInput;
            if (port.type === 'input') {
                if (port.state === 'connected') {
                    (port as WebMidi.MIDIInput).onmidimessage = listener;
                } else {
                    (port as WebMidi.MIDIInput).onmidimessage = null;
                    releaseAllMidiNotes();
                }
                setMidiInputCount(midiAccess.inputs.size);
            }
        };
        
        return () => {
            inputs.forEach((input) => input.onmidimessage = null);
            midiAccess.onstatechange = null;
            releaseAllMidiNotes();
        };
    }, [midiAccess, releaseAllMidiNotes]);

    return {
        isSustainPedalDown,
        midiStatus,
        midiInputCount,
        requestMidiAccess,
    };
}
