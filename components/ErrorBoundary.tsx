import { Component, ErrorInfo, ReactNode } from 'react';
import { SETTINGS_STORAGE_KEY } from '../contexts/SettingsContext';
import { TRANSLATIONS, Language } from '../i18n';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary sits above SettingsProvider, so it cannot use `useSettings()`.
 * It reads the persisted language directly to keep the failure screen localized.
 */
const readStoredLanguage = (): Language => {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}') as Record<string, unknown>;
    return parsed.language === 'zh' ? 'zh' : 'en';
  } catch {
    return 'en';
  }
};

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const t = TRANSLATIONS[readStoredLanguage()].errorScreen;
      return (
        <div className="h-screen w-screen bg-zinc-900 text-white flex flex-col items-center justify-center gap-6 p-8">
          <div className="text-6xl">🎹</div>
          <h1 className="text-2xl font-bold text-yellow-500">{t.title}</h1>
          <p className="text-gray-400 text-center max-w-md">
            {t.message}
          </p>
          <pre className="bg-black/50 text-red-400 text-xs p-4 rounded-lg max-w-lg overflow-auto max-h-32">
            {this.state.error?.message}
          </pre>
          <button
            onClick={this.handleReset}
            className="px-6 py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-lg transition-colors"
          >
            {t.tryAgain}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
