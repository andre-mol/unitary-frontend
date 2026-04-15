
/**
 * Chart Helpers for Normalization
 * 
 * Normaliza os dados para mostrar a rentabilidade acumulada do portfólio
 * comparando com o CUSTO DE AQUISIÇÃO (não o primeiro ponto do período).
 * 
 * Isso garante que se você comprou a R$1 e agora vale R$3,85, 
 * o gráfico mostra +285% em todo o período.
 */

export interface EvolutionPoint {
    name: string;
    fullDate: string;
    value: number; // Absolute currency
    valuePrice?: number; // Absolute currency or Return
    ibov?: number; // Base 100 (from RPC)
    cdi?: number;  // Base 100 (from RPC)
    ipca?: number; // Base 100 (from RPC)
    spx?: number;  // Base 100 (from RPC)
    ifix?: number; // Base 100 (from RPC)
    idiv?: number; // Base 100 (from RPC)
    smll?: number; // Base 100 (from RPC)
    ivvb11?: number; // Base 0 (decimal return)
}

export interface NormalizedPoint extends EvolutionPoint {
    normalizedValue: number; // Percentage
    normalizedValuePrice?: number; // Percentage
    normalizedIbov?: number; // Percentage
    normalizedCdi?: number;  // Percentage
    normalizedIpca?: number; // Percentage
    normalizedSpx?: number;  // Percentage
    normalizedIfix?: number; // Percentage
    normalizedIdiv?: number; // Percentage
    normalizedSmll?: number; // Percentage
    normalizedIvvb11?: number; // Percentage
}

/**
 * Normalizes evolution data using ACQUISITION COST as the portfolio baseline.
 * 
 * @param data - Array of evolution points with absolute values
 * @param acquisitionCost - Total cost of acquisition (custo de aquisição)
 * 
 * For portfolio: ((value / acquisitionCost) - 1) * 100 = rentabilidade acumulada
 * For benchmarks: Uses first valid point as baseline (variação no período)
 */
export function normalizeEvolutionData(data: EvolutionPoint[], acquisitionCost?: number): NormalizedPoint[] {
    if (!data || data.length === 0) return [];

    const sortedDetails = [...data].sort((a, b) =>
        new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime()
    );

    // CRITICAL FIX: The backend RPC get_portfolio_performance_daily returns decimal returns (0.10 = 10%).
    // We should CONSISTENTLY treat 'value' and 'valuePrice' as decimal returns if they represent performance.
    // If the caller provides acquisitionCost > 0, we assume 'value' is absolute currency and normalize it.
    // Otherwise, we assume it's already a decimal return series.

    const isAbsoluteCurrency = acquisitionCost && acquisitionCost > 0;

    if (!isAbsoluteCurrency) {
        // --- PERFORMANCE MODE (Decimal Returns) ---
        // Just convert 0.10 to 10 for display in Recharts
        return sortedDetails.map(point => {
            return {
                ...point,
                normalizedValue: point.value * 100, // 0.37 -> 37.0
                normalizedValuePrice: point.valuePrice !== undefined ? point.valuePrice * 100 : undefined,
                // These are already normalized by the caller/RPC
                normalizedCdi: point.cdi !== undefined ? point.cdi * 100 : undefined,
                normalizedIpca: point.ipca !== undefined ? point.ipca * 100 : undefined,
                normalizedIbov: point.ibov !== undefined ? point.ibov * 100 : undefined,
                normalizedSpx: point.spx !== undefined ? point.spx * 100 : undefined,
                normalizedIfix: point.ifix !== undefined ? point.ifix * 100 : undefined,
                normalizedIdiv: point.idiv !== undefined ? point.idiv * 100 : undefined,
                normalizedSmll: point.smll !== undefined ? point.smll * 100 : undefined,
                normalizedIvvb11: point.ivvb11 !== undefined ? point.ivvb11 * 100 : undefined
            };
        });
    }

    // --- CURRENCY MODE (NAV) ---

    // 2b. Find first valid point for benchmarks baseline
    const baselineIndex = sortedDetails.findIndex(d => d.value > 0);

    if (baselineIndex === -1) {
        return sortedDetails.map(d => ({
            ...d,
            normalizedValue: 0
        }));
    }

    const benchmarkBaseline = sortedDetails[baselineIndex];

    // 3. Determine portfolio baseline
    // AIDEV-FIX: Usar custo de aquisição como baseline para mostrar rentabilidade real
    // Se não fornecido, usa o primeiro valor válido (comportamento antigo)
    const portfolioBaseline = (acquisitionCost && acquisitionCost > 0)
        ? acquisitionCost
        : benchmarkBaseline.value;

    // 4. Process points
    let lastValidValue = benchmarkBaseline.value;

    return sortedDetails.map((point, index) => {
        // A. Handle Pre-Baseline (Pre-inception) - before first valid data
        if (index < baselineIndex) {
            // Calcular rentabilidade mesmo antes do primeiro ponto se temos custo
            const preNormalized = portfolioBaseline > 0
                ? ((point.value / portfolioBaseline) - 1) * 100
                : 0;
            return {
                ...point,
                normalizedValue: point.value > 0 ? preNormalized : 0,
                normalizedValuePrice: 0,
                normalizedIbov: undefined,
                normalizedCdi: undefined,
                normalizedIpca: undefined,
                normalizedSpx: undefined,
                normalizedIfix: undefined,
                normalizedIdiv: undefined,
                normalizedSmll: undefined,
                normalizedIvvb11: undefined
            };
        }

        // B. Update Last Valid Value (Forward Fill for gaps)
        if (point.value > 0) {
            lastValidValue = point.value;
        }

        // C. Normalize Portfolio: Rentabilidade vs Custo de Aquisição
        // Formula: ((Value_t / CustoAquisição) - 1) * 100
        const normalizedPortfolio = portfolioBaseline > 0
            ? ((lastValidValue / portfolioBaseline) - 1) * 100
            : 0;

        // D. Normalize Benchmarks:
        // Backend returns decimal returns (0.15 = 15%) — simply multiply by 100 for display
        const normalizeBenchmark = (val: number | undefined | null) => {
            if (val === undefined || val === null || isNaN(Number(val))) return undefined;
            return Number(val) * 100;
        };

        return {
            ...point,
            normalizedValue: normalizedPortfolio,
            normalizedValuePrice: 0, // Not calculated for Currency Mode yet
            normalizedIbov: normalizeBenchmark(point.ibov),
            normalizedCdi: normalizeBenchmark(point.cdi),
            normalizedIpca: normalizeBenchmark(point.ipca),
            normalizedSpx: normalizeBenchmark(point.spx),
            normalizedIfix: normalizeBenchmark(point.ifix),
            normalizedIdiv: normalizeBenchmark(point.idiv),
            normalizedSmll: normalizeBenchmark(point.smll),
            normalizedIvvb11: normalizeBenchmark(point.ivvb11)
        };
    });
}

/**
 * Rebases a series of geometric returns so that the first point in the range starts at 0.
 * Formula: (1 + CurrentCum) / (1 + StartCum) - 1
 * 
 * @param data - The full series of data
 * @param startDate - The start date of the visible range
 */
export function rebaseSeries(data: EvolutionPoint[], startDate: Date): EvolutionPoint[] {
    if (!data || data.length === 0) return [];

    // 1. Filter data within range
    const filtered = data.filter(d => new Date(d.fullDate) >= startDate);
    if (filtered.length === 0) return [];

    // 2. Find baseline values (the cumulative return at the start of the period)
    const baseline = filtered[0];
    const baseValue = baseline.value; // Total Return Cum
    const basePrice = baseline.valuePrice || 0; // Price Return Cum

    // 3. Rebase
    return filtered.map(d => {
        // Geometric Rebase: (1 + End) / (1 + Start) - 1
        // Note: Inputs are decimals (0.10 for 10%)

        const rebasedValue = ((1 + d.value) / (1 + baseValue)) - 1;

        let rebasedPrice = 0;
        if (d.valuePrice !== undefined) {
            rebasedPrice = ((1 + (d.valuePrice || 0)) / (1 + basePrice)) - 1;
        }

        return {
            ...d,
            value: rebasedValue,
            valuePrice: rebasedPrice,
            // Rebase benchmarks too if they are present?
            // Yes, benchmarks are also cumulative returns from RPC.
            // But are they? RPC returns `normalized`. 
            // If they are cumulative from the same start, we might need to rebase them too.
            // For now, let's assume benchmarks are already aligned or handle them in the UI.
            // Actually, get_benchmark_data RPC probably returns cumulative from p_start_date.
            // If we change the range on the client, we MUST rebase them too.
            ibov: d.ibov !== undefined ? ((1 + (d.ibov || 0)) / (1 + (baseline.ibov || 0)) - 1) : undefined,
            cdi: d.cdi !== undefined ? ((1 + (d.cdi || 0)) / (1 + (baseline.cdi || 0)) - 1) : undefined,
            ipca: d.ipca !== undefined ? ((1 + (d.ipca || 0)) / (1 + (baseline.ipca || 0)) - 1) : undefined,
            spx: d.spx !== undefined ? ((1 + (d.spx || 0)) / (1 + (baseline.spx || 0)) - 1) : undefined,
            ifix: d.ifix !== undefined ? ((1 + (d.ifix || 0)) / (1 + (baseline.ifix || 0)) - 1) : undefined,
            idiv: d.idiv !== undefined ? ((1 + (d.idiv || 0)) / (1 + (baseline.idiv || 0)) - 1) : undefined,
            smll: d.smll !== undefined ? ((1 + (d.smll || 0)) / (1 + (baseline.smll || 0)) - 1) : undefined,
            ivvb11: d.ivvb11 !== undefined ? ((1 + (d.ivvb11 || 0)) / (1 + (baseline.ivvb11 || 0)) - 1) : undefined,
        };
    });
}
