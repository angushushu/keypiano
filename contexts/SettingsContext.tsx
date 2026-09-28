import React, { createContext, useContext, useEffect, useLayoutEffect, useState, useMemo } from 'react';
import { DEFAULT_THEME_ID, THEMES, ThemeID, themeCssVariables } from '../theme';
import { TRANSLATIONS, Language, TranslationSet } from '../i18n';
import { Theme } from '../theme';

interface SettingsContextValue {
  language: Language;
  setLanguage: (l: Language) => void;
  themeId: ThemeID;
  setThemeId: (id: ThemeID) => void;
  theme: Theme;
  t: TranslationSet;
  isZenMode: boolean;
  setIsZenMode: (v: boolean) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);
export const SETTINGS_STORAGE_KEY = 'keypiano.settings.v1';

const readStoredSettings = (): { language: Language; themeId: ThemeID } => {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}') as Record<string, unknown>;
    return {
      language: parsed.language === 'zh' ? 'zh' : 'en',
      themeId: typeof parsed.themeId === 'string' && parsed.themeId in THEMES
        ? parsed.themeId as ThemeID
        : DEFAULT_THEME_ID,
    };
  } catch {
    return { language: 'en', themeId: DEFAULT_THEME_ID };
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

  // Theme colours live in CSS variables on <html>, so everything (panels,
  // modals, the page background, native controls) follows the theme. A layout
  // effect applies them before the first paint.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const theme = THEMES[themeId];
    Object.entries(themeCssVariables(theme)).forEach(([name, value]) => root.style.setProperty(name, value));
    root.style.colorScheme = theme.isLight ? 'light' : 'dark';
  }, [themeId]);

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
