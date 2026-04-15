
import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  trend: number;
  icon: React.ReactNode;
  highlight?: boolean;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, trend, icon, highlight, onClick }) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`p-6 rounded-xl border flex flex-col justify-between h-full relative overflow-hidden group ${
        highlight 
          ? 'bg-gradient-to-br from-zinc-900 to-zinc-950 border-amber-500/30' 
          : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'
      } ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-amber-500/50 transition-all' : ''}`}
    >
    {highlight && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-[60px] rounded-full pointer-events-none group-hover:bg-amber-500/10 transition-colors duration-500"></div>
    )}

    <div className="flex justify-between items-start mb-4 relative z-10">
      <span className="text-zinc-500 text-sm font-medium">{title}</span>
      <div className={`p-2 rounded-lg ${highlight ? 'bg-amber-500/10 text-amber-500' : 'bg-zinc-800 text-zinc-400'}`}>
        {icon}
      </div>
    </div>
    
    <div className="relative z-10">
      <h3 className="text-2xl md:text-3xl font-bold text-white mb-2 tracking-tight">{value}</h3>
      <div className="flex items-center gap-2 text-sm">
        <span className={`flex items-center font-medium ${trend >= 0 ? 'text-amber-500' : 'text-red-500'}`}>
          {trend >= 0 ? <ArrowUpRight size={16} className="mr-1" /> : <ArrowDownRight size={16} className="mr-1" />}
          {Math.abs(trend).toFixed(2)}%
        </span>
        <span className="text-zinc-600">vs. mês anterior</span>
      </div>
    </div>
  </motion.div>
  );
};
