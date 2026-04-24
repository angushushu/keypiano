import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

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
      return (
        <div className="h-screen w-screen bg-zinc-900 text-white flex flex-col items-center justify-center gap-6 p-8">
          <div className="text-6xl">🎹</div>
          <h1 className="text-2xl font-bold text-yellow-500">Oops! Something went wrong</h1>
          <p className="text-gray-400 text-center max-w-md">
            KeyPiano encountered an unexpected error. Your audio engine may still be running.
          </p>
          <pre className="bg-black/50 text-red-400 text-xs p-4 rounded-lg max-w-lg overflow-auto max-h-32">
            {this.state.error?.message}
          </pre>
          <button
            onClick={this.handleReset}
            className="px-6 py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
