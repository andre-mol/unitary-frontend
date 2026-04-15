
import React from 'react';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { PORTFOLIO_TYPES } from '../../../../constants/portfolio';

export const SelectionCard: React.FC<{ 
  item: typeof PORTFOLIO_TYPES[0]; 
  isSelected: boolean; 
  onClick: () => void 
}> = ({ item, isSelected, onClick }) => (
  <div 
    onClick={onClick}
    className={`group relative p-6 rounded-xl border cursor-pointer transition-all duration-300 ${
      isSelected 
        ? 'bg-zinc-900 border-amber-500 shadow-[0_0_20px_-5px_rgba(245,158,11,0.2)]' 
        : 'bg-zinc-900/30 border-zinc-800 hover:bg-zinc-900/60 hover:border-zinc-700'
    }`}
  >
    <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 transition-colors ${isSelected ? 'bg-amber-500/20 text-amber-500' : 'bg-zinc-800 text-zinc-400 group-hover:text-zinc-200'}`}>
      <item.icon size={24} />
    </div>

    {/* Indicator: Checkmark if selected, Chevron if available */}
    <div className="absolute top-6 right-6 transition-transform duration-300 group-hover:translate-x-1">
        {isSelected ? (
            <CheckCircle2 className="text-amber-500" size={22} />
        ) : (
            <ChevronRight className="text-zinc-600 group-hover:text-zinc-400" size={22} />
        )}
    </div>

    <div className="flex justify-between items-start">
      <div className="pr-8">
        <h3 className={`font-semibold mb-1 transition-colors ${isSelected ? 'text-white' : 'text-zinc-300 group-hover:text-white'}`}>
          {item.title}
        </h3>
        <p className="text-sm text-zinc-500 leading-relaxed group-hover:text-zinc-400 transition-colors">
          {item.description}
        </p>
      </div>
    </div>
  </div>
);
