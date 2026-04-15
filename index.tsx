import './bootstrap';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { isDemoMode } from './mocks/demoMode';

/**
 * O seed do demo precisa terminar antes do primeiro paint: caso contrário
 * fetchDashboardBundle lê localStorage vazio e a Visão Geral fica zerada.
 */
async function bootstrapApp(): Promise<void> {
  if (isDemoMode()) {
    const { seedDemoData } = await import('./mocks/demoData');
    seedDemoData();
  }

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Could not find root element to mount to");
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

void bootstrapApp();
