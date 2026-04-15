import React from 'react';
import { ChevronLeft, ChevronRight, Calendar, Banknote } from 'lucide-react';

interface MonthSelectorProps {
    displayMonth: string;
    salary: string;
    onMonthChange: (offset: number) => void;
    onSalaryChange: (value: string) => void;
}

export const MonthSelector: React.FC<MonthSelectorProps> = ({
    displayMonth,
    salary,
    onMonthChange,
    onSalaryChange,
}) => {
    return (
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-zinc-900/30 border border-zinc-800 p-6 rounded-xl">
            <div className="flex items-center gap-4 bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                <button onClick={() => onMonthChange(-1)} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors">
                    <ChevronLeft size={20} />
                </button>
                <div className="flex items-center gap-2 min-w-[160px] justify-center">
                    <Calendar size={16} className="text-amber-500" />
                    <span className="text-lg font-bold text-white capitalize select-none">
                        {displayMonth}
                    </span>
                </div>
                <button onClick={() => onMonthChange(1)} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors">
                    <ChevronRight size={20} />
                </button>
            </div>

            <div className="flex-1 w-full md:max-w-md">
                <label className="block text-xs font-bold text-amber-500 uppercase mb-2 ml-1">
                    Salário Líquido Mensal (R$)
                </label>
                <div className="relative">
                    <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                    <input 
                        type="number" 
                        placeholder="0.00"
                        value={salary}
                        onChange={(e) => onSalaryChange(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 text-2xl font-mono text-white rounded-xl py-4 pl-12 pr-4 focus:outline-none focus:border-amber-500 transition-all placeholder-zinc-700"
                    />
                </div>
            </div>
        </div>
    );
};

