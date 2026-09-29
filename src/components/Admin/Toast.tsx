'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

type ToastVariant = 'error' | 'success';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  error: (message: string | undefined) => void;
  success: (message: string) => void;
}

const DEFAULT_ERROR_MESSAGE = 'Something went wrong.';

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, variant: ToastVariant) => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, message, variant }]);
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  const value: ToastContextValue = {
    error: (message) => push(message ?? DEFAULT_ERROR_MESSAGE, 'error'),
    success: (message) => push(message, 'success'),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border p-3 shadow-2xl ${
              t.variant === 'error'
                ? 'border-red-900/80 bg-red-950/90 text-red-100'
                : 'border-emerald-900/80 bg-emerald-950/90 text-emerald-100'
            }`}
          >
            {t.variant === 'error' ? (
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-400" />
            ) : (
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-400" />
            )}
            <p className="flex-1 text-sm">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-zinc-400 transition-colors hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
