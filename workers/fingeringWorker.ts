import { planPiece, type FingeringOptions, type FingeringPlan, type KeyAssignment } from '../services/autoFingering';
import type { RecordedEvent } from '../types';

export interface FingeringRequest {
    events: RecordedEvent[];
    keymap: Record<string, string>;
    offset: number;
    options: FingeringOptions;
}
export type FingeringResponse = Omit<FingeringPlan, 'assignments'> & { assignments: [number, KeyAssignment][] };

self.onmessage = (event: MessageEvent<FingeringRequest>) => {
    const { events, keymap, offset, options } = event.data;
    const { assignments, ...summary } = planPiece(events, keymap, offset, options);
    const indices = new Map(events.map((evt, index) => [evt, index]));
    const response: FingeringResponse = { ...summary, assignments: [...assignments].map(([evt, assignment]) => [indices.get(evt)!, assignment]) };
    self.postMessage(response);
};
