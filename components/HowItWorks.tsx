import React from 'react';
import { FadeIn, FadeInScale } from './ui/Motion';
import { motion } from 'framer-motion';

// Individual Step Component with Connecting Line Animation
const Step: React.FC<{ number: string; title: string; description: string; isLast?: boolean }> = ({ number, title, description, isLast }) => (
    <motion.div 
        className="relative pl-12 pb-12 last:pb-0"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { duration: 0.5 } }
        }}
    >
        {/* Vertical Line Container */}
        {!isLast && (
            <div className="absolute left-[0px] top-[40px] bottom-0 w-[2px] bg-zinc-900/50 -translate-x-1/2">
                {/* The Filling Animation */}
                <motion.div 
                    className="w-full bg-gradient-to-b from-amber-500 to-zinc-900 origin-top"
                    variants={{
                        hidden: { height: "0%" },
                        visible: { height: "100%", transition: { duration: 1, delay: 0.5, ease: "easeInOut" } }
                    }}
                />
            </div>
        )}

        {/* Number Bubble */}
        <motion.div 
            className="absolute left-[-20px] top-0 w-10 h-10 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center text-amber-500 font-bold z-10 shadow-lg shadow-black/50"
            variants={{
                hidden: { scale: 0, borderColor: "rgba(39, 39, 42, 1)" },
                visible: { scale: 1, borderColor: "rgba(245, 158, 11, 0.5)", transition: { type: "spring", stiffness: 200, damping: 15 } }
            }}
        >
            {number}
        </motion.div>

        {/* Content */}
        <motion.div
            variants={{
                hidden: { opacity: 0, x: -20 },
                visible: { opacity: 1, x: 0, transition: { delay: 0.2, duration: 0.5 } }
            }}
        >
            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
            <p className="text-zinc-400 leading-relaxed">{description}</p>
        </motion.div>
    </motion.div>
);

// Animated Block for the 'After' visualization
const AnimatedBlock: React.FC<{ label: string; color: string; delay?: number }> = ({ label, color, delay = 0 }) => (
    <motion.div 
        className={`h-12 bg-zinc-900 border-l-4 ${color} rounded flex items-center px-4 shadow-sm`}
        variants={{
            hidden: { opacity: 0, x: 20, scale: 0.95 },
            visible: { opacity: 1, x: 0, scale: 1, transition: { type: "spring", stiffness: 100, damping: 20 } }
        }}
    >
        <span className="text-zinc-300 text-sm font-medium">{label}</span>
    </motion.div>
);

export const HowItWorks: React.FC = () => {
  return (
    <section className="py-24 bg-zinc-950 overflow-hidden" id="como-funciona">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            
            {/* Left Column: Narrative Steps */}
            <div className="flex flex-col justify-center">
                <FadeIn>
                    <span className="text-amber-500 font-semibold tracking-wider text-sm uppercase mb-3 block">Workflow</span>
                    <h2 className="text-3xl md:text-5xl font-bold text-white mb-8">
                        Do caos ao controle em três etapas.
                    </h2>
                    <p className="text-zinc-400 text-lg mb-12">
                        Sem conexões bancárias invasivas. Sem algoritmos vendendo produtos. Você no controle dos dados.
                    </p>
                </FadeIn>
                
                <div className="mt-4 pl-4">
                    <Step 
                        number="1"
                        title="Crie seus Portfólios"
                        description="Defina a estrutura macro do seu patrimônio. Separe por objetivos (Aposentadoria, Liberdade) ou por titularidade (Pessoal, Holding, Família)."
                    />
                    <Step 
                        number="2"
                        title="Adicione seus Ativos"
                        description="Cadastre seus bens e direitos. O sistema permite um nível de detalhe granular, de cotas de fundos a imóveis rurais."
                    />
                    <Step 
                        number="3"
                        title="Decisão Consciente"
                        description="Acompanhe a evolução através de dashboards claros. Identifique desbalanços na alocação e ajuste a rota com precisão."
                        isLast={true}
                    />
                </div>
            </div>
            
            {/* Right Column: Visualizer */}
            <FadeInScale className="relative h-full min-h-[500px] bg-zinc-900/30 rounded-2xl border border-zinc-800/50 p-8 flex items-center justify-center overflow-hidden backdrop-blur-sm">
                {/* Background Grid Decoration */}
                <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.02)_50%,transparent_75%,transparent_100%)] bg-[length:24px_24px] opacity-20"></div>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.03),transparent_70%)]"></div>
                
                <div className="w-full max-w-sm space-y-6 relative z-10">
                    <div className="flex justify-between items-center text-xs text-zinc-500 uppercase tracking-widest mb-2 font-medium">
                        <span>Antes</span>
                        <span>Depois</span>
                    </div>
                    
                    <div className="flex gap-6 items-center">
                        {/* Before: Chaotic, Floating, Blurred */}
                        <div className="w-1/2 space-y-3 opacity-40 blur-[1px]">
                            {[1, -2, 3, -1].map((rotation, i) => (
                                <motion.div 
                                    key={i}
                                    className="h-12 bg-zinc-800 rounded w-[90%]"
                                    animate={{ 
                                        y: [0, -5, 0],
                                        rotate: [rotation, rotation * -1, rotation] 
                                    }}
                                    transition={{ 
                                        duration: 4 + i, 
                                        repeat: Infinity, 
                                        ease: "easeInOut",
                                        delay: i * 0.5 
                                    }}
                                    style={{ width: `${85 + (i * 3)}%` }}
                                />
                            ))}
                        </div>

                        {/* Divider */}
                        <div className="h-48 w-px bg-gradient-to-b from-transparent via-zinc-800 to-transparent"></div>

                        {/* After: Organized, Staggered Entrance */}
                        <motion.div 
                            className="w-1/2 space-y-3"
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, margin: "-50px" }}
                            variants={{
                                visible: { transition: { staggerChildren: 0.15, delayChildren: 0.3 } }
                            }}
                        >
                             <AnimatedBlock label="Liquidez" color="border-amber-500" />
                             <AnimatedBlock label="Renda" color="border-amber-600" />
                             <AnimatedBlock label="Proteção" color="border-amber-700" />
                             <AnimatedBlock label="Mult." color="border-amber-800" />
                        </motion.div>
                    </div>
                </div>
            </FadeInScale>
        </div>
      </div>
    </section>
  );
};