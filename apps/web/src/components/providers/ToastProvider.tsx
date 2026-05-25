'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';
import clsx from 'clsx';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  toast: (opts: Omit<Toast, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export const useToast = () => useContext(ToastContext);

const icons = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const styles: Record<ToastType, string> = {
  success: 'border-green-500/30 bg-green-500/10 text-green-300',
  error:   'border-red-500/30   bg-red-500/10   text-red-300',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  info:    'border-blue-500/30  bg-blue-500/10  text-blue-300',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((opts: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...opts, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
        {toasts.map((t) => {
          const Icon = icons[t.type];
          return (
            <div key={t.id} className={clsx('card border p-4 flex gap-3 animate-slide-up', styles[t.type])}>
              <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{t.title}</p>
                {t.message && <p className="text-xs opacity-80 mt-0.5">{t.message}</p>}
              </div>
              <button onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))} className="opacity-60 hover:opacity-100">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
