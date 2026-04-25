import { useState, useEffect, useRef } from 'react';
import { audioEngine } from '../services/audioEngine';
import { RecordedEvent } from '../types';
import { getTransposedNote } from '../constants';
import { NoteType } from '../components/StaveVisualizer';

interface UseAudioSchedulerProps {
    recordingRef: React.MutableRefObject<RecordedEvent[]>;
    isPracticeMode: boolean;
    playbackSpeed: number;
    leftHandMap: Map<string, string>;
    rightHandMap: Map<string, string>;
    noteToKeyMap: Map<string, string>;
    setPlaybackKeys: (keys: Set<string>) => void;
    setPlaybackNotes: (notes: Set<string>) => void;
    setTriggerNotes: (updater: (prev: any[]) => any[]) => void;
    setPlaybackTempTranspose: (transpose: number) => void;
    setUpcomingKeys: (keys: Set<string>) => void;
    setUpcomingNotes: (notes: Set<string>) => void;
    setElapsedTime: (time: number) => void;
    elapsedTime: number;
}

// ─── Pure helper functions ──────────────────────────────────────

function computeActiveEvents(events: RecordedEvent[], upToMs: number): Map<string, RecordedEvent> {
    const map = new Map<string, RecordedEvent>();
    for (const evt of events) {
        if (evt.time > upToMs) break;
        const key = evt.code || `${evt.note}_${evt.transpose}`;
        if (evt.type === 'on') map.set(key, evt);
        else map.delete(key);
    }
    return map;
}

function assignFingering(
    events: Map<string, RecordedEvent>,
    leftHandMap: Map<string, string>,
    rightHandMap: Map<string, string>,
    noteToKeyMap: Map<string, string>,
): { activeKeys: Set<string>; activeNotes: Set<string> } {
    const activeK = new Set<string>();
    const activeN = new Set<string>();
    const notesArray = Array.from(events.values());

    const hasBlackKeys = notesArray.some(evt => evt.note.includes('#') || evt.note.includes('b'));
    let rightHandCount = 0;

    notesArray.sort((a, b) => a.note.localeCompare(b.note));

    for (const evt of notesArray) {
        const visualNote = getTransposedNote(evt.note, evt.transpose);
        activeN.add(visualNote);

        if (evt.code) {
            activeK.add(evt.code);
            continue;
        }

        const isBlackKey = evt.note.includes('#') || evt.note.includes('b');
        let assignedCode: string | undefined;

        if (isBlackKey) {
            const baseNote = getTransposedNote(evt.note, -1);
            const baseCode = leftHandMap.get(baseNote);
            if (baseCode) {
                assignedCode = baseCode;
                activeK.add('ShiftLeft');
            } else {
                assignedCode = noteToKeyMap.get(evt.note);
            }
        } else {
            const rightCode = rightHandMap.get(evt.note);
            if (hasBlackKeys) {
                if (rightCode && rightHandCount < 5) { assignedCode = rightCode; rightHandCount++; }
                else assignedCode = leftHandMap.get(evt.note);
            } else {
                if (rightCode && rightHandCount < 5) { assignedCode = rightCode; rightHandCount++; }
                else assignedCode = leftHandMap.get(evt.note) || noteToKeyMap.get(evt.note);
            }
        }
        if (assignedCode) activeK.add(assignedCode);
    }

    return { activeKeys: activeK, activeNotes: activeN };
}

function detectTempTranspose(activeKeys: Set<string>): number {
    if (activeKeys.has('ShiftLeft')) return 1;
    if (activeKeys.has('ControlLeft')) return -1;
    return 0;
}

function emitTriggerNotes(
    events: RecordedEvent[],
    fromIndex: number,
    upToMs: number,
    isPracticeMode: boolean,
): { triggerNotes: { note: string; time: number; type: NoteType }[]; newIndex: number } {
    const result: { note: string; time: number; type: NoteType }[] = [];
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
    playbackSpeed,
    leftHandMap,
    rightHandMap,
    noteToKeyMap,
    setPlaybackKeys,
    setPlaybackNotes,
    setTriggerNotes,
    setPlaybackTempTranspose,
    setUpcomingKeys,
    setUpcomingNotes,
    setElapsedTime,
    elapsedTime
}: UseAudioSchedulerProps) {
    const [isPlayingBack, setIsPlayingBack] = useState(false);
    
    // Playback Refs needed for precise scheduling
    const animFrameRef = useRef<number | null>(null);
    const audioContextStartTimeRef = useRef<number>(0);
    const audioCursorRef = useRef<number>(0);
    const playbackStartOffsetRef = useRef<number>(0); 
    const playbackSpeedRef = useRef<number>(playbackSpeed); 
    const isPracticeModeRef = useRef<boolean>(isPracticeMode);
    
    // Extracted state for fingering visuals
    const playbackKeysRef = useRef<Set<string>>(new Set());
    const playbackNotesRef = useRef<Set<string>>(new Set());
    const upcomingKeysRef = useRef<Set<string>>(new Set());
    const upcomingNotesRef = useRef<Set<string>>(new Set());
    const playbackTempTransposeRef = useRef(0);
    const lastStaveIndexRef = useRef<number>(0);
    const workerRef = useRef<Worker | null>(null);

    useEffect(() => { playbackSpeedRef.current = playbackSpeed; }, [playbackSpeed]);
    useEffect(() => { isPracticeModeRef.current = isPracticeMode; }, [isPracticeMode]);

    const pausePlayback = () => {
        setIsPlayingBack(false);
        audioEngine.stopAllNotes();
        workerRef.current?.postMessage('stop');
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        setPlaybackKeys(new Set());
        setPlaybackNotes(new Set());
        setUpcomingKeys(new Set());
        setUpcomingNotes(new Set());
        playbackKeysRef.current = new Set();
        playbackNotesRef.current = new Set();
        upcomingKeysRef.current = new Set();
        upcomingNotesRef.current = new Set();
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
        }
    
        audioContextStartTimeRef.current = audioEngine.currentTime;
        setIsPlayingBack(true);
        setPlaybackKeys(new Set());
        setPlaybackNotes(new Set());
        setUpcomingKeys(new Set());
        setUpcomingNotes(new Set());
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
        const workerCode = `
            let intervalId;
            self.onmessage = function(e) {
                if (e.data === 'start') {
                    if (intervalId) clearInterval(intervalId);
                    intervalId = setInterval(() => { self.postMessage('tick'); }, 25);
                } else if (e.data === 'stop') {
                    if (intervalId) clearInterval(intervalId);
                }
            };
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        workerRef.current = new Worker(blobUrl);
        workerRef.current.onmessage = (e) => {
            if (e.data === 'tick') runAudioScheduler();
        };
        return () => {
            workerRef.current?.terminate();
            URL.revokeObjectURL(blobUrl);
        };
    }, []);

    const runAudioScheduler = () => {
        if (recordingRef.current.length === 0) return;

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
            } else {
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

        const currentCtxTime = audioEngine.currentTime;
        const speed = playbackSpeedRef.current;
        const currentTrackTimeMs = ((currentCtxTime - audioContextStartTimeRef.current) * speed * 1000) + playbackStartOffsetRef.current;
        
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

        // 5. Upcoming notes (practice mode)
        if (isPracticeModeRef.current) {
            const LOOKAHEAD_MS = 1500;
            const upcomingMap = new Map<string, RecordedEvent>();
            for (const evt of events) {
                if (evt.time > currentTrackTimeMs + LOOKAHEAD_MS) break;
                if (evt.time >= currentTrackTimeMs) {
                    const key = evt.code || `${evt.note}_${evt.transpose}`;
                    if (evt.type === 'on') upcomingMap.set(key, evt);
                }
            }
            
            const { activeKeys: upK, activeNotes: upN } = assignFingering(
                upcomingMap, leftHandMap, rightHandMap, noteToKeyMap,
            );

            let upChanged = false;
            if (upK.size !== upcomingKeysRef.current.size || upN.size !== upcomingNotesRef.current.size) upChanged = true;
            else {
                for(const k of upK) if (!upcomingKeysRef.current.has(k)) { upChanged = true; break; }
                if (!upChanged) {
                    for(const n of upN) if (!upcomingNotesRef.current.has(n)) { upChanged = true; break; }
                }
            }
            
            if (upChanged) {
                upcomingKeysRef.current = upK;
                upcomingNotesRef.current = upN;
                setUpcomingKeys(upK);
                setUpcomingNotes(upN);
            }
        } else {
            if (upcomingKeysRef.current.size > 0) {
               upcomingKeysRef.current = new Set();
               upcomingNotesRef.current = new Set();
               setUpcomingKeys(new Set());
               setUpcomingNotes(new Set());
            }
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
        changePlaybackSpeedAnchor
    };
}
