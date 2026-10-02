import { getTransposedNote, noteToMidi } from '../constants';
import type { RecordedEvent } from '../types';
import { noteQueueKey } from './waitGate';

export type Hand = 'left' | 'right';
export type Finger = 1 | 2 | 3 | 4 | 5;
export type Modifier = 0 | 1 | -1;

export interface KeyAssignment {
    code: string;
    modifier: Modifier;
    hand: Hand;
    /** Thumb = 1, little finger = 5. */
    finger?: Finger;
    /** Zero for a simultaneous chord; positive steps are played in order. */
    step?: number;
    /** Held keys to release before this press when the original score cannot fit. */
    releaseBefore?: string[];
}

export interface FingeringOptions {
    useNumpad: boolean;
    /** Bounded sequence search; 1 is a greedy baseline, default 32. */
    beamWidth?: number;
}

export const DEFAULT_FINGERING_OPTIONS: FingeringOptions = { useNumpad: true };

export interface FingeringIssue {
    time: number;
    type: 'roll' | 'release' | 'unreachable';
    count: number;
}

export interface FingeringPlan {
    assignments: Map<RecordedEvent, KeyAssignment>;
    issues: FingeringIssue[];
    /** Adaptations are compared before movement cost. */
    adaptations: number;
    cost: number;
    /** Search limits were reached; this is a recommendation, not an optimality proof. */
    pruned: boolean;
}

export interface KeyPosition { row: number; x: number }
export interface KeySlot extends KeyPosition { code: string; midi: number; isImmune: boolean }

interface Note {
    id: number;
    events: RecordedEvent[];
    midi: number;
    time: number;
    end: number;
}
interface Press extends KeyAssignment {
    finger: Finger;
    slot: KeySlot;
    note: Note;
}
interface Candidate { presses: Press[]; modifier: Modifier; cost: number; rolled: boolean }
interface Held { press: Press; end: number }
interface Pose extends KeyPosition { time: number }
interface Path {
    previous: Path | null;
    presses: Press[];
    issues: FingeringIssue[];
    held: Held[];
    poses: Record<Hand, Pose>;
    voices: Map<string, { hand: Hand; time: number }>;
    modifier: Modifier;
    adaptations: number;
    cost: number;
}

// Conservative teaching defaults in physical key units, not measured human
// limits. A held modifier also occupies the left little finger and this span.
const MAX_X_SPAN = 6.5;
const MAX_ROW_SPAN = 3;
const CANDIDATE_LIMIT = 48;
const PARTIAL_LIMIT = 72;
const PHRASE_BREAK_MS = 1500;
const FINGERS: Finger[] = [1, 2, 3, 4, 5];
const MODIFIERS: Modifier[] = [0, 1, -1];
const fingerOffset = (hand: Hand, finger: Finger) => hand === 'right' ? finger - 2 : 3 - finger;
const pitch = (evt: RecordedEvent) => noteToMidi(getTransposedNote(evt.note, evt.transpose));
const source = (evt: RecordedEvent) => JSON.stringify([evt.channel, evt.trackName, evt.program, evt.instrumentId]);

/** Pair within source tracks, so one track's note-off cannot release another. */
export function noteEndTimes(events: RecordedEvent[]): Map<RecordedEvent, number> {
    const result = new Map<RecordedEvent, number>();
    const pending = new Map<string, RecordedEvent[]>();
    for (const evt of [...events].sort((a, b) => a.time - b.time || Number(a.type === 'on') - Number(b.type === 'on'))) {
        const id = noteQueueKey(evt);
        if (evt.type === 'on') {
            const queue = pending.get(id) ?? [];
            queue.push(evt);
            pending.set(id, queue);
        } else {
            const on = pending.get(id)?.shift();
            if (on) result.set(on, Math.max(on.time, evt.time));
        }
    }
    return result;
}

function notesForChord(chord: RecordedEvent[], ends: Map<RecordedEvent, number>, nextTime: number, firstId: number): Note[] {
    // Truly simultaneous unisons need one physical press. Repeated attacks
    // at different times remain separate even inside the chord window.
    const notes = new Map<string, Note>();
    for (const evt of chord) {
        const midi = pitch(evt);
        const id = `${midi}|${evt.time}`;
        const end = ends.get(evt) ?? Math.max(evt.time + 1, nextTime);
        const existing = notes.get(id);
        if (existing) {
            existing.events.push(evt);
            existing.end = Math.max(existing.end, end);
        } else {
            notes.set(id, { id: firstId + notes.size, events: [evt], midi, time: evt.time, end });
        }
    }
    return [...notes.values()].sort((a, b) => a.midi - b.midi || a.time - b.time);
}

