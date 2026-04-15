import React, { useState, useRef, useEffect, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

// Context to manage open state and trigger ref
const DropdownMenuContext = createContext<{
    open: boolean;
    setOpen: (open: boolean) => void;
    triggerRef: React.RefObject<HTMLButtonElement | HTMLDivElement>;
}>({
    open: false,
    setOpen: () => { },
    triggerRef: { current: null }
});

export const DropdownMenu: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside (but allow clicks inside content which is portaled)
    useEffect(() => {
        // We'll handle click outside in the Content component since it's portaled
        return () => { };
    }, [open]);

    return (
        <DropdownMenuContext.Provider value={{ open, setOpen, triggerRef }}>
            <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
                {children}
            </div>
        </DropdownMenuContext.Provider>
    );
};

export const DropdownMenuTrigger: React.FC<{ asChild?: boolean; children: React.ReactNode }> = ({ asChild, children }) => {
    const { open, setOpen, triggerRef } = useContext(DropdownMenuContext);

    if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children as React.ReactElement<any>, {
            ref: triggerRef, // Attach ref to child
            onClick: (e: React.MouseEvent) => {
                children.props.onClick?.(e);
                setOpen(!open);
            },
            'data-state': open ? 'open' : 'closed'
        });
    }

    return (
        <button
            ref={triggerRef as React.RefObject<HTMLButtonElement>}
            onClick={() => setOpen(!open)}
            data-state={open ? 'open' : 'closed'}
        >
            {children}
        </button>
    );
};

export const DropdownMenuContent: React.FC<{
    align?: 'start' | 'end' | 'center';
    className?: string;
    children: React.ReactNode
}> = ({ align = 'center', className = '', children }) => {
    const { open, setOpen, triggerRef } = useContext(DropdownMenuContext);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const contentRef = useRef<HTMLDivElement>(null);

    // Update position when opening
    useEffect(() => {
        if (open && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const scrollX = window.scrollX;
            const scrollY = window.scrollY;

            // Basic Positioning Logic
            let top = rect.bottom + scrollY + 4; // 4px margin
            let left = rect.left + scrollX;

            // Alignment adjustments
            if (align === 'end') {
                left = (rect.right + scrollX); // We'll adjust via CSS transform translate too
            } else if (align === 'center') {
                left = (rect.left + scrollX) + (rect.width / 2);
            }

            setPosition({ top, left });
        }
    }, [open, triggerRef, align]);

    // Click outside handler for Portal
    useEffect(() => {
        if (!open) return;

        const handleClickOutside = (event: MouseEvent) => {
            // Check if click is inside the trigger
            if (triggerRef.current && triggerRef.current.contains(event.target as Node)) {
                return;
            }
            // Check if click is inside the content
            if (contentRef.current && contentRef.current.contains(event.target as Node)) {
                return;
            }
            setOpen(false);
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [open, setOpen, triggerRef]);

    if (!open) return null;

    // Portal to Document Body
    return createPortal(
        <AnimatePresence>
            {open && (
                <motion.div
                    ref={contentRef}
                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                    transition={{ duration: 0.1 }}
                    style={{
                        top: position.top,
                        left: position.left,
                        position: 'absolute',
                        zIndex: 9999,
                        // Override alignment with transforms
                        transform: align === 'end' ? 'translateX(-100%)' : align === 'center' ? 'translateX(-50%)' : 'none'
                    }}
                    // Note: We move alignment classes to style transform logic above to be precise with absolute positioning
                    className={`min-w-[8rem] overflow-hidden rounded-md border border-zinc-800 bg-zinc-950 p-1 text-zinc-300 shadow-xl ${className}`}
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export const DropdownMenuItem: React.FC<{
    className?: string;
    children: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void
}> = ({ className = '', children, onClick }) => {
    const { setOpen } = useContext(DropdownMenuContext);

    return (
        <div
            className={`relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-zinc-800 hover:text-white data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${className}`}
            onClick={(e) => {
                e.stopPropagation(); // Stop propagation
                onClick?.(e);
                setOpen(false); // Close on item click
            }}
        >
            {children}
        </div>
    );
};

export const DropdownMenuLabel: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
    <div className={`px-2 py-1.5 text-sm font-semibold ${className}`}>
        {children}
    </div>
);

export const DropdownMenuSeparator: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`-mx-1 my-1 h-px bg-zinc-800 ${className}`} />
);
