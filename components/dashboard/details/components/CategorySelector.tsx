
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Plus } from 'lucide-react';

export const CategorySelector = ({ value, onChange, categories, onAddCategory }: { value: string; onChange: (val: string) => void; categories: string[]; onAddCategory: (val: string) => void; }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const filtered = categories.filter(c => c.toLowerCase().includes((value || '').toLowerCase()) && c.toLowerCase() !== (value || '').toLowerCase());
    const isExactMatch = categories.some(c => c.toLowerCase() === (value || '').trim().toLowerCase());

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const handleSelect = (cat: string) => { onChange(cat); setIsOpen(false); };
    const handleAdd = () => { if (value && value.trim()) { onAddCategory(value.trim()); setIsOpen(false); } };

    return (
        <div className="relative group" ref={wrapperRef}>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1">Categoria</label>
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <input
                        type="text"
                        className="w-full bg-zinc-900/50 text-white border border-zinc-800 rounded-lg py-3 px-4 focus:outline-none focus:border-amber-500 transition-all placeholder-zinc-600"
                        placeholder="Selecione ou crie..."
                        value={value}
                        onChange={(e) => { onChange(e.target.value); setIsOpen(true); }}
                        onFocus={() => setIsOpen(true)}
                    />
                    <AnimatePresence>
                        {isOpen && (filtered.length > 0 || (value && !isExactMatch)) && (
                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute z-50 left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl max-h-60 overflow-y-auto custom-scrollbar overflow-hidden">
                                {filtered.length > 0 && filtered.map((cat) => (
                                    <button key={cat} className="w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors border-b border-zinc-800/30 last:border-0" onClick={() => handleSelect(cat)}>
                                        {cat}
                                    </button>
                                ))}
                                {value && !isExactMatch && (
                                    <button className="w-full text-left px-4 py-3 text-sm text-amber-500 hover:bg-amber-500/10 font-medium transition-colors flex items-center gap-2" onClick={handleAdd}>
                                        <Plus size={14} /> Criar nova: "{value}"
                                    </button>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                <button onClick={handleAdd} disabled={!value || isExactMatch} className={`p-3 rounded-lg border transition-all flex-shrink-0 ${value && !isExactMatch ? 'bg-amber-500 text-black border-amber-500 hover:bg-amber-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500 cursor-not-allowed opacity-50'}`}>
                    {isExactMatch ? <Check size={20} /> : <Plus size={20} />}
                </button>
            </div>
        </div>
    );
};