function compatible(a: { slot: KeyPosition; code: string; hand: Hand; finger: Finger }, b: { slot: KeyPosition; code: string; hand: Hand; finger: Finger }): boolean {
    if (a.code === b.code) return false;
    if (a.hand !== b.hand) return a.hand === 'left' ? a.slot.x <= b.slot.x + 1 : b.slot.x <= a.slot.x + 1;
    if (a.finger === b.finger) return false;
    const dx = a.slot.x - b.slot.x;
    const dy = a.slot.row - b.slot.row;
    if (Math.abs(dx) > MAX_X_SPAN || Math.abs(dy) > MAX_ROW_SPAN) return false;
    const fingerSpan = 0.9 + Math.abs(a.finger - b.finger) * 1.4 + (a.finger === 1 || b.finger === 1 ? 1.1 : 0);
    if (Math.hypot(dx, dy * 0.8) > fingerSpan) return false;
    // On the same row, avoid crossing fingers. Other rows need a 2D posture.
    if (dy === 0 && Math.abs(dx) > 0.5) {
        const order = a.hand === 'right' ? a.finger - b.finger : b.finger - a.finger;
        if (dx * order < 0) return false;
    }
    return true;
}

function modifierPress(modifier: Modifier, positions: Map<string, KeyPosition>) {
    if (modifier === 0) return null;
    const code = modifier === 1 ? 'ShiftLeft' : 'ControlLeft';
    const slot = positions.get(code);
    return slot ? { code, slot, hand: 'left' as const, finger: 5 as const } : null;
}

function spellingCost(note: Note, modifier: Modifier): number {
    if (modifier === 0) return 0;
    const written = note.events[0].note;
    return (modifier === 1 && written.includes('#')) || (modifier === -1 && /^[A-G]b/.test(written)) ? 0 : 2;
}

function choicesFor(note: Note, modifier: Modifier, slots: KeySlot[], hands: Map<RecordedEvent, Hand>, options: FingeringOptions, anchors: Record<Hand, KeyPosition>, positions: Map<string, KeyPosition>): { press: Press; cost: number }[] {
    const result: { press: Press; cost: number }[] = [];
    const preferred = hands.get(note.events[0]) ?? 'right';
    const control = modifierPress(modifier, positions);
    for (const slot of slots) {
        if (slot.midi + (slot.isImmune ? 0 : modifier) !== note.midi) continue;
        // The right hand may help on the main block when continuity or a
        // modifier's reach makes it useful. Fixed-pitch right-side keys stay right.
        const allowed: Hand[] = slot.isImmune ? ['right'] : ['left', 'right'];
        for (const hand of allowed) {
            const area = options.useNumpad
                ? slot.isImmune ? 0 : 3 + (hand === 'right' ? 2 : 0)
                : (hand === preferred ? 0 : 8) + ((hand === 'left' ? [3, 4] : [1, 2]).includes(slot.row) ? 0 : 8);
            for (const finger of FINGERS) {
                const press: Press = { slot, note, code: slot.code, hand, finger, modifier: slot.isImmune ? 0 : modifier, step: 0 };
                if (control && !compatible(press, control)) continue;
                const fingerBias = Math.abs(slot.x - anchors[hand].x - fingerOffset(hand, finger)) * 0.12;
                result.push({ press, cost: area + fingerBias + spellingCost(note, press.modifier) });
            }
        }
    }
    return result.sort((a, b) => a.cost - b.cost || pressId(a.press).localeCompare(pressId(b.press)));
}

const pressId = (press: Press) => `${press.code}:${press.hand}:${press.finger}:${press.modifier}`;
const candidateId = (candidate: Candidate) => candidate.presses.map(pressId).join('|');

