import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '../../../ui/dialog';
import { Button } from '../../../ui/Button';
import { Settings, Save } from 'lucide-react';
import { CustomItem } from '../../../../types';

// Define available columns for Standard Assets (Non-RE, Non-Business)
// Since RE/Business schemas are fixed/distinct, we primarily support toggling for standard assets first 
// as implies by the "editar colunas" requirement usually targeting the complex main table.
export type ColumnKey =
    | 'quantity'
    | 'avgPrice'
    | 'currentPrice'
    | 'variation'
    | 'totalReturn'
    | 'totalValue'
    | 'score'
    | 'idealPct'
    | 'portfolioPct';

interface ColumnDef {
    key: ColumnKey;
    label: string;
}

const AVAILABLE_COLUMNS: ColumnDef[] = [
    { key: 'quantity', label: 'Quantidade' },
    { key: 'currentPrice', label: 'Preco Atual' },
    { key: 'avgPrice', label: 'Preço Médio' },
    { key: 'variation', label: 'Variação (R$ / %)' },
    { key: 'totalReturn', label: 'Retorno Total / TRI' },
    { key: 'totalValue', label: 'Valor Total' },
    { key: 'score', label: 'Nota Convicção' },
    { key: 'idealPct', label: '% Ideal' },
    { key: 'portfolioPct', label: '% Carteira' },
];

interface EditColumnsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    portfolioId: string; // Used for scoping persistence
    category: string;    // Used for scoping persistence
    onSave: (visibleColumns: Set<ColumnKey>) => void;
    initialColumns?: Set<ColumnKey>;
}

export const EditColumnsDialog: React.FC<EditColumnsDialogProps> = ({
    isOpen,
    onClose,
    portfolioId,
    category,
    onSave,
    initialColumns
}) => {
    // Default all visible if nothing passed
    const [selected, setSelected] = useState<Set<ColumnKey>>(
        initialColumns || new Set(AVAILABLE_COLUMNS.map(c => c.key))
    );

    // Load from local storage on mount (or when id changes)
    useEffect(() => {
        if (!isOpen) return;

        // AIDEV-NOTE: Column visibility persistence key format:
        // user_prefs_columns_{portfolioId}_{category}
        const key = `user_prefs_columns_${portfolioId}_${category}`;
        const stored = localStorage.getItem(key);

        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    setSelected(new Set(parsed as ColumnKey[]));
                }
            } catch (e) {
                console.error("Failed to parse stored columns", e);
            }
        }
    }, [isOpen, portfolioId, category]);

    const toggle = (key: ColumnKey) => {
        const next = new Set(selected);
        if (next.has(key)) {
            next.delete(key);
        } else {
            next.add(key);
        }
        setSelected(next);
    };

    const handleSave = () => {
        const key = `user_prefs_columns_${portfolioId}_${category}`;
        const array = Array.from(selected);
        localStorage.setItem(key, JSON.stringify(array));

        onSave(selected);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
            <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 mb-2">
                        <Settings size={18} className="text-zinc-400" />
                        Editar Colunas
                    </DialogTitle>
                </DialogHeader>

                <div className="py-4 space-y-3">
                    <p className="text-xs text-zinc-500 mb-4">
                        Selecione as colunas que deseja visualizar para a categoria <span className="text-zinc-300 font-bold">{category}</span>.
                    </p>

                    <div className="grid grid-cols-1 gap-2">
                        {AVAILABLE_COLUMNS.map((col) => {
                            const isChecked = selected.has(col.key);
                            return (
                                <label
                                    key={col.key}
                                    className="flex items-center gap-3 p-2 rounded-lg bg-zinc-900/50 hover:bg-zinc-900 cursor-pointer border border-transparent hover:border-zinc-800 transition-colors"
                                >
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isChecked ? 'bg-amber-500 border-amber-500 text-black' : 'border-zinc-600 bg-transparent'}`}>
                                        {isChecked && <div className="w-1.5 h-1.5 bg-black rounded-sm" />}
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={isChecked}
                                        onChange={() => toggle(col.key)}
                                    />
                                    <span className={`text-sm ${isChecked ? 'text-zinc-200' : 'text-zinc-500'}`}>
                                        {col.label}
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
                    <Button variant="primary" size="sm" onClick={handleSave} className="gap-2">
                        <Save size={14} /> Salvar Preferências
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
