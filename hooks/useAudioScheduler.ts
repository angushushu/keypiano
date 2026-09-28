import { useState, useEffect, useRef, useCallback } from 'react';
import { audioEngine } from '../services/audioEngine';
import { RecordedEvent, TriggerNote } from '../types';
import { getTransposedNote, noteToMidi } from '../constants';
import {
    WaitGate, findNextGate, isGateSatisfied, isWithinGateWindow, remainingNotes, withHit,
} from '../services/waitGate';
import {
    GUIDE_LOOKAHEAD_MS, GUIDE_NOW, GuideEntry, nowEntries, raiseLevel, sameLevels, upcomingEntries,
} from '../services/practiceGuide';
import type { TickWorkerMessage } from '../workers/tickWorker';

interface UseAudioSchedulerProps {
    recordingRef: React.MutableRefObject<RecordedEvent[]>;
    isPracticeMode: boolean;
    /** In practice mode, halt at each note until the player presses it. */
    isWaitMode: boolean;
    playbackSpeed: number;
    leftHandMap: Map<string, string>;
    rightHandMap: Map<string, string>;
    noteToKeyMap: Map<string, string>;
    setPlaybackKeys: (keys: Set<string>) => void;
    setPlaybackNotes: (notes: Set<string>) => void;
    setTriggerNotes: (updater: (prev: TriggerNote[]) => TriggerNote[]) => void;
    setPlaybackTempTranspose: (transpose: number) => void;
    /** Practice guide brightness per key code / note, 1 meaning "press now". */
    setGuideKeys: (levels: Map<string, number>) => void;
    setGuideNotes: (levels: Map<string, number>) => void;
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
        const baseKey = evt.code || `${evt.note}_${evt.transpose}`;
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

export interface KeyAssignment {
    evt: RecordedEvent;
    /** Sounding note, transposition applied. */
    note: string;
    code?: string;
    /** The key is played with Shift held (a black key reached from its white neighbour). */
    withShift: boolean;
}

export function assignKeys(
    events: RecordedEvent[],
    leftHandMap: Map<string, string>,
    rightHandMap: Map<string, string>,
    noteToKeyMap: Map<string, string>,
): KeyAssignment[] {
    const sorted = [...events].sort((a, b) => a.note.localeCompare(b.note));
    const hasBlackKeys = sorted.some(evt => evt.note.includes('#') || evt.note.includes('b'));
    let rightHandCount = 0;

    return sorted.map(evt => {
        const note = getTransposedNote(evt.note, evt.transpose);
        if (evt.code) return { evt, note, code: evt.code, withShift: false };

        if (evt.note.includes('#') || evt.note.includes('b')) {
            const baseCode = leftHandMap.get(getTransposedNote(evt.note, -1));
            return baseCode
                ? { evt, note, code: baseCode, withShift: true }
                : { evt, note, code: noteToKeyMap.get(evt.note), withShift: false };
        }

        const rightCode = rightHandMap.get(evt.note);
        if (rightCode && rightHandCount < 5) {
            rightHandCount++;
            return { evt, note, code: rightCode, withShift: false };
        }
        const code = hasBlackKeys
            ? leftHandMap.get(evt.note)
            : leftHandMap.get(evt.note) || noteToKeyMap.get(evt.note);
        return { evt, note, code, withShift: false };
    });
}

export function assignFingering(
    events: Map<string, RecordedEvent>,
    leftHandMap: Map<string, string>,
    rightHandMap: Map<string, string>,
    noteToKeyMap: Map<string, string>,
): { activeKeys: Set<string>; activeNotes: Set<string> } {
    const activeKeys = new Set<string>();
    const activeNotes = new Set<string>();
    for (const assignment of assignKeys([...events.values()], leftHandMap, rightHandMap, noteToKeyMap)) {
        activeNotes.add(assignment.note);
        if (assignment.withShift) activeKeys.add('ShiftLeft');
        if (assignment.code) activeKeys.add(assignment.code);
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
    leftHandMap,
    rightHandMap,
    noteToKeyMap,
    setPlaybackKeys,
    setPlaybackNotes,
    setTriggerNotes,
    setPlaybackTempTranspose,
    setGuideKeys,
    setGuideNotes,
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
    const playbackTempTransposeRef = useRef(0);
    const lastStaveIndexRef = useRef<number>(0);
    const workerRef = useRef<Worker | null>(null);

    useEffect(() => { playbackSpeedRef.current = playbackSpeed; }, [playbackSpeed]);
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
        const next = withHit(gate, noteToMidi(note));
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

    const updateGuide = (keys: Map<string, number>, notes: Map<string, number>) => {
        if (!sameLevels(keys, guideKeysRef.current)) {
            guideKeysRef.current = keys;
            setGuideKeys(keys);
        }
        if (!sameLevels(notes, guideNotesRef.current)) {
            guideNotesRef.current = notes;
            setGuideNotes(notes);
        }
    };

    // Notes due now and approaching notes are fingered separately, as before,
    // so a crowded lookahead cannot push a current note onto the other hand.
    const buildGuide = (entries: GuideEntry[]) => {
        const keys = new Map<string, number>();
        const notes = new Map<string, number>();
        const groups = [entries.filter(entry => entry.level === GUIDE_NOW), entries.filter(entry => entry.level < GUIDE_NOW)];
        for (const group of groups) {
            const levelOf = new Map(group.map(entry => [entry.evt, entry.level]));
            for (const assignment of assignKeys(group.map(entry => entry.evt), leftHandMap, rightHandMap, noteToKeyMap)) {
                const level = levelOf.get(assignment.evt) ?? 0;
                raiseLevel(notes, assignment.note, level);
                if (assignment.code) raiseLevel(keys, assignment.code, level);
                if (assignment.withShift) raiseLevel(keys, 'ShiftLeft', level);
            }
        }
        return { keys, notes };
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

    const startPlayback = () => {
        if (recordingRef.current.length === 0) return;
        audioEngine.resumeIfSuspended();
    
        const lastEventTime = recordingRef.current[recordingRef.current.length - 1].time;
    
        if (elapsedTime >= lastEventTime) {
            setElapsedTime(0);
            playbackStartOffsetRef.current = 0;
            audioCursorRef.current = 0;
            lastStaveIndexRef.current = 0;
        } else {
            playbackStartOffsetRef.current = elapsedTime;
            let idx = 0;
            while(idx < recordingRef.current.length && recordingRef.current[idx].time < elapsedTime) idx++;
            audioCursorRef.current = idx;
            lastStaveIndexRef.current = idx;
            if (!isPracticeModeRef.current) {
                computeActiveEvents(recordingRef.current, elapsedTime).forEach((evt) => {
                    audioEngine.playNote(evt.note, evt.transpose, evt.velocity);
                });
            }
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
        if (recordingRef.current.length === 0) return;
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
                         audioEngine.playNote(evt.note, evt.transpose, evt.velocity, absolutePlayTime);
                     }
                 }
            } else if (!isPracticeModeRef.current) {
                 // Practice mode never starts playback notes, and stopping one
                 // here would cut off the player's own note of the same pitch.
                 audioEngine.stopNote(evt.note, evt.transpose, absolutePlayTime);
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
        if (events.length === 0 || !workerRef.current) return;
        applyWaitGate();

        const currentTrackTimeMs = readTrackTimeMs();

        setElapsedTime(currentTrackTimeMs > 0 ? currentTrackTimeMs : 0);

        // 1. Compute active notes at current time
        const activeNotesMap = computeActiveEvents(events, currentTrackTimeMs);
        
        // 2. Assign fingering
        const { activeKeys, activeNotes } = assignFingering(
            activeNotesMap, leftHandMap, rightHandMap, noteToKeyMap,
        );

        // 3. Detect temp transpose
        const modT = detectTempTranspose(activeKeys);
        if (modT !== playbackTempTransposeRef.current) {
            setPlaybackTempTranspose(modT);
            playbackTempTransposeRef.current = modT;
        }

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
            const { keys, notes } = buildGuide([
                ...nowEntries([...activeNotesMap.values()], events, waitingGate, waitActive),
                ...upcomingEntries(events, currentTrackTimeMs, GUIDE_LOOKAHEAD_MS * playbackSpeedRef.current, gate, isWaitingRef.current),
            ]);
            updateGuide(keys, notes);
        } else {
            updateGuide(new Map(), new Map());
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
        changePlaybackSpeedAnchor,
        waitingRemaining,
        registerUserNote,
        skipWaitingNotes,
    };
}
