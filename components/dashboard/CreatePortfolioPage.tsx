
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from './DashboardLayout';
import { Button } from '../ui/Button';
import { AnimatePresence } from 'framer-motion';
import { ArrowRight, AlertTriangle, X } from 'lucide-react';
import { portfolioService } from '../../lib/portfolioService';
import { useSubscription } from '../subscription/SubscriptionProvider';
import { StepIndicator } from './create-portfolio/components/StepIndicator';
import { Step1TypeSelection } from './create-portfolio/steps/Step1TypeSelection';
import { Step2Configuration } from './create-portfolio/steps/Step2Configuration';
import { Step3Review } from './create-portfolio/steps/Step3Review';
import { SupabaseError, SUPABASE_ERROR_CODES, isSupabaseError } from '../../utils/supabaseErrors';
import type { PortfolioObjective, PortfolioTimeHorizon } from '../../types';

type PortfolioType = 'investments' | 'real_estate' | 'business' | 'custom';

interface PortfolioFormData {
  name?: string;
  currency: string;
  region?: string;
  location?: string;
  focus?: string;
  structure?: string;
  description?: string;
  customClass?: string;
  objective?: PortfolioObjective;
  timeHorizon?: PortfolioTimeHorizon;
  criteria?: string[];
}

export const CreatePortfolioPage: React.FC = () => {
  const navigate = useNavigate();
  const { plan, portfolioLimit } = useSubscription();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [selectedType, setSelectedType] = useState<PortfolioType | null>(null);
  const [formData, setFormData] = useState<PortfolioFormData>({
    currency: 'BRL'
  });

  // AIDEV-NOTE: Validação básica para navegação entre steps.
  // Validação completa com Zod acontece no handleCreate.
  const handleNext = () => {
    if (step === 1 && !selectedType) return;
    if (step === 2 && !formData.name) return;
    setStep(s => s + 1);
  };

  const handleBack = () => {
    if (step === 1) navigate('/dashboard');
    else setStep(s => s - 1);
  };

  const handleCreate = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      // AIDEV-NOTE: Validação usando Zod schema. Valida nome, tipo, moeda e campos opcionais.
      const { createPortfolioSchema } = await import('../../lib/validation/schemas');
      const validationData = {
        name: formData.name || '',
        type: selectedType || 'investments',
        currency: formData.currency || 'BRL',
        description: formData.description,
        criteria: formData.criteria,
        timeHorizon: formData.timeHorizon,
      };

      const validationResult = createPortfolioSchema.safeParse(validationData);
      if (!validationResult.success) {
        const firstError = validationResult.error.issues[0];
        setErrorMessage(firstError.message);
        setLoading(false);
        return;
      }

      // UX Check: Verify limit before attempting to create
      // Skip check for patrio_pro plan (unlimited)
      if (plan !== 'patrio_pro') {
        const currentPortfolios = await portfolioService.getPortfolios();
        const currentCount = currentPortfolios.length;
        const limit = portfolioLimit === 'unlimited' ? Infinity : portfolioLimit;

        if (currentCount >= limit) {
          // Navigate to pricing page with limit info
          const requiredPlan = plan === 'inicial' ? 'essencial' : 'patrio_pro';
          navigate('/precos', {
            state: {
              featureName: 'Criação de portfólios',
              limitInfo: {
                current: currentCount,
                limit: limit,
                plan: plan,
              },
              requiredPlan,
            },
          });
          setLoading(false);
          return;
        }
      }

      // Small delay for UX
      await new Promise(resolve => setTimeout(resolve, 300));

      // Attempt to create portfolio
      let createdId = '';
      if (selectedType) {
        const newPortfolio = await portfolioService.addPortfolio({
          ...formData,
          name: formData.name || '',
          type: selectedType,
          currency: formData.currency || 'BRL',
          objective: formData.objective || 'growth',
          timeHorizon: formData.timeHorizon || 'long',
        });
        createdId = newPortfolio.id;

        // AIDEV-NOTE: Capture portfolio_created event (type only, no IDs or values)
        const { capturePortfolioCreated } = await import('../../lib/analytics');
        capturePortfolioCreated(selectedType);
      }

      if (createdId) {
        navigate(`/dashboard/portfolio/${createdId}`, { state: { newPortfolio: true, name: formData.name } });
      } else {
        navigate('/dashboard/portfolios');
      }
    } catch (error) {
      // Handle error from database (backend enforcement)
      if (isSupabaseError(error)) {
        const isLimitError =
          error.code === SUPABASE_ERROR_CODES.PORTFOLIO_LIMIT_REACHED ||
          (error.code === SUPABASE_ERROR_CODES.VALIDATION_ERROR &&
            (error.message.includes('limite de portfólios') ||
              error.message.includes('PATRIO_PORTFOLIO_LIMIT')));

        if (isLimitError) {
          const limitMsg = plan === 'inicial'
            ? 'Seu plano permite apenas 1 portfólio. Faça upgrade para criar mais.'
            : 'Seu plano permite até 3 portfólios. Faça upgrade para criar mais.';
          setErrorMessage(limitMsg);
        } else {
          setErrorMessage(error.message || 'Erro ao criar portfólio. Tente novamente.');
        }
      } else {
        setErrorMessage('Erro ao criar portfólio. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (key: keyof PortfolioFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <DashboardLayout title="Novo Portfólio">
      <div className="max-w-3xl mx-auto py-8">
        <StepIndicator currentStep={step} totalSteps={3} />

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium mb-2">{errorMessage}</p>
                {errorMessage.includes('limite de portfólios') && (
                  <Button
                    onClick={() => navigate('/precos')}
                    size="sm"
                    variant="secondary"
                    className="mt-2"
                  >
                    Ver Planos
                  </Button>
                )}
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-red-400/60 hover:text-red-400 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}

        <div className="min-h-[400px]">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <Step1TypeSelection
                key="step1"
                selectedType={selectedType}
                onSelect={(type) => { setSelectedType(type); setStep(2); }}
              />
            )}
            {step === 2 && selectedType && (
              <Step2Configuration
                key="step2"
                type={selectedType}
                data={formData}
                onChange={updateFormData}
              />
            )}
            {step === 3 && selectedType && (
              <Step3Review
                key="step3"
                type={selectedType}
                data={formData}
              />
            )}
          </AnimatePresence>
        </div>

        <div className="flex justify-between items-center mt-12 pt-6 border-t border-zinc-900">
          <Button variant="outline" onClick={handleBack} disabled={loading}>
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </Button>

          {step < 3 ? (
            <Button onClick={handleNext} disabled={(step === 1 && !selectedType) || (step === 2 && !formData.name)}>
              Continuar <ArrowRight size={16} className="ml-2" />
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={loading} className="w-32">
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-zinc-900 border-t-transparent" />
              ) : (
                'Criar Portfólio'
              )}
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};
