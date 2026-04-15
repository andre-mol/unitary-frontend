import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Menu, X } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { brand } from '../config/brand';

// Sub-component for the animated link
const NavLink: React.FC<{ to: string; children: React.ReactNode; isActive?: boolean }> = ({ to, children, isActive }) => (
  <Link 
    to={to} 
    className={`group relative text-sm font-medium transition-colors duration-300 ${isActive ? 'text-white' : 'text-zinc-400 hover:text-white'}`}
  >
    {children}
    {/* Animated Underline */}
    <span className={`absolute -bottom-1 left-0 h-[2px] bg-amber-500 transition-all duration-300 ease-out ${isActive ? 'w-full' : 'w-0 group-hover:w-full'}`}></span>
  </Link>
);

export const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Custom handler for anchor links to work with HashRouter
  const handleNavClick = (e: React.MouseEvent, targetId: string) => {
    e.preventDefault();
    setIsMobileMenuOpen(false);

    if (isHome) {
      // If we are already home, just scroll
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      // If not home, navigate to home and pass the target ID in state
      navigate('/', { state: { scrollTo: targetId } });
    }
  };

  // Helper to scroll to top
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsMobileMenuOpen(false);
  }

  return (
    <nav 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out border-b ${
        isScrolled 
          ? 'bg-zinc-950/80 backdrop-blur-md border-zinc-800/50 py-0 shadow-lg' 
          : 'bg-transparent border-transparent py-2 shadow-none'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center">
            <Link to="/" onClick={scrollToTop} className="cursor-pointer select-none">
              <img 
                src="/assets/logos/logo-landing.svg" 
                alt={`${brand.name} Logo`}
                className="h-8 w-auto"
              />
            </Link>
          </div>
          
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-8">
              {/* Manual navigation links */}
              <button onClick={(e) => handleNavClick(e, 'solucao')} className="text-sm font-medium text-zinc-400 hover:text-white transition-colors duration-300 bg-transparent border-none cursor-pointer">Solução</button>
              <button onClick={(e) => handleNavClick(e, 'recursos')} className="text-sm font-medium text-zinc-400 hover:text-white transition-colors duration-300 bg-transparent border-none cursor-pointer">Recursos</button>
              <button onClick={(e) => handleNavClick(e, 'como-funciona')} className="text-sm font-medium text-zinc-400 hover:text-white transition-colors duration-300 bg-transparent border-none cursor-pointer">Como Funciona</button>
              
              <NavLink to="/precos" isActive={location.pathname === '/precos'}>Preços</NavLink>
              
              <div className="ml-4 flex items-center gap-3">
                <Link to="/login">
                    <Button variant="outline" size="sm">Entrar</Button>
                </Link>
                <Link to="/cadastro">
                    <Button variant="primary" size="sm">Começar Agora</Button>
                </Link>
              </div>
            </div>
          </div>

          <div className="md:hidden">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
              className="text-zinc-400 hover:text-white transition-colors p-2"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div 
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out bg-zinc-950 border-b border-zinc-800 ${
          isMobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-2 pt-2 pb-6 space-y-1 sm:px-3 flex flex-col">
          <button onClick={(e) => handleNavClick(e, 'solucao')} className="block w-full text-left px-3 py-3 text-base font-medium text-zinc-300 hover:text-white hover:bg-zinc-900 rounded-md transition-colors">Solução</button>
          <button onClick={(e) => handleNavClick(e, 'recursos')} className="block w-full text-left px-3 py-3 text-base font-medium text-zinc-300 hover:text-white hover:bg-zinc-900 rounded-md transition-colors">Recursos</button>
          <button onClick={(e) => handleNavClick(e, 'como-funciona')} className="block w-full text-left px-3 py-3 text-base font-medium text-zinc-300 hover:text-white hover:bg-zinc-900 rounded-md transition-colors">Como Funciona</button>
          
          <Link to="/precos" onClick={() => setIsMobileMenuOpen(false)} className="block px-3 py-3 text-base font-medium text-amber-500 hover:text-amber-400 hover:bg-zinc-900 rounded-md transition-colors">Preços</Link>
          
          <div className="pt-4 flex flex-col space-y-3 px-3">
              <Link to="/login" className="w-full">
                <Button variant="outline" className="w-full justify-center">Entrar</Button>
              </Link>
              <Link to="/cadastro" className="w-full">
                <Button variant="primary" className="w-full justify-center">Começar Agora</Button>
              </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};
