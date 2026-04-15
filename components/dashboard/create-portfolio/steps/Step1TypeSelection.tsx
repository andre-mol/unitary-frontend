
import React from 'react';
import { motion } from 'framer-motion';
import { PORTFOLIO_TYPES } from '../../../../constants/portfolio';
import { SelectionCard } from '../components/SelectionCard';

type PortfolioType = 'investments' | 'real_estate' | 'business' | 'custom';

export const Step1TypeSelection: React.FC<{ 
  selectedType: PortfolioType | null; 
  onSelect: (type: PortfolioType) => void 
}> = ({ selectedType, onSelect }) => (
  <motion.div
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    className="space-y-6"
  >
    <div className="text-center mb-8">
      <h2 className="text-2xl font-bold text-white mb-2">Que tipo de portfólio você deseja criar?</h2>
      <p className="text-zinc-400">Escolha a estrutura principal do patrimônio que deseja organizar.</p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {PORTFOLIO_TYPES.map((type) => (
        <SelectionCard 
          key={type.id} 
          item={type} 
          isSelected={selectedType === type.id}
          onClick={() => onSelect(type.id as PortfolioType)}
        />
      ))}
    </div>
  </motion.div>
);
