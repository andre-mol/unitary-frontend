/**
 * AllocationDetailsModal - Modal showing detailed allocation breakdown
 * Displays full pie chart with legend and category list with values and percentages
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, PieChart as PieChartIcon } from 'lucide-react';
import { 
    ResponsiveContainer, 
    PieChart, 
    Pie, 
    Cell, 
    Tooltip, 
    Legend 
} from 'recharts';
import { formatCurrency } from '../../../utils/formatters';

interface AllocationData {
    name: string;
    value: number;
    color: string;
}

interface AllocationDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    allocationData: AllocationData[];
    totalValue: number;
}

export const AllocationDetailsModal: React.FC<AllocationDetailsModalProps> = ({
    isOpen,
    onClose,
    allocationData,
    totalValue
}) => {
    // Handle ESC key to close modal
    useEffect(() => {
        if (!isOpen) return;
        
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Calculate percentages
    const dataWithPercentages = allocationData.map(item => ({
        ...item,
        percentage: totalValue > 0 ? (item.value / totalValue) * 100 : 0
    }));

    // Sort by value descending
    const sortedData = [...dataWithPercentages].sort((a, b) => b.value - a.value);

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg shadow-xl">
                    <p className="text-white font-bold text-sm mb-1">{data.name}</p>
                    <p className="text-zinc-300 text-xs">
                        Valor: <span className="font-mono font-bold text-white">{formatCurrency(data.value, 'BRL')}</span>
                    </p>
                    <p className="text-zinc-400 text-xs">
                        {data.percentage.toFixed(2)}% do total
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
                    />
                    
                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed inset-0 z-[70] flex items-center justify-center p-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
                            {/* Header */}
                            <div className="flex justify-between items-center p-6 border-b border-zinc-800">
                                <div className="flex items-center gap-3">
                                    <PieChartIcon size={24} className="text-amber-500" />
                                    <div>
                                        <h3 className="text-white font-bold text-lg">Alocação Detalhada</h3>
                                        <p className="text-zinc-500 text-xs mt-1">
                                            Distribuição completa por categoria
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={onClose} 
                                    className="text-zinc-500 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50 rounded p-1"
                                    aria-label="Fechar"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6">
                                {allocationData.length === 0 ? (
                                    <div className="text-center py-12">
                                        <PieChartIcon size={48} className="mx-auto mb-4 text-zinc-700 opacity-50" />
                                        <p className="text-zinc-500 text-sm">Nenhum dado de alocação disponível</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {/* Chart Section */}
                                        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6">
                                            <h4 className="text-white font-semibold text-sm mb-4">Distribuição Visual</h4>
                                            <div className="h-[300px] w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            data={allocationData}
                                                            cx="50%"
                                                            cy="50%"
                                                            innerRadius={80}
                                                            outerRadius={120}
                                                            paddingAngle={2}
                                                            dataKey="value"
                                                            stroke="none"
                                                        >
                                                            {allocationData.map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip content={<CustomTooltip />} />
                                                        <Legend 
                                                            wrapperStyle={{ paddingTop: '20px' }}
                                                            formatter={(value) => <span className="text-zinc-300 text-xs">{value}</span>}
                                                        />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>

                                        {/* List Section */}
                                        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6">
                                            <h4 className="text-white font-semibold text-sm mb-4">Breakdown por Categoria</h4>
                                            <div className="space-y-3">
                                                {sortedData.map((item, index) => (
                                                    <div 
                                                        key={index}
                                                        className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800/50 hover:border-zinc-700 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                                            <div 
                                                                className="w-4 h-4 rounded-full flex-shrink-0" 
                                                                style={{ backgroundColor: item.color }}
                                                            />
                                                            <span className="text-white font-medium text-sm truncate">
                                                                {item.name}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                                                            <div className="text-right">
                                                                <p className="text-white font-mono font-bold text-sm">
                                                                    {formatCurrency(item.value, 'BRL')}
                                                                </p>
                                                                <p className="text-zinc-500 text-xs">
                                                                    {item.percentage.toFixed(2)}%
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            
                                            {/* Total */}
                                            <div className="mt-4 pt-4 border-t border-zinc-800">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-zinc-400 font-semibold text-sm">Total</span>
                                                    <span className="text-white font-mono font-bold text-lg">
                                                        {formatCurrency(totalValue, 'BRL')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
