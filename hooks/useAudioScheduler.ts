import { useState, useEffect, useRef, useCallback } from 'react';
import { audioEngine } from '../services/audioEngine';
import { RecordedEvent, TriggerNote } from '../types';
import { getTransposedNote, noteToMidi } from '../constants';
import {
    WaitGate, findNextGate, isGateSatisfied, isWithinGateWindow, noteQueueKey, remainingNotes, withHit,
} from '../services/waitGate';
import {
    GUIDE_LOOKAHEAD_MS, EMPTY_INSTRUCTION, buildPracticeGuide, holdingEntries, nextPracticePitches, nowEntries, sameInstruction, sameLevels, upcomingEntries,
    type GuideInstruction,
} from '../services/practiceGuide';
import type { KeyAssignment } from '../services/autoFingering';
import type { TickWorkerMessage } from '../workers/tickWorker';

interface UseAudioSchedulerProps {
    recordingRef: React.MutableRefObject<RecordedEvent[]>;
    isPracticeMode: boolean;
    /** In practice mode, halt at each note until the player presses it. */
    isWaitMode: boolean;
    playbackSpeed: number;
    /** Keys chosen for events without a recorded key (imported MIDI), computed once per piece. */
    keyAssignments: Map<RecordedEvent, KeyAssignment>;
    setPlaybackKeys: (keys: Set<string>) => void;
    setPlaybackNotes: (notes: Set<string>) => void;
    setTriggerNotes: (updater: (prev: TriggerNote[]) => TriggerNote[]) => void;
    setPlaybackTempTranspose: (transpose: number) => void;
    /** Practice guide brightness per key code / note, 1 meaning "press now". */
    setGuideKeys: (levels: Map<string, number>) => void;
    setGuideNotes: (levels: Map<string, number>) => void;
    setGuideInstruction: (instruction: GuideInstruction) => void;
    setElapsedTime: (time: number) => void;
    elapsedTime: number;
}

// ─── Pure helper functions ──────────────────────────────────────

export function computeActiveEvents(events: RecordedEvent[], upToMs: number): Map<string, RecordedEvent> {
    const active = new Map<string, RecordedEvent>();
    const queues = new Map<string, string[]>();
    let sequence = 0;

    for (const evt of events) {
        if (evt.time > upToMs) break;
        const baseKey = noteQueueKey(evt);
        const queue = queues.get(baseKey) ?? [];

        if (evt.type === 'on') {
            const instanceKey = `${baseKey}#${sequence++}`;
            queue.push(instanceKey);
            queues.set(baseKey, queue);
            active.set(instanceKey, evt);
        } else {
            const instanceKey = queue.shift();
            if (instanceKey) active.delete(instanceKey);
            if (queue.length === 0) queues.delete(baseKey);
        }
    }
    return active;
}

/** Events exactly at the cursor remain scheduled, rather than resumed twice. */
export function getPlaybackCursor(events: RecordedEvent[], requestedTime: number) {
    const duration = events.reduce((end, evt) => Math.max(end, evt.time), 0);
    const time = Number.isFinite(requestedTime) ? Math.max(0, Math.min(duration, requestedTime)) : 0;
    let index = 0;
    while (index < events.length && events[index].time < time) index++;
    return { time, duration, index, active: computeActiveEvents(events.slice(0, index), time) };
}

/** Keys that play `evt`: the key it was recorded with, or the auto-fingered key plus its modifier. */
export function keysForEvent(evt: RecordedEvent, assignments: Map<RecordedEvent, KeyAssignment>): string[] {
    if (evt.code) return [evt.code];
    const assignment = assignments.get(evt);
    if (!assignment) return [];
    if (assignment.modifier === 1) return [assignment.code, 'ShiftLeft'];
    if (assignment.modifier === -1) return [assignment.code, 'ControlLeft'];
    return [assignment.code];
}

