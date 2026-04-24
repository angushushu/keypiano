import React from 'react';
import { X, Info, Github, Globe } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

export interface InfoModalProps {
  show: boolean;
  onClose: () => void;
}

const InfoModal: React.FC<InfoModalProps> = ({ show, onClose }) => {
  const { theme, t } = useSettings();

  if (!show) return null;

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`w-full max-w-lg rounded-lg shadow-2xl border flex flex-col overflow-hidden ${theme.panelBg} ${theme.panelBorder}`}>
        <div className={`flex items-center justify-between p-4 border-b ${theme.panelBorder} ${theme.toolbarBg}`}>
          <div className="flex items-center gap-2 text-yellow-500 font-bold"><Info className="w-5 h-5" /><span>{t.aboutTitle}</span></div>
          <button onClick={onClose} className="text-current opacity-60 hover:opacity-100"><X className="w-5 h-5" /></button>
        </div>
        <div className={`p-6 text-sm leading-relaxed ${theme.toolbarText}`}>
          <p className="mb-4"><strong className="text-current opacity-100 font-extrabold">{t.title}</strong> {t.aboutDesc}</p>
          <p className="text-xs text-current opacity-60 mb-4">{t.mobileHint}</p>
          <div className={`border-t pt-4 mt-2 flex flex-col gap-2 ${theme.panelBorder}`}>
            <div className="text-[10px] font-bold text-current opacity-60 uppercase tracking-wider mb-1">{t.relatedProjects}</div>
            <a href="https://github.com/angushushu/keypiano" target="_blank" className="flex items-center gap-2 text-current hover:text-yellow-500 transition-colors text-xs font-medium"><Github className="w-3.5 h-3.5" /> <span>{t.sourceCode}</span></a>
            <a href="https://github.com/angushushu/freepyano" target="_blank" className="flex items-center gap-2 text-current hover:text-yellow-500 transition-colors text-xs font-medium"><Github className="w-3.5 h-3.5" /> <span>{t.desktopRemake}</span></a>
            <a href="https://freepiano.tiwb.com/" target="_blank" className="flex items-center gap-2 text-current hover:text-yellow-500 transition-colors text-xs font-medium"><Globe className="w-3.5 h-3.5" /> <span>{t.originalSite}</span></a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InfoModal;
