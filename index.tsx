import React from 'react';
import ReactDOM from 'react-dom/client';
import './src/index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { audioEngine } from './services/audioEngine';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// The audio engine is a page-lifetime singleton, so its teardown belongs to the
// page lifecycle rather than to a React unmount (StrictMode mounts twice in dev,
// and closing the AudioContext there would break audio for the second mount).
window.addEventListener('pagehide', () => { audioEngine.dispose(); }, { once: true });

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);