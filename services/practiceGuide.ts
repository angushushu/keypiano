import { RecordedEvent } from '../types';
import { WaitGate, eventPitch } from './waitGate';

// Practice-mode key guide: a key fills with one colour as its note approaches
// and is fully lit when it should be pressed now.

/** How far ahead (in real time) upcoming notes start to fade in. */
export const GUIDE_LOOKAHEAD_MS = 1500;
/**
 * Brightness steps. Approaching notes use 1..STEPS-1 of STEPS; a full step is
 * reserved for "press now". Quantising keeps React updates to a few per note
 * instead of one per animation frame.
 */
export const GUIDE_STEPS = 5;
export const GUIDE_NOW = 1;

/**
 * Opacity of the guide fill for an approaching note. Starts clearly visible
 * so the faintest step still reads on light keys; "now" uses the key's full
 * playback style instead of the fill.
 */
export const guideFillOpacity = (level: number) => (
    level > 0 && level < GUIDE_NOW ? 0.15 + level * 0.7 : 0
);

export interface GuideEntry {
    evt: RecordedEvent;
    level: number;
}

/**
 * Level for a note-on `untilMs` of track time away, or 0 when it is outside
 * the lookahead. Never returns GUIDE_NOW: only notes due now are fully lit.
 */
export function approachLevel(untilMs: number, lookaheadMs: number): number {
    if (untilMs <= 0 || untilMs > lookaheadMs) return 0;
    const progress = 1 - untilMs / lookaheadMs;
    const step = Math.max(1, Math.ceil(progress * (GUIDE_STEPS - 1)));
    return step / GUIDE_STEPS;
}

const isInGate = (evt: RecordedEvent, gate: WaitGate) => (
    evt.type === 'on' && evt.time >= gate.timeMs && evt.time <= gate.endTimeMs
);

/**
 * Notes to light fully. In wait mode, only the held chord's notes not yet
 * pressed (notes carried over from earlier chords need no new press);
 * otherwise every note sounding now, which the player should be holding.
 */
export function nowEntries(
    sounding: RecordedEvent[],
    events: RecordedEvent[],
    waitingGate: WaitGate | null,
    isWaitMode: boolean,
): GuideEntry[] {
    if (isWaitMode) {
        if (!waitingGate) return [];
        return events
            .filter(evt => isInGate(evt, waitingGate) && !waitingGate.hit.includes(eventPitch(evt)))
            .map(evt => ({ evt, level: GUIDE_NOW }));
    }
    return sounding.map(evt => ({ evt, level: GUIDE_NOW }));
}

/**
 * Note-ons after `nowMs` within the lookahead, faded by distance. Chord notes
 * the player already pressed early for the upcoming gate are left out.
 */
export function upcomingEntries(
    events: RecordedEvent[],
    nowMs: number,
    lookaheadTrackMs: number,
    gate: WaitGate | null,
    isWaiting: boolean,
): GuideEntry[] {
    const entries: GuideEntry[] = [];
    for (const evt of events) {
        if (evt.time > nowMs + lookaheadTrackMs) break;
        if (evt.type !== 'on' || evt.time <= nowMs) continue;
        if (gate && isInGate(evt, gate) && (isWaiting || gate.hit.includes(eventPitch(evt)))) continue;
        const level = approachLevel(evt.time - nowMs, lookaheadTrackMs);
        if (level > 0) entries.push({ evt, level });
    }
    return entries;
}

/** Adds `level` for `id`, keeping the brightest when several notes share a key. */
export const raiseLevel = (levels: Map<string, number>, id: string, level: number) => {
    if (level > (levels.get(id) ?? 0)) levels.set(id, level);
};

export const sameLevels = (a: Map<string, number>, b: Map<string, number>) => (
    a.size === b.size && [...a].every(([id, level]) => b.get(id) === level)
);
