export interface Metric {
    timestamp: number;
    duration: number;
}

export interface Stats {
    avg: number;
    p95: number;
    p99: number;
    count: number;
}

export interface Token {
    text: string;
    frequency: number;
    position?: number;
}

export interface SearchResult {
    docId: string;
    key: string;
    value: any;
    score: number;
    options?: any;
}

export interface Query {
    text: string;
    limit?: number;
    offset?: number;
    filters?: Record<string, any>;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    options?: any;
    tokens?: string[];
    timestamp?: number;
}

export interface ExecutionPlan {
    operation: string;
    indexes: string[];
    estimatedCost: number;
}

export interface Operation {
    type: 'put' | 'del' | 'get';
    key: string;
    value?: any;
}

export interface Transaction {
    operations: Operation[];
    put(key: string, value: any): void;
    del(key: string): void;
    get(key: string): Promise<any>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
}

export interface CacheEntry<T> {
    data: T;
    timestamp: number;
    hits: number;
}

export interface InvertedIndex {
    token: string;
    docCount: number;
    documents: Record<string, number>;
}

export interface ShardedIndex {
    shardId: string;
    search(tokens: string[]): Promise<SearchResult[]>;
    addDocument(docId: string, tokens: Record<string, number>): Promise<void>;
    removeDocument(docId: string, tokens: Record<string, number>): Promise<void>;
}