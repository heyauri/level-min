import * as utils from "../utils/utils";
import { DatabaseManager } from "./database-manager";
import { ConfigManager } from "../config/config-manager";
import { PerformanceMonitor } from "../monitor/monitor";
import { SearchCache, IndexCache } from "../cache/cache";
import { Query, SearchResult } from "../types/types";
import * as tokenizer from "../tokenizer/tokenizer";

export class SearchManager {
    private dbManager: DatabaseManager;
    private configManager: ConfigManager;
    private performanceMonitor: PerformanceMonitor;
    private searchCache: SearchCache;
    private indexCache: IndexCache;

    constructor(dbManager: DatabaseManager, configManager: ConfigManager, performanceMonitor: PerformanceMonitor) {
        this.dbManager = dbManager;
        this.configManager = configManager;
        this.performanceMonitor = performanceMonitor;
        this.searchCache = new SearchCache(1000); // 1000 items
        this.indexCache = new IndexCache(500); // 500 items
    }

    // Search documents
    async search(query: string, options?: any): Promise<SearchResult[]> {
        const startTime = Date.now();
        
        try {
            // Check cache
            const cacheKey = this.generateCacheKey(query, options);
            const cachedResult = this.searchCache.get(cacheKey);
            if (cachedResult) {
                this.performanceMonitor.record("cache_hit", 1);
                return cachedResult;
            }
            
            const db = this.dbManager.getDb();
            const lock = this.dbManager.getLock();
            
            // Acquire read lock
            await lock.readLock();
            
            try {
                // Process options
                if (options) {
                    await this.configManager.updateOptions(options);
                }
                
                // Tokenize query text
                const queryTokenResult = await tokenizer.tokenize(query);
                const queryTokens = queryTokenResult && typeof queryTokenResult === 'object' ? Object.keys(queryTokenResult) : [];
                
                // Build query object
                const queryObj: Query = {
                    text: query,
                    options: this.configManager.getOptions(),
                    tokens: queryTokens,
                    timestamp: Date.now()
                };
                
                // Execute search
                const results = await this.executeSearch(queryObj);
                
                // Cache results
                this.searchCache.set(cacheKey, results);
                
                // Record performance metrics
                this.performanceMonitor.record("search", Date.now() - startTime);
                this.performanceMonitor.record("cache_miss", 1);
                
                return results;
            } finally {
                // Release lock
                lock.unlock();
            }
        } catch (error) {
            console.error("Search operation failed:", error);
            throw error;
        }
    }

    // Execute search
    private async executeSearch(query: Query): Promise<SearchResult[]> {
        const db = this.dbManager.getDb();
        const docCount = await this.dbManager.getDocCount();
        const indexStats = this.dbManager.getIndexStats();
        
        if (!query.tokens || !Array.isArray(query.tokens) || query.tokens.length === 0) {
            return [];
        }
        
        // Collect relevant documents
        const relevantDocs = new Map<string, number>(); // docId -> score
        
        for (const token of query.tokens) {
            try {
                // Check index cache
                let indexData;
                const cachedIndex = this.indexCache.get(token);
                if (cachedIndex && cachedIndex.i && cachedIndex.l !== undefined) {
                    indexData = cachedIndex;
                    this.performanceMonitor.record("cache_hit", 1);
                } else {
                    // Get index from database
                const rawData = await db.get("0x001_" + token);
                if (!rawData) {
                    continue; // Index doesn't exist, skip this token
                }
                indexData = JSON.parse(rawData);
                    
                    // Cache index
                    this.indexCache.set(token, indexData);
                    this.performanceMonitor.record("cache_miss", 1);
                }
                
                // Update relevant document scores
                for (const docInfo of indexData.i) {
                    const docId = docInfo.docId;
                    const frequency = docInfo.frequency || 1;
                    
                    // Calculate actual TF-IDF score for each document
                    const docTfIdfScore = await this.calTfIdf(token, indexData.l, docCount, frequency);
                    const currentScore = relevantDocs.get(docId) || 0;
                    relevantDocs.set(docId, currentScore + docTfIdfScore);
                }
            } catch (err) {
                if (err.code !== "LEVEL_NOT_FOUND") {
                    console.error("Failed to search for token:", token, err);
                }
            }
        }
        
        // Get document details and sort
        const results: SearchResult[] = [];
        for (const [docId, score] of relevantDocs) {
            try {
                const docData = await db.get("0x002_" + docId);
                if (!docData) {
                    continue; // Document doesn't exist, skip
                }
                const doc = JSON.parse(docData);
                
                results.push({
                    docId: docId,
                    key: doc.key,
                    value: doc.value,
                    score: score
                });
            } catch (err) {
                console.error("Failed to get document:", docId, err);
            }
        }
        
        // Sort by score
        results.sort((a, b) => b.score - a.score);
        
        // Apply search options
        let finalResults = results;
        if (query.options) {
            // Apply offset
            if (query.options.offset && query.options.offset > 0) {
                finalResults = finalResults.slice(query.options.offset);
            }
            // Apply limit
            if (query.options.limit && query.options.limit > 0) {
                finalResults = finalResults.slice(0, query.options.limit);
            }
        }
        
        return finalResults;
    }

    // Calculate TF-IDF
    private async calTfIdf(token: string, tokenDocCount: number, totalDocCount: number, frequency: number = 1): Promise<number> {
        if (tokenDocCount === 0 || totalDocCount === 0) {
            return 0;
        }
        
        // TF (Term Frequency) - Calculate actual term frequency
        const tf = frequency;
        
        // IDF (Inverse Document Frequency)
        const idf = Math.log(totalDocCount / tokenDocCount);
        
        // TF-IDF
        return tf * idf;
    }

    // Search index
    async searchIndex(token: string): Promise<any> {
        const startTime = Date.now();
        
        try {
            const db = this.dbManager.getDb();
            const lock = this.dbManager.getLock();
            
            // Acquire read lock
            await lock.readLock();
            
            try {
                // Check index cache
                const cachedIndex = this.indexCache.get(token);
                if (cachedIndex && cachedIndex.i) {
                    this.performanceMonitor.record("cache_hit", 1);
                    return { v: cachedIndex.i };
                }
                
                // Get index from database
                const indexData = await db.get("0x001_" + token);
                if (!indexData) {
                    return { v: [] }; // Index doesn't exist, return empty array
                }
                const index = JSON.parse(indexData);
                
                // Cache index
                this.indexCache.set(token, index);
                
                // Record performance metrics
                this.performanceMonitor.record("search", Date.now() - startTime);
                this.performanceMonitor.record("cache_miss", 1);
                
                return { v: index.i };
            } finally {
                // Release lock
                lock.unlock();
            }
        } catch (error) {
            if (error.code === "LEVEL_NOT_FOUND") {
                return { v: [] };
            }
            console.error("Search index operation failed:", error);
            throw error;
        }
    }

    // Generate cache key
    private generateCacheKey(query: string, options?: any): string {
        const optionsStr = options ? JSON.stringify(options) : "";
        return utils.generateSha1Hash(query + optionsStr);
    }

    // Clear search cache
    clearSearchCache(): void {
        this.searchCache.clear();
    }

    // Clear index cache
    clearIndexCache(): void {
        this.indexCache.clear();
    }

    // Get cache statistics
    getCacheStats() {
        // 添加防御性检查，确保缓存对象存在
        if (!this.searchCache || !this.indexCache) {
            console.log('DEBUG: Cache objects not initialized');
            return {
                searchCache: {
                    size: 0,
                    maxSize: 0,
                    expiredCount: 0,
                    hits: 0,
                    totalHits: 0,
                    averageHits: 0
                },
                indexCache: {
                    size: 0,
                    maxSize: 0,
                    expiredCount: 0,
                    hits: 0,
                    totalHits: 0,
                    averageHits: 0
                }
            };
        }
        
        const searchStats = this.searchCache.getStats();
        const indexStats = this.indexCache.getStats();
        
        console.log('DEBUG: Raw searchStats:', searchStats);
        console.log('DEBUG: Raw indexStats:', indexStats);
        
        // 确保返回的对象包含测试期望的hits属性
        const formatStats = (stats: any) => {
            if (!stats) {
                console.log('DEBUG: Stats is null/undefined');
                return {
                    size: 0,
                    maxSize: 0,
                    expiredCount: 0,
                    hits: 0,
                    totalHits: 0,
                    averageHits: 0
                };
            }
            const formatted = {
                ...stats,
                hits: stats.totalHits || 0
            };
            console.log('DEBUG: Formatted stats:', formatted);
            return formatted;
        };
        
        const result = {
            searchCache: formatStats(searchStats),
            indexCache: formatStats(indexStats)
        };
        
        console.log('DEBUG: Final result:', result);
        return result;
    }
}