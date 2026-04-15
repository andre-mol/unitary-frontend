/**
 * Toast Notification System
 * 
 * Simple, dependency-free toast system using Tailwind CSS.
 * Provides success, error, info, and warning notifications.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

// ============================================================
// TYPES
// ============================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
    id: string;
    type: ToastType;
    title?: string;
    message: string;
    duration?: number;
}

interface ToastContextValue {
    addToast: (toast: Omit<Toast, 'id'>) => void;
    removeToast: (id: string) => void;
}

// ============================================================
// CONTEXT
// ============================================================

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

// ============================================================
// HOOK
// ============================================================

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

// ============================================================
// COMPONENT
// ============================================================

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback(({ type, title, message, duration = 5000 }: Omit<Toast, 'id'>) => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, type, title, message, duration }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            {createPortal(
                <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-full max-w-sm pointer-events-none p-4 sm:p-0">
                    <AnimatePresence mode="popLayout">
                        {toasts.map((toast) => (
                            <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
                        ))}
                    </AnimatePresence>
                </div>,
                document.body
            )}
        </ToastContext.Provider>
    );
}

const ToastItem = React.forwardRef<HTMLDivElement, { toast: Toast; onDismiss: (id: string) => void }>(({ toast, onDismiss }, ref) => {
    useEffect(() => {
        if (toast.duration && toast.duration > 0) {
            const timer = setTimeout(() => {
                onDismiss(toast.id);
            }, toast.duration);
            return () => clearTimeout(timer);
        }
    }, [toast.id, toast.duration, onDismiss]);

    const icons = {
        success: <CheckCircle className="w-5 h-5 text-emerald-500" />,
        error: <AlertCircle className="w-5 h-5 text-red-500" />,
        warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
        info: <Info className="w-5 h-5 text-blue-500" />,
    };

    const backgrounds = {
        success: 'bg-zinc-900 border-emerald-500/20',
        error: 'bg-zinc-900 border-red-500/20',
        warning: 'bg-zinc-900 border-amber-500/20',
        info: 'bg-zinc-900 border-blue-500/20',
    };

    return (
        <motion.div
            ref={ref}
            layout
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            className={`pointer-events-auto flex items-start w-full gap-3 p-4 rounded-lg border shadow-lg backdrop-blur-sm ${backgrounds[toast.type]}`}
        >
            <div className="shrink-0 mt-0.5">{icons[toast.type]}</div>
            <div className="flex-1 min-w-0">
                {toast.title && <h3 className="text-sm font-medium text-white mb-1">{toast.title}</h3>}
                <p className={`text-sm ${toast.title ? 'text-zinc-400' : 'text-zinc-200'}`}>{toast.message}</p>
            </div>
            <button
                onClick={() => onDismiss(toast.id)}
                className="shrink-0 text-zinc-500 hover:text-white transition-colors"
                aria-label="Close"
            >
                <X className="w-4 h-4" />
            </button>
        </motion.div>
    );
});
