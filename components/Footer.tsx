import React from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { FadeInScale } from './ui/Motion';
import { Mail, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { brand } from '../config/brand';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-zinc-950 border-t border-zinc-900 pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Final CTA */}
        <FadeInScale className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 rounded-3xl p-8 md:p-16 text-center mb-20 relative overflow-hidden group">
            <div className="relative z-10">
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                    Assuma o controle total.
                </h2>
                <p className="text-zinc-400 text-lg max-w-2xl mx-auto mb-10">
                    Pare de gerenciar seu patrimônio no escuro. Comece hoje a construir um futuro com clareza, dados e estratégia.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <Link to="/cadastro">
                        <Button size="lg" className="w-full sm:w-auto">Criar Conta Gratuitamente</Button>
                    </Link>
                </div>
                <p className="mt-6 text-xs text-zinc-500">Sem cartão de crédito necessário para começar.</p>
            </div>
             {/* Decorative glow */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-amber-500/10 blur-[100px] rounded-full pointer-events-none transition-all duration-700 group-hover:bg-amber-500/15"></div>
        </FadeInScale>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 border-b border-zinc-900 pb-12">
            <div className="col-span-1 md:col-span-1">
                <img 
                  src="/assets/logos/logo-landing.svg" 
                  alt={`${brand.name} Logo`}
                  className="h-8 w-auto mb-4"
                />
                <p className="mt-4 text-zinc-500 text-sm mb-6">
                    Gestão patrimonial inteligente para quem pensa no longo prazo.
                </p>
                
                {/* Newsletter Input Demo */}
                <div className="space-y-2">
                    <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Fique atualizado</p>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <Input 
                                placeholder="Seu e-mail profissional" 
                                icon={<Mail size={16} />}
                                className="w-full"
                            />
                        </div>
                        <Button size="sm" variant="secondary" className="px-3">
                            <ArrowRight size={16} />
                        </Button>
                    </div>
                </div>
            </div>
            
            <div>
                <h4 className="text-white font-semibold mb-4">Produto</h4>
                <ul className="space-y-2 text-sm text-zinc-400">
                    <li><a href="#" className="hover:text-amber-500 hover:pl-1 transition-all duration-300">Recursos</a></li>
                    <li><a href="#" className="hover:text-amber-500 hover:pl-1 transition-all duration-300">Preços</a></li>
                    <li><a href="#" className="hover:text-amber-500 hover:pl-1 transition-all duration-300">Segurança</a></li>
                    <li><a href="#" className="hover:text-amber-500 hover:pl-1 transition-all duration-300">Roadmap</a></li>
                </ul>
            </div>

            <div>
                <h4 className="text-white font-semibold mb-4">Empresa</h4>
                <ul className="space-y-2 text-sm text-zinc-400">
                    <li><a href="#" className="hover:text-amber-500 hover:pl-1 transition-all duration-300">Sobre Nós</a></li>
                    <li><a href="#" className="hover:text-amber-500 hover:pl-1 transition-all duration-300">Manifesto</a></li>
                    <li><a href="#" className="hover:text-amber-500 hover:pl-1 transition-all duration-300">Contato</a></li>
                </ul>
            </div>

            <div>
                 <h4 className="text-white font-semibold mb-4">Legal</h4>
                <ul className="space-y-2 text-sm text-zinc-400">
                    <li><Link to="/terms" className="hover:text-amber-500 hover:pl-1 transition-all duration-300">Termos de Uso</Link></li>
                    <li><Link to="/privacy" className="hover:text-amber-500 hover:pl-1 transition-all duration-300">Privacidade</Link></li>
                    <li><Link to="/communications" className="hover:text-amber-500 hover:pl-1 transition-all duration-300">Comunicações</Link></li>
                </ul>
            </div>
        </div>

        <div className="pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-zinc-600">
            <p>&copy; {new Date().getFullYear()} {brand.name}. Todos os direitos reservados.</p>
            <div className="mt-4 md:mt-0 flex gap-2">
                <span className="bg-zinc-900 border border-zinc-800 px-2 py-1 rounded cursor-default hover:border-zinc-700 transition-colors duration-300">Não somos um banco</span>
                <span className="bg-zinc-900 border border-zinc-800 px-2 py-1 rounded cursor-default hover:border-zinc-700 transition-colors duration-300">Não somos uma corretora</span>
            </div>
        </div>
      </div>
    </footer>
  );
};
