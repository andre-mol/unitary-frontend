
import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { CacheProvider } from './components/cache/CacheProvider';
import { QueryProvider } from './components/query/QueryProvider';
import { PrefetchOnLogin } from './components/cache/PrefetchOnLogin';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { ProblemSolution } from './components/ProblemSolution';
import { AssetGrid } from './components/AssetGrid';
import { HowItWorks } from './components/HowItWorks';
import { Audience } from './components/Audience';
import { Footer } from './components/Footer';
import { Pricing } from './components/Pricing';
import { LoginPage } from './components/auth/LoginPage';
import { SignupPage } from './components/auth/SignupPage';
import { ForgotPasswordPage } from './components/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import { TermsPage } from './components/legal/TermsPage';
import { PrivacyPage } from './components/legal/PrivacyPage';
import { CommunicationsPage } from './components/legal/CommunicationsPage';
import { AuthProvider, useAuth } from './components/auth/AuthProvider';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { SubscriptionProvider } from './components/subscription/SubscriptionProvider';
import { PlanRoute } from './components/subscription/PlanRoute';
import { PortfolioLimitRoute } from './components/subscription/PortfolioLimitRoute';
import { SettingsProvider } from './components/settings/SettingsProvider';
import { MaintenanceMode } from './components/MaintenanceMode';
import { GlobalBanner } from './components/GlobalBanner';
import { PostHogProvider } from './components/analytics/PostHogProvider';

import { PageviewTracker } from './components/analytics/PageviewTracker';
import { ConsentProvider } from './components/consent/ConsentProvider';
import { CookieConsentBanner } from './components/consent/CookieConsentBanner';
import { ToastProvider } from './components/ui/Toast';

