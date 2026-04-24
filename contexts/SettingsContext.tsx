import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
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

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');
  const [themeId, setThemeId] = useState<ThemeID>('dark');
  const [isZenMode, setIsZenMode] = useState(false);

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
