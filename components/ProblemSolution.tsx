import React from 'react';
import { Layers, Eye, Compass, LayoutGrid, AlertTriangle, FileWarning, EyeOff } from 'lucide-react';
import { FadeIn, StaggerContainer } from './ui/Motion';
import { motion } from 'framer-motion';
import { brand } from '../config/brand';

// Enhanced Problem Card with Icon and Micro-interactions
const ProblemCard: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({ icon, title, description }) => (
    <motion.div 
        variants={{
            hidden: { opacity: 0, y: 20, scale: 0.96 },
            visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 50, damping: 20 } }
        }}
        whileHover={{ 
            y: -5, 
            borderColor: "rgba(245, 158, 11, 0.4)",
            backgroundColor: "rgba(24, 24, 27, 0.8)",
            boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)"
        }}
        className="group p-6 border border-zinc-900 bg-zinc-950/50 rounded-xl transition-all duration-300 cursor-default"
    >
        <div className="flex items-start gap-4">
            <motion.div 
                className="mt-1 text-zinc-600 group-hover:text-amber-500 transition-colors"
                variants={{
                    hover: { rotate: -10, scale: 1.1 }
                }}
                transition={{ type: "spring", stiffness: 300 }}
            >
                {icon}
            </motion.div>
            <div>
                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-amber-50 transition-colors">{title}</h3>
                <p className="text-zinc-400 leading-relaxed text-sm group-hover:text-zinc-300 transition-colors">{description}</p>
            </div>
        </div>
    </motion.div>
);

// Animated Feature Item for the 4 Pillars
const FeatureItem: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({ icon, title, description }) => (
    <motion.div 
        className="flex flex-col items-start"
        variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
        }}
    >
        <motion.div 
            className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-amber-500 mb-4 origin-left"
            variants={{
                hidden: { scale: 0, opacity: 0 },
                visible: { scale: 1, opacity: 1, transition: { type: "spring", stiffness: 200, damping: 20 } }
            }}
            whileHover={{ 
                scale: 1.1, 
                backgroundColor: "rgba(39, 39, 42, 1)", 
                borderColor: "rgba(245, 158, 11, 0.5)", 
                boxShadow: "0 0 20px -5px rgba(245, 158, 11, 0.4)"
            }}
        >
            {icon}
        </motion.div>
        
        <motion.div
            variants={{
                hidden: { opacity: 0, x: -10 },
                visible: { opacity: 1, x: 0, transition: { delay: 0.2, duration: 0.5 } }
            }}
        >
            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">{description}</p>
        </motion.div>
    </motion.div>
);

export const ProblemSolution: React.FC = () => {
  return (
    <>
        {/* Problem Section */}
        <section className="py-24 bg-black border-y border-zinc-900 overflow-hidden" id="problema">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    
                    {/* Left Side: Narrative Lateral Entrance */}
                    <motion.div 
                        initial={{ opacity: 0, x: -60 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                    >
                        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight">
                            A cegueira da <br/>
                            <span className="text-zinc-600">fragmentação</span>.
                        </h2>
                        <p className="text-zinc-400 text-lg mb-8 leading-relaxed border-l-2 border-zinc-800 pl-6">
                            Seu patrimônio está espalhado em corretoras, bancos, matrículas de imóveis e contratos sociais. <br/><br/>
                            <span className="text-zinc-200">Tomar decisões estratégicas sem ver o todo não é investir, é adivinhar.</span>
                        </p>
                    </motion.div>

                    {/* Right Side: Staggered Cards with Scale Entrance */}
                    <StaggerContainer className="flex flex-col gap-4">
                        <ProblemCard 
                            icon={<EyeOff size={24} />}
                            title="Visão Limitada" 
                            description="Você acessa 5 apps diferentes e ainda não sabe quanto seu patrimônio cresceu realmente no último ano."
                        />
                        <ProblemCard 
                            icon={<AlertTriangle size={24} />}
                            title="Risco Desconhecido" 
                            description="Sem consolidação, você não percebe que 80% do seu risco pode estar concentrado em um único setor."
                        />
                        <ProblemCard 
                            icon={<FileWarning size={24} />}
                            title="Dados Desconectados" 
                            description="Planilhas manuais quebram, desatualizam e não geram inteligência para sua tomada de decisão."
                        />
                    </StaggerContainer>
                </div>
            </div>
        </section>

        {/* Solution Section */}
        <section className="py-24 bg-zinc-950" id="solucao">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <FadeIn className="text-center mb-16">
                    <span className="text-amber-500 font-semibold tracking-wider text-sm uppercase">A Solução {brand.name}</span>
                    <h2 className="text-3xl md:text-5xl font-bold text-white mt-3 mb-6">Inteligência centralizada.</h2>
                    <p className="text-zinc-400 max-w-2xl mx-auto">
                        Deixamos de lado o ruído bancário para focar no que importa: a estrutura e a longevidade do seu capital.
                    </p>
                </FadeIn>

                <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    <FeatureItem 
                        icon={<LayoutGrid size={24} />}
                        title="Consolidação"
                        description="Traga todos os seus ativos para uma única base segura. O fim do login em múltiplas plataformas apenas para conferir saldos."
                    />
                    <FeatureItem 
                        icon={<Layers size={24} />}
                        title="Organização"
                        description="Categorize ativos por estratégia, liquidez ou moeda. Mapeie sua estrutura de holdings e participações."
                    />
                    <FeatureItem 
                        icon={<Eye size={24} />}
                        title="Clareza Real"
                        description="Visualize seu Net Worth atualizado. Entenda o impacto real de cada movimentação no seu quadro geral."
                    />
                    <FeatureItem 
                        icon={<Compass size={24} />}
                        title="Planejamento"
                        description="Projete cenários futuros. Defina metas de independência financeira baseadas em dados concretos, não em palpites."
                    />
                </StaggerContainer>
            </div>
        </section>
    </>
  );
};
