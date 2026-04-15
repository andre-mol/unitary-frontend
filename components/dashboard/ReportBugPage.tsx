import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { DashboardLayout } from './DashboardLayout';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import { useAuth } from '../auth/AuthProvider';
import { getSupabaseClient } from '../../config/supabase';
import { Bug, Upload, CheckCircle2, AlertCircle, X, Image as ImageIcon } from 'lucide-react';
import { buildBugScreenshotPath, validateBugScreenshot } from '../../lib/bugScreenshotValidation';
import { brand } from '../../config/brand';

const APP_VERSION = 'web-1.0.0';

interface BugReportForm {
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  screenshot: File | null;
}

type SeverityOption = {
  value: 'low' | 'medium' | 'high' | 'critical';
  label: string;
  color: string;
};

const SEVERITY_OPTIONS: SeverityOption[] = [
  { value: 'low', label: 'Baixa', color: 'text-zinc-400' },
  { value: 'medium', label: 'Média', color: 'text-yellow-400' },
  { value: 'high', label: 'Alta', color: 'text-orange-400' },
  { value: 'critical', label: 'Crítica', color: 'text-red-400' },
];

export const ReportBugPage: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [form, setForm] = useState<BugReportForm>({
    title: '',
    severity: 'medium',
    description: '',
    screenshot: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);

  const handleInputChange = (field: keyof BugReportForm, value: string | File | null) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setScreenshotPreview(null);
      handleInputChange('screenshot', null);
      return;
    }

    const validation = validateBugScreenshot(file);
    if (!validation.valid) {
      setError(validation.message);
      return;
    }

    // Criar preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setScreenshotPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    handleInputChange('screenshot', file);
  };

  const removeScreenshot = () => {
    setScreenshotPreview(null);
    handleInputChange('screenshot', null);
    // Reset file input
    const fileInput = document.getElementById('screenshot-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  // AIDEV-NOTE: Validação usando Zod schema. Valida título, severidade e descrição.
  const validateForm = async (): Promise<boolean> => {
    const { bugReportSchema } = await import('../../lib/validation/schemas');
    const validationResult = bugReportSchema.safeParse(form);

    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      setError(firstError.message);
      return false;
    }

    return true;
  };

  const generateBugId = (): string => {
    // Gerar UUID simples (v4-like)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!(await validateForm())) {
      return;
    }

    if (!user?.id) {
      setError('Você precisa estar autenticado para reportar um bug.');
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabaseClient();
      const bugId = generateBugId();
      let screenshotPath: string | null = null;

      // Upload screenshot se houver
      if (form.screenshot) {
        const validation = validateBugScreenshot(form.screenshot);
        if (!validation.valid) {
          throw new Error(validation.message);
        }

        const storagePath = buildBugScreenshotPath(user.id, bugId, form.screenshot);

        const { error: uploadError } = await supabase.storage
          .from('bug-screenshots')
          .upload(storagePath, form.screenshot, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Erro ao fazer upload da imagem: ${uploadError.message}`);
        }

        screenshotPath = storagePath;
      }

      // Inserir bug report
      const { data, error: insertError } = await supabase
        .from('bug_reports')
        .insert({
          user_id: user.id,
          title: form.title.trim(),
          description: form.description.trim(),
          severity: form.severity,
          route: location.pathname,
          app_version: APP_VERSION,
          user_agent: navigator.userAgent,
          screenshot_path: screenshotPath,
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Erro ao enviar reporte: ${insertError.message}`);
      }

      // Sucesso
      setSuccess(data.id);

      // Limpar formulário
      setForm({
        title: '',
        severity: 'medium',
        description: '',
        screenshot: null,
      });
      setScreenshotPreview(null);
      const fileInput = document.getElementById('screenshot-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido ao enviar reporte.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout
      title="Reportar Bug"
      subtitle={`Ajude-nos a melhorar o ${brand.name} reportando problemas encontrados.`}
    >
      <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Success Message */}
            {success && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-start gap-3">
                <CheckCircle2 className="text-green-400 flex-shrink-0 mt-0.5" size={20} />
                <div className="flex-1">
                  <p className="text-green-400 font-medium mb-1">Reporte enviado com sucesso!</p>
                  <p className="text-zinc-400 text-sm">
                    Protocolo: <span className="font-mono text-green-300">{success}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSuccess(null)}
                  className="text-zinc-400 hover:text-zinc-300 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
                <div className="flex-1">
                  <p className="text-red-400 font-medium">{error}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="text-zinc-400 hover:text-zinc-300 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Title */}
            <Input
              label="Título do Bug"
              placeholder="Ex: Erro ao salvar portfólio"
              value={form.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              required
              disabled={loading}
            />

            {/* Severity */}
            <div className="relative group">
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1 transition-colors duration-300 group-focus-within:text-amber-500">
                Severidade
              </label>
              <div className="relative">
                <select
                  value={form.severity}
                  onChange={(e) => handleInputChange('severity', e.target.value as BugReportForm['severity'])}
                  disabled={loading}
                  className="w-full bg-zinc-900/50 text-white border border-zinc-800 rounded-lg py-3 pl-4 pr-10 focus:outline-none focus:bg-zinc-900 transition-all duration-300 focus:shadow-[0_0_15px_rgba(245,158,11,0.1)] appearance-none cursor-pointer"
                >
                  {SEVERITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-0 rounded-lg pointer-events-none transition-all duration-500 ease-out border border-transparent group-focus-within:border-amber-500/50" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] bg-amber-500 transition-all duration-300 ease-out w-0 group-focus-within:w-full" />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <div className={`w-2 h-2 rounded-full ${SEVERITY_OPTIONS.find(o => o.value === form.severity)?.color || 'text-zinc-400'}`} style={{
                    backgroundColor: form.severity === 'low' ? '#71717a' :
                      form.severity === 'medium' ? '#facc15' :
                        form.severity === 'high' ? '#fb923c' : '#ef4444'
                  }} />
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="relative group">
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1 transition-colors duration-300 group-focus-within:text-amber-500">
                Descrição
              </label>
              <div className="relative">
                <textarea
                  value={form.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Descreva o problema encontrado, passos para reproduzir e o comportamento esperado..."
                  disabled={loading}
                  required
                  rows={6}
                  className="w-full bg-zinc-900/50 text-white placeholder-zinc-600 border border-zinc-800 rounded-lg py-3 px-4 focus:outline-none focus:bg-zinc-900 transition-all duration-300 resize-none focus:shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                />
                <div className="absolute inset-0 rounded-lg pointer-events-none transition-all duration-500 ease-out border border-transparent group-focus-within:border-amber-500/50" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] bg-amber-500 transition-all duration-300 ease-out w-0 group-focus-within:w-full" />
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Mínimo de 10 caracteres. Seja o mais detalhado possível.
              </p>
            </div>

            {/* Screenshot Upload */}
            <div className="relative group">
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1 transition-colors duration-300">
                Screenshot (Opcional)
              </label>
              <div className="space-y-3">
                {!screenshotPreview ? (
                  <label
                    htmlFor="screenshot-input"
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-800 rounded-lg cursor-pointer hover:border-amber-500/50 transition-colors bg-zinc-900/30"
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="text-zinc-500 mb-2" size={24} />
                      <p className="mb-2 text-sm text-zinc-400">
                        <span className="font-semibold">Clique para fazer upload</span> ou arraste aqui
                      </p>
                      <p className="text-xs text-zinc-500">PNG, JPG ou WEBP (máx. 5MB)</p>
                    </div>
                    <input
                      id="screenshot-input"
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={handleScreenshotChange}
                      disabled={loading}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="relative border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/50">
                    <img
                      src={screenshotPreview}
                      alt="Preview"
                      className="w-full h-auto max-h-64 object-contain"
                    />
                    <button
                      type="button"
                      onClick={removeScreenshot}
                      disabled={loading}
                      className="absolute top-2 right-2 p-1.5 bg-zinc-900/90 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Auto-captured Info (Read-only) */}
            <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4 space-y-2">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Informações Capturadas Automaticamente</p>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2 text-zinc-400">
                  <span className="font-medium">Rota:</span>
                  <span className="font-mono text-zinc-300">{location.pathname}</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-400">
                  <span className="font-medium">Versão:</span>
                  <span className="font-mono text-zinc-300">{APP_VERSION}</span>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="min-w-[140px]"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin mr-2" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Bug size={16} className="mr-2" />
                    Enviar Reporte
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </DashboardLayout>
  );
};

