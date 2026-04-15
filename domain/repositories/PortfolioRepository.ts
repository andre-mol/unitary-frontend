/**
 * Portfolio Repository Interface
 * Defines the contract for portfolio data access
 * This abstraction allows swapping storage implementations (localStorage, Supabase, etc.)
 * 
 * ============================================================
 * ASYNC BY DESIGN
 * All methods return Promises to support both sync (localStorage)
 * and async (Supabase, API) implementations transparently.
 * ============================================================
 */

import { Portfolio, CustomItem, DashboardConfig, PortfolioEvent } from '../../types';

/**
 * Data Transfer Object for creating a new portfolio
 */
export type CreatePortfolioDTO = Omit<Portfolio, 'id' | 'value' | 'monthVar' | 'yearVar' | 'createdAt'>;

/**
 * Data Transfer Object for creating a new history event
 */
export type CreateHistoryEventDTO = Omit<PortfolioEvent, 'id' | 'portfolioId' | 'createdAt'>;

/**
 * Portfolio Repository Interface
 * Provides async data access methods without any business logic or calculations
 */
export interface PortfolioRepository {
    // === PORTFOLIO CRUD ===

    /**
     * Get all portfolios with legacy data polyfill
     */
    getAll(): Promise<Portfolio[]>;

    /**
     * Get a portfolio by ID
     */
    getById(id: string): Promise<Portfolio | undefined>;

    /**
     * Create a new portfolio
     */
    create(data: CreatePortfolioDTO): Promise<Portfolio>;

    /**
     * Update an existing portfolio
     */
    update(id: string, updates: Partial<Portfolio>): Promise<Portfolio | null>;

    /**
     * Update last accessed timestamp
     */
    updateLastAccessed(id: string): Promise<void>;

    /**
     * Delete a portfolio and all associated data
     */
    delete(id: string): Promise<void>;

    // === CUSTOM ITEMS (ASSETS) ===

    /**
     * Get all custom items for a portfolio
     */
    getItems(portfolioId: string): Promise<CustomItem[]>;

    /**
     * Get all custom items for ALL user portfolios (bulk fetch for dashboard)
     * AIDEV-NOTE: Used to optimize dashboard loading, reducing N+1 queries
     */
    getAllItems(): Promise<CustomItem[]>;

    /**
     * Save custom items for a portfolio
     */
    saveItems(portfolioId: string, items: CustomItem[]): Promise<void>;

    // === DASHBOARD CONFIG ===

    /**
     * Get dashboard configuration for a portfolio
     */
    getDashboardConfig(portfolioId: string): Promise<DashboardConfig>;

    /**
     * Save dashboard configuration for a portfolio
     */
    saveDashboardConfig(portfolioId: string, config: DashboardConfig): Promise<void>;

    // === CATEGORIES ===

    /**
     * Get all available categories
     */
    getCategories(): Promise<string[]>;

    /**
     * Add a new category
     */
    addCategory(category: string): Promise<string[]>;

    // === HISTORY EVENTS ===

    /**
     * Add a history event for a portfolio
     */
    addHistoryEvent(portfolioId: string, event: CreateHistoryEventDTO): Promise<PortfolioEvent>;

    /**
     * Get all history events for a portfolio
     */
    getHistoryEvents(portfolioId: string): Promise<PortfolioEvent[]>;

    /**
     * Get all history events for ALL user portfolios (bulk fetch for dashboard)
     * AIDEV-NOTE: Used to optimize dashboard loading, reducing N+1 queries
     */
    getAllHistoryEvents(): Promise<PortfolioEvent[]>;

    /**
     * Get archived history events (from deleted portfolios)
     */
    getHistoryArchive(): Promise<PortfolioEvent[]>;

    /**
     * Get lifecycle events (portfolio create/delete)
     */
    getLifecycleEvents(): Promise<PortfolioEvent[]>;

    /**
     * Archive history events before portfolio deletion
     */
    archiveHistoryEvents(portfolioId: string, events: PortfolioEvent[]): Promise<void>;

    /**
     * Log a portfolio lifecycle event (create/delete)
     */
    logLifecycleEvent(type: 'portfolio_create' | 'portfolio_delete', portfolio: Portfolio): Promise<void>;

    /**
     * Save history events for a portfolio
     */
    saveHistoryEvents(portfolioId: string, events: PortfolioEvent[]): Promise<void>;

    // === STORAGE MANAGEMENT ===

    /**
     * Dispatch update event to notify listeners
     */
    dispatchUpdateEvent(): void;
}