const PlansPage = lazy(async () => ({ default: (await import('./components/dashboard/PlansPage')).PlansPage }));
const OverviewPage = lazy(async () => ({ default: (await import('./components/dashboard/OverviewPage')).OverviewPage }));
const CreatePortfolioPage = lazy(async () => ({ default: (await import('./components/dashboard/CreatePortfolioPage')).CreatePortfolioPage }));
const PortfolioDetailsPage = lazy(async () => ({ default: (await import('./components/dashboard/PortfolioDetailsPage')).PortfolioDetailsPage }));
const PortfoliosPage = lazy(async () => ({ default: (await import('./components/dashboard/PortfoliosPage')).PortfoliosPage }));
const PortfolioHistoryPage = lazy(async () => ({ default: (await import('./components/dashboard/PortfolioHistoryPage')).PortfolioHistoryPage }));
const PortfolioProfitabilityPage = lazy(async () => ({ default: (await import('./components/dashboard/PortfolioProfitabilityPage')).PortfolioProfitabilityPage }));
const GlobalProfitabilityPage = lazy(async () => ({ default: (await import('./components/dashboard/GlobalProfitabilityPage')).GlobalProfitabilityPage }));
const GlobalHistoryPage = lazy(async () => ({ default: (await import('./components/dashboard/GlobalHistoryPage')).GlobalHistoryPage }));
const NotesPage = lazy(async () => ({ default: (await import('./components/dashboard/NotesPage')).NotesPage }));
const ContributionsPage = lazy(async () => ({ default: (await import('./components/dashboard/ContributionsPage')).ContributionsPage }));
const BudgetPage = lazy(async () => ({ default: (await import('./components/dashboard/BudgetPage')).BudgetPage }));
const GoalsPage = lazy(async () => ({ default: (await import('./components/dashboard/GoalsPage')).GoalsPage }));
const GenericPlaceholderPage = lazy(async () => ({ default: (await import('./components/dashboard/GenericPlaceholderPage')).GenericPlaceholderPage }));
const TimelinePage = lazy(async () => ({ default: (await import('./components/dashboard/TimelinePage')).TimelinePage }));
const ReportBugPage = lazy(async () => ({ default: (await import('./components/dashboard/ReportBugPage')).ReportBugPage }));
const ProfilePage = lazy(async () => ({ default: (await import('./components/dashboard/ProfilePage')).ProfilePage }));
const SettingsPage = lazy(async () => ({ default: (await import('./components/dashboard/SettingsPage')).SettingsPage }));
const PrivacySettingsPage = lazy(async () => ({ default: (await import('./components/dashboard/PrivacySettingsPage')).PrivacySettingsPage }));
const ReportsPage = lazy(async () => ({ default: (await import('./components/dashboard/ReportsPage')).ReportsPage }));
const CompoundInterestCalculator = lazy(async () => ({ default: (await import('./components/dashboard/tools/CompoundInterestCalculator')).CompoundInterestCalculator }));
const RentVsBuyCalculator = lazy(async () => ({ default: (await import('./components/dashboard/tools/RentVsBuyCalculator')).RentVsBuyCalculator }));
const InvestmentComparator = lazy(async () => ({ default: (await import('./components/dashboard/tools/InvestmentComparator')).InvestmentComparator }));
const EmergencyFundCalculator = lazy(async () => ({ default: (await import('./components/dashboard/tools/EmergencyFundCalculator')).EmergencyFundCalculator }));
const BazinCalculator = lazy(async () => ({ default: (await import('./components/dashboard/tools/BazinCalculator')).BazinCalculator }));
const GrahamCalculator = lazy(async () => ({ default: (await import('./components/dashboard/tools/GrahamCalculator')).GrahamCalculator }));
const NotificationDetailPage = lazy(async () => ({ default: (await import('./components/dashboard/NotificationDetailPage')).NotificationDetailPage }));
const SupportListPage = lazy(async () => ({ default: (await import('./components/dashboard/support/SupportListPage')).SupportListPage }));
const SupportNewPage = lazy(async () => ({ default: (await import('./components/dashboard/support/SupportNewPage')).SupportNewPage }));
const SupportDetailPage = lazy(async () => ({ default: (await import('./components/dashboard/support/SupportDetailPage')).SupportDetailPage }));
const SuccessPage = lazy(async () => ({ default: (await import('./components/billing/SuccessPage')).SuccessPage }));
const CancelPage = lazy(async () => ({ default: (await import('./components/billing/CancelPage')).CancelPage }));

// Helper component to handle scrolling when navigating from another page
// or when state is passed
const ScrollHandler = () => {
  const { pathname, state } = useLocation();

  useEffect(() => {
    // If we have a specific target in state (from Navbar click)
    if (state && state.scrollTo) {
      const element = document.getElementById(state.scrollTo);
      if (element) {
        // Small timeout to allow layout to settle
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
    // Otherwise, if just changing pages (e.g. to Pricing), scroll to top
    else if (!state?.keepScroll) {
      window.scrollTo(0, 0);
    }
  }, [pathname, state]);

  return null;
};

const LandingPage = () => {
  const { user, loading } = useAuth();

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      <Navbar />
      <Hero />
      <ProblemSolution />
      <AssetGrid />
      <HowItWorks />
      <Audience />
      <Footer />
    </>
  );
};

const PricingPage = () => (
  <>
    <Navbar />
    <Pricing />
    <Footer />
  </>
);

const RouteFallback = () => <div className="min-h-[40vh] bg-black" />;

const renderLazyRoute = (element: React.ReactNode) => (
  <Suspense fallback={<RouteFallback />}>
    {element}
  </Suspense>
);

function App() {
  return (
    <ToastProvider>
      <CacheProvider>
        <QueryProvider>
          <ConsentProvider>
            <BrowserRouter>
              <PostHogProvider>
                <SettingsProvider>
                  <AuthProvider>
                    <SubscriptionProvider>
                      <PrefetchOnLogin />
                      <MaintenanceMode>
                        <div className="min-h-screen bg-black text-white selection:bg-amber-500/30">
                          <GlobalBanner />
                          <ScrollHandler />
                          <CookieConsentBanner />
                          <PageviewTracker />
                          {/* Navbar and Footer are now specific to pages, not global wrap, to allow clean Auth pages */}
                          <main>
                            <Routes>
                              {/* Public Routes */}
                              <Route path="/" element={<LandingPage />} />
                              <Route path="/precos" element={<PricingPage />} />
                              <Route path="/pricing" element={<PricingPage />} />
                              <Route path="/login" element={<LoginPage />} />
                              <Route path="/cadastro" element={<SignupPage />} />
                              <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />
                              <Route path="/reset-password" element={<ResetPasswordPage />} />
                              <Route path="/terms" element={<TermsPage />} />
                              <Route path="/privacy" element={<PrivacyPage />} />
                              <Route path="/communications" element={<CommunicationsPage />} />

                              {/* Protected Billing Routes */}
                              <Route path="/billing/success" element={<ProtectedRoute>{renderLazyRoute(<SuccessPage />)}</ProtectedRoute>} />
                              <Route path="/billing/cancel" element={<ProtectedRoute>{renderLazyRoute(<CancelPage />)}</ProtectedRoute>} />

                              {/* Protected Dashboard Routes */}
                              <Route path="/dashboard" element={<ProtectedRoute>{renderLazyRoute(<OverviewPage />)}</ProtectedRoute>} />
                              <Route path="/dashboard/planos" element={<ProtectedRoute>{renderLazyRoute(<PlansPage />)}</ProtectedRoute>} />

                              {/* Investimentos */}
                              <Route path="/dashboard/portfolios" element={<ProtectedRoute>{renderLazyRoute(<PortfoliosPage />)}</ProtectedRoute>} />
                              <Route
                                path="/dashboard/create-portfolio"
                                element={
                                  <ProtectedRoute>
                                    <PortfolioLimitRoute>
                                      {renderLazyRoute(<CreatePortfolioPage />)}
                                    </PortfolioLimitRoute>
                                  </ProtectedRoute>
                                }
                              />
                              <Route path="/dashboard/portfolio/:id" element={<ProtectedRoute>{renderLazyRoute(<PortfolioDetailsPage />)}</ProtectedRoute>} />
                              <Route path="/dashboard/portfolio/:id/history" element={<ProtectedRoute>{renderLazyRoute(<PortfolioHistoryPage />)}</ProtectedRoute>} />
                              <Route path="/dashboard/portfolio/:id/profitability" element={<ProtectedRoute>{renderLazyRoute(<PortfolioProfitabilityPage />)}</ProtectedRoute>} />
                              <Route path="/dashboard/global-history" element={<ProtectedRoute>{renderLazyRoute(<GlobalHistoryPage />)}</ProtectedRoute>} />
                              <Route path="/dashboard/global-profitability" element={<ProtectedRoute>{renderLazyRoute(<GlobalProfitabilityPage />)}</ProtectedRoute>} />
                              <Route path="/dashboard/contributions" element={<ProtectedRoute>{renderLazyRoute(<ContributionsPage />)}</ProtectedRoute>} />
                              <Route path="/dashboard/notas" element={<ProtectedRoute>{renderLazyRoute(<NotesPage />)}</ProtectedRoute>} />

                              {/* Calculadoras (Ferramentas) */}
                              <Route path="/dashboard/calculadoras/alugar-vs-financiar" element={<ProtectedRoute>{renderLazyRoute(<RentVsBuyCalculator />)}</ProtectedRoute>} />
                              <Route path="/dashboard/calculadoras/juros-compostos" element={<ProtectedRoute>{renderLazyRoute(<CompoundInterestCalculator />)}</ProtectedRoute>} />
                              <Route path="/dashboard/calculadoras/comparador-investimentos" element={<ProtectedRoute>{renderLazyRoute(<InvestmentComparator />)}</ProtectedRoute>} />
                              <Route path="/dashboard/calculadoras/reserva-emergencia" element={<ProtectedRoute>{renderLazyRoute(<EmergencyFundCalculator />)}</ProtectedRoute>} />
                              <Route path="/dashboard/calculadoras/bazin" element={<ProtectedRoute>{renderLazyRoute(<BazinCalculator />)}</ProtectedRoute>} />
                              <Route path="/dashboard/calculadoras/graham" element={<ProtectedRoute>{renderLazyRoute(<GrahamCalculator />)}</ProtectedRoute>} />

                              {/* Planejamento */}
                              <Route
                                path="/dashboard/metas"
                                element={
                                  <ProtectedRoute>
                                    <PlanRoute required="essencial" featureName="Planejamento (Metas, Orçamento e Linha do Tempo)">
                                      {renderLazyRoute(<GoalsPage />)}
                                    </PlanRoute>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/dashboard/orcamento"
                                element={
                                  <ProtectedRoute>
                                    <PlanRoute required="essencial" featureName="Planejamento (Metas, Orçamento e Linha do Tempo)">
                                      {renderLazyRoute(<BudgetPage />)}
                                    </PlanRoute>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/dashboard/linha-tempo"
                                element={
                                  <ProtectedRoute>
                                    <PlanRoute required="essencial" featureName="Planejamento (Metas, Orçamento e Linha do Tempo)">
                                      {renderLazyRoute(<TimelinePage />)}
                                    </PlanRoute>
                                  </ProtectedRoute>
                                }
                              />

                              {/* Gestão & Sistema */}
                              <Route
                                path="/dashboard/relatorios"
                                element={
                                  <ProtectedRoute>
                                    <PlanRoute required="essencial" featureName="Relatórios Avançados">
                                      {renderLazyRoute(<ReportsPage />)}
                                    </PlanRoute>
                                  </ProtectedRoute>
                                }
                              />
                              <Route path="/dashboard/reportar-bug" element={<ProtectedRoute>{renderLazyRoute(<ReportBugPage />)}</ProtectedRoute>} />
                              <Route path="/dashboard/configuracoes" element={<ProtectedRoute>{renderLazyRoute(<ProfilePage />)}</ProtectedRoute>} />
                              <Route path="/dashboard/privacidade" element={<ProtectedRoute>{renderLazyRoute(<PrivacySettingsPage />)}</ProtectedRoute>} />
                              <Route path="/settings" element={<ProtectedRoute>{renderLazyRoute(<SettingsPage />)}</ProtectedRoute>} />
                              <Route path="/config" element={<ProtectedRoute>{renderLazyRoute(<SettingsPage />)}</ProtectedRoute>} />
                              <Route path="/notificacoes/:slug" element={<ProtectedRoute>{renderLazyRoute(<NotificationDetailPage />)}</ProtectedRoute>} />

                              {/* Suporte */}
                              <Route path="/dashboard/suporte" element={<ProtectedRoute>{renderLazyRoute(<SupportListPage />)}</ProtectedRoute>} />
                              <Route path="/dashboard/suporte/novo" element={<ProtectedRoute>{renderLazyRoute(<SupportNewPage />)}</ProtectedRoute>} />
                              <Route path="/dashboard/suporte/:id" element={<ProtectedRoute>{renderLazyRoute(<SupportDetailPage />)}</ProtectedRoute>} />

                              <Route
                                path="/reports"
                                element={
                                  <ProtectedRoute>
                                    <PlanRoute required="essencial" featureName="Relatórios Avançados">
                                      {renderLazyRoute(<ReportsPage />)}
                                    </PlanRoute>
                                  </ProtectedRoute>
                                }
                              />
                            </Routes>
                          </main>

                        </div>
                      </MaintenanceMode>
                    </SubscriptionProvider>
                  </AuthProvider>
                </SettingsProvider>
              </PostHogProvider>
            </BrowserRouter>
          </ConsentProvider>
        </QueryProvider>
      </CacheProvider>
    </ToastProvider>
  );
}

export default App;
