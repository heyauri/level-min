import { Metric, Stats } from '../types/types';
import { EventEmitter } from 'events';

export class PerformanceMonitor extends EventEmitter {
    private metrics = new Map<string, Metric[]>();
    private maxMetricsPerOperation = 1000;
    private cleanupInterval: NodeJS.Timeout;

    constructor() {
        super();
        this.startCleanup();
    }

    private startCleanup(): void {
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 300000); // Clean up every 5 minutes
    }

    private cleanup(): void {
        const now = Date.now();
        const oneHourAgo = now - 3600000; // 1 hour ago

        for (const [operation, metrics] of this.metrics.entries()) {
            // Keep data from the last 1 hour, but maximum 1000 entries
            const filtered = metrics
                .filter(m => m.timestamp > oneHourAgo)
                .slice(-this.maxMetricsPerOperation);
            
            if (filtered.length !== metrics.length) {
                this.metrics.set(operation, filtered);
            }
        }
    }

    record(operation: string, duration: number): void {
        if (!this.metrics.has(operation)) {
            this.metrics.set(operation, []);
        }

        const metric: Metric = {
            timestamp: Date.now(),
            duration
        };

        this.metrics.get(operation)!.push(metric);
        
        // Trigger performance event
        this.emit('metricRecorded', { operation, duration });
        
        // If performance is abnormal, trigger warning
        if (duration > this.getThreshold(operation)) {
            this.emit('performanceWarning', { 
                operation, 
                duration, 
                threshold: this.getThreshold(operation) 
            });
        }
    }

    private getThreshold(operation: string): number {
        const thresholds: Record<string, number> = {
            'search': 1000,      // 1 second
            'create': 500,       // 500ms
            'update': 300,       // 300ms
            'delete': 200,       // 200ms
            'get': 50,           // 50ms
            'batch': 2000        // 2 seconds
        };
        return thresholds[operation] || 1000;
    }

    getStats(operation: string): Stats {
        const data = this.metrics.get(operation) || [];
        
        if (data.length === 0) {
            return { avg: 0, p95: 0, p99: 0, count: 0 };
        }

        const durations = data.map(m => m.duration).sort((a, b) => a - b);
        const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
        
        return {
            avg,
            p95: this.percentile(durations, 95),
            p99: this.percentile(durations, 99),
            count: data.length
        };
    }

    private percentile(sortedArray: number[], p: number): number {
        const index = Math.ceil((p / 100) * sortedArray.length) - 1;
        return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
    }

    getRecentMetrics(operation: string, minutes: number = 60): Metric[] {
        const cutoff = Date.now() - (minutes * 60000);
        return (this.metrics.get(operation) || []).filter(m => m.timestamp > cutoff);
    }

    getAllStats(): Record<string, Stats> {
        const stats: Record<string, Stats> = {};
        for (const operation of this.metrics.keys()) {
            stats[operation] = this.getStats(operation);
        }
        return stats;
    }

    getSystemStats() {
        const allStats = this.getAllStats();
        const totalOperations = Object.values(this.metrics)
            .reduce((sum, metrics) => sum + metrics.length, 0);
        
        return {
            totalOperations,
            operationTypes: Object.keys(allStats).length,
            averageResponseTime: Object.values(allStats)
                .reduce((sum, stat) => sum + stat.avg, 0) / Object.keys(allStats).length || 0,
            slowestOperation: Object.entries(allStats)
                .reduce((slowest, [op, stat]) => {
                    const avg = typeof stat === 'object' && stat !== null ? stat.avg : 0;
                    const slowestAvg = typeof slowest[1] === 'object' && slowest[1] !== null ? slowest[1].avg : 0;
                    return avg > slowestAvg ? [op, stat] : slowest;
                }, ['', { avg: 0 }])[0]
        };
    }

    reset(): void {
        this.metrics.clear();
        this.emit('reset');
    }

    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.reset();
    }
}

// Performance analysis decorator
export function measurePerformance(operation: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        const monitor = target.performanceMonitor || new PerformanceMonitor();
        
        descriptor.value = async function (...args: any[]) {
            const startTime = Date.now();
            try {
                const result = await originalMethod.apply(this, args);
                const duration = Date.now() - startTime;
                monitor.record(operation, duration);
                return result;
            } catch (error) {
                const duration = Date.now() - startTime;
                monitor.record(`${operation}_error`, duration);
                throw error;
            }
        };
        
        return descriptor;
    };
}

// Query performance analyzer
export class QueryProfiler {
    private queries = new Map<string, Array<{ duration: number; timestamp: number }>>();
    private slowQueryThreshold = 1000; // 1 second

    recordQuery(query: string, duration: number): void {
        const queryHash = this.hashQuery(query);
        
        if (!this.queries.has(queryHash)) {
            this.queries.set(queryHash, []);
        }
        
        this.queries.get(queryHash)!.push({
            duration,
            timestamp: Date.now()
        });
        
        // Record slow queries
        if (duration > this.slowQueryThreshold) {
            console.warn(`Slow query detected: ${query} (${duration}ms)`);
        }
    }

    private hashQuery(query: string): string {
        // Simple query hash for deduplication
        return query.replace(/\s+/g, ' ').trim().toLowerCase();
    }

    getSlowQueries(limit: number = 10): Array<{ query: string; avgDuration: number; count: number }> {
        const slowQueries: Array<{ 
            query: string; 
            avgDuration: number; 
            count: number 
        }> = [];

        for (const [queryHash, executions] of this.queries.entries()) {
            const avgDuration = executions.reduce((sum, e) => sum + e.duration, 0) / executions.length;
            
            if (avgDuration > this.slowQueryThreshold) {
                slowQueries.push({
                    query: queryHash,
                    avgDuration,
                    count: executions.length
                });
            }
        }

        return slowQueries
            .sort((a, b) => b.avgDuration - a.avgDuration)
            .slice(0, limit);
    }

    getQueryStats(query: string) {
        const queryHash = this.hashQuery(query);
        const executions = this.queries.get(queryHash) || [];
        
        if (executions.length === 0) {
            return null;
        }

        const durations = executions.map(e => e.duration);
        return {
            count: executions.length,
            avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
            minDuration: Math.min(...durations),
            maxDuration: Math.max(...durations)
        };
    }
}