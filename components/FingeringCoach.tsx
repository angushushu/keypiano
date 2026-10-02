import { ALL_ROWS } from '../constants';
import type { FingeringPlan } from '../services/autoFingering';
import type { GuideInstruction } from '../services/practiceGuide';
import { useSettings } from '../contexts/SettingsContext';

interface FingeringCoachProps {
    plan: FingeringPlan;
    instruction: GuideInstruction;
    isPlanning: boolean;
    failed: boolean;
    isWaitMode: boolean;
}
const KEY_LABELS = new Map(ALL_ROWS.flat().map(key => [key.code, key.customLabel || key.label]));

export default function FingeringCoach({ plan, instruction, isPlanning, failed, isWaitMode }: FingeringCoachProps) {
    const { t, theme } = useSettings();
    const rolls = new Set(plan.issues.filter(issue => issue.type === 'roll').map(issue => issue.time)).size;
    const releases = plan.issues.filter(issue => issue.type === 'release').reduce((sum, issue) => sum + issue.count, 0);
    const unreachable = plan.issues.filter(issue => issue.type === 'unreachable').reduce((sum, issue) => sum + issue.count, 0);
    return (
        <div className={`shrink-0 border-b px-3 py-2 text-[11px] sm:text-xs flex flex-col gap-1 ${theme.toolbarBg} ${theme.toolbarBorder} ${theme.toolbarText}`}>
            <span>{isPlanning ? t.fingering.planning : failed ? t.fingering.failed : t.fingering.legend}</span>
            {!isPlanning && !failed && plan.issues.length > 0 && (
                <span className={theme.mutedText}>
                    {t.fingering.adaptations.replace('{roll}', String(rolls)).replace('{release}', String(releases)).replace('{unreachable}', String(unreachable))}
                </span>
            )}
            {!isWaitMode && rolls > 0 && <span>{t.fingering.useWaitMode}</span>}
            <span role="status" aria-live="polite">
                {instruction.releaseCodes.length > 0
                    ? t.fingering.release.replace('{keys}', instruction.releaseCodes.map(code => {
                        const label = KEY_LABELS.get(code) ?? code;
                        return code.startsWith('Numpad') || code === 'NumLock' ? t.fingering.numpadKey.replace('{key}', label) : label;
                    }).join(' + '))
                    : instruction.rolled ? t.fingering.roll : ''}
            </span>
        </div>
    );
}
