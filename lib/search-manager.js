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
exports.SearchManager = void 0;
const utils = require("./utils");
const cache_1 = require("./cache");
class SearchManager {
    constructor(dbManager, configManager, performanceMonitor) {
        this.dbManager = dbManager;
        this.configManager = configManager;
        this.performanceMonitor = performanceMonitor;
        this.searchCache = new cache_1.SearchCache(1000);
        this.indexCache = new cache_1.IndexCache(500);
    }
    search(query, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            try {
                const cacheKey = this.generateCacheKey(query, options);
                const cachedResult = this.searchCache.get(cacheKey);
                if (cachedResult) {
                    this.performanceMonitor.record("cache_hit", 1);
                    return cachedResult;
                }
                const db = this.dbManager.getDb();
                const lock = this.dbManager.getLock();
                yield lock.readLock();
                try {
                    if (options) {
                        yield this.configManager.updateOptions(options);
                    }
                    const queryObj = {
                        text: query,
                        options: this.configManager.getOptions(),
                        tokens: yield this.configManager.getTokensList(),
                        timestamp: Date.now()
                    };
                    const results = yield this.executeSearch(queryObj);
                    this.searchCache.set(cacheKey, results);
                    this.performanceMonitor.record("search_duration", Date.now() - startTime);
                    this.performanceMonitor.record("cache_miss", 1);
                    return results;
                }
                finally {
                    lock.unlock();
                }
            }
            catch (error) {
                console.error("Search operation failed:", error);
                throw error;
            }
        });
    }
    executeSearch(query) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = this.dbManager.getDb();
            const docCount = yield this.dbManager.getDocCount();
            const indexStats = this.dbManager.getIndexStats();
            if (!query.tokens || query.tokens.length === 0) {
                return [];
            }
            const relevantDocs = new Map();
            for (const token of query.tokens) {
                try {
                    let indexData;
                    const cachedIndex = this.indexCache.get(token);
                    if (cachedIndex) {
                        indexData = cachedIndex;
                        this.performanceMonitor.record("cache_hit", 1);
                    }
                    else {
                        const rawData = yield db.get("0x001_" + token);
                        indexData = JSON.parse(rawData);
                        this.indexCache.set(token, indexData);
                        this.performanceMonitor.record("cache_miss", 1);
                    }
                    const tfIdfScore = yield this.calTfIdf(token, indexData.l, docCount);
                    for (const docId of indexData.i) {
                        const currentScore = relevantDocs.get(docId) || 0;
                        relevantDocs.set(docId, currentScore + tfIdfScore);
                    }
                }
                catch (err) {
                    if (err.code !== "LEVEL_NOT_FOUND") {
                        console.error("Failed to search for token:", token, err);
                    }
                }
            }
            const results = [];
            for (const [docId, score] of relevantDocs) {
                try {
                    const docData = yield db.get("0x002_" + docId);
                    const doc = JSON.parse(docData);
                    results.push({
                        docId: docId,
                        key: doc.key,
                        value: doc.value,
                        score: score
                    });
                }
                catch (err) {
                    console.error("Failed to get document:", docId, err);
                }
            }
            results.sort((a, b) => b.score - a.score);
            return results;
        });
    }
    calTfIdf(token, tokenDocCount, totalDocCount) {
        return __awaiter(this, void 0, void 0, function* () {
            if (tokenDocCount === 0 || totalDocCount === 0) {
                return 0;
            }
            const tf = 1;
            const idf = Math.log(totalDocCount / tokenDocCount);
            return tf * idf;
        });
    }
    searchIndex(token) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            try {
                const db = this.dbManager.getDb();
                const lock = this.dbManager.getLock();
                yield lock.readLock();
                try {
                    const cachedIndex = this.indexCache.get(token);
                    if (cachedIndex) {
                        this.performanceMonitor.record("cache_hit", 1);
                        return cachedIndex.i;
                    }
                    const indexData = yield db.get("0x001_" + token);
                    const index = JSON.parse(indexData);
                    this.indexCache.set(token, index);
                    this.performanceMonitor.record("search_index_duration", Date.now() - startTime);
                    this.performanceMonitor.record("cache_miss", 1);
                    return index.i;
                }
                finally {
                    lock.unlock();
                }
            }
            catch (error) {
                if (error.code === "LEVEL_NOT_FOUND") {
                    return [];
                }
                console.error("Search index operation failed:", error);
                throw error;
            }
        });
    }
    generateCacheKey(query, options) {
        const optionsStr = options ? JSON.stringify(options) : "";
        return utils.generateSha1Hash(query + optionsStr);
    }
    clearSearchCache() {
        this.searchCache.clear();
    }
    clearIndexCache() {
        this.indexCache.clear();
    }
    getCacheStats() {
        return {
            searchCache: this.searchCache.getStats(),
            indexCache: this.indexCache.getStats()
        };
    }
}
exports.SearchManager = SearchManager;
