/**
 * Month Range Utilities
 * 
 * Funções utilitárias para trabalhar com ranges de meses no formato 'YYYY-MM'.
 * Usa timezone America/Sao_Paulo para cálculos consistentes.
 * 
 * AIDEV-NOTE: Range de datas crítico. Qualquer mudança aqui afeta o gráfico
 * Histórico Financeiro e outros componentes que dependem de ranges mensais.
 */

export type TimeRange = '3M' | '6M' | '1A' | 'YTD' | 'ALL';

const TIMEZONE = 'America/Sao_Paulo';

/**
 * Converte Date para month key no formato 'YYYY-MM'
 * Usa timezone America/Sao_Paulo para garantir consistência.
 * 
 * @param date Data a converter
 * @param tz Timezone (padrão: 'America/Sao_Paulo')
 * @returns Month key no formato 'YYYY-MM'
 */
export function monthKey(date: Date, tz: string = TIMEZONE): string {
  // Usar Intl.DateTimeFormat para garantir timezone correto
  const year = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric'
  }).format(date);

  const month = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    month: '2-digit'
  }).format(date);

  return `${year}-${month}`;
}

/**
 * Adiciona ou subtrai meses de um month key
 * 
 * @param monthKey Month key no formato 'YYYY-MM'
 * @param delta Número de meses a adicionar (negativo para subtrair)
 * @returns Novo month key no formato 'YYYY-MM'
 */
export function addMonths(monthKey: string, delta: number): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  // Criar Date no primeiro dia do mês
  const date = new Date(year, month - 1, 1);
  date.setMonth(date.getMonth() + delta);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Constrói range de meses para um modo específico.
 * Retorna informações completas sobre o range incluindo datas ISO para queries.
 * 
 * @param mode Modo do range ('3M' | '6M' | '1A' | 'ALL')
 * @param now Data de referência (padrão: new Date())
 * @param minYear Ano inicial para modo 'ALL' (padrão: 2020)
 * @returns Objeto com months array, startMonth, endMonth e datas ISO
 */
export function buildRangeMonths(
  mode: TimeRange,
  now: Date = new Date(),
  minYear: number = new Date().getFullYear()
): {
  months: string[];
  startMonth: string;
  endMonth: string;
  startDateIso: string;
  endDateIso: string;
} {
  // Usar timezone America/Sao_Paulo para cálculos consistentes
  const tzDate = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }));
  const currentYear = tzDate.getFullYear();
  const currentMonth = tzDate.getMonth() + 1; // 1-12

  let months: string[] = [];
  let startMonth: string;
  let endMonth: string;

  switch (mode) {
    case '3M':
      // Últimos 3 meses: mês atual + 2 anteriores
      for (let i = 2; i >= 0; i--) {
        const targetMonth = currentMonth - i;
        let targetYear = currentYear;
        let monthNum = targetMonth;

        if (targetMonth < 1) {
          monthNum = 12 + targetMonth;
          targetYear = currentYear - 1;
        }

        months.push(`${targetYear}-${String(monthNum).padStart(2, '0')}`);
      }
      startMonth = months[0];
      endMonth = months[months.length - 1];
      break;

    case '6M':
      // Últimos 6 meses: mês atual + 5 anteriores
      for (let i = 5; i >= 0; i--) {
        const targetMonth = currentMonth - i;
        let targetYear = currentYear;
        let monthNum = targetMonth;

        if (targetMonth < 1) {
          monthNum = 12 + targetMonth;
          targetYear = currentYear - 1;
        }

        months.push(`${targetYear}-${String(monthNum).padStart(2, '0')}`);
      }
      startMonth = months[0];
      endMonth = months[months.length - 1];
      break;

    case '1A':
      // Último ano: mês atual + 11 anteriores
      for (let i = 11; i >= 0; i--) {
        const targetMonth = currentMonth - i;
        let targetYear = currentYear;
        let monthNum = targetMonth;

        if (targetMonth < 1) {
          monthNum = 12 + targetMonth;
          targetYear = currentYear - 1;
        }

        months.push(`${targetYear}-${String(monthNum).padStart(2, '0')}`);
      }
      startMonth = months[0];
      endMonth = months[months.length - 1];
      break;

    case 'ALL':
      // Desde minYear (Jan) até mês atual
      for (let y = minYear; y <= currentYear; y++) {
        const startM = (y === minYear) ? 1 : 1; // Sempre começa em Jan, ou ajustar se minMonth for necessário
        const endM = (y === currentYear) ? currentMonth : 12;

        for (let m = startM; m <= endM; m++) {
          months.push(`${y}-${String(m).padStart(2, '0')}`);
        }
      }
      startMonth = `${minYear}-01`;
      endMonth = months[months.length - 1];
      break;


    default:
      throw new Error(`Modo de range inválido: ${mode}`);
  }

  // Construir datas ISO para queries
  // startDateIso: primeiro dia do primeiro mês às 00:00:00
  const [startYear, startMonthNum] = startMonth.split('-').map(Number);
  const startDate = new Date(startYear, startMonthNum - 1, 1, 0, 0, 0, 0);
  const startDateIso = startDate.toISOString();

  // endDateIso: último dia do último mês às 23:59:59
  const [endYear, endMonthNum] = endMonth.split('-').map(Number);
  const endDate = new Date(endYear, endMonthNum, 0, 23, 59, 59, 999); // dia 0 = último dia do mês anterior
  const endDateIso = endDate.toISOString();

  return {
    months,
    startMonth,
    endMonth,
    startDateIso,
    endDateIso
  };
}
