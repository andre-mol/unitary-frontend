import React from 'react';
import { User, Briefcase, TrendingUp } from 'lucide-react';
import { FadeIn, StaggerContainer } from './ui/Motion';
import { motion } from 'framer-motion';
import { brand } from '../config/brand';

const Profile: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({ icon, title, description }) => (
    <motion.div
        variants={{
            hidden: { opacity: 0, scale: 0.9, y: 30 },
            visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 50, damping: 20 } },
            hover: { y: -8 }
        }}
        whileHover="hover"
        className="group flex flex-col items-center text-center p-6 rounded-2xl transition-colors duration-500 hover:bg-zinc-900/40 border border-transparent hover:border-zinc-800/60 cursor-default"
    >
        <motion.div
            className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 mb-6 relative"
            variants={{
                hover: {
                    scale: 1.1,
                    color: "#f59e0b", // Amber-500
                    borderColor: "rgba(245, 158, 11, 0.5)",
                    boxShadow: "0 0 25px -5px rgba(245, 158, 11, 0.4)",
                    backgroundColor: "#09090b"
                }
            }}
            transition={{ duration: 0.3 }}
        >
            {icon}
        </motion.div>

        <h3 className="text-lg font-bold text-white mb-3 group-hover:text-amber-500 transition-colors duration-300">
            {title}
        </h3>
        
        <p className="text-zinc-400 text-sm max-w-xs group-hover:text-zinc-200 transition-colors duration-300">
            {description}
        </p>
    </motion.div>
);

export const Audience: React.FC = () => {
  return (
    <section className="py-24 bg-black border-t border-zinc-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Para quem construímos o {brand.name}?</h2>
            <p className="text-zinc-400 text-lg">
                Não é para day-traders. Não é para quem busca atalhos.
            </p>
        </FadeIn>

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Profile 
                icon={<TrendingUp size={32} />}
                title="Investidores de Longo Prazo"
                description="Que entendem que a verdadeira riqueza é construída com consistência, diversificação e tempo."
            />
            <Profile 
                icon={<Briefcase size={32} />}
                title="Empreendedores"
                description="Cujo patrimônio pessoal se mistura com o negócio e precisam de clareza para separar as entidades."
            />
            <Profile 
                icon={<User size={32} />}
                title="Construtores de Patrimônio"
                description="Pessoas focadas em acumulação e proteção de capital, que valorizam visão estratégica sobre 'dicas quentes'."
            />
        </StaggerContainer>
      </div>
    </section>
  );
};
