import React from 'react';
import { Building2, TrendingUp, Briefcase, Landmark, Wallet, CreditCard } from 'lucide-react';
import { FadeIn, StaggerContainer } from './ui/Motion';
import { motion } from 'framer-motion';
import { brand } from '../config/brand';

const AssetCard: React.FC<{ icon: React.ReactNode; title: string; items: string[] }> = ({ icon, title, items }) => (
    <motion.div 
        variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
            hover: { 
                y: -8,
                backgroundColor: "rgba(39, 39, 42, 0.6)", // zinc-800 with opacity
                borderColor: "rgba(245, 158, 11, 0.5)", // amber-500 with opacity
                boxShadow: "0 20px 40px -10px rgba(0,0,0,0.5)"
            }
        }}
        whileHover="hover"
        className="group relative bg-zinc-900 border border-zinc-800 rounded-xl p-6 cursor-default transition-colors"
    >
        <div className="relative z-10">
            <motion.div 
                className="absolute top-0 right-0 text-amber-500"
                variants={{
                    hidden: { opacity: 0, y: 5 },
                    visible: { opacity: 0, y: 5 },
                    hover: { opacity: 1, y: 0 }
                }}
                transition={{ duration: 0.3 }}
            >
                <TrendingUp size={20} />
            </motion.div>

            <motion.div 
                className="w-12 h-12 rounded-lg bg-zinc-950 flex items-center justify-center text-zinc-300 mb-6 border border-zinc-800"
                variants={{
                    visible: { scale: 1, color: "rgb(212 212 216)", borderColor: "rgb(39 39 42)" }, // defaults
                    hover: { 
                        scale: 1.05, 
                        color: "#f59e0b", // Amber-500
                        borderColor: "rgba(245, 158, 11, 0.3)" 
                    }
                }}
                transition={{ duration: 0.3 }}
            >
                {icon}
            </motion.div>

            <h3 className="text-xl font-bold text-white mb-4">{title}</h3>
            
            <ul className="space-y-2">
                {items.map((item, idx) => (
                    <li key={idx} className="flex items-center text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors duration-300">
                        <span className="w-1 h-1 rounded-full bg-zinc-600 mr-2 group-hover:bg-amber-500 transition-colors duration-300"></span>
                        {item}
                    </li>
                ))}
            </ul>
        </div>
    </motion.div>
);

export const AssetGrid: React.FC = () => {
  return (
    <section className="py-24 bg-black" id="recursos">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                Gerencie <span className="text-amber-500">tudo</span> o que você possui.
            </h2>
            <p className="text-zinc-400 text-lg max-w-3xl">
                O {brand.name} não se limita ao mercado financeiro. Nosso sistema foi desenhado para comportar a complexidade da vida real.
            </p>
        </FadeIn>

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-10 gap-x-6">
            <AssetCard 
                icon={<TrendingUp size={24} />}
                title="Investimentos"
                items={["Ações & Stocks", "Fundos de Investimento", "Renda Fixa & Tesouro", "Criptoativos"]}
            />
            <AssetCard 
                icon={<Building2 size={24} />}
                title="Imóveis"
                items={["Residenciais & Comerciais", "Terrenos", "Fundos Imobiliários (FIIs)", "Recebimento de Aluguéis"]}
            />
            <AssetCard 
                icon={<Briefcase size={24} />}
                title="Empresas"
                items={["Participações Societárias", "Valuation de Negócios", "Equity Privado", "Investidor Anjo"]}
            />
            <AssetCard 
                icon={<Wallet size={24} />}
                title="Caixa & Reservas"
                items={["Contas Correntes", "Reservas de Emergência", "Moedas Estrangeiras", "Caixa Físico"]}
            />
            <AssetCard 
                icon={<Landmark size={24} />}
                title="Fontes de Renda"
                items={["Salários & Pro-labore", "Distribuição de Lucros", "Royalties", "Direitos Autorais"]}
            />
            <AssetCard 
                icon={<CreditCard size={24} />}
                title="Dívidas & Obrigações"
                items={["Financiamentos", "Empréstimos", "Contas a Pagar", "Passivos Fiscais"]}
            />
        </StaggerContainer>
      </div>
    </section>
  );
};