function chordCandidates(notes: Note[], slots: KeySlot[], hands: Map<RecordedEvent, Hand>, options: FingeringOptions, anchors: Record<Hand, KeyPosition>, positions: Map<string, KeyPosition>): { candidates: Candidate[]; pruned: boolean; unreachable: number } {
    let pruned = false;
    const candidates: Candidate[] = [];
    const choices = new Map<Note, Map<Modifier, ReturnType<typeof choicesFor>>>();
    for (const note of notes) choices.set(note, new Map(MODIFIERS.map(modifier => [modifier, choicesFor(note, modifier, slots, hands, options, anchors, positions)])));
    const reachable = notes.filter(note => MODIFIERS.some(modifier => choices.get(note)?.get(modifier)?.length));
    for (const modifier of MODIFIERS) {
        let partial: Candidate[] = [{ presses: [], modifier, cost: modifier === 0 ? 0 : 1, rolled: false }];
        for (const note of reachable) {
            const next: Candidate[] = [];
            for (const candidate of partial) {
                for (const choice of choices.get(note)?.get(modifier) ?? []) {
                    if (!candidate.presses.every(press => compatible(press, choice.press))) continue;
                    const spread = candidate.presses.filter(press => press.hand === choice.press.hand)
                        .reduce((sum, press) => sum + Math.abs(press.slot.x - choice.press.slot.x) * 0.04 + Math.abs(press.slot.row - choice.press.slot.row) * 0.15, 0);
                    next.push({ ...candidate, presses: [...candidate.presses, choice.press], cost: candidate.cost + choice.cost + spread });
                }
            }
            next.sort((a, b) => a.cost - b.cost || candidateId(a).localeCompare(candidateId(b)));
            if (next.length > PARTIAL_LIMIT) pruned = true;
            partial = next.slice(0, PARTIAL_LIMIT);
            if (partial.length === 0) break;
        }
        candidates.push(...partial);
    }
    // An explicit serial alternative also lets the sequence search preserve a
    // sustained voice when simultaneous notes would require an early release.
    if (reachable.length > 1) {
        let partial: Candidate[] = [{ presses: [], modifier: 0, cost: 0, rolled: true }];
        for (const [index, note] of reachable.entries()) {
            const alternatives = MODIFIERS.flatMap(modifier => choices.get(note)?.get(modifier) ?? []);
            const next = partial.flatMap(candidate => alternatives.map(choice => ({
                ...candidate, presses: [...candidate.presses, { ...choice.press, step: index + 1 }], cost: candidate.cost + choice.cost,
            })));
            next.sort((a, b) => a.cost - b.cost || candidateId(a).localeCompare(candidateId(b)));
            if (next.length > PARTIAL_LIMIT) pruned = true;
            partial = next.slice(0, PARTIAL_LIMIT);
        }
        candidates.push(...partial);
    }
    candidates.sort((a, b) => Number(a.rolled) - Number(b.rolled) || a.cost - b.cost || candidateId(a).localeCompare(candidateId(b)));
    // Reserve alternatives for each modifier and for serial playing. Otherwise
    // cheap unmodified finger combinations can crowd out all altered paths.
    const retained = new Map<string, Candidate>();
    for (const category of ['0', '1', '-1', 'roll']) {
        candidates.filter(candidate => (candidate.rolled ? 'roll' : String(candidate.modifier)) === category)
            .slice(0, CANDIDATE_LIMIT / 4).forEach(candidate => retained.set(`${candidate.rolled}|${candidateId(candidate)}`, candidate));
    }
    for (const candidate of candidates) {
        if (retained.size >= CANDIDATE_LIMIT) break;
        retained.set(`${candidate.rolled}|${candidateId(candidate)}`, candidate);
    }
    if (candidates.length > retained.size) pruned = true;
    return { candidates: [...retained.values()], pruned, unreachable: notes.length - reachable.length };
}

function transition(previous: Path, candidate: Candidate, time: number, positions: Map<string, KeyPosition>, unreachable: number): Path {
    let held = previous.held.filter(note => note.end > time);
    let modifier = previous.modifier;
    let cost = previous.cost + candidate.cost;
    let adaptations = previous.adaptations + (candidate.rolled ? Math.max(1, candidate.presses.length - 1) : 0) + unreachable;
    const poses = { ...previous.poses };
    const voices = new Map(previous.voices);
    const issues: FingeringIssue[] = [];
    const presses: Press[] = [];
    if (candidate.rolled) issues.push({ type: 'roll', time, count: candidate.presses.length });
    if (unreachable) issues.push({ type: 'unreachable', time, count: unreachable });
    const phases = candidate.rolled ? candidate.presses.map(press => [press]) : [candidate.presses];
    for (const phase of phases) {
        const phaseTime = Math.min(...phase.map(press => press.note.time), time);
        const nextModifier = phase.find(press => !press.slot.isImmune)?.modifier ?? 0;
        const control = modifierPress(nextModifier, positions);
        const occupied = control ? [...phase, control] : phase;
        const released = held.filter(note => !occupied.every(press => compatible(note.press, press)));
        held = held.filter(note => !released.includes(note));
        if (released.length) {
            adaptations += released.length;
            cost += released.reduce((sum, note) => sum + Math.min(8, (note.end - time) / 250), 0);
            issues.push({ type: 'release', time, count: released.length });
        }
        if (nextModifier !== modifier) cost += 2 + (nextModifier !== 0 && modifier !== 0 ? 2 : 0);
        modifier = nextModifier;
        for (const hand of ['left', 'right'] as Hand[]) {
            const playing = phase.filter(press => press.hand === hand);
            if (playing.length === 0) continue;
            const center = { x: playing.reduce((sum, press) => sum + press.slot.x - fingerOffset(hand, press.finger), 0) / playing.length,
                row: playing.reduce((sum, press) => sum + press.slot.row, 0) / playing.length, time: phaseTime };
            const from = poses[hand];
            const interval = Math.max(80, phaseTime - from.time);
            const pace = Math.min(3, Math.max(0.5, 400 / interval));
            cost += (Math.abs(center.x - from.x) * 0.35 + Math.abs(center.row - from.row) * 1.5) * pace;
            poses[hand] = center;
        }
        phase.forEach((press, index) => {
            presses.push({ ...press, releaseBefore: index === 0 && released.length ? [...new Set(released.map(note => note.press.code))] : undefined });
            held.push({ press, end: press.note.end });
        });
    }
    // A track's top note represents its melodic voice; inner chord notes do
    // not randomly replace that memory just because file event order differs.
    const topByVoice = new Map<string, Press>();
    for (const press of candidate.presses) {
        for (const voice of new Set(press.note.events.map(source))) {
            const top = topByVoice.get(voice);
            if (!top || press.note.midi > top.note.midi) topByVoice.set(voice, press);
        }
    }
    for (const [voice, press] of topByVoice) {
        const from = voices.get(voice);
        if (from && time - from.time < PHRASE_BREAK_MS && from.hand !== press.hand) cost += 7;
        voices.set(voice, { hand: press.hand, time });
    }
    return { previous, presses, held, issues, poses, voices, modifier, cost, adaptations };
}

