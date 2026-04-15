
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Save, Tag, FileText, LayoutTemplate, Target, Clock } from 'lucide-react';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { Portfolio, PortfolioObjective, PortfolioTimeHorizon } from '../../../../types';

interface PortfolioSettingsModalProps {
    portfolio: Portfolio;
    onClose: () => void;
    onSave: (updates: Partial<Portfolio>) => void;
}

export const PortfolioSettingsModal: React.FC<PortfolioSettingsModalProps> = ({ 
    portfolio, onClose, onSave 
}) => {
    const [name, setName] = useState(portfolio.name);
    const [customClass, setCustomClass] = useState(portfolio.customClass || '');
    const [description, setDescription] = useState(portfolio.description || '');
    const [objective, setObjective] = useState<PortfolioObjective>(portfolio.objective || 'growth');
    const [timeHorizon, setTimeHorizon] = useState<PortfolioTimeHorizon>(portfolio.timeHorizon || 'long');

    const handleSave = () => {
        if (!name.trim()) return;
        
        onSave({
            name,
            customClass,
            description,
            objective,
            timeHorizon
        });
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto"
            >
                <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                    <div>
                        <h3 className="text-white font-bold text-lg">Configurações do Portfólio</h3>
                        <p className="text-zinc-500 text-xs mt-1">Edite as informações principais.</p>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                        <X size={20}/>
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    <Input 
                        label="Nome do Portfólio" 
                        icon={<LayoutTemplate size={16} />}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex: Reserva de Valor"
                    />

                    <div>
                        <Input 
                            label="Classificação / Tag" 
                            icon={<Tag size={16} />}
                            value={customClass}
                            onChange={(e) => setCustomClass(e.target.value)}
                            placeholder="Ex: Risco Alto, Curto Prazo..."
                        />
                        <p className="text-[10px] text-zinc-500 mt-1.5 ml-1">
                            Usado para agrupar este portfólio nos gráficos globais.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 pt-2 pb-2 border-y border-zinc-800/50">
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1 flex items-center gap-1">
                                <Target size={12} /> Objetivo Principal
                            </label>
                            <select 
                                className="w-full bg-zinc-900/50 text-white border border-zinc-800 rounded-lg py-2.5 px-4 focus:outline-none focus:border-amber-500 transition-all text-sm appearance-none cursor-pointer"
                                value={objective}
                                onChange={(e) => setObjective(e.target.value as PortfolioObjective)}
                            >
                                <option value="growth">Crescimento Patrimonial</option>
                                <option value="income">Geração de Renda</option>
                                <option value="protection">Proteção / Estabilidade</option>
                                <option value="speculation">Especulação / Alto Risco</option>
                                <option value="mixed">Misto / Equilibrado</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1 flex items-center gap-1">
                                <Clock size={12} /> Horizonte de Tempo
                            </label>
                            <select 
                                className="w-full bg-zinc-900/50 text-white border border-zinc-800 rounded-lg py-2.5 px-4 focus:outline-none focus:border-amber-500 transition-all text-sm appearance-none cursor-pointer"
                                value={timeHorizon}
                                onChange={(e) => setTimeHorizon(e.target.value as PortfolioTimeHorizon)}
                            >
                                <option value="short">Curto Prazo (até 2 anos)</option>
                                <option value="medium">Médio Prazo (2–5 anos)</option>
                                <option value="long">Longo Prazo (5+ anos)</option>
                            </select>
                        </div>
                    </div>

                    <div className="relative group">
                        <div className="flex items-center gap-2 mb-1.5 ml-1">
                            <FileText size={12} className="text-zinc-500" />
                            <label className="block text-xs font-medium text-zinc-400 transition-colors duration-300 group-focus-within:text-amber-500">
                                Descrição
                            </label>
                        </div>
                        <div className="relative">
                            <textarea 
                                className="w-full bg-zinc-900/50 text-white placeholder-zinc-600 border border-zinc-800 rounded-lg py-3 px-4 focus:outline-none focus:bg-zinc-900 transition-all duration-300 min-h-[100px] resize-none focus:shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                                placeholder="Qual o objetivo deste portfólio?" 
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                maxLength={130}
                            />
                            {/* Animated Border Effects */}
                            <div className="absolute inset-0 rounded-lg pointer-events-none transition-all duration-500 ease-out border border-transparent group-focus-within:border-amber-500/50" />
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] bg-amber-500 transition-all duration-300 ease-out w-0 group-focus-within:w-full" />
                            
                            <div className="absolute bottom-2 right-3 text-[10px] text-zinc-600 font-mono">
                                {description.length}/130
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-zinc-800 bg-zinc-950/50 rounded-b-xl flex justify-end gap-3 mt-auto">
                    <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={!name.trim()}>
                        <Save size={16} className="mr-2" /> Salvar Alterações
                    </Button>
                </div>
            </motion.div>
        </div>
    );
};