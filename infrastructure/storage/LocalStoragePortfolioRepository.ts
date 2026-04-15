/**
 * LocalStorage Implementation of PortfolioRepository
 * Contains the exact same storage logic from the original portfolioService
 * 
 * ============================================================
 * ASYNC WRAPPER
 * All methods return Promises (via Promise.resolve) to match
 * the async interface, enabling seamless swap to Supabase later.
 * ============================================================
 */

import { Portfolio, CustomItem, DashboardConfig, PortfolioEvent } from '../../types';
import {
    PortfolioRepository,
    CreatePortfolioDTO,
    CreateHistoryEventDTO
} from '../../domain/repositories/PortfolioRepository';
import { safeJsonParse } from '../../utils/storage';

// Storage Keys - Exact same as original
const STORAGE_KEY = 'patrio_portfolios';
const ITEMS_KEY_PREFIX = 'patrio_items_';
const DASHBOARD_KEY_PREFIX = 'patrio_dashboard_';
const HISTORY_KEY_PREFIX = 'patrio_history_';
const HISTORY_ARCHIVE_KEY = 'patrio_history_archive';
const LIFECYCLE_KEY = 'patrio_lifecycle_log';
const CATEGORIES_KEY = 'patrio_categories';

// Custom Event Name for real-time sidebar updates
export const PORTFOLIO_UPDATE_EVENT = 'patrio_portfolio_updated';

// Default configurations - Exact same as original
const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
    widgets: [
        { id: 'kpi_total', type: 'kpi', title: 'Valor Total', visible: true, order: 0 },
        { id: 'kpi_count', type: 'kpi', title: 'Quantidade de Itens', visible: true, order: 1 },
        { id: 'kpi_roi', type: 'kpi', title: 'Rentabilidade Total', visible: true, order: 2 },
        { id: 'chart_history', type: 'chart_area', title: 'Evolução Patrimonial', visible: true, order: 3 },
        { id: 'chart_categories', type: 'chart_bar', title: 'Distribuição por Categoria', visible: true, order: 4 },
    ]
};

const DEFAULT_CATEGORIES = ['Geral', 'Ações', 'Imóveis', 'Renda Fixa', 'Caixa', 'Veículos', 'Obras de Arte', 'Participações'];

const DEFAULT_CRITERIA = [
    "O ativo possui liquidez adequada para meus objetivos?",
    "Entendo profundamente como este ativo gera valor?",
    "O risco deste ativo é compatível com meu perfil?",
    "Este ativo pagou dividendos ou rendimentos constantes?",
    "A gestão/governança por trás do ativo é confiável?"
];

/**
 * LocalStorage implementation of PortfolioRepository
 * Maintains exact behavior from original portfolioService
 */
export class LocalStoragePortfolioRepository implements PortfolioRepository {

    // === PORTFOLIO CRUD ===

    async getAll(): Promise<Portfolio[]> {
        const data = localStorage.getItem(STORAGE_KEY);
        const rawPortfolios: Portfolio[] = safeJsonParse<Portfolio[]>(data, []);

        // Polyfill for legacy portfolios - exact same logic
        return rawPortfolios.map(p => ({
            ...p,
            objective: p.objective || 'growth',
            timeHorizon: p.timeHorizon || 'long',
            userConvictionScore: p.userConvictionScore ?? 5
        }));
    }

    async getById(id: string): Promise<Portfolio | undefined> {
        const portfolios = await this.getAll();
        return portfolios.find(p => p.id === id);
    }

