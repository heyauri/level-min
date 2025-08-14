import { Query, ExecutionPlan, SearchResult } from '../types/types';
import { LRUCache } from '../cache/cache';
import { PerformanceMonitor } from '../monitor/monitor';
import * as tokenizer from '../tokenizer/tokenizer';

export interface QueryAnalysis {
    tokens: string[];
    rareTokens: string[];
    commonTokens: string[];
    estimatedResults: number;
    complexity: 'low' | 'medium' | 'high';
}

export class QueryOptimizer {
    private tokenFrequencyCache: LRUCache<string, number>;
    private performanceMonitor: PerformanceMonitor;
    private readonly rareTokenThreshold = 5; // Tokens with document count less than 5 are considered rare tokens
    private readonly commonTokenThreshold = 1000; // Tokens with document count greater than 1000 are considered common tokens

    constructor(performanceMonitor: PerformanceMonitor) {
        this.tokenFrequencyCache = new LRUCache<string, number>(5000);
        this.performanceMonitor = performanceMonitor;
    }

    async optimize(query: Query, indexStats: Map<string, number>): Promise<ExecutionPlan> {
        const startTime = Date.now();
        
        try {
            // 1. Query analysis
            const analysis = await this.analyzeQuery(query.text, indexStats);
            
            // 2. Query rewrite
            const rewrittenQuery = this.rewriteQuery(query, analysis);
            
            // 3. Index selection
            const selectedIndexes = this.selectIndexes(analysis);
            
            // 4. Execution plan generation
            const plan = this.generateExecutionPlan(rewrittenQuery, selectedIndexes, analysis);
            
            const duration = Date.now() - startTime;
            this.performanceMonitor.record('query_optimization', duration);
            
            return plan;
        } catch (error) {
            const duration = Date.now() - startTime;
            this.performanceMonitor.record('query_optimization_error', duration);
            throw error;
        }
    }

    private async analyzeQuery(queryText: string, indexStats: Map<string, number>): Promise<QueryAnalysis> {
        // Use tokenizer module for tokenization
        const tokenizeResult = tokenizer.tokenize(queryText);
        const tokens = Object.keys(tokenizeResult);
        
        // Get token frequency statistics
        const tokenFrequencies = await this.getTokenFrequencies(tokens, indexStats);
        
        // Classify tokens
        const rareTokens: string[] = [];
        const commonTokens: string[] = [];
        
        for (const [token, frequency] of tokenFrequencies.entries()) {
            if (frequency <= this.rareTokenThreshold) {
                rareTokens.push(token);
            } else if (frequency >= this.commonTokenThreshold) {
                commonTokens.push(token);
            }
        }
        
        // Estimate result count
        const estimatedResults = this.estimateResults(tokenFrequencies);
        
        // Evaluate complexity
        let complexity: 'low' | 'medium' | 'high' = 'low';
        if (tokens.length > 5 || estimatedResults > 10000) {
            complexity = 'high';
        } else if (tokens.length > 3 || estimatedResults > 1000) {
            complexity = 'medium';
        }
        
        return {
            tokens,
            rareTokens,
            commonTokens,
            estimatedResults,
            complexity
        };
    }



    private async getTokenFrequencies(tokens: string[], indexStats: Map<string, number>): Promise<Map<string, number>> {
        const frequencies = new Map<string, number>();
        
        for (const token of tokens) {
            // First check cache
            const cached = this.tokenFrequencyCache.get(token);
            if (cached !== undefined) {
                frequencies.set(token, cached);
                continue;
            }
            
            // Get frequency from indexStats
            const frequency = indexStats.get(token) || 0;
            frequencies.set(token, frequency);
            
            // Cache result
            this.tokenFrequencyCache.set(token, frequency);
        }
        
        return frequencies;
    }

    private estimateResults(tokenFrequencies: Map<string, number>): number {
        if (tokenFrequencies.size === 0) return 0;
        
        // Use minimum frequency as estimation (AND logic)
        const minFrequency = Math.min(...tokenFrequencies.values());
        
        // If there are rare tokens, significantly reduce estimation
        const hasRareToken = Array.from(tokenFrequencies.values())
            .some(freq => freq <= this.rareTokenThreshold);
        
        if (hasRareToken) {
            return Math.max(1, Math.floor(minFrequency * 0.1));
        }
        
        return minFrequency;
    }

    private rewriteQuery(query: Query, analysis: QueryAnalysis): Query {
        const rewritten = { ...query };
        
        // If query is too complex, automatically limit result count
        if (analysis.complexity === 'high' && !rewritten.limit) {
            rewritten.limit = 100;
        }
        
        // If there are rare tokens, increase limit count (because results may be few)
        if (analysis.rareTokens.length > 0 && !rewritten.limit) {
            rewritten.limit = Math.min(1000, rewritten.limit || 100);
        }
        
        return rewritten;
    }

    private selectIndexes(analysis: QueryAnalysis): string[] {
        // Prioritize rare token indexes because they can best narrow down result set
        const selectedIndexes = [...analysis.rareTokens];
        
        // Then select other tokens, but exclude overly common tokens
        for (const token of analysis.tokens) {
            if (!selectedIndexes.includes(token) && !analysis.commonTokens.includes(token)) {
                selectedIndexes.push(token);
            }
        }
        
        return selectedIndexes;
    }

    private generateExecutionPlan(
        query: Query, 
        selectedIndexes: string[], 
        analysis: QueryAnalysis
    ): ExecutionPlan {
        // Calculate estimated cost
        let estimatedCost = analysis.estimatedResults;
        
        // Adjust cost based on complexity
        if (analysis.complexity === 'high') {
            estimatedCost *= 2;
        } else if (analysis.complexity === 'medium') {
            estimatedCost *= 1.5;
        }
        
        // Adjust cost based on index selection
        if (selectedIndexes.length === 0) {
            estimatedCost *= 10; // No suitable index, cost is very high
        }
        
        return {
            operation: 'search',
            indexes: selectedIndexes,
            estimatedCost
        };
    }

    // Cache token frequency statistics
    async cacheTokenFrequencies(indexStats: Map<string, number>): Promise<void> {
        for (const [token, frequency] of indexStats.entries()) {
            this.tokenFrequencyCache.set(token, frequency);
        }
    }

    // Get optimization statistics
    getOptimizationStats() {
        return {
            cacheSize: this.tokenFrequencyCache.size(),
            cacheStats: this.tokenFrequencyCache.getStats(),
            thresholds: {
                rareToken: this.rareTokenThreshold,
                commonToken: this.commonTokenThreshold
            }
        };
    }
}

// Query executor
export class QueryExecutor {
    private performanceMonitor: PerformanceMonitor;

    constructor(performanceMonitor: PerformanceMonitor) {
        this.performanceMonitor = performanceMonitor;
    }

    async executePlan(
        plan: ExecutionPlan, 
        searchFunction: (tokens: string[]) => Promise<SearchResult[]>
    ): Promise<SearchResult[]> {
        const startTime = Date.now();
        
        try {
            let results: SearchResult[] = [];
            
            if (plan.indexes.length > 0) {
                // Execute search using selected indexes
                results = await searchFunction(plan.indexes);
            } else {
                // No indexes, return empty results
                results = [];
            }
            
            const duration = Date.now() - startTime;
            this.performanceMonitor.record('query_execution', duration);
            
            return results;
        } catch (error) {
            const duration = Date.now() - startTime;
            this.performanceMonitor.record('query_execution_error', duration);
            throw error;
        }
    }
}