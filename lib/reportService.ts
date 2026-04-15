import { getSupabaseClient } from '../config/supabase';

export interface GeneratedReportPayload {
  meta: {
    reportId: string;
    reportTitle: string;
    portfolioName: string;
    dateFrom: string;
    dateTo: string;
    periodLabel: string;
    generatedAt: string;
    pageCount: number;
  };
  summary: {
    profileName: string;
    balanceStart: number;
    balanceEnd: number;
    investedEnd: number;
    resultValue: number;
    returnPct: number;
    firstActivityDate: string | null;
    cards: Array<{
      label: string;
      value: number | string;
      accent?: 'primary' | 'positive' | 'neutral';
    }>;
  };
  performance: {
    series: Array<{ label: string; value: number }>;
    effectiveSeriesStart?: string | null;
    windowReturns: Array<{
      label: string;
      period: number;
      yearToDate: number;
      trailing12Months: number;
      sinceStart: number;
    }>;
    monthlyReturns: Array<{ label: string; value: number }>;
    stats: {
      positiveMonths: number;
      negativeMonths: number;
      bestMonth: number;
      worstMonth: number;
      averageMonth: number;
    };
  };
  allocation: {
    byAssetClass: Array<{ name: string; value: number; share: number }>;
    byCategory: Array<{ name: string; value: number; share: number }>;
    topPositions: Array<{ name: string; value: number }>;
  };
  cashflow: {
    entries: number;
    exits: number;
    income: number;
    incomeProvisioned: number;
    expenses: number;
    netContributions: number;
    marketPnl: number;
    closingDifference: number;
    netResult: number;
    topEvents: Array<{ date: string; label: string; value: number }>;
  };
  methodology: {
    definitions: string[];
    formulas: string[];
    notes: string[];
  };
  diagnostics: {
    anomalies: Array<{
      date: string;
      portfolioId: string | null;
      kind: 'daily_return' | 'monthly_return' | 'invalid_base';
      observedValue: number | null;
      context: Record<string, unknown>;
    }>;
  };
}

export interface GenerateReportResult {
  fileName: string;
  mimeType: string;
  reportId: string;
  generatedAt: string;
  storagePath: string;
  signedUrl: string;
  expiresAt: string;
  report: GeneratedReportPayload;
}

export const reportService = {
  async generatePdf(params: {
    dateFrom: string;
    dateTo: string;
    portfolioScope?: 'all' | 'single';
    portfolioId?: string | null;
    includeBenchmarks?: boolean;
    includePii?: boolean;
  }): Promise<GenerateReportResult> {
    const supabase = getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const accessToken = session?.access_token;
    if (!accessToken) {
      throw new Error('Sessao expirada. Faça login novamente para gerar o relatorio.');
    }

    const { data, error } = await supabase.functions.invoke('generate-report-pdf', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Access-Token': accessToken,
      },
      body: {
        ...params,
        accessToken,
      },
    });

    if (error) {
      const response = (error as any).context;
      if (response && typeof response.json === 'function') {
        try {
          const payload = await response.json();
          if (payload?.error) {
            throw new Error(payload.error as string);
          }
        } catch {
          // Fall back to the original transport error when the response body is unavailable.
        }
      }

      throw error;
    }

    if (!data?.success || !data?.signed_url || !data?.report_id) {
      throw new Error(data?.error || 'Falha ao gerar o relatorio em PDF.');
    }

    return {
      fileName: (data.file_name as string) || 'unitary-relatorio.pdf',
      mimeType: (data.mime_type as string) || 'application/pdf',
      reportId: data.report_id as string,
      generatedAt: data.generated_at as string,
      storagePath: data.storage_path as string,
      signedUrl: data.signed_url as string,
      expiresAt: data.expires_at as string,
      report: data.report as GeneratedReportPayload,
    };
  },
};
