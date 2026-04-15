import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
  return (
    <div className="min-h-screen flex bg-black">
      {/* Left Column - Branding (Desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-zinc-900 overflow-hidden items-center justify-center p-12">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-amber-900/20 via-zinc-900 to-black"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150"></div>
        
        <div className="relative z-10 max-w-lg">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="w-12 h-12 rounded-lg bg-amber-500 mb-8 flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.4)]">
                <ShieldCheck className="text-black" size={24} />
            </div>
            
            <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
              A inteligência por trás do seu <span className="text-amber-500">legado.</span>
            </h1>
            <p className="text-zinc-400 text-xl leading-relaxed">
              Junte-se a investidores que deixaram de gerenciar seus ativos no escuro. Consolidação, clareza e estratégia em um único lugar.
            </p>

            <div className="mt-12 flex items-center gap-4 text-sm text-zinc-500 font-medium">
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div> Criptografia Militar
              </span>
              <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
              <span>Dados Privados</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right Column - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 relative">
        <Link to="/" className="absolute top-8 left-8 lg:left-12 text-zinc-500 hover:text-white transition-colors text-sm font-medium">
          ← Voltar ao site
        </Link>

        <motion.div 
          className="w-full max-w-md"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-3">{title}</h2>
            <p className="text-zinc-400">{subtitle}</p>
          </div>

          <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm shadow-2xl">
            {children}
          </div>
        </motion.div>
      </div>
    </div>
  );
};