import React from 'react';
import { DashboardLayout } from './DashboardLayout';
import { Construction, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/Button';
import { Link } from 'react-router-dom';
import { brand } from '../../config/brand';

interface GenericPlaceholderPageProps {
  title: string;
  subtitle: string;
  category?: string;
}

export const GenericPlaceholderPage: React.FC<GenericPlaceholderPageProps> = ({ title, subtitle, category }) => {
  return (
    <DashboardLayout title={title} subtitle={category || "Em Desenvolvimento"}>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 animate-in fade-in zoom-in-95 duration-500">
        <div className="w-20 h-20 bg-zinc-900/50 border border-zinc-800 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_-10px_rgba(245,158,11,0.1)]">
          <Construction className="text-amber-500 opacity-80" size={40} />
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-3">{title}</h2>
        <p className="text-zinc-400 max-w-md text-lg mb-8 leading-relaxed">
          {subtitle}
        </p>
        
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 max-w-lg w-full mb-8">
          <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-2">Status do Desenvolvimento</p>
          <div className="flex items-center gap-3">
            <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
            <span className="text-sm text-zinc-300">Esta ferramenta fará parte do MVP do {brand.name}.</span>
          </div>
        </div>

        <Link to="/dashboard">
          <Button variant="secondary">
            <ArrowLeft size={16} className="mr-2" />
            Voltar ao Dashboard
          </Button>
        </Link>
      </div>
    </DashboardLayout>
  );
};
