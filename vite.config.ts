/**
 * Vite Configuration
 * 
 * ============================================================
 * VARIÁVEIS DE AMBIENTE
 * 
 * Vite expõe variáveis com prefixo VITE_ via import.meta.env
 * Variáveis disponíveis:
 * - import.meta.env.VITE_SUPABASE_URL
 * - import.meta.env.VITE_SUPABASE_ANON_KEY
 * - import.meta.env.VITE_APP_ENV
 * - import.meta.env.DEV (true em desenvolvimento)
 * - import.meta.env.PROD (true em produção)
 * ============================================================
 */

import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load environment variables from frontend/web directory
    // Vite automatically loads .env files from the root directory (__dirname)
    const env = loadEnv(mode, __dirname, '');

    return {
        root: __dirname,
        server: {
            port: 5173,
            host: '0.0.0.0',
            proxy: {
                '/api': {
                    target: 'http://localhost:3000',
                    changeOrigin: true,
                }
            }
        },
        plugins: [react()],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, '.'),
            }
        },
        // ============================================================
        // NOTA: Não é necessário 'define' para variáveis VITE_*
        // Elas são automaticamente expostas via import.meta.env
        // O Vite carrega automaticamente arquivos .env do diretório root
        // ============================================================
    };
});
