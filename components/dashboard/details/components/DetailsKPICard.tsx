
import React from 'react';
import { TrendingUp } from 'lucide-react';

export const DetailsKPICard: React.FC<{ 
    title: string; 
    value: string; 
    valueColor?: string; // New prop for manual color override
    trend?: number; 
    icon?: React.ReactNode; 
}> = ({ title, value, valueColor, trend, icon }) => (
  <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-xl flex flex-col justify-between hover:border-zinc-700 transition-all duration-300 h-full group min-h-[110px]">
    <div className="flex justify-between items-start mb-2">
      <span className="text-zinc-500 text-[11px] uppercase font-bold tracking-wider">{title}</span>
      <div className="text-zinc-600 group-hover:text-zinc-400 transition-colors bg-zinc-900/50 p-1.5 rounded-lg border border-zinc-900/50">
        {icon || <TrendingUp size={16} />}
      </div>
    </div>
    
    <div>
      <div className={`text-2xl font-mono font-medium tracking-tight leading-none mb-2 ${valueColor || 'text-white'}`}>{value}</div>
      
      {trend !== undefined && trend !== 0 ? (
        <div className="flex items-center gap-1.5">
             <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md ${trend > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'}`}>
                {trend > 0 ? '+' : ''}{trend.toFixed(2)}%
              </span>
              <span className="text-[10px] text-zinc-600 font-medium">vs. custo</span>
        </div>
      ) : (
         /* Spacer to keep 'value' alignment consistent with cards that have trends */
         <div className="h-[21px]"></div> 
      )}
    </div>
  </div>
);
