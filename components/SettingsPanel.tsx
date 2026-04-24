import React from 'react';
import { Map as MapIcon, Palette, Languages } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { THEMES } from '../theme';
import { KEYMAP_PRESETS, KeymapID } from '../constants';

interface SettingsPanelProps {
  show: boolean;
  onClose: () => void;
  panelRef: React.RefObject<HTMLDivElement>;
  keymapId: string;
  setKeymapId: (id: KeymapID) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ show, onClose, panelRef, keymapId, setKeymapId }) => {
  const { language, setLanguage, themeId, setThemeId, theme, t } = useSettings();

  if (!show) return null;

  return (
    <div ref={panelRef} className={`absolute top-[48px] md:top-[48px] right-2 w-56 rounded shadow-xl z-50 p-3 flex flex-col gap-3 border ${theme.panelBg} ${theme.panelBorder}`}>
      <div className="flex flex-col gap-1">
        <div className={`flex items-center gap-2 text-xs px-1 ${theme.toolbarText}`}><MapIcon className="w-3 h-3" /><span>Keymap</span></div>
        <select value={keymapId} onChange={(e) => setKeymapId(e.target.value as KeymapID)} className={`bg-black/20 text-current text-xs p-1.5 rounded border outline-none focus:border-yellow-500 cursor-pointer ${theme.panelBorder} ${theme.toolbarText}`}>
          {Object.entries(KEYMAP_PRESETS).map(([id, cfg]) => (<option key={id} value={id}>{cfg.name}</option>))}
        </select>
      </div>
      <div className={`h-px border-b ${theme.panelBorder}`}></div>
      <div className="flex flex-col gap-1">
        <div className={`flex items-center gap-2 text-xs px-1 ${theme.toolbarText}`}><Palette className="w-3 h-3" /><span>{t.theme}</span></div>
        <select value={themeId} onChange={(e) => setThemeId(e.target.value as any)} className={`bg-black/20 text-current text-xs p-1.5 rounded border outline-none focus:border-yellow-500 cursor-pointer ${theme.panelBorder} ${theme.toolbarText}`}>
          {Object.values(THEMES).map(th => (<option key={th.id} value={th.id}>{t.themes[th.id]}</option>))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <div className={`flex items-center gap-2 text-xs px-1 ${theme.toolbarText}`}><Languages className="w-3 h-3" /><span>{t.language}</span></div>
        <select value={language} onChange={(e) => setLanguage(e.target.value as any)} className={`bg-black/20 text-current text-xs p-1.5 rounded border outline-none focus:border-yellow-500 cursor-pointer ${theme.panelBorder} ${theme.toolbarText}`}>
          <option value="en">English</option><option value="zh">中文</option>
        </select>
      </div>
    </div>
  );
};

export default SettingsPanel;
