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
exports.QueryProfiler = exports.measurePerformance = exports.PerformanceMonitor = void 0;
const events_1 = require("events");
class PerformanceMonitor extends events_1.EventEmitter {
    constructor() {
        super();
        this.metrics = new Map();
        this.maxMetricsPerOperation = 1000;
        this.startCleanup();
    }
    startCleanup() {
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 300000);
    }
    cleanup() {
        const now = Date.now();
        const oneHourAgo = now - 3600000;
        for (const [operation, metrics] of this.metrics.entries()) {
            const filtered = metrics
                .filter(m => m.timestamp > oneHourAgo)
                .slice(-this.maxMetricsPerOperation);
            if (filtered.length !== metrics.length) {
                this.metrics.set(operation, filtered);
            }
        }
    }
    record(operation, duration) {
        if (!this.metrics.has(operation)) {
            this.metrics.set(operation, []);
        }
        const metric = {
            timestamp: Date.now(),
            duration
        };
        this.metrics.get(operation).push(metric);
        this.emit('metricRecorded', { operation, duration });
        if (duration > this.getThreshold(operation)) {
            this.emit('performanceWarning', {
                operation,
                duration,
                threshold: this.getThreshold(operation)
            });
        }
    }
    getThreshold(operation) {
        const thresholds = {
            'search': 1000,
            'create': 500,
            'update': 300,
            'delete': 200,
            'get': 50,
            'batch': 2000
        };
        return thresholds[operation] || 1000;
    }
    getStats(operation) {
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
    percentile(sortedArray, p) {
        const index = Math.ceil((p / 100) * sortedArray.length) - 1;
        return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
    }
    getRecentMetrics(operation, minutes = 60) {
        const cutoff = Date.now() - (minutes * 60000);
        return (this.metrics.get(operation) || []).filter(m => m.timestamp > cutoff);
    }
    getAllStats() {
        const stats = {};
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
    reset() {
        this.metrics.clear();
        this.emit('reset');
    }
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.reset();
    }
}
exports.PerformanceMonitor = PerformanceMonitor;
function measurePerformance(operation) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        const monitor = target.performanceMonitor || new PerformanceMonitor();
        descriptor.value = function (...args) {
            return __awaiter(this, void 0, void 0, function* () {
                const startTime = Date.now();
                try {
                    const result = yield originalMethod.apply(this, args);
                    const duration = Date.now() - startTime;
                    monitor.record(operation, duration);
                    return result;
                }
                catch (error) {
                    const duration = Date.now() - startTime;
                    monitor.record(`${operation}_error`, duration);
                    throw error;
                }
            });
        };
        return descriptor;
    };
}
exports.measurePerformance = measurePerformance;
class QueryProfiler {
    constructor() {
        this.queries = new Map();
        this.slowQueryThreshold = 1000;
    }
    recordQuery(query, duration) {
        const queryHash = this.hashQuery(query);
        if (!this.queries.has(queryHash)) {
            this.queries.set(queryHash, []);
        }
        this.queries.get(queryHash).push({
            duration,
            timestamp: Date.now()
        });
        if (duration > this.slowQueryThreshold) {
            console.warn(`Slow query detected: ${query} (${duration}ms)`);
        }
    }
    hashQuery(query) {
        return query.replace(/\s+/g, ' ').trim().toLowerCase();
    }
    getSlowQueries(limit = 10) {
        const slowQueries = [];
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
    getQueryStats(query) {
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
exports.QueryProfiler = QueryProfiler;
