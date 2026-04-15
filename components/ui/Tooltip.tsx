import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

const TooltipContext = createContext<{
    open: boolean;
    setOpen: (open: boolean) => void;
    triggerRef: React.RefObject<HTMLDivElement>;
}>({
    open: false,
    setOpen: () => { },
    triggerRef: { current: null }
});

export const TooltipProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <>{children}</>
);

export const Tooltip: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLDivElement>(null);

    return (
        <TooltipContext.Provider value={{ open, setOpen, triggerRef }}>
            <div
                className="relative inline-block"
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
            >
                {children}
            </div>
        </TooltipContext.Provider>
    );
};

export const TooltipTrigger: React.FC<{ asChild?: boolean; children: React.ReactNode }> = ({ children }) => {
    const { triggerRef } = useContext(TooltipContext);
    return (
        <div ref={triggerRef} className="cursor-help inline-flex">
            {children}
        </div>
    );
};

export const TooltipContent: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => {
    const { open, triggerRef } = useContext(TooltipContext);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    useEffect(() => {
        if (open && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            // Position above the trigger, centered horizontally
            setPosition({
                top: rect.top + window.scrollY - 10, // 10px spacing above
                left: rect.left + window.scrollX + (rect.width / 2)
            });
        }
    }, [open, triggerRef]);

    if (!open) return null;

    // Use Portal to render outside of any overflow:hidden containers
    return createPortal(
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 5 }}
                    transition={{ duration: 0.15 }}
                    style={{
                        top: position.top,
                        left: position.left,
                        position: 'absolute', // Absolute relative to document body (portal)
                        zIndex: 9999
                    }}
                    className={`pointer-events-none rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-300 shadow-md transform -translate-x-1/2 -translate-y-full w-max max-w-[200px] ${className}`}
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};
