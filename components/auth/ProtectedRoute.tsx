/**
 * Protected Route Component
 * 
 * ============================================================
 * PROTEÇÃO DE ROTAS AUTENTICADAS
 * 
 * Wrapper para rotas que requerem autenticação.
 * 
 * Comportamento:
 * - Se loading: renderiza null (sem alterar layout)
 * - Se não logado: redireciona para /login
 * - Se logado: renderiza children
 * 
 * Uso:
 * ```tsx
 * <Route 
 *   path="/dashboard" 
 *   element={
 *     <ProtectedRoute>
 *       <DashboardPage />
 *     </ProtectedRoute>
 *   } 
 * />
 * ```
 * ============================================================
 */

import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { useSettings } from '../settings/SettingsProvider';

interface ProtectedRouteProps {
    children: React.ReactNode;
    /** Custom redirect path (default: /login) */
    redirectTo?: string;
}

export function ProtectedRoute({ 
    children, 
    redirectTo = '/login' 
}: ProtectedRouteProps) {
    const { user, loading, isConfigured } = useAuth();
    const { isMaintenanceMode, isLockdownMode, loading: settingsLoading } = useSettings();
    const location = useLocation();
    const warnedRef = useRef(false);
    
    // Log warning once when Supabase is not configured
    useEffect(() => {
        if (!isConfigured && !warnedRef.current) {
            warnedRef.current = true;
            console.warn(
                '[ProtectedRoute] ⚠️ SUPABASE NÃO CONFIGURADO ⚠️\n' +
                'O dashboard requer autenticação via Supabase.\n' +
                'Configure as variáveis de ambiente:\n' +
                '  - VITE_SUPABASE_URL\n' +
                '  - VITE_SUPABASE_ANON_KEY\n' +
                'Redirecionando para login...'
            );
        }
    }, [isConfigured]);
    
    // While checking auth state or settings, render nothing (no layout change)
    if (loading || settingsLoading) {
        return null;
    }
    
    // If Supabase is not configured, block access and redirect to login
    // The app cannot save any data without Supabase
    if (!isConfigured) {
        return (
            <Navigate 
                to={redirectTo} 
                state={{ 
                    from: location.pathname,
                    error: 'SUPABASE_NOT_CONFIGURED'
                }} 
                replace 
            />
        );
    }
    
    // If not authenticated, redirect to login
    // Preserve the attempted location for redirect after login
    if (!user) {
        return (
            <Navigate 
                to={redirectTo} 
                state={{ from: location.pathname }} 
                replace 
            />
        );
    }
    
    // Additional check: If maintenance mode is active, verify if user is admin
    // (MaintenanceMode component should handle this, but this is an extra safety check)
    if (isMaintenanceMode() || isLockdownMode()) {
        // MaintenanceMode component will handle blocking, but we can add extra safety here
        // For now, let MaintenanceMode handle it since it checks admin role
    }
    
    // User is authenticated, render children
    return <>{children}</>;
}

