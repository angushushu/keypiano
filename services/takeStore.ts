import { RecordedEvent } from '../types';
import { INSTRUMENTS, InstrumentID } from './audioEngine';

// Recordings and imported MIDI files are kept in IndexedDB so a refresh, a
// closed tab or a new take never throws away what the player just played.

export type TakeKind = 'recording' | 'import';

export interface TakeSummary {
    id: string;
    kind: TakeKind;
    /** File name for imports; recordings are named from `createdAt` at display time. */
    name?: string;
    createdAt: number;
    durationMs: number;
    noteCount: number;
}

export interface Take extends TakeSummary {
    events: RecordedEvent[];
}

export const MAX_TAKES = 20;

const DB_NAME = 'keypiano';
const DB_VERSION = 1;
const STORE = 'takes';

// ─── Pure helpers ───────────────────────────────────────────────

export const summarizeEvents = (events: RecordedEvent[]) => ({
    durationMs: events.length > 0 ? Math.max(...events.map(evt => evt.time)) : 0,
    noteCount: events.filter(evt => evt.type === 'on').length,
});

/**
 * Appends a note-off at `endTimeMs` for every note still held, so a snapshot
 * taken mid-recording (or a take cut short by a closed tab) never replays a
 * note that rings forever.
 */
export function closeOpenNotes(events: RecordedEvent[], endTimeMs: number): RecordedEvent[] {
    const open = new Map<string, RecordedEvent[]>();
    for (const evt of events) {
        const key = evt.noteId ?? evt.code ?? `${evt.note}_${evt.transpose}`;
        const queue = open.get(key) ?? [];
        if (evt.type === 'on') queue.push(evt);
        else queue.shift();
        if (queue.length > 0) open.set(key, queue);
        else open.delete(key);
    }

    const closing: RecordedEvent[] = [];
    for (const queue of open.values()) {
        for (const evt of queue) {
            const { velocity: _velocity, ...rest } = evt;
            closing.push({ ...rest, type: 'off', time: Math.max(evt.time, endTimeMs) });
        }
    }
    return closing.length > 0 ? [...events, ...closing] : events;
}

/** Ids of the takes that fall outside the newest `limit`, oldest last. */
export function selectTakesToPrune(takes: Pick<TakeSummary, 'id' | 'createdAt'>[], limit = MAX_TAKES): string[] {
    return [...takes]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(limit)
        .map(take => take.id);
}

const isInstrumentID = (value: unknown): value is InstrumentID => (
    typeof value === 'string' && INSTRUMENTS.some(inst => inst.id === value)
);

/**
 * Stored data is external input: it may come from an older build or have been
 * edited by hand. Keep only well-formed events, in time order.
 */
export function sanitizeEvents(value: unknown): RecordedEvent[] {
    if (!Array.isArray(value)) return [];
    const events: RecordedEvent[] = [];
    for (const raw of value) {
        if (!raw || typeof raw !== 'object') continue;
        const evt = raw as Record<string, unknown>;
        if (typeof evt.time !== 'number' || !Number.isFinite(evt.time) || evt.time < 0) continue;
        if (evt.type !== 'on' && evt.type !== 'off') continue;
        if (typeof evt.note !== 'string' || !/^[A-G][#b]?-?\d+$/.test(evt.note)) continue;
        events.push({
            time: evt.time,
            type: evt.type,
            note: evt.note,
            transpose: typeof evt.transpose === 'number' && Number.isFinite(evt.transpose) ? evt.transpose : 0,
            instrumentId: isInstrumentID(evt.instrumentId) ? evt.instrumentId : 'salamander',
            ...(typeof evt.noteId === 'string' ? { noteId: evt.noteId } : {}),
            ...(typeof evt.code === 'string' ? { code: evt.code } : {}),
            ...(typeof evt.velocity === 'number' ? { velocity: Math.max(0, Math.min(127, evt.velocity)) } : {}),
            ...(typeof evt.channel === 'number' ? { channel: evt.channel } : {}),
            ...(typeof evt.trackName === 'string' ? { trackName: evt.trackName } : {}),
            ...(typeof evt.program === 'number' ? { program: evt.program } : {}),
        });
    }
    return events.sort((a, b) => a.time - b.time);
}

const toSummary = ({ id, kind, name, createdAt, durationMs, noteCount }: Take): TakeSummary => (
    { id, kind, ...(name ? { name } : {}), createdAt, durationMs, noteCount }
);

export const createTakeId = () => (
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
);

// ─── IndexedDB repository ───────────────────────────────────────

const requestToPromise = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});

const transactionDone = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
});

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = () => {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB is not available'));
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(STORE)) {
                request.result.createObjectStore(STORE, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab'));
    }).catch(error => {
        // Allow a later call to retry, e.g. after the blocking tab closes.
        dbPromise = null;
        throw error;
    });
    return dbPromise;
};

const readAll = async (): Promise<Take[]> => {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const takes = await requestToPromise(tx.objectStore(STORE).getAll() as IDBRequest<Take[]>);
    return takes.filter(take => take && typeof take.id === 'string' && typeof take.createdAt === 'number');
};

export const takeStore = {
    /** Newest first. */
    async list(): Promise<TakeSummary[]> {
        const takes = await readAll();
        return takes.sort((a, b) => b.createdAt - a.createdAt).map(toSummary);
    },

    async get(id: string): Promise<Take | null> {
        const db = await openDb();
        const tx = db.transaction(STORE, 'readonly');
        const take = await requestToPromise(tx.objectStore(STORE).get(id) as IDBRequest<Take | undefined>);
        if (!take) return null;
        return { ...take, events: sanitizeEvents(take.events) };
    },

    /** Inserts or replaces a take, then drops the oldest beyond MAX_TAKES. */
    async put(take: Take): Promise<void> {
        const db = await openDb();
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        store.put(take);
        const existing = await requestToPromise(store.getAll() as IDBRequest<Take[]>);
        const summaries = existing.map(entry => ({ id: entry.id, createdAt: entry.createdAt }));
        selectTakesToPrune(summaries).forEach(id => store.delete(id));
        await transactionDone(tx);
    },

    async remove(id: string): Promise<void> {
        const db = await openDb();
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(id);
        await transactionDone(tx);
    },
};
