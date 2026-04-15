
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '../../../ui/Input';
import { Globe, MapPin, Tag, Target, Clock, ChevronDown } from 'lucide-react';
import { CURRENCY_OPTIONS, PORTFOLIO_TYPES } from '../../../../constants/portfolio';
import type { PortfolioObjective, PortfolioTimeHorizon } from '../../../../types';

type PortfolioType = 'investments' | 'real_estate' | 'business' | 'custom';

interface PortfolioFormData {
  name?: string;
  currency: string;
  region?: string;
  location?: string;
  focus?: string;
  structure?: string;
  description?: string;
  customClass?: string;
  objective?: PortfolioObjective;
  timeHorizon?: PortfolioTimeHorizon;
}

export const Step2Configuration: React.FC<{ 
  type: PortfolioType; 
  data: PortfolioFormData; 
  onChange: (key: keyof PortfolioFormData, value: string) => void 
}> = ({ type, data, onChange }) => {
  
  const renderFields = () => {
    switch(type) {
      case 'investments':
        return (
          <div className="space-y-6">
            <Input 
              label="Nome do Portfólio" 
              placeholder="Ex: Investimentos Pessoais" 
              value={data.name || ''}
              onChange={(e) => onChange('name', e.target.value)}
              autoFocus
            />
            
            <div className="space-y-3">
              <label className="text-xs font-medium text-zinc-400 ml-1">Região Principal</label>
              <div className="grid grid-cols-2 gap-3">
                {['Brasil', 'Exterior'].map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                        onChange('region', opt);
                        // Reset location if switching back to Brasil, or keep it empty for Exterior to fill
                        if (opt === 'Brasil') onChange('location', ''); 
                    }}
                    className={`px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                      data.region === opt 
                        ? 'bg-amber-500/10 border-amber-500 text-amber-500' 
                        : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <Globe size={16} className="inline-block mr-2 mb-0.5" />
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Conditional Input for Exterior Location */}
            <AnimatePresence>
                {data.region === 'Exterior' && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="pt-1">
                            <Input 
                                label="Localização do Investimento" 
                                placeholder="Ex: EUA, Europa, Global" 
                                icon={<MapPin size={16} />}
                                value={data.location || ''}
                                onChange={(e) => onChange('location', e.target.value)}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="space-y-3">
               <label className="text-xs font-medium text-zinc-400 ml-1">Moeda Base</label>
               <div className="flex gap-4">
                  {CURRENCY_OPTIONS.map(opt => (
                    <label key={opt.code} className="flex items-center gap-2 cursor-pointer group">
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${data.currency === opt.code ? 'border-amber-500' : 'border-zinc-700 group-hover:border-zinc-500'}`}>
                        {data.currency === opt.code && <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />}
                      </div>
                      <span className={`text-sm ${data.currency === opt.code ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'}`}>{opt.label}</span>
                      <input 
                        type="radio" 
                        name="currency" 
                        className="hidden" 
                        checked={data.currency === opt.code} 
                        onChange={() => onChange('currency', opt.code)}
                      />
                    </label>
                  ))}
               </div>
               <p className="text-[10px] text-zinc-500 pl-1">
                   Todos os valores e históricos deste portfólio serão exibidos nesta moeda.
               </p>
            </div>
          </div>
        );
      
      case 'real_estate':
        return (
          <div className="space-y-6">
            <Input 
              label="Nome do Portfólio" 
              placeholder="Ex: Imóveis de Renda" 
              value={data.name || ''}
              onChange={(e) => onChange('name', e.target.value)}
              autoFocus
            />
             <div className="space-y-3">
              <label className="text-xs font-medium text-zinc-400 ml-1">Foco Principal</label>
              <div className="grid grid-cols-3 gap-3">
                {['Residencial', 'Comercial', 'Terrenos'].map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onChange('focus', opt)}
                    className={`px-3 py-3 rounded-lg border text-sm font-medium transition-all ${
                      data.focus === opt 
                        ? 'bg-blue-500/10 border-blue-500 text-blue-500' 
                        : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <Input 
              label="Localização Principal (Cidade/Estado)" 
              placeholder="Ex: São Paulo, SP" 
              icon={<MapPin size={16} />}
              value={data.location || ''}
              onChange={(e) => onChange('location', e.target.value)}
            />
          </div>
        );

      case 'business':
         return (
          <div className="space-y-6">
            <Input 
              label="Nome do Portfólio" 
              placeholder="Ex: Holding Familiar" 
              value={data.name || ''}
              onChange={(e) => onChange('name', e.target.value)}
              autoFocus
            />
             <div className="space-y-3">
              <label className="text-xs font-medium text-zinc-400 ml-1">Tipo de Estrutura</label>
              <div className="grid grid-cols-2 gap-3">
                {['Holding', 'Empresa Operacional', 'Participação', 'Equity'].map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onChange('structure', opt)}
                    className={`px-3 py-3 rounded-lg border text-sm font-medium transition-all ${
                      data.structure === opt 
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' 
                        : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      default: // Custom
        return (
          <div className="space-y-6">
            <Input 
              label="Nome do Portfólio" 
              placeholder="Ex: Reserva de Emergência" 
              value={data.name || ''}
              onChange={(e) => onChange('name', e.target.value)}
              autoFocus
            />

            <Input 
              label="Classificação do Portfólio" 
              placeholder="Ex: Cripto, Vinhos, Colecionáveis"
              value={data.customClass || ''}
              onChange={(e) => onChange('customClass', e.target.value)}
              icon={<Tag size={16} />}
            />
            <p className="text-[10px] text-zinc-500 -mt-4 pl-1">
                Isso definirá como este portfólio aparecerá no gráfico de alocação global.
            </p>
          </div>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
       <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Configurações Iniciais</h2>
        <p className="text-zinc-400">Defina os detalhes básicos para {PORTFOLIO_TYPES.find(t => t.id === type)?.title.toLowerCase()}.</p>
      </div>

      <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-6 md:p-8">
        {renderFields()}

        {/* --- STRATEGIC FIELDS (ALL TYPES) --- */}
        <div className="mt-8 pt-8 border-t border-zinc-800">
            <div className="flex items-center gap-2 mb-4">
                <Target size={16} className="text-amber-500" />
                <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wide">Estratégia do Portfólio</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1">Objetivo Principal</label>
                    <div className="relative">
                        <select 
                            className="w-full bg-zinc-900/50 text-white border border-zinc-800 rounded-lg py-3 px-4 pr-10 focus:outline-none focus:border-amber-500 transition-all appearance-none cursor-pointer"
                            value={data.objective || 'growth'}
                            onChange={(e) => onChange('objective', e.target.value)}
                        >
                            <option value="growth">Crescimento Patrimonial</option>
                            <option value="income">Geração de Renda</option>
                            <option value="protection">Proteção / Estabilidade</option>
                            <option value="speculation">Especulação / Alto Risco</option>
                            <option value="mixed">Misto / Equilibrado</option>
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1 flex items-center gap-1">
                        Horizonte de Tempo
                    </label>
                    <div className="relative">
                        <select 
                            className="w-full bg-zinc-900/50 text-white border border-zinc-800 rounded-lg py-3 px-4 pr-10 focus:outline-none focus:border-amber-500 transition-all appearance-none cursor-pointer"
                            value={data.timeHorizon || 'long'}
                            onChange={(e) => onChange('timeHorizon', e.target.value)}
                        >
                            <option value="short">Curto Prazo (até 2 anos)</option>
                            <option value="medium">Médio Prazo (2–5 anos)</option>
                            <option value="long">Longo Prazo (5+ anos)</option>
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                    </div>
                </div>
            </div>
        </div>

        <div className="mt-6 pt-6 border-t border-zinc-800">
            {/* Custom Description Textarea with Character Limit */}
            <div className="relative group">
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1 transition-colors duration-300 group-focus-within:text-amber-500">
                    Descrição (Opcional)
                </label>
                <div className="relative">
                    <textarea 
                        className="w-full bg-zinc-900/50 text-white placeholder-zinc-600 border border-zinc-800 rounded-lg py-3 px-4 pb-6 focus:outline-none focus:bg-zinc-900 transition-all duration-300 min-h-[100px] resize-none focus:shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                        placeholder="Qual o objetivo deste portfólio?" 
                        value={data.description || ''}
                        onChange={(e) => {
                            if (e.target.value.length <= 130) {
                                onChange('description', e.target.value);
                            }
                        }}
                        maxLength={130}
                    />
                    
                    {/* Animated Border Effects similar to Input component */}
                    <div className="absolute inset-0 rounded-lg pointer-events-none transition-all duration-500 ease-out border border-transparent group-focus-within:border-amber-500/50" />
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] bg-amber-500 transition-all duration-300 ease-out w-0 group-focus-within:w-full" />
                    
                    {/* Character Counter */}
                    <div className="absolute bottom-2 right-3 text-[10px] text-zinc-500 font-mono font-medium pointer-events-none">
                        {(data.description || '').length}/130
                    </div>
                </div>
            </div>
        </div>
      </div>
    </motion.div>
  );
};
