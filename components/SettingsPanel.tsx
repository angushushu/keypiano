import React, { useEffect, useRef } from 'react';
import { Map as MapIcon, Palette, Languages, Usb } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { THEMES, ThemeID } from '../theme';
import { KEYMAP_PRESETS, KeymapID } from '../constants';
import { Language } from '../i18n';

interface SettingsPanelProps {
  show: boolean;
  onClose: () => void;
  panelRef: React.RefObject<HTMLDivElement>;
  keymapId: string;
  setKeymapId: (id: KeymapID) => void;
  settingsButtonRef: React.RefObject<HTMLButtonElement>;
  midiStatus: 'idle' | 'requesting' | 'connected' | 'denied' | 'unsupported';
  midiInputCount: number;
  requestMidiAccess: () => Promise<void>;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  show,
  onClose,
  panelRef,
  keymapId,
  setKeymapId,
  settingsButtonRef,
  midiStatus,
  midiInputCount,
  requestMidiAccess,
}) => {
  const { language, setLanguage, themeId, setThemeId, theme, t } = useSettings();
  const firstSelectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (!show) return;
    firstSelectRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
      settingsButtonRef.current?.focus();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, settingsButtonRef, show]);

  if (!show) return null;

  const isThemeID = (value: string): value is ThemeID => value in THEMES;
  const isLanguage = (value: string): value is Language => value === 'en' || value === 'zh';

  return (
    <div
      ref={panelRef}
      id="keypiano-settings-panel"
      role="dialog"
      aria-labelledby="settings-panel-title"
      className={`fixed top-2 right-2 w-64 max-h-[calc(100vh-1rem)] overflow-y-auto rounded shadow-xl z-50 p-3 flex flex-col gap-3 border ${theme.panelBg} ${theme.panelBorder}`}
    >
      <h2 id="settings-panel-title" className={`text-sm font-bold ${theme.toolbarText}`}>{t.settings}</h2>
      <div className="flex flex-col gap-1">
        <label htmlFor="keymap-select" className={`flex items-center gap-2 text-xs px-1 ${theme.toolbarText}`}><MapIcon className="w-3 h-3" /><span>{t.keymap}</span></label>
        <select ref={firstSelectRef} id="keymap-select" value={keymapId} onChange={(e) => {
          const value = e.target.value;
          if (value in KEYMAP_PRESETS) setKeymapId(value as KeymapID);
        }} className={`bg-black/20 text-current text-xs p-1.5 rounded border outline-none focus:border-yellow-500 cursor-pointer ${theme.panelBorder} ${theme.toolbarText}`}>
          {Object.entries(KEYMAP_PRESETS).map(([id, cfg]) => (<option key={id} value={id}>{cfg.name}</option>))}
        </select>
      </div>
      <div className={`h-px border-b ${theme.panelBorder}`}></div>
      <div className="flex flex-col gap-1">
        <label htmlFor="theme-select" className={`flex items-center gap-2 text-xs px-1 ${theme.toolbarText}`}><Palette className="w-3 h-3" /><span>{t.theme}</span></label>
        <select id="theme-select" value={themeId} onChange={(e) => {
          const value = e.target.value;
          if (isThemeID(value)) setThemeId(value);
        }} className={`bg-black/20 text-current text-xs p-1.5 rounded border outline-none focus:border-yellow-500 cursor-pointer ${theme.panelBorder} ${theme.toolbarText}`}>
          {Object.values(THEMES).map(th => (<option key={th.id} value={th.id}>{t.themes[th.id]}</option>))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="language-select" className={`flex items-center gap-2 text-xs px-1 ${theme.toolbarText}`}><Languages className="w-3 h-3" /><span>{t.language}</span></label>
        <select id="language-select" value={language} onChange={(e) => {
          const value = e.target.value;
          if (isLanguage(value)) setLanguage(value);
        }} className={`bg-black/20 text-current text-xs p-1.5 rounded border outline-none focus:border-yellow-500 cursor-pointer ${theme.panelBorder} ${theme.toolbarText}`}>
          <option value="en">English</option><option value="zh">中文</option>
        </select>
      </div>
      <div className={`h-px border-b ${theme.panelBorder}`}></div>
      <div className="flex flex-col gap-2">
        <div className={`flex items-center gap-2 text-xs px-1 ${theme.toolbarText}`}><Usb className="w-3 h-3" /><span>{t.midi.title}</span></div>
        <p className={`text-[11px] px-1 ${theme.toolbarText} opacity-70`} role="status">
          {midiStatus === 'requesting' && t.midi.requesting}
          {midiStatus === 'connected' && `${t.midi.connected} · ${midiInputCount} ${t.midi.inputs}`}
          {midiStatus === 'denied' && t.midi.denied}
          {midiStatus === 'unsupported' && t.midi.unsupported}
          {midiStatus === 'idle' && t.midi.enable}
        </p>
        {midiStatus !== 'connected' && midiStatus !== 'unsupported' && (
          <button
            type="button"
            disabled={midiStatus === 'requesting'}
            onClick={() => void requestMidiAccess()}
            className="rounded bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:cursor-wait disabled:opacity-50"
          >
            {midiStatus === 'denied' ? t.midi.retry : t.midi.enable}
          </button>
        )}
      </div>
    </div>
  );
};

export default SettingsPanel;
