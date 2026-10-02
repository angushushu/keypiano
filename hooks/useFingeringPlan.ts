import { useEffect, useState } from 'react';
import { planPiece, type FingeringPlan, type FingeringOptions } from '../services/autoFingering';
import type { RecordedEvent } from '../types';
import type { FingeringResponse } from '../workers/fingeringWorker';

const EMPTY_PLAN: FingeringPlan = { assignments: new Map(), issues: [], adaptations: 0, cost: 0, pruned: false };

export function useFingeringPlan(events: RecordedEvent[], keymap: Record<string, string>, offset: number, options: FingeringOptions) {
    const [result, setResult] = useState<{
        events: RecordedEvent[]; keymap: Record<string, string>; offset: number; options: FingeringOptions;
        plan: FingeringPlan; failed: boolean;
    } | null>(null);
    const imported = events.some(evt => evt.type === 'on' && !evt.code);
    const matches = result?.events === events && result.keymap === keymap && result.offset === offset && result.options === options;

    useEffect(() => {
        if (!imported) return;
        let cancelled = false;
        let worker: Worker | undefined;
        let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
        const complete = (plan: FingeringPlan, failed = false) => {
            if (!cancelled) setResult({ events, keymap, offset, options, plan, failed });
        };
        const fallback = () => {
            worker?.terminate();
            fallbackTimer = setTimeout(() => {
                if (cancelled) return;
                try { complete(planPiece(events, keymap, offset, options)); }
                catch { complete(EMPTY_PLAN, true); }
            }, 0);
        };
        try {
            worker = new Worker(new URL('../workers/fingeringWorker.ts', import.meta.url), { type: 'module' });
            worker.onmessage = (event: MessageEvent<FingeringResponse>) => {
                const { assignments, ...summary } = event.data;
                complete({ ...summary, assignments: new Map(assignments.map(([index, assignment]) => [events[index], assignment])) });
                worker?.terminate();
            };
            worker.onerror = event => { event.preventDefault(); fallback(); };
            worker.postMessage({ events, keymap, offset, options });
        } catch { fallback(); }
        return () => {
            cancelled = true;
            worker?.terminate();
            if (fallbackTimer !== undefined) clearTimeout(fallbackTimer);
        };
    }, [events, keymap, offset, options, imported]);

    return {
        plan: imported && matches ? result.plan : EMPTY_PLAN,
        isPlanning: imported && !matches,
        failed: imported && matches ? result.failed : false,
    };
}
