import React, { useRef, useEffect, useState } from 'react';
import { Button } from './ui/Button';
import { ArrowRight, ShieldCheck, PieChart, TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePie, Pie, Cell } from 'recharts';
import { FadeIn } from './ui/Motion';
import { motion, useScroll, useTransform, useInView, useMotionValue, useSpring } from 'framer-motion';
import { Link } from 'react-router-dom';
import { brand } from '../config/brand';

const data = [
  { name: 'Jan', value: 2400000 },
  { name: 'Fev', value: 2450000 },
  { name: 'Mar', value: 2420000 },
  { name: 'Abr', value: 2580000 },
  { name: 'Mai', value: 2700000 },
  { name: 'Jun', value: 2850000 },
  { name: 'Jul', value: 3100000 },
];

const allocationData = [
  { name: 'Ações', value: 400 },
  { name: 'Imóveis', value: 300 },
  { name: 'Renda Fixa', value: 300 },
  { name: 'Caixa', value: 100 },
];

const COLORS = ['#f59e0b', '#3f3f46', '#71717a', '#a1a1aa'];

// --- Counter Component ---
const Counter: React.FC<{ value: number; decimals?: number; prefix?: string; suffix?: string }> = ({ 
  value, 
  decimals = 0,
  prefix = '', 
  suffix = '' 
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { damping: 40, stiffness: 60 });
  const isInView = useInView(ref, { once: true, margin: "-20px" });

  useEffect(() => {
    if (isInView) {
      motionValue.set(value);
    }
  }, [isInView, value, motionValue]);

  useEffect(() => {
    return springValue.on("change", (latest) => {
      if (ref.current) {
        // Handle localized number formatting manually for smooth transitions
        const formattedNumber = latest.toLocaleString('pt-BR', { 
            minimumFractionDigits: decimals, 
            maximumFractionDigits: decimals 
        });
        ref.current.textContent = `${prefix}${formattedNumber}${suffix}`;
      }
    });
  }, [springValue, decimals, prefix, suffix]);

  return <span ref={ref}>{prefix}0{suffix}</span>;
};

