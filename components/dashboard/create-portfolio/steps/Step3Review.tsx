
import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { PORTFOLIO_TYPES } from '../../../../constants/portfolio';

type PortfolioType = 'investments' | 'real_estate' | 'business' | 'custom';

// Mappers for display
const OBJECTIVE_LABELS: Record<string, string> = {
    'growth': 'Crescimento',
    'income': 'Renda',
    'protection': 'Proteção',
    'speculation': 'Alto Risco',
    'mixed': 'Misto'
};

const HORIZON_LABELS: Record<string, string> = {
    'short': 'Curto (< 2 anos)',
    'medium': 'Médio (2-5 anos)',
    'long': 'Longo (> 5 anos)'
};

interface PortfolioFormData {
  name?: string;
  currency: string;
  region?: string;
  location?: string;
  focus?: string;
  structure?: string;
  description?: string;
  customClass?: string;
  objective?: string;
  timeHorizon?: string;
}

export const Step3Review: React.FC<{ type: PortfolioType; data: PortfolioFormData }> = ({ type, data }) => {
  const typeInfo = PORTFOLIO_TYPES.find(t => t.id === type)!;

  return (
     <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
       <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Tudo pronto?</h2>
        <p className="text-zinc-400">Revise as informações antes de criar seu portfólio.</p>
      </div>

      <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-xl p-8 relative overflow-hidden">
        {/* Glow Effect */}
        <div className={`absolute top-0 right-0 w-64 h-64 blur-[100px] opacity-10 rounded-full ${typeInfo.bg.replace('/10', '')}`}></div>

        <div className="relative z-10 flex flex-col items-center text-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${typeInfo.bg} ${typeInfo.color}`}>
                <typeInfo.icon size={32} />
            </div>
            
            <h3 className="text-3xl font-bold text-white mb-2">{data.name || 'Sem nome'}</h3>
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-300 mb-8">
                {typeInfo.title}
            </span>

            <div className="grid grid-cols-2 gap-x-12 gap-y-6 w-full max-w-sm text-left">
                {Object.entries(data).map(([key, value]) => {
                    // Skip technical fields or fields handled separately
                    if (key === 'name' || key === 'description' || key === 'objective' || key === 'timeHorizon') return null;
                    
                    // Format customClass key for display
                    const displayKey = key === 'customClass' ? 'Classificação' : key;
                    
                    return (
                        <div key={key}>
                            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{displayKey}</p>
                            <p className="text-white font-medium capitalize">{String(value)}</p>
                        </div>
                    );
                })}
                
                {/* Explicitly Render Strategic Fields */}
                <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Objetivo</p>
                    <p className="text-white font-medium capitalize">
                        {OBJECTIVE_LABELS[data.objective] || data.objective}
                    </p>
                </div>
                <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Horizonte</p>
                    <p className="text-white font-medium capitalize">
                        {HORIZON_LABELS[data.timeHorizon] || data.timeHorizon}
                    </p>
                </div>
            </div>
        </div>
      </div>

      <div className="flex items-start gap-3 p-4 bg-amber-500/5 border border-amber-500/10 rounded-lg text-sm text-amber-500/80">
        <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
        <p>Após a criação, você será redirecionado para adicionar os ativos específicos e começar a acompanhar a evolução.</p>
      </div>
    </motion.div>
  );
};