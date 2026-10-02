import { RecordedEvent } from '../types';
import { WaitGate, eventPitch } from './waitGate';
import { CHORD_WINDOW_MS } from './waitGate';
import { getTransposedNote } from '../constants';
import type { Finger, Hand, KeyAssignment } from './autoFingering';

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
    holding?: boolean;
}

export interface FingerHint { hand: Hand; finger: Finger; note?: string; holding?: boolean }
export interface GuideInstruction {
    fingers: Map<string, FingerHint>;
    releaseCodes: string[];
    rolled: boolean;
}
export const EMPTY_INSTRUCTION: GuideInstruction = { fingers: new Map(), releaseCodes: [], rolled: false };

/** In a rolled chord, only the next unplayed step advances the teaching gate. */
export function nextPracticePitches(events: RecordedEvent[], gate: WaitGate, assignments: Map<RecordedEvent, KeyAssignment>): number[] {
    const remaining = events.filter(evt => isInGate(evt, gate) && !gate.hit.includes(eventPitch(evt)));
    const first = Math.min(...remaining.map(evt => assignments.get(evt)?.step ?? 0));
    return [...new Set(remaining.filter(evt => first === 0 || assignments.get(evt)?.step === first).map(eventPitch))];
}

/** Sounding notes already accepted by wait mode still need duration cues. */
export function holdingEntries(sounding: RecordedEvent[], gate: WaitGate | null, assignments: Map<RecordedEvent, KeyAssignment> = new Map()): GuideEntry[] {
    const accepted = (evt: RecordedEvent) => !gate || evt.time < gate.timeMs || (isInGate(evt, gate) && gate.hit.includes(eventPitch(evt)));
    const releases = [...assignments].filter(([evt, assignment]) => assignment.releaseBefore?.length && accepted(evt));
    return sounding.filter(evt => accepted(evt) && !releases.some(([release, assignment]) => {
        const held = assignments.get(evt);
        const earlier = evt.time < release.time || (evt.time === release.time && (held?.step ?? 0) < (assignment.step ?? 0));
        return earlier && held && assignment.releaseBefore?.includes(held.code);
    }))
        .map(evt => ({ evt, level: 0.6, holding: true }));
}

/** The nearest/brightest instruction wins when a key is used again later. */
export function buildPracticeGuide(entries: GuideEntry[], assignments: Map<RecordedEvent, KeyAssignment>, sequential: boolean) {
    const keys = new Map<string, number>();
    const notes = new Map<string, number>();
    const instruction: GuideInstruction = { fingers: new Map(), releaseCodes: [], rolled: false };
    const now = entries.filter(entry => entry.level >= GUIDE_NOW);
    const latest = Math.max(...now.map(entry => entry.evt.time), -Infinity);
    const steps = now.map(({ evt }) => assignments.get(evt)?.step ?? 0).filter(step => step > 0);
    const firstStep = sequential && steps.length ? Math.min(...steps) : 0;
    const selected = entries.map(entry => {
        const step = assignments.get(entry.evt)?.step ?? 0;
        return firstStep && entry.level >= GUIDE_NOW && step > firstStep ? { ...entry, level: 0.4 } : entry;
    }).sort((a, b) => (b.level >= GUIDE_NOW ? 2 : b.holding ? 1 : 0) - (a.level >= GUIDE_NOW ? 2 : a.holding ? 1 : 0)
        || b.level - a.level || a.evt.time - b.evt.time
        || (assignments.get(a.evt)?.step ?? 0) - (assignments.get(b.evt)?.step ?? 0));
    for (const { evt, level } of selected) {
        if (level < GUIDE_NOW) continue;
        const assignment = assignments.get(evt);
        instruction.releaseCodes.push(...assignment?.releaseBefore ?? []);
        instruction.rolled ||= (assignment?.step ?? 0) > 0;
    }
    instruction.releaseCodes = [...new Set(instruction.releaseCodes)];
    for (const { evt, level, holding } of selected) {
        const assignment = assignments.get(evt);
        if (evt.time < latest && assignment && instruction.releaseCodes.includes(assignment.code)) continue;
        const note = getTransposedNote(evt.note, evt.transpose);
        raiseLevel(notes, note, level);
        const code = evt.code ?? assignment?.code;
        if (!code) continue;
        raiseLevel(keys, code, level);
        if (assignment?.finger && !instruction.fingers.has(code)) instruction.fingers.set(code, { hand: assignment.hand, finger: assignment.finger, note, holding });
        // A held note keeps its onset pitch after the modifier is released.
        // Only new attacks need a modifier cue, not every sustained note.
        if (assignment?.modifier && !holding && (level < GUIDE_NOW || evt.time >= latest - CHORD_WINDOW_MS)) {
            const control = assignment.modifier === 1 ? 'ShiftLeft' : 'ControlLeft';
            raiseLevel(keys, control, level);
            if (!instruction.fingers.has(control)) instruction.fingers.set(control, { hand: 'left', finger: 5 });
        }
    }
    return { keys, notes, instruction };
}

export const sameInstruction = (a: GuideInstruction, b: GuideInstruction) => (
    a.rolled === b.rolled && a.releaseCodes.join('|') === b.releaseCodes.join('|')
    && a.fingers.size === b.fingers.size && [...a.fingers].every(([code, hint]) => {
        const other = b.fingers.get(code);
        return other?.hand === hint.hand && other.finger === hint.finger && other.note === hint.note && other.holding === hint.holding;
    })
);

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
