import { useCallback, useEffect, useRef, useState } from 'react';
import { RecordedEvent } from '../types';
import {
    Take, TakeSummary, closeOpenNotes, createTakeId, summarizeEvents, takeStore,
} from '../services/takeStore';

// How often an in-progress recording is snapshotted, bounding what a crash or
// a closed tab can lose.
const AUTOSAVE_INTERVAL_MS = 5000;

interface UseTakeHistoryProps {
    isRecording: boolean;
    recordingStartTime: number;
    recordingRef: React.MutableRefObject<RecordedEvent[]>;
    /** True while nothing is loaded yet, so the last take may be restored. */
    hasEvents: boolean;
    loadEvents: (events: RecordedEvent[]) => void;
}

export function useTakeHistory({
    isRecording,
    recordingStartTime,
    recordingRef,
    hasEvents,
    loadEvents,
}: UseTakeHistoryProps) {
    const [takes, setTakes] = useState<TakeSummary[]>([]);
    const [currentTakeId, setCurrentTakeId] = useState<string | null>(null);
    // Null until the first read settles; false when the browser refuses
    // storage (private mode, disabled site data), so callers can warn instead.
    const [isStorageAvailable, setIsStorageAvailable] = useState<boolean | null>(null);

    const recordingTakeRef = useRef<{ id: string; createdAt: number } | null>(null);
    const hasEventsRef = useRef(hasEvents);
    const isRecordingRef = useRef(isRecording);
    const loadEventsRef = useRef(loadEvents);
    useEffect(() => { hasEventsRef.current = hasEvents; }, [hasEvents]);
    useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
    useEffect(() => { loadEventsRef.current = loadEvents; }, [loadEvents]);

    const refresh = useCallback(async () => {
        try {
            setTakes(await takeStore.list());
            setIsStorageAvailable(true);
        } catch (error) {
            console.warn('Recording history is unavailable:', error);
            setIsStorageAvailable(false);
        }
    }, []);

    const save = useCallback(async (take: Take) => {
        try {
            await takeStore.put(take);
            await refresh();
            return true;
        } catch (error) {
            console.warn('Could not save the take:', error);
            setIsStorageAvailable(false);
            return false;
        }
    }, [refresh]);

    const snapshotRecording = useCallback(() => {
        const current = recordingTakeRef.current;
        if (!current || recordingRef.current.length === 0) return Promise.resolve(false);
        const endTime = Date.now() - current.createdAt;
        const events = closeOpenNotes([...recordingRef.current], endTime);
        return save({ id: current.id, kind: 'recording', createdAt: current.createdAt, ...summarizeEvents(events), events });
    }, [recordingRef, save]);

    // Restore the most recent take once, so a refresh lands where the player left off.
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const list = await takeStore.list();
                if (cancelled) return;
                setTakes(list);
                setIsStorageAvailable(true);
                const latest = list[0];
                // Never replace something the player loaded or started meanwhile.
                const isBusy = () => hasEventsRef.current || isRecordingRef.current;
                if (!latest || isBusy()) return;
                const take = await takeStore.get(latest.id);
                if (cancelled || !take || take.events.length === 0 || isBusy()) return;
                loadEventsRef.current(take.events);
                setCurrentTakeId(take.id);
            } catch (error) {
                if (cancelled) return;
                console.warn('Recording history is unavailable:', error);
                setIsStorageAvailable(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Start a take when recording begins, snapshot it while it runs, and save
    // the final version when it stops -- whichever control stopped it.
    useEffect(() => {
        if (!isRecording) {
            if (recordingTakeRef.current) {
                const finished = recordingTakeRef.current;
                void snapshotRecording().then(saved => {
                    if (saved) setCurrentTakeId(finished.id);
                });
                recordingTakeRef.current = null;
            }
            return;
        }
        recordingTakeRef.current ??= { id: createTakeId(), createdAt: recordingStartTime };
        const interval = window.setInterval(() => { void snapshotRecording(); }, AUTOSAVE_INTERVAL_MS);
        return () => window.clearInterval(interval);
    }, [isRecording, recordingStartTime, snapshotRecording]);

    const saveImport = useCallback(async (events: RecordedEvent[], name: string) => {
        const id = createTakeId();
        const saved = await save({ id, kind: 'import', name, createdAt: Date.now(), ...summarizeEvents(events), events });
        setCurrentTakeId(saved ? id : null);
    }, [save]);

    const openTake = useCallback(async (id: string) => {
        try {
            const take = await takeStore.get(id);
            if (!take || take.events.length === 0) return false;
            loadEventsRef.current(take.events);
            setCurrentTakeId(id);
            return true;
        } catch (error) {
            console.warn('Could not open the take:', error);
            return false;
        }
    }, []);

    const deleteTake = useCallback(async (id: string) => {
        try {
            await takeStore.remove(id);
            setCurrentTakeId(current => (current === id ? null : current));
            await refresh();
        } catch (error) {
            console.warn('Could not delete the take:', error);
        }
    }, [refresh]);

    return {
        takes,
        currentTakeId,
        isStorageAvailable,
        saveImport,
        openTake,
        deleteTake,
    };
}
