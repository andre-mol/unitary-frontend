import { Portfolio, CustomItem } from '../../../types';

export interface Suggestion {
    assetId: string;
    assetName: string;
    categoryId: string;
    currentPrice: number;
    weight: number; 
    score: number;  
    suggestedAmount: number;
    suggestedQty: number;
    manualAmount?: number; 
    currentQty: number;
    currentTotalValue: number;
    currentPct: number; 
    idealPct: number;   
    projectedPct: number; 
}

export interface PortfolioQueueItem {
    portfolio: Portfolio;
    score: number;
    allocatedAmount: number;
    status: 'pending' | 'completed' | 'skipped';
}

export type FlowStep = 'input' | 'manual_selection' | 'preview' | 'execution';

export interface CategoryAnalysisItem {
    category: string;
    currentVal: number;
    currentPct: number;
    targetPct: number;
    targetVal: number;
    deficit: number;
    items: CustomItem[];
    suggestedAmount: number;
}

