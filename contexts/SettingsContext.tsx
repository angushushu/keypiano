import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { THEMES, ThemeID } from '../theme';
import { TRANSLATIONS, Language, TranslationSet } from '../i18n';
import { Theme } from '../theme';

interface SettingsContextValue {
  language: Language;
  setLanguage: (l: Language) => void;
  themeId: ThemeID;
  setThemeId: (id: ThemeID) => void;
  theme: Theme;
  t: TranslationSet;
  isLightTheme: boolean;
  isZenMode: boolean;
  setIsZenMode: (v: boolean) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);
const SETTINGS_STORAGE_KEY = 'keypiano.settings.v1';

const readStoredSettings = (): { language: Language; themeId: ThemeID } => {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}') as Record<string, unknown>;
    return {
      language: parsed.language === 'zh' ? 'zh' : 'en',
      themeId: typeof parsed.themeId === 'string' && parsed.themeId in THEMES
        ? parsed.themeId as ThemeID
        : 'dark',
    };
  } catch {
    return { language: 'en', themeId: 'dark' };
  }
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [initialSettings] = useState(readStoredSettings);
  const [language, setLanguage] = useState<Language>(initialSettings.language);
  const [themeId, setThemeId] = useState<ThemeID>(initialSettings.themeId);
  const [isZenMode, setIsZenMode] = useState(false);

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ language, themeId }));
    } catch {
      // Private browsing or a full storage quota should not block the app.
    }
  }, [language, themeId]);

  const value = useMemo(() => {
    const theme = THEMES[themeId];
    const t = TRANSLATIONS[language];
    return {
      language,
      setLanguage,
      themeId,
      setThemeId,
      theme,
      t,
      isLightTheme: theme.isLight,
      isZenMode,
      setIsZenMode,
    };
  }, [language, themeId, isZenMode]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