    async create(data: CreatePortfolioDTO): Promise<Portfolio> {
        const portfolios = await this.getAll();
        const newPortfolio: Portfolio = {
            ...data,
            id: crypto.randomUUID(),
            value: 0,
            monthVar: 0,
            yearVar: 0,
            createdAt: new Date().toISOString(),
            lastAccessedAt: new Date().toISOString(),
            criteria: DEFAULT_CRITERIA,
            categoryTargets: {},
            objective: data.objective || 'growth',
            timeHorizon: data.timeHorizon || 'long',
            userConvictionScore: data.userConvictionScore ?? 5
        };
        const updatedPortfolios = [...portfolios, newPortfolio];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPortfolios));

        // Log Lifecycle Event
        await this.logLifecycleEvent('portfolio_create', newPortfolio);

        this.dispatchUpdateEvent();
        return newPortfolio;
    }

    async update(id: string, updates: Partial<Portfolio>): Promise<Portfolio | null> {
        const portfolios = await this.getAll();
        const index = portfolios.findIndex(p => p.id === id);
        if (index !== -1) {
            const updatedPortfolio = { ...portfolios[index], ...updates };
            portfolios[index] = updatedPortfolio;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolios));
            this.dispatchUpdateEvent();
            return updatedPortfolio;
        }
        return null;
    }

    async updateLastAccessed(id: string): Promise<void> {
        const portfolios = await this.getAll();
        const index = portfolios.findIndex(p => p.id === id);
        if (index !== -1) {
            portfolios[index].lastAccessedAt = new Date().toISOString();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolios));
            this.dispatchUpdateEvent();
        }
    }

    async delete(id: string): Promise<void> {
        const portfolios = await this.getAll();
        const portfolioToDelete = portfolios.find(p => p.id === id);

        if (portfolioToDelete) {
            // Archive history before deletion
            const portfolioHistory = await this.getHistoryEvents(id);
            await this.archiveHistoryEvents(id, portfolioHistory);

            // Log lifecycle event
            await this.logLifecycleEvent('portfolio_delete', portfolioToDelete);
        }

        const filteredPortfolios = portfolios.filter(p => p.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredPortfolios));

        // Remove associated data
        localStorage.removeItem(`${ITEMS_KEY_PREFIX}${id}`);
        localStorage.removeItem(`${DASHBOARD_KEY_PREFIX}${id}`);
        localStorage.removeItem(`${HISTORY_KEY_PREFIX}${id}`);

        this.dispatchUpdateEvent();
    }

    // === CUSTOM ITEMS (ASSETS) ===

    async getItems(portfolioId: string): Promise<CustomItem[]> {
        const data = localStorage.getItem(`${ITEMS_KEY_PREFIX}${portfolioId}`);
        return safeJsonParse<CustomItem[]>(data, []);
    }

    async saveItems(portfolioId: string, items: CustomItem[]): Promise<void> {
        localStorage.setItem(`${ITEMS_KEY_PREFIX}${portfolioId}`, JSON.stringify(items));
    }

    /**
     * AIDEV-NOTE: Bulk fetch all items for all user portfolios (dashboard optimization)
     * For localStorage, we iterate through all portfolios and merge their items
     */
    async getAllItems(): Promise<CustomItem[]> {
        const portfolios = await this.getAll();
        const allItems: (CustomItem & { portfolio_id?: string })[] = [];

        for (const portfolio of portfolios) {
            const items = await this.getItems(portfolio.id);
            // Add portfolio_id to each item for grouping in dashboard calculations
            items.forEach(item => {
                allItems.push({ ...item, portfolio_id: portfolio.id } as CustomItem & { portfolio_id: string });
            });
        }

        return allItems;
    }

    // === DASHBOARD CONFIG ===

    async getDashboardConfig(portfolioId: string): Promise<DashboardConfig> {
        const data = localStorage.getItem(`${DASHBOARD_KEY_PREFIX}${portfolioId}`);
        return safeJsonParse<DashboardConfig>(data, DEFAULT_DASHBOARD_CONFIG);
    }

    async saveDashboardConfig(portfolioId: string, config: DashboardConfig): Promise<void> {
        localStorage.setItem(`${DASHBOARD_KEY_PREFIX}${portfolioId}`, JSON.stringify(config));
    }

    // === CATEGORIES ===

    async getCategories(): Promise<string[]> {
        const data = localStorage.getItem(CATEGORIES_KEY);
        return safeJsonParse<string[]>(data, DEFAULT_CATEGORIES);
    }

    async addCategory(category: string): Promise<string[]> {
        const cleanCategory = category.trim();
        if (!cleanCategory) return this.getCategories();
        const categories = await this.getCategories();
        if (!categories.some(c => c.toLowerCase() === cleanCategory.toLowerCase())) {
            categories.push(cleanCategory);
            categories.sort((a, b) => a.localeCompare(b));
            localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
        }
        return categories;
    }

    // === HISTORY EVENTS ===

    async addHistoryEvent(portfolioId: string, event: CreateHistoryEventDTO): Promise<PortfolioEvent> {
        const key = `${HISTORY_KEY_PREFIX}${portfolioId}`;
        const existingData = localStorage.getItem(key);
        const events: PortfolioEvent[] = safeJsonParse<PortfolioEvent[]>(existingData, []);

        // Get portfolio name for snapshot
        const portfolio = await this.getById(portfolioId);

        const newEvent: PortfolioEvent = {
            id: crypto.randomUUID(),
            portfolioId,
            portfolioName: portfolio?.name,
            createdAt: new Date().toISOString(),
            ...event
        };

        const updatedEvents = [newEvent, ...events];
        localStorage.setItem(key, JSON.stringify(updatedEvents));
        return newEvent;
    }

    async getHistoryEvents(portfolioId: string): Promise<PortfolioEvent[]> {
        const key = `${HISTORY_KEY_PREFIX}${portfolioId}`;
        const data = localStorage.getItem(key);
        return safeJsonParse<PortfolioEvent[]>(data, []);
    }

    /**
     * AIDEV-NOTE: Bulk fetch all history events for all user portfolios (dashboard optimization)
     */
    async getAllHistoryEvents(): Promise<PortfolioEvent[]> {
        const portfolios = await this.getAll();
        let allEvents: PortfolioEvent[] = [];

        for (const portfolio of portfolios) {
            const events = await this.getHistoryEvents(portfolio.id);
            allEvents = [...allEvents, ...events];
        }

        // Include archive and lifecycle events
        const archiveEvents = await this.getHistoryArchive();
        const lifecycleEvents = await this.getLifecycleEvents();

        return [...allEvents, ...archiveEvents, ...lifecycleEvents];
    }

    async getHistoryArchive(): Promise<PortfolioEvent[]> {
        const archiveData = localStorage.getItem(HISTORY_ARCHIVE_KEY);
        return safeJsonParse<PortfolioEvent[]>(archiveData, []);
    }

    async getLifecycleEvents(): Promise<PortfolioEvent[]> {
        const lifecycleData = localStorage.getItem(LIFECYCLE_KEY);
        return safeJsonParse<PortfolioEvent[]>(lifecycleData, []);
    }

    async archiveHistoryEvents(portfolioId: string, events: PortfolioEvent[]): Promise<void> {
        const archiveData = localStorage.getItem(HISTORY_ARCHIVE_KEY);
        const currentArchive = safeJsonParse<PortfolioEvent[]>(archiveData, []);
        const newArchive = [...currentArchive, ...events];
        localStorage.setItem(HISTORY_ARCHIVE_KEY, JSON.stringify(newArchive));
    }

    async logLifecycleEvent(type: 'portfolio_create' | 'portfolio_delete', portfolio: Portfolio): Promise<void> {
        const existingData = localStorage.getItem(LIFECYCLE_KEY);
        const events: PortfolioEvent[] = safeJsonParse<PortfolioEvent[]>(existingData, []);

        const newEvent: PortfolioEvent = {
            id: crypto.randomUUID(),
            portfolioId: portfolio.id,
            portfolioName: portfolio.name,
            assetName: portfolio.name,
            assetCategory: 'Sistema',
            date: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            type: type,
            totalValue: 0,
            observation: type === 'portfolio_create'
                ? `Criação do portfólio ${portfolio.name}`
                : `Exclusão do portfólio ${portfolio.name}`
        };

        localStorage.setItem(LIFECYCLE_KEY, JSON.stringify([newEvent, ...events]));
    }

    async saveHistoryEvents(portfolioId: string, events: PortfolioEvent[]): Promise<void> {
        const key = `${HISTORY_KEY_PREFIX}${portfolioId}`;
        localStorage.setItem(key, JSON.stringify(events));
    }

    // === STORAGE MANAGEMENT ===

    dispatchUpdateEvent(): void {
        window.dispatchEvent(new Event(PORTFOLIO_UPDATE_EVENT));
    }
}
