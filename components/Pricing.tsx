import React from 'react';
import { FadeIn } from './ui/Motion';
import { PricingPlans } from './pricing/PricingPlans';
import { ShieldCheck, Zap } from 'lucide-react';
import { Button } from './ui/Button';
import { Link } from 'react-router-dom';
import { brand } from '../config/brand';

export const Pricing: React.FC = () => {
  return (
    <div className="pt-24 pb-24 min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <FadeIn>
          <PricingPlans isPublic={true} />
        </FadeIn>

        {/* Transparency Note - Kept from original */}
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8 border-t border-zinc-900 pt-16 mt-16">
          <div className="flex gap-4">
            <div className="bg-zinc-900 p-3 rounded-lg h-fit border border-zinc-800">
              <ShieldCheck className="text-zinc-400" size={24} />
            </div>
            <div>
              <h4 className="text-white font-bold mb-2">Transparência Total</h4>
              <p className="text-zinc-400 text-sm leading-relaxed">
                O {brand.name} <strong>não é um banco nem uma corretora</strong>. Nós não tocamos no seu dinheiro, não fazemos investimentos por você e não vendemos seus dados para terceiros. Somos uma ferramenta de inteligência pura.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="bg-zinc-900 p-3 rounded-lg h-fit border border-zinc-800">
              <Zap className="text-zinc-400" size={24} />
            </div>
            <div>
              <h4 className="text-white font-bold mb-2">Liberdade de Escolha</h4>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Você pode cancelar, atualizar ou alterar seu plano a qualquer momento. Seus dados podem ser exportados se decidir sair. Você mantém o controle total sobre suas informações.
              </p>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="mt-24 text-center">
          <h2 className="text-2xl font-bold text-white mb-6">Comece a organizar seu patrimônio hoje.</h2>
          <div className="flex flex-col items-center gap-4">
            <Link to="/cadastro">
              <Button size="lg" variant="primary">Criar conta gratuitamente</Button>
            </Link>
            <p className="text-zinc-500 text-xs">Você pode evoluir de plano a qualquer momento.</p>
          </div>
        </div>

      </div>
    </div>
  );
};