const comparePaths = (a: Path, b: Path) => a.adaptations - b.adaptations || a.cost - b.cost;
function pathId(path: Path): string {
    return JSON.stringify([path.modifier, path.poses, [...path.voices], path.held.map(({ press, end }) => [press.note.id, pressId(press), end])]);
}

export function searchFingering(
    events: RecordedEvent[], chords: RecordedEvent[][], slots: KeySlot[], hands: Map<RecordedEvent, Hand>,
    options: FingeringOptions, anchors: Record<Hand, KeyPosition>, positions: Map<string, KeyPosition>,
): FingeringPlan {
    const assignments = new Map<RecordedEvent, KeyAssignment>();
    if (chords.length === 0) return { assignments, issues: [], adaptations: 0, cost: 0, pruned: false };
    const width = Math.max(1, Math.min(64, Math.floor(options.beamWidth ?? 32) || 32));
    const ends = noteEndTimes(events);
    let beam: Path[] = [{ previous: null, presses: [], issues: [], held: [], voices: new Map(), modifier: 0,
        poses: { left: { ...anchors.left, time: chords[0][0].time - 400 }, right: { ...anchors.right, time: chords[0][0].time - 400 } },
        cost: 0, adaptations: 0 }];
    let pruned = false;
    let noteId = 0;
    for (const [index, chord] of chords.entries()) {
        const time = chord[0].time;
        const notes = notesForChord(chord, ends, chords[index + 1]?.[0].time ?? time + 500, noteId);
        noteId += notes.length;
        const generated = chordCandidates(notes, slots, hands, options, anchors, positions);
        pruned ||= generated.pruned;
        const candidates = generated.candidates.length ? generated.candidates : [{ presses: [], modifier: 0 as const, cost: 0, rolled: false }];
        if (index > 0 && time - chords[index - 1][0].time >= PHRASE_BREAK_MS && beam.every(path => path.held.every(note => note.end <= time))) {
            // No sound spans this rest. Earlier choices no longer affect the
            // next phrase, so finalize the cheapest path and reset hand posture.
            const best = beam.sort(comparePaths)[0];
            beam = [{ ...best, held: [], voices: new Map(), modifier: 0,
                poses: { left: { ...anchors.left, time: time - 400 }, right: { ...anchors.right, time: time - 400 } } }];
        }
        const next = beam.flatMap(path => candidates.map(candidate => transition(path, candidate, time, positions, generated.unreachable)));
        next.sort(comparePaths);
        const unique = new Map<string, Path>();
        for (const path of next) {
            const id = pathId(path);
            if (!unique.has(id)) unique.set(id, path);
            if (unique.size > width) { pruned = true; break; }
        }
        beam = [...unique.values()].slice(0, width);
    }
    const best = beam.sort(comparePaths)[0];
    const chain: Path[] = [];
    for (let path: Path | null = best; path?.previous; path = path.previous) chain.push(path);
    const issues: FingeringIssue[] = [];
    for (const path of chain.reverse()) {
        issues.push(...path.issues);
        for (const { code, hand, finger, modifier, step, releaseBefore, note } of path.presses) {
            for (const evt of note.events) assignments.set(evt, { code, hand, finger, modifier, step, ...(releaseBefore ? { releaseBefore } : {}) });
        }
    }
    return { assignments, issues, cost: best.cost, adaptations: best.adaptations, pruned };
}
