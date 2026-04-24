import React from 'react';
import { AlertTriangle, X, Info } from 'lucide-react';

export type ToastVariant = 'warning' | 'error' | 'info';

export interface ToastProps {
  message: string;
  variant: ToastVariant;
  onDismiss: () => void;
}

const variantStyles: Record<ToastVariant, string> = {
  warning: 'bg-yellow-600/90',
  error: 'bg-red-700/90',
  info: 'bg-slate-700/90',
};

const Toast: React.FC<ToastProps> = ({ message, variant, onDismiss }) => (
  <div
    role="alert"
    className={`absolute top-16 left-1/2 -translate-x-1/2 z-50 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 backdrop-blur animate-fade-in-down max-w-[min(90vw,28rem)] ${variantStyles[variant]}`}
  >
    {variant === 'info' ? (
      <Info className="w-4 h-4 shrink-0" aria-hidden />
    ) : (
      <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
    )}
    <span className="text-xs font-semibold">{message}</span>
    <button
      type="button"
      onClick={onDismiss}
      className="ml-1 shrink-0 hover:bg-white/20 p-1 rounded"
      aria-label="Dismiss"
    >
      <X className="w-3 h-3" />
    </button>
  </div>
);

export default Toast;
