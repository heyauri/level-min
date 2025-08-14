"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndexCache = exports.SearchCache = exports.LRUCache = void 0;
class LRUCache {
    constructor(maxSize = 1000, ttl = 300000) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.ttl = ttl;
        this.startCleanup();
    }
    startCleanup() {
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60000);
    }
    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.ttl) {
                this.cache.delete(key);
            }
        }
    }
    get(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return undefined;
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            return undefined;
        }
        entry.timestamp = Date.now();
        entry.hits++;
        this.cache.delete(key);
        this.cache.set(key, entry);
        return entry.data;
    }
    set(key, value) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
        this.cache.set(key, {
            data: value,
            timestamp: Date.now(),
            hits: 0
        });
    }
    has(key) {
        return this.cache.has(key) && this.get(key) !== undefined;
    }
    delete(key) {
        return this.cache.delete(key);
    }
    clear() {
        this.cache.clear();
    }
    size() {
        return this.cache.size;
    }
    getStats() {
        const now = Date.now();
        let expiredCount = 0;
        let totalHits = 0;
        for (const entry of this.cache.values()) {
            if (now - entry.timestamp > this.ttl) {
                expiredCount++;
            }
            totalHits += entry.hits;
        }
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            expiredCount,
            totalHits,
            averageHits: this.cache.size > 0 ? totalHits / this.cache.size : 0
        };
    }
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.clear();
    }
}
exports.LRUCache = LRUCache;
class SearchCache extends LRUCache {
    constructor(maxSize = 500) {
        super(maxSize, 180000);
    }
    static generateKey(query, limit, offset) {
        const parts = [query];
        if (limit)
            parts.push(`limit:${limit}`);
        if (offset)
            parts.push(`offset:${offset}`);
        return parts.join('|');
    }
}
exports.SearchCache = SearchCache;
class IndexCache extends LRUCache {
    constructor(maxSize = 2000) {
        super(maxSize, 300000);
    }
    static generateKey(token) {
        return `index:${token}`;
    }
}
exports.IndexCache = IndexCache;
