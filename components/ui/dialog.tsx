import React, { createContext, useContext, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

const DialogContext = createContext<{
    open: boolean;
    setOpen: (open: boolean) => void;
}>({ open: false, setOpen: () => { } });

interface DialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, children }) => {
    return (
        <DialogContext.Provider value={{ open, setOpen: onOpenChange }}>
            {children}
        </DialogContext.Provider>
    );
};

export const DialogContent: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => {
    const { open, setOpen } = useContext(DialogContext);

    if (!open) return null;

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
                        onClick={() => setOpen(false)}
                    />

                    {/* Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.2 }}
                        className={`z-50 rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl w-full ${className}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {children}
                        <button
                            onClick={() => setOpen(false)}
                            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
                        >
                            <X size={16} className="text-zinc-400" />
                            <span className="sr-only">Close</span>
                        </button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export const DialogHeader: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
    <div className={`flex flex-col space-y-1.5 text-center sm:text-left ${className}`}>
        {children}
    </div>
);

export const DialogFooter: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
    <div className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 ${className}`}>
        {children}
    </div>
);

export const DialogTitle: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
    <h2 className={`text-lg font-semibold leading-none tracking-tight ${className}`}>
        {children}
    </h2>
);

export const DialogClose: React.FC<{ asChild?: boolean; children: React.ReactNode }> = ({ children }) => {
    const { setOpen } = useContext(DialogContext);
    return (
        <div onClick={() => setOpen(false)}>
            {children}
        </div>
    );
};