export const Hero: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Parallax Logic
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, 80]);
  const opacity = useTransform(scrollY, [0, 600], [1, 0.5]);
  const boxShadow = useTransform(
    scrollY,
    [0, 300],
    [
      "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
      "0 50px 100px -12px rgba(0, 0, 0, 0.8)"
    ]
  );

  // Refs for Chart Visibility
  const areaChartRef = useRef(null);
  const isAreaInView = useInView(areaChartRef, { once: true, margin: "-50px" });
  
  const pieChartRef = useRef(null);
  const isPieInView = useInView(pieChartRef, { once: true, margin: "-50px" });

  return (
    <section ref={containerRef} className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden min-h-screen flex flex-col justify-center">
      
      {/* 1. Spline 3D Animation Layer (Base Z-0) */}
      <div className="absolute inset-0 w-full h-full z-0 hidden md:block overflow-hidden">
         <div className="w-full h-full opacity-80 scale-105">
            <iframe 
                src="https://my.spline.design/thresholddarkambientui-0obVyNlCEmy8TqV11wRgGi43/"
                frameBorder="0"
                width="100%"
                height="100%"
                title={`${brand.name} Ambient Background`}
                className="w-full h-full object-cover"
            ></iframe>
         </div>
      </div>

      {/* 2. Base Gradient / Overlay Layer (Z-10) */}
      <div className="absolute inset-0 z-10 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-950/20 via-zinc-950/80 to-zinc-950"></div>
          <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-zinc-950 via-zinc-950/90 to-transparent"></div>
          <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent"></div>
          <div className="absolute inset-0 bg-zinc-950/30"></div>
      </div>
      
      {/* 3. Content Layer (Z-20) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20 w-full pointer-events-none">
        <div className="text-center max-w-4xl mx-auto mb-16 pointer-events-none">
          <FadeIn delay={0}>
            <div className="inline-flex items-center px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/80 backdrop-blur-md mb-8 shadow-lg">
              <span className="flex h-2 w-2 rounded-full bg-amber-500 mr-2 animate-pulse"></span>
              <span className="text-xs font-medium text-zinc-300 uppercase tracking-wider">Gestão Patrimonial Privada</span>
            </div>
          </FadeIn>
          
          <FadeIn delay={0.1}>
            <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight mb-8 leading-tight drop-shadow-2xl">
              Domine a arquitetura do <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-600">seu patrimônio.</span>
            </h1>
          </FadeIn>
          
          <FadeIn delay={0.2}>
            <p className="text-xl md:text-2xl text-zinc-300 mb-10 max-w-2xl mx-auto font-light drop-shadow-md">
              Consolide investimentos, imóveis e participações empresariais em um único sistema estratégico. Saiba exatamente quanto você tem e para onde está indo.
            </p>
          </FadeIn>
          
          <FadeIn delay={0.3}>
            {/* Buttons: MUST have pointer-events-auto to be clickable */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pointer-events-auto">
              <Link to="/cadastro">
                <Button size="lg" className="w-full sm:w-auto group shadow-2xl shadow-amber-900/20">
                    Criar meu patrimônio
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Button variant="outline" size="lg" className="w-full sm:w-auto bg-zinc-950/50 backdrop-blur-sm hover:bg-zinc-900/80">
                Ver como funciona
              </Button>
            </div>
          </FadeIn>
        </div>

        {/* Mock Dashboard Preview */}
        <motion.div 
            style={{ y, opacity, boxShadow }}
            initial={{ opacity: 0, scale: 0.95, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1.0], delay: 0.4 }}
            className="relative mx-auto max-w-5xl rounded-xl border border-zinc-800 bg-zinc-900/80 backdrop-blur-md p-6 md:p-8 pointer-events-auto"
        >
            <div className="flex items-center gap-2 mb-6 border-b border-zinc-800 pb-4">
                <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total Net Worth Card */}
                <div className="md:col-span-2 bg-zinc-950/50 border border-zinc-800 rounded-lg p-6" ref={areaChartRef}>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-zinc-400 text-sm font-medium">Evolução Patrimonial</h3>
                        <div className="flex items-center text-amber-500 text-sm font-bold">
                            <TrendingUp size={16} className="mr-1" />
                            <Counter value={12.4} decimals={1} prefix="+" suffix="%" />
                        </div>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={isAreaInView ? data : []}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                <XAxis dataKey="name" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$ ${(value / 1000000).toFixed(1)}M`} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff' }}
                                    itemStyle={{ color: '#f59e0b' }}
                                    formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Total']}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="value" 
                                    stroke="#f59e0b" 
                                    strokeWidth={2} 
                                    fillOpacity={1} 
                                    fill="url(#colorValue)" 
                                    isAnimationActive={true}
                                    animationDuration={2500}
                                    animationEasing="ease-in-out"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Allocation Card */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6 flex flex-col justify-between" ref={pieChartRef}>
                    <div>
                        <h3 className="text-zinc-400 text-sm font-medium mb-2">Alocação de Ativos</h3>
                        <div className="text-2xl font-bold text-white mb-6">
                            <Counter value={4} suffix=" Classes" />
                        </div>
                    </div>
                    <div className="h-48 relative">
                         <ResponsiveContainer width="100%" height="100%">
                            <RePieChart>
                                <Pie
                                    data={isPieInView ? allocationData : []}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                    startAngle={90}
                                    endAngle={-270}
                                    isAnimationActive={true}
                                    animationDuration={2000}
                                    animationBegin={0}
                                    animationEasing="ease-out"
                                >
                                    {allocationData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                            </RePieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <PieChart className="text-zinc-600" size={32} />
                        </div>
                    </div>
                    <div className="space-y-2 mt-4">
                        <div className="flex justify-between text-xs">
                            <span className="text-zinc-400 flex items-center"><span className="w-2 h-2 rounded-full bg-amber-500 mr-2"></span>Ações</span>
                            <span className="text-white font-medium">
                                <Counter value={36} suffix="%" />
                            </span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-zinc-400 flex items-center"><span className="w-2 h-2 rounded-full bg-zinc-700 mr-2"></span>Imóveis</span>
                            <span className="text-white font-medium">
                                <Counter value={27} suffix="%" />
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Floating Badge */}
            <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1, duration: 0.5 }}
                className="absolute -bottom-6 right-8 bg-zinc-900 border border-zinc-700 p-4 rounded-lg shadow-xl flex items-center gap-3"
            >
                <div className="bg-green-500/10 p-2 rounded-md">
                    <ShieldCheck className="text-green-500" size={20} />
                </div>
                <div>
                    <p className="text-xs text-zinc-400">Status do Patrimônio</p>
                    <p className="text-sm font-bold text-white">Consolidado & Seguro</p>
                </div>
            </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

// Helper component for Pie Chart wrapper
const RePieChart: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return <RePie width={200} height={200}>{children}</RePie>
}
