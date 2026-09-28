import React, { useEffect, useRef } from 'react';
import { History, Trash2, FileMusic, Mic } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { TakeSummary } from '../services/takeStore';

interface TakesPanelProps {
  show: boolean;
  onClose: () => void;
  toggleButtonRef: React.RefObject<HTMLButtonElement>;
  takes: TakeSummary[];
  currentTakeId: string | null;
  isStorageAvailable: boolean | null;
  /** Recording is running, so loading another take is not allowed. */
  isLocked: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

const formatDuration = (ms: number) => {
  const totalSeconds = Math.round(ms / 1000);
  return `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60).toString().padStart(2, '0')}`;
};

const TakesPanel: React.FC<TakesPanelProps> = ({
  show, onClose, toggleButtonRef, takes, currentTakeId, isStorageAvailable, isLocked, onOpen, onDelete,
}) => {
  const { theme, t, language } = useSettings();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show) return;
    const closeAndReturnFocus = () => {
      onClose();
      toggleButtonRef.current?.focus();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeAndReturnFocus();
    };
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || toggleButtonRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [onClose, show, toggleButtonRef]);

  if (!show) return null;

  const dateFormat = new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const takeName = (take: TakeSummary) => (
    take.kind === 'import' && take.name
      ? take.name
      : t.takes.recordingName.replace('{date}', dateFormat.format(take.createdAt))
  );

  return (
    <div
      ref={panelRef}
      id="keypiano-takes-panel"
      role="dialog"
      aria-labelledby="takes-panel-title"
      className={`fixed top-2 right-2 w-72 max-h-[calc(100vh-1rem)] overflow-y-auto rounded shadow-xl z-50 p-3 flex flex-col gap-2 border ${theme.panelBg} ${theme.panelBorder}`}
    >
      <h2 id="takes-panel-title" className={`flex items-center gap-2 text-sm font-bold ${theme.toolbarText}`}>
        <History className="w-4 h-4" aria-hidden="true" />{t.takes.title}
      </h2>
      {isStorageAvailable === false && (
        <p role="alert" className="text-[11px] px-1 text-amber-500">{t.takes.unavailable}</p>
      )}
      {takes.length === 0 && isStorageAvailable !== false && (
        <p className={`text-[11px] px-1 ${theme.toolbarText} opacity-70`}>{t.takes.empty}</p>
      )}
      <ul className="flex flex-col gap-1">
        {takes.map(take => {
          const isCurrent = take.id === currentTakeId;
          const name = takeName(take);
          const Icon = take.kind === 'import' ? FileMusic : Mic;
          return (
            <li key={take.id} className={`flex items-center gap-1 rounded border ${isCurrent ? 'border-yellow-500/70 bg-yellow-500/10' : theme.panelBorder}`}>
              <button
                type="button"
                disabled={isLocked}
                aria-current={isCurrent ? 'true' : undefined}
                onClick={() => onOpen(take.id)}
                className={`flex-1 min-w-0 flex items-start gap-2 p-2 text-left rounded hover:bg-black/20 disabled:cursor-not-allowed disabled:opacity-50 ${theme.toolbarText}`}
              >
                <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-70" aria-hidden="true" />
                <span className="min-w-0 flex flex-col">
                  <span className="text-xs truncate">{name}</span>
                  <span className="text-[10px] opacity-60">
                    {formatDuration(take.durationMs)} · {(take.noteCount === 1 ? t.takes.notesOne : t.takes.notes).replace('{count}', String(take.noteCount))}
                    {isCurrent && ` · ${t.takes.current}`}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => { if (window.confirm(t.takes.confirmDelete)) onDelete(take.id); }}
                className="p-2 rounded text-gray-500 hover:text-red-400 hover:bg-black/20"
                title={t.takes.delete}
                aria-label={`${t.takes.delete}: ${name}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default TakesPanel;