export function assignFingering(
    events: Map<string, RecordedEvent>,
    assignments: Map<RecordedEvent, KeyAssignment>,
): { activeKeys: Set<string>; activeNotes: Set<string> } {
    const activeKeys = new Set<string>();
    const activeNotes = new Set<string>();
    for (const evt of events.values()) {
        activeNotes.add(getTransposedNote(evt.note, evt.transpose));
        keysForEvent(evt, assignments).forEach(code => activeKeys.add(code));
    }
    return { activeKeys, activeNotes };
}

export function detectTempTranspose(activeKeys: Set<string>): number {
    if (activeKeys.has('ShiftLeft')) return 1;
    if (activeKeys.has('ControlLeft')) return -1;
    return 0;
}

export function emitTriggerNotes(
    events: RecordedEvent[],
    fromIndex: number,
    upToMs: number,
    isPracticeMode: boolean,
): { triggerNotes: TriggerNote[]; newIndex: number } {
    const result: TriggerNote[] = [];
    let i = fromIndex;
    while (i < events.length && events[i].time <= upToMs) {
        if (events[i].type === 'on') {
            const evt = events[i];
            const visualNote = getTransposedNote(evt.note, evt.transpose);
            result.push({ note: visualNote, time: Date.now(), type: isPracticeMode ? 'practice' : 'user' });
        }
        i++;
    }
    return { triggerNotes: result, newIndex: i };
}

// ─── Main hook ──────────────────────────────────────────────────

