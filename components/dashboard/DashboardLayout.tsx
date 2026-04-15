import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, title, subtitle }) => {
  return (
    <div className="min-h-screen bg-black flex font-sans selection:bg-amber-500/30">
      <Sidebar />
      
      <div className="flex-1 flex flex-col md:ml-64 min-w-0 transition-all duration-300">
        <Header title={title} subtitle={subtitle} />
        
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 bg-black">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};