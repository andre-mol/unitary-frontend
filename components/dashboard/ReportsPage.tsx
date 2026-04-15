import React, { useMemo, useState } from 'react';
import { CalendarDays, FileText, Lock, Sparkles } from 'lucide-react';
import { DashboardLayout } from './DashboardLayout';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { useSubscription } from '../subscription/SubscriptionProvider';
import { captureReportGenerated } from '../../lib/analytics/events';
import { getPlanDisplayName } from '../../lib/plans';
import { reportService, type GeneratedReportPayload } from '../../lib/reportService';

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getYearStartIsoDate(): string {
  const today = new Date();
  return `${today.getFullYear()}-01-01`;
}

function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) {
    return '--/--/----';
  }

  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) {
    return isoDate;
  }

  return `${day}/${month}/${year}`;
}

function formatTimestamp(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date instanceof Date ? date : new Date(date));
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0)}%`;
}

export const ReportsPage: React.FC = () => {
  const { addToast } = useToast();
  const { plan, canAccessPlanning } = useSubscription();
  const [startDate, setStartDate] = useState(getYearStartIsoDate);
  const [endDate, setEndDate] = useState(getTodayIsoDate);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportPayload, setReportPayload] = useState<GeneratedReportPayload | null>(null);
  const [fileName, setFileName] = useState<string>('relatorio-geral.pdf');
  const [reportId, setReportId] = useState<string | null>(null);

  const formattedPeriod = useMemo(
    () => `${formatDate(startDate)} ate ${formatDate(endDate)}`,
    [endDate, startDate]
  );

  const handleGeneratePdf = async () => {
    if (!canAccessPlanning) {
      addToast({
        type: 'warning',
        title: 'Recurso bloqueado',
        message: 'Relatorios em PDF estao disponiveis apenas nos planos Essencial e Unitary Pro.',
      });
      return;
    }

    if (!startDate || !endDate) {
      addToast({
        type: 'error',
        title: 'Periodo invalido',
        message: 'Selecione a data inicial e a data final antes de gerar o PDF.',
      });
      return;
    }

    if (startDate > endDate) {
      addToast({
        type: 'error',
        title: 'Intervalo invalido',
        message: 'A data inicial nao pode ser maior que a data final.',
      });
      return;
    }

    setIsGenerating(true);

    try {
      const result = await reportService.generatePdf({
        dateFrom: startDate,
        dateTo: endDate,
        portfolioScope: 'all',
        includeBenchmarks: true,
        includePii: true,
      });

      setPdfUrl(result.signedUrl);
      setFileName(result.fileName);
      setGeneratedAt(result.generatedAt);
      setExpiresAt(result.expiresAt);
      setReportId(result.reportId);
      setReportPayload(result.report);
      captureReportGenerated('relatorio_geral_pdf_server');

      addToast({
        type: 'success',
        title: 'PDF gerado',
        message: 'O relatorio foi gerado no servidor, salvo em storage privado e esta pronto para visualizacao.',
      });
    } catch (error: any) {
      addToast({
        type: 'error',
        title: 'Falha ao gerar PDF',
        message: error?.message || 'Nao foi possivel gerar o relatorio agora. Tente novamente.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <DashboardLayout
      title="Relatorios"
      subtitle="Gere um relatorio geral em PDF com renderizacao server-side e visualizacao imediata."
    >
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.05),transparent_28%)]" />
          <div className="relative grid gap-6 p-6 lg:grid-cols-[1.4fr_0.8fr] lg:p-8">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">
                  <Sparkles size={14} />
                  PDF premium
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/70 px-3 py-1 text-xs font-medium text-zinc-300">
                  <Lock size={14} />
                  Essencial e Unitary Pro
                </span>
              </div>

              <div>
                <h2 className="text-2xl font-semibold text-white">Relatorio geral</h2>
                <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                  O backend consolida os dados, gera um PDF multipagina com header e footer fixos, salva em storage privado e devolve uma signed URL curta.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,220px)_minmax(0,220px)_auto] xl:items-end">
                <label className="block">
                  <span className="mb-2 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
                    <CalendarDays size={14} />
                    Data inicial
                  </span>
                  <input
                    type="date"
                    value={startDate}
                    max={endDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="w-full rounded-2xl border border-zinc-700 bg-zinc-900/90 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
                    <CalendarDays size={14} />
                    Data final
                  </span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="w-full rounded-2xl border border-zinc-700 bg-zinc-900/90 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  />
                </label>

                <Button
                  type="button"
                  size="md"
                  onClick={handleGeneratePdf}
                  disabled={isGenerating || !canAccessPlanning}
                  className="w-full rounded-2xl disabled:cursor-not-allowed disabled:opacity-60 xl:w-auto"
                >
                  <FileText size={18} className="mr-2" />
                  {isGenerating ? 'Gerando PDF...' : 'Gerar PDF'}
                </Button>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-black/40 p-5">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Resumo</p>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Periodo selecionado</p>
                  <p className="mt-2 text-lg font-semibold text-white">{formattedPeriod}</p>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Plano atual</p>
                  <p className="mt-2 text-lg font-semibold text-white">{getPlanDisplayName(plan)}</p>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Ultima geracao</p>
                  <p className="mt-2 text-sm text-zinc-300">
                    {generatedAt ? formatTimestamp(generatedAt) : 'Nenhum PDF gerado nesta sessao.'}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">
                    {expiresAt ? `Expira em: ${formatTimestamp(expiresAt)}` : 'Aguardando...'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950">
            <div className="flex flex-col gap-2 border-b border-zinc-800 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Visualizador de PDF</h3>
                <p className="text-sm text-zinc-400">
                  O arquivo salvo no storage privado aparece aqui por meio da signed URL retornada pelo backend.
                </p>
              </div>
              {pdfUrl ? (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  download={fileName}
                  className="inline-flex items-center justify-center rounded-xl border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                >
                  Abrir PDF
                </a>
              ) : null}
            </div>

            <div className="p-4 sm:p-6">
              {pdfUrl ? (
                <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-black">
                  <iframe
                    title="Visualizador do relatorio em PDF"
                    src={pdfUrl}
                    className="h-[780px] w-full bg-white"
                  />
                </div>
              ) : (
                <div className="flex min-h-[480px] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 text-center">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                    <FileText size={36} className="text-zinc-300" />
                  </div>
                  <h4 className="mt-5 text-xl font-semibold text-white">Nenhum PDF gerado ainda</h4>
                  <p className="mt-2 max-w-xl text-sm text-zinc-400">
                    Defina a data inicial e a data final, depois clique em gerar. O backend vai montar o relatorio e devolver uma URL temporaria para visualizacao.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950">
            <div className="border-b border-zinc-800 px-6 py-5">
              <h3 className="text-lg font-semibold text-white">Dados do relatorio</h3>
              <p className="text-sm text-zinc-400">
                Payload consolidado retornado junto com o PDF.
              </p>
            </div>

            <div className="space-y-4 p-6">
              {reportPayload ? (
                <>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Escopo</p>
                    <p className="mt-2 text-base font-semibold text-white">{reportPayload.meta.portfolioName}</p>
                    <p className="mt-1 text-sm text-zinc-400">{reportPayload.meta.periodLabel}</p>
                    <p className="mt-2 text-xs text-zinc-500">Report ID: {reportId}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Patrimonio inicial</p>
                      <p className="mt-2 text-sm font-semibold text-white">{formatCurrency(reportPayload.summary.balanceStart)}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Patrimonio final</p>
                      <p className="mt-2 text-sm font-semibold text-white">{formatCurrency(reportPayload.summary.balanceEnd)}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Resultado</p>
                      <p className="mt-2 text-sm font-semibold text-white">{formatCurrency(reportPayload.summary.resultValue)}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Rentabilidade</p>
                      <p className="mt-2 text-sm font-semibold text-white">{formatPercent(reportPayload.summary.returnPct)}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Alocacao por classe</p>
                    <div className="mt-3 space-y-2">
                      {reportPayload.allocation.byAssetClass.length > 0 ? (
                        reportPayload.allocation.byAssetClass.slice(0, 5).map((category) => (
                          <div key={category.name} className="flex items-center justify-between gap-3 text-sm">
                            <span className="text-zinc-300">{category.name}</span>
                            <span className="font-medium text-white">
                              {formatCurrency(category.value)} ({formatPercent(category.share * 100)})
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-zinc-500">Sem categorias suficientes neste recorte.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Estatisticas do periodo</p>
                    <div className="mt-3 grid gap-2 text-sm text-zinc-300">
                      <div className="flex items-center justify-between gap-3">
                        <span>Meses positivos</span>
                        <span className="font-medium text-white">{reportPayload.performance.stats.positiveMonths}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Meses negativos</span>
                        <span className="font-medium text-white">{reportPayload.performance.stats.negativeMonths}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Melhor mes</span>
                        <span className="font-medium text-white">{formatPercent(reportPayload.performance.stats.bestMonth)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Pior mes</span>
                        <span className="font-medium text-white">{formatPercent(reportPayload.performance.stats.worstMonth)}</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-6">
                  <p className="text-sm text-zinc-400">
                    Aguardando a geracao do PDF...
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};
