"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryExecutor = exports.QueryOptimizer = void 0;
const cache_1 = require("../cache/cache");
const tokenizer = require("../tokenizer/tokenizer");
class QueryOptimizer {
    constructor(performanceMonitor) {
        this.rareTokenThreshold = 5;
        this.commonTokenThreshold = 1000;
        this.tokenFrequencyCache = new cache_1.LRUCache(5000);
        this.performanceMonitor = performanceMonitor;
    }
    optimize(query, indexStats) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            try {
                const analysis = yield this.analyzeQuery(query.text, indexStats);
                const rewrittenQuery = this.rewriteQuery(query, analysis);
                const selectedIndexes = this.selectIndexes(analysis);
                const plan = this.generateExecutionPlan(rewrittenQuery, selectedIndexes, analysis);
                const duration = Date.now() - startTime;
                this.performanceMonitor.record('query_optimization', duration);
                return plan;
            }
            catch (error) {
                const duration = Date.now() - startTime;
                this.performanceMonitor.record('query_optimization_error', duration);
                throw error;
            }
        });
    }
    analyzeQuery(queryText, indexStats) {
        return __awaiter(this, void 0, void 0, function* () {
            const tokenizeResult = tokenizer.tokenize(queryText);
            const tokens = Object.keys(tokenizeResult);
            const tokenFrequencies = yield this.getTokenFrequencies(tokens, indexStats);
            const rareTokens = [];
            const commonTokens = [];
            for (const [token, frequency] of tokenFrequencies.entries()) {
                if (frequency <= this.rareTokenThreshold) {
                    rareTokens.push(token);
                }
                else if (frequency >= this.commonTokenThreshold) {
                    commonTokens.push(token);
                }
            }
            const estimatedResults = this.estimateResults(tokenFrequencies);
            let complexity = 'low';
            if (tokens.length > 5 || estimatedResults > 10000) {
                complexity = 'high';
            }
            else if (tokens.length > 3 || estimatedResults > 1000) {
                complexity = 'medium';
            }
            return {
                tokens,
                rareTokens,
                commonTokens,
                estimatedResults,
                complexity
            };
        });
    }
    getTokenFrequencies(tokens, indexStats) {
        return __awaiter(this, void 0, void 0, function* () {
            const frequencies = new Map();
            for (const token of tokens) {
                const cached = this.tokenFrequencyCache.get(token);
                if (cached !== undefined) {
                    frequencies.set(token, cached);
                    continue;
                }
                const frequency = indexStats.get(token) || 0;
                frequencies.set(token, frequency);
                this.tokenFrequencyCache.set(token, frequency);
            }
            return frequencies;
        });
    }
    estimateResults(tokenFrequencies) {
        if (tokenFrequencies.size === 0)
            return 0;
        const minFrequency = Math.min(...tokenFrequencies.values());
        const hasRareToken = Array.from(tokenFrequencies.values())
            .some(freq => freq <= this.rareTokenThreshold);
        if (hasRareToken) {
            return Math.max(1, Math.floor(minFrequency * 0.1));
        }
        return minFrequency;
    }
    rewriteQuery(query, analysis) {
        const rewritten = Object.assign({}, query);
        if (analysis.complexity === 'high' && !rewritten.limit) {
            rewritten.limit = 100;
        }
        if (analysis.rareTokens.length > 0 && !rewritten.limit) {
            rewritten.limit = Math.min(1000, rewritten.limit || 100);
        }
        return rewritten;
    }
    selectIndexes(analysis) {
        const selectedIndexes = [...analysis.rareTokens];
        for (const token of analysis.tokens) {
            if (!selectedIndexes.includes(token) && !analysis.commonTokens.includes(token)) {
                selectedIndexes.push(token);
            }
        }
        return selectedIndexes;
    }
    generateExecutionPlan(query, selectedIndexes, analysis) {
        let estimatedCost = analysis.estimatedResults;
        if (analysis.complexity === 'high') {
            estimatedCost *= 2;
        }
        else if (analysis.complexity === 'medium') {
            estimatedCost *= 1.5;
        }
        if (selectedIndexes.length === 0) {
            estimatedCost *= 10;
        }
        return {
            operation: 'search',
            indexes: selectedIndexes,
            estimatedCost
        };
    }
    cacheTokenFrequencies(indexStats) {
        return __awaiter(this, void 0, void 0, function* () {
            for (const [token, frequency] of indexStats.entries()) {
                this.tokenFrequencyCache.set(token, frequency);
            }
        });
    }
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
exports.QueryOptimizer = QueryOptimizer;
class QueryExecutor {
    constructor(performanceMonitor) {
        this.performanceMonitor = performanceMonitor;
    }
    executePlan(plan, searchFunction) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            try {
                let results = [];
                if (plan.indexes.length > 0) {
                    results = yield searchFunction(plan.indexes);
                }
                else {
                    results = [];
                }
                const duration = Date.now() - startTime;
                this.performanceMonitor.record('query_execution', duration);
                return results;
            }
            catch (error) {
                const duration = Date.now() - startTime;
                this.performanceMonitor.record('query_execution_error', duration);
                throw error;
            }
        });
    }
}
exports.QueryExecutor = QueryExecutor;
