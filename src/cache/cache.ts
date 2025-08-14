import { CacheEntry } from '../types/types';

export class LRUCache<K, V> {
    private cache = new Map<K, CacheEntry<V>>();
    private maxSize: number;
    private ttl: number; // Time to live in milliseconds
    private cleanupInterval: NodeJS.Timeout;

    constructor(maxSize: number = 1000, ttl: number = 300000) { // 5 minutes default TTL
        this.maxSize = maxSize;
        this.ttl = ttl;
        this.startCleanup();
    }

    private startCleanup(): void {
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60000); // Clean up every minute
    }

    private cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.ttl) {
                this.cache.delete(key);
            }
        }
    }

    get(key: K): V | undefined {
        const entry = this.cache.get(key);
        if (!entry) return undefined;

        // Check if expired
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            return undefined;
        }

        // Update access time and hit count
        entry.timestamp = Date.now();
        entry.hits++;
        
        // Move to front (LRU algorithm)
        this.cache.delete(key);
        this.cache.set(key, entry);
        
        return entry.data;
    }

    set(key: K, value: V): void {
        // If already exists, delete first
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }

        // If maximum size is reached, delete the oldest item
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

    has(key: K): boolean {
        return this.cache.has(key) && this.get(key) !== undefined;
    }

    delete(key: K): boolean {
        return this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    size(): number {
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

    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.clear();
    }
}

// Special cache for search results
export class SearchCache extends LRUCache<string, any[]> {
    constructor(maxSize: number = 500) {
        super(maxSize, 180000); // 3 minutes TTL
    }

    // Generate cache key
    static generateKey(query: string, limit?: number, offset?: number): string {
        const parts = [query];
        if (limit) parts.push(`limit:${limit}`);
        if (offset) parts.push(`offset:${offset}`);
        return parts.join('|');
    }
}

// Special cache for index
export class IndexCache extends LRUCache<string, any> {
    constructor(maxSize: number = 2000) {
        super(maxSize, 300000); // 5 minutes TTL
    }

    // Generate index cache key
    static generateKey(token: string): string {
        return `index:${token}`;
    }
}