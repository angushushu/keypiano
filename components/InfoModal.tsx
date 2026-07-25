import React, { useEffect, useRef } from 'react';
import { X, Info, Github, Globe } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

export interface InfoModalProps {
  show: boolean;
  onClose: () => void;
  returnFocusRef?: React.RefObject<HTMLButtonElement>;
}

const InfoModal: React.FC<InfoModalProps> = ({ show, onClose, returnFocusRef }) => {
  const { theme, t } = useSettings();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!show) return;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        returnFocusRef?.current?.focus();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, returnFocusRef, show]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-dialog-title"
        aria-describedby="about-dialog-description"
        className={`w-full max-w-lg rounded-lg shadow-2xl border flex flex-col overflow-hidden ${theme.panelBg} ${theme.panelBorder}`}
      >
        <div className={`flex items-center justify-between p-4 border-b ${theme.panelBorder} ${theme.toolbarBg}`}>
          <div className="flex items-center gap-2 text-yellow-500 font-bold"><Info className="w-5 h-5" /><span id="about-dialog-title">{t.aboutTitle}</span></div>
          <button
            ref={closeButtonRef}
            onClick={() => {
              onClose();
              returnFocusRef?.current?.focus();
            }}
            aria-label={t.close}
            className="rounded p-2 text-current opacity-60 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
          ><X className="w-5 h-5" /></button>
        </div>
        <div className={`p-6 text-sm leading-relaxed ${theme.toolbarText}`}>
          <p id="about-dialog-description" className="mb-4"><strong className="text-current opacity-100 font-extrabold">{t.title}</strong> {t.aboutDesc}</p>
          <p className="text-xs text-current opacity-60 mb-4">{t.mobileHint}</p>
          <div className={`border-t pt-4 mt-2 flex flex-col gap-2 ${theme.panelBorder}`}>
            <div className="text-[10px] font-bold text-current opacity-60 uppercase tracking-wider mb-1">{t.relatedProjects}</div>
            <a href="https://github.com/angushushu/keypiano" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-current hover:text-yellow-500 transition-colors text-xs font-medium"><Github className="w-3.5 h-3.5" /> <span>{t.sourceCode}</span></a>
            <a href="https://github.com/angushushu/freepyano" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-current hover:text-yellow-500 transition-colors text-xs font-medium"><Github className="w-3.5 h-3.5" /> <span>{t.desktopRemake}</span></a>
            <a href="https://freepiano.tiwb.com/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-current hover:text-yellow-500 transition-colors text-xs font-medium"><Globe className="w-3.5 h-3.5" /> <span>{t.originalSite}</span></a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InfoModal;