export function useAudioScheduler({
    recordingRef,
    isPracticeMode,
    isWaitMode,
    playbackSpeed,
    keyAssignments,
    setPlaybackKeys,
    setPlaybackNotes,
    setTriggerNotes,
    setPlaybackTempTranspose,
    setGuideKeys,
    setGuideNotes,
    setGuideInstruction,
    setElapsedTime,
    elapsedTime
}: UseAudioSchedulerProps) {
    const [isPlayingBack, setIsPlayingBack] = useState(false);
    /** Notes still to press while wait mode holds the clock, or null when not waiting. */
    const [waitingRemaining, setWaitingRemaining] = useState<number | null>(null);
    
    // Playback Refs needed for precise scheduling
    const animFrameRef = useRef<number | null>(null);
    const audioContextStartTimeRef = useRef<number>(0);
    const audioCursorRef = useRef<number>(0);
    const playbackStartOffsetRef = useRef<number>(0); 
    const playbackSpeedRef = useRef<number>(playbackSpeed); 
    const isPracticeModeRef = useRef<boolean>(isPracticeMode);
    const isWaitModeRef = useRef<boolean>(isWaitMode);
    const isPlayingRef = useRef(false);
    const gateRef = useRef<WaitGate | null>(null);
    const isWaitingRef = useRef(false);
    
    // Extracted state for fingering visuals
    const playbackKeysRef = useRef<Set<string>>(new Set());
    const playbackNotesRef = useRef<Set<string>>(new Set());
    const guideKeysRef = useRef<Map<string, number>>(new Map());
    const guideNotesRef = useRef<Map<string, number>>(new Map());
    const guideInstructionRef = useRef(EMPTY_INSTRUCTION);
    const playbackTempTransposeRef = useRef(0);
    const lastStaveIndexRef = useRef<number>(0);
    const workerRef = useRef<Worker | null>(null);

    const keyAssignmentsRef = useRef(keyAssignments);
    useEffect(() => { playbackSpeedRef.current = playbackSpeed; }, [playbackSpeed]);
    useEffect(() => { keyAssignmentsRef.current = keyAssignments; }, [keyAssignments]);
    const readTrackTimeMs = () => (
        (audioEngine.currentTime - audioContextStartTimeRef.current) * playbackSpeedRef.current * 1000
    ) + playbackStartOffsetRef.current;

    const isWaitActive = () => isPracticeModeRef.current && isWaitModeRef.current;

    // Pins the clock to `timeMs`; resuming later continues from there.
    const holdClockAt = (timeMs: number) => {
        playbackStartOffsetRef.current = timeMs;
        audioContextStartTimeRef.current = audioEngine.currentTime;
    };

    const clearWait = () => {
        isWaitingRef.current = false;
        setWaitingRemaining(null);
    };

    const releaseGate = () => {
        const gate = gateRef.current;
        if (!gate) return;
        if (isWaitingRef.current) holdClockAt(gate.timeMs);
        gateRef.current = findNextGate(recordingRef.current, gate.endTimeMs, false);
        clearWait();
    };

    /**
     * Called before either loop reads the clock: passes gates the player has
     * already satisfied and holds the clock at the first one they have not.
     */
    const applyWaitGate = () => {
        if (!isWaitActive()) return;
        if (isWaitingRef.current) {
            if (gateRef.current) holdClockAt(gateRef.current.timeMs);
            return;
        }
        const trackTimeMs = readTrackTimeMs();
        while (gateRef.current && trackTimeMs >= gateRef.current.timeMs && isGateSatisfied(gateRef.current)) {
            gateRef.current = findNextGate(recordingRef.current, gateRef.current.endTimeMs, false);
        }
        const gate = gateRef.current;
        if (!gate || trackTimeMs < gate.timeMs) return;
        isWaitingRef.current = true;
        holdClockAt(gate.timeMs);
        setWaitingRemaining(remainingNotes(gate));
    };

    // Toggling practice or wait mode mid-piece restarts gating from "now", so
    // a stale gate behind the playhead can never pull the clock backwards.
    useEffect(() => {
        isPracticeModeRef.current = isPracticeMode;
        isWaitModeRef.current = isWaitMode;
        if (isWaitingRef.current) clearWait();
        gateRef.current = isPlayingRef.current
            ? findNextGate(recordingRef.current, readTrackTimeMs(), true)
            : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPracticeMode, isWaitMode]);

    /** Reports a note the player pressed (any input), in sounding pitch. */
    const registerUserNote = useCallback((note: string) => {
        const gate = gateRef.current;
        if (!gate || !isPlayingRef.current || !isWaitActive()) return;
        if (!isWaitingRef.current && !isWithinGateWindow(gate, readTrackTimeMs(), playbackSpeedRef.current)) return;
        const midi = noteToMidi(note);
        if (!nextPracticePitches(recordingRef.current, gate, keyAssignmentsRef.current).includes(midi)) return;
        const next = withHit(gate, midi);
        if (next === gate) return;
        gateRef.current = next;
        if (!isWaitingRef.current) return;
        if (isGateSatisfied(next)) releaseGate();
        else setWaitingRemaining(remainingNotes(next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /** Lets the player move past notes they cannot reach, e.g. outside the key map. */
    const skipWaitingNotes = useCallback(() => {
        if (isWaitingRef.current) releaseGate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const updateGuide = (keys: Map<string, number>, notes: Map<string, number>, instruction = EMPTY_INSTRUCTION) => {
        if (!sameLevels(keys, guideKeysRef.current)) {
            guideKeysRef.current = keys;
            setGuideKeys(keys);
        }
        if (!sameLevels(notes, guideNotesRef.current)) {
            guideNotesRef.current = notes;
            setGuideNotes(notes);
        }
        if (!sameInstruction(instruction, guideInstructionRef.current)) {
            guideInstructionRef.current = instruction;
            setGuideInstruction(instruction);
        }
    };

    const pausePlayback = () => {
        isPlayingRef.current = false;
        clearWait();
        gateRef.current = null;
        setIsPlayingBack(false);
        audioEngine.stopAllNotes();
        workerRef.current?.postMessage('stop');
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        setPlaybackKeys(new Set());
        setPlaybackNotes(new Set());
        playbackKeysRef.current = new Set();
        playbackNotesRef.current = new Set();
        updateGuide(new Map(), new Map());
        setPlaybackTempTranspose(0);
        playbackTempTransposeRef.current = 0;
    };

    const startPlayback = (fromMs = elapsedTime, restartAtEnd = true) => {
        if (recordingRef.current.length === 0) return;
        audioEngine.resumeIfSuspended();

        const cursor = getPlaybackCursor(recordingRef.current, fromMs);
        const position = restartAtEnd && cursor.time >= cursor.duration ? getPlaybackCursor(recordingRef.current, 0) : cursor;
        setElapsedTime(position.time);
        playbackStartOffsetRef.current = position.time;
        audioCursorRef.current = position.index;
        lastStaveIndexRef.current = position.index;
        if (!isPracticeModeRef.current) {
            position.active.forEach(evt => {
                audioEngine.playNote(evt.note, evt.transpose, evt.velocity, 0, evt.noteId);
            });
        }
    
        audioContextStartTimeRef.current = audioEngine.currentTime;
        gateRef.current = findNextGate(recordingRef.current, playbackStartOffsetRef.current, true);
        clearWait();
        isPlayingRef.current = true;
        setIsPlayingBack(true);
        setPlaybackKeys(new Set());
        setPlaybackNotes(new Set());
        updateGuide(new Map(), new Map());
        workerRef.current?.postMessage('start');
        
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = requestAnimationFrame(visualLoop);
    };

    const togglePlayback = () => {
        if (isPlayingBack) pausePlayback();
        else startPlayback();
    };

    const seekPlayback = (requestedTime: number) => {
        const wasPlaying = isPlayingRef.current;
        const cursor = getPlaybackCursor(recordingRef.current, requestedTime);
        if (wasPlaying) pausePlayback();
        setElapsedTime(cursor.time);
        playbackStartOffsetRef.current = cursor.time;
        if (wasPlaying && cursor.time < cursor.duration) startPlayback(cursor.time, false);
    };

    const changePlaybackSpeedAnchor = (newSpeed: number) => {
        if (isPlayingBack && playbackSpeedRef.current > 0) {
            const now = audioEngine.currentTime;
            const currentTrackTimeSec = (now - audioContextStartTimeRef.current) * playbackSpeedRef.current;
            audioContextStartTimeRef.current = now - (currentTrackTimeSec / newSpeed);
        }
    };

    useEffect(() => {
        const worker = new Worker(new URL('../workers/tickWorker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (event: MessageEvent<TickWorkerMessage>) => {
            if (event.data === 'tick') runAudioScheduler();
        };
        workerRef.current = worker;
        return () => {
            worker.terminate();
            // Must be cleared: the visual loop re-arms itself while this is
            // truthy, which would keep requestAnimationFrame running forever
            // after unmount (and hold the audio voices it references).
            workerRef.current = null;
            if (animFrameRef.current !== null) {
                cancelAnimationFrame(animFrameRef.current);
                animFrameRef.current = null;
            }
            audioEngine.stopAllNotes();
        };
    }, []);

    const runAudioScheduler = () => {
        if (!isPlayingRef.current || recordingRef.current.length === 0) return;
        applyWaitGate();

        const currentCtxTime = audioEngine.currentTime;
        const speed = playbackSpeedRef.current;
        const startOffsetSec = playbackStartOffsetRef.current / 1000;
        
        const trackPlayTime = (currentCtxTime - audioContextStartTimeRef.current) * speed + startOffsetSec; 
        const scheduleUntil = trackPlayTime + 0.1 * speed; 
        
        const events = recordingRef.current;
        let nextIdx = audioCursorRef.current;

        while(nextIdx < events.length) {
            const evt = events[nextIdx];
            const evtTimeSec = evt.time / 1000;
            if (evtTimeSec > scheduleUntil) break; 

            const absolutePlayTime = audioContextStartTimeRef.current + (evtTimeSec - startOffsetSec) / speed;
            
            if (evt.type === 'on') {
                 if (absolutePlayTime > currentCtxTime - 0.05) {
                     if (!isPracticeModeRef.current) {
                         audioEngine.playNote(evt.note, evt.transpose, evt.velocity, absolutePlayTime, evt.noteId);
                     }
                 }
            } else if (!isPracticeModeRef.current) {
                 // Practice mode never starts playback notes, and stopping one
                 // here would cut off the player's own note of the same pitch.
                 audioEngine.stopNote(evt.note, evt.transpose, absolutePlayTime, evt.noteId);
            }
            nextIdx++;
        }
        audioCursorRef.current = nextIdx;
        
        const lastEvent = events[events.length - 1];
        if (lastEvent && trackPlayTime > (lastEvent.time / 1000) + 1.0) {
            workerRef.current?.postMessage('stop');
            pausePlayback();
            setElapsedTime(0);
            playbackStartOffsetRef.current = 0;
        }
    };

    const visualLoop = () => {
        const events = recordingRef.current;
        if (!isPlayingRef.current || events.length === 0 || !workerRef.current) return;
        applyWaitGate();

        const currentTrackTimeMs = readTrackTimeMs();

        setElapsedTime(currentTrackTimeMs > 0 ? currentTrackTimeMs : 0);

        // 1. Compute active notes at current time
        const activeNotesMap = computeActiveEvents(events, currentTrackTimeMs);
        
        // 2. Assign fingering
        const { activeKeys, activeNotes } = assignFingering(activeNotesMap, keyAssignmentsRef.current);

        // 3. Detect temp transpose
        let modT = isPracticeModeRef.current ? 0 : detectTempTranspose(activeKeys);

        // 4. Update playback visuals (only if changed)
        let changed = false;
        if (activeKeys.size !== playbackKeysRef.current.size || activeNotes.size !== playbackNotesRef.current.size) changed = true;
        else {
            for(const k of activeKeys) if (!playbackKeysRef.current.has(k)) { changed = true; break; }
            if (!changed) {
                for(const n of activeNotes) if (!playbackNotesRef.current.has(n)) { changed = true; break; }
            }
        }

        if (changed) {
            playbackKeysRef.current = activeKeys;
            playbackNotesRef.current = activeNotes;
            setPlaybackKeys(activeKeys);
            setPlaybackNotes(activeNotes);
        }

        // 5. Practice guide: keys fill in as their notes approach
        if (isPracticeModeRef.current) {
            const waitActive = isWaitActive();
            const gate = waitActive ? gateRef.current : null;
            const waitingGate = isWaitingRef.current ? gate : null;
            const { keys, notes, instruction } = buildPracticeGuide([
                ...nowEntries([...activeNotesMap.values()], events, waitingGate, waitActive),
                ...(waitActive ? holdingEntries([...activeNotesMap.values()], gate, keyAssignmentsRef.current) : []),
                ...upcomingEntries(events, currentTrackTimeMs, GUIDE_LOOKAHEAD_MS * playbackSpeedRef.current, gate, isWaitingRef.current),
            ], keyAssignmentsRef.current, waitActive);
            updateGuide(keys, notes, instruction);
            modT = detectTempTranspose(new Set([...keys].filter(([, level]) => level >= 1).map(([code]) => code)));
        } else {
            updateGuide(new Map(), new Map());
        }
        if (modT !== playbackTempTransposeRef.current) {
            setPlaybackTempTranspose(modT);
            playbackTempTransposeRef.current = modT;
        }

        // 6. Emit stave trigger notes
        const { triggerNotes: newTriggers, newIndex } = emitTriggerNotes(
            events, lastStaveIndexRef.current, currentTrackTimeMs, isPracticeModeRef.current,
        );
        lastStaveIndexRef.current = newIndex;
        
        if (newTriggers.length > 0) {
            setTriggerNotes(prev => [...prev, ...newTriggers]);
        }

        if (workerRef.current) animFrameRef.current = requestAnimationFrame(visualLoop);
    };

    return {
        isPlayingBack,
        togglePlayback,
        pausePlayback,
        seekPlayback,
        changePlaybackSpeedAnchor,
        waitingRemaining,
        registerUserNote,
        skipWaitingNotes,
    };
}
