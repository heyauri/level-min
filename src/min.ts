import { DatabaseManager } from './core/database-manager';
import { ConfigManager } from './config/config-manager';
import { DocumentManager } from './core/document-manager';
import { SearchManager } from './core/search-manager';
import { PerformanceMonitor } from './monitor/monitor';
import { SearchCache, IndexCache } from './cache/cache';
import { TransactionManager, BatchManager } from './transaction/transaction';
import { QueryOptimizer, QueryExecutor } from './optimizer/optimizer';
import { Query, SearchResult } from './types/types';

export class Min {
    private dbManager: DatabaseManager;
    private configManager: ConfigManager;
    private documentManager: DocumentManager;
    private searchManager: SearchManager;
    private performanceMonitor: PerformanceMonitor;
    private transactionManager: TransactionManager;
    private batchManager: BatchManager;
    private queryOptimizer: QueryOptimizer;
    private queryExecutor: QueryExecutor;
    private initialized: boolean;

    constructor() {
        this.dbManager = new DatabaseManager();
        this.configManager = new ConfigManager();
        this.performanceMonitor = new PerformanceMonitor();
        this.initialized = false;
    }

    async init(dbAddress: string, options?: any): Promise<void> {
        return this.initializeDatabase(dbAddress, options);
    }

    async initializeDatabase(dbAddress: string, options?: any): Promise<void> {
        if (this.initialized) {
            throw new Error('Min is already initialized');
        }

        try {
            // Initialize database
            await this.dbManager.initializeDatabase(dbAddress, options);
            
            // Initialize managers
            this.documentManager = new DocumentManager(
                this.dbManager,
                this.configManager,
                this.performanceMonitor
            );
            
            this.searchManager = new SearchManager(
                this.dbManager,
                this.configManager,
                this.performanceMonitor
            );
            
            this.transactionManager = this.dbManager.getTransactionManager();
            this.batchManager = this.dbManager.getBatchManager();
            this.queryOptimizer = this.dbManager.getQueryOptimizer();
            this.queryExecutor = this.dbManager.getQueryExecutor();
            
            this.initialized = true;
            console.log('Min initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Min:', error);
            throw error;
        }
    }

    // Document operations
    async create(key: string, value: any, options?: any): Promise<string> {
        this.ensureInitialized();
        return this.documentManager.create(key, value, options);
    }

    async update(key: string, value: any, options?: any): Promise<string> {
        this.ensureInitialized();
        return this.documentManager.update(key, value, options);
    }

    async put(key: string, value: any, options?: any): Promise<string> {
        this.ensureInitialized();
        try {
            // Try to create document
            return await this.documentManager.create(key, value, options);
        } catch (error) {
            // If document already exists, update it
            if (error.message === 'Document already exists') {
                return await this.documentManager.update(key, value, options);
            }
            throw error;
        }
    }

    async del(key: string): Promise<string> {
        this.ensureInitialized();
        return this.documentManager.del(key);
    }

    async get(key: string): Promise<any> {
        this.ensureInitialized();
        const value = await this.documentManager.get(key);
        return {
            key: key,
            value: value
        };
    }

    async cleanGet(key: string): Promise<any> {
        this.ensureInitialized();
        const value = await this.documentManager.get(key);
        return value;
    }

    // Search operations
    async search(query: string, options?: any): Promise<SearchResult[]> {
        this.ensureInitialized();
        return this.searchManager.search(query, options);
    }

    async searchIndex(token: string): Promise<any> {
        this.ensureInitialized();
        return this.searchManager.searchIndex(token);
    }

    // Batch operations
    async batchCreate(docs: Array<{ key: string; value: any; options?: any }>): Promise<string[]> {
        this.ensureInitialized();
        const results: string[] = [];
        
        for (const doc of docs) {
            const docId = await this.create(doc.key, doc.value, doc.options);
            results.push(docId);
        }
        
        return results;
    }

    // Transaction operations
    async createTransaction(): Promise<any> {
        this.ensureInitialized();
        return this.transactionManager.begin();
    }

    // Statistics and monitoring
    async getDocCount(): Promise<number> {
        this.ensureInitialized();
        return this.dbManager.getDocCount();
    }

    async getPerformanceStats(): Promise<any> {
        this.ensureInitialized();
        return this.performanceMonitor.getAllStats();
    }

    async getCacheStats(): Promise<any> {
        this.ensureInitialized();
        return this.searchManager.getCacheStats();
    }

    async getIndexStats(): Promise<any> {
        this.ensureInitialized();
        const indexStats = this.dbManager.getIndexStats();
        return Object.fromEntries(indexStats);
    }

    // Utility methods
    async dumpAllDocuments(): Promise<void> {
        this.ensureInitialized();
        return this.dbManager.dumpAllDocuments();
    }

    async recalculateDocumentCount(): Promise<number> {
        this.ensureInitialized();
        return this.dbManager.recalculateDocumentCount();
    }

    async optimizeIndex(): Promise<void> {
        this.ensureInitialized();
        // Implement index optimization logic
        console.log('Index optimization completed');
    }

    async clearCache(type: string = 'all'): Promise<void> {
        this.ensureInitialized();
        if (type === 'search' || type === 'all') {
            this.searchManager.clearSearchCache();
        }
        if (type === 'index' || type === 'all') {
            this.searchManager.clearIndexCache();
        }
    }

    // Cleanup and close
    async close(): Promise<void> {
        if (!this.initialized) {
            return;
        }

        try {
            // Close all managers
            if (this.performanceMonitor) {
                this.performanceMonitor.destroy();
            }
            
            if (this.searchManager) {
                this.searchManager.clearSearchCache();
                this.searchManager.clearIndexCache();
            }
            
            // Close database
            await this.dbManager.close();
            
            this.initialized = false;
            console.log('Min closed successfully');
        } catch (error) {
            console.error('Failed to close Min:', error);
            throw error;
        }
    }

    // Static method
    static async getdocid(key: string): Promise<string> {
        const { generateDocId } = await import('./utils/utils');
        return generateDocId(key);
    }

    // Private method
    private ensureInitialized(): void {
        if (!this.initialized) {
            throw new Error('Min is not initialized. Call init() first.');
        }
    }
}