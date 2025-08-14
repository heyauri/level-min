import * as utils from "../utils/utils";
import * as tokenizer from "../tokenizer/tokenizer";
import { ReadWriteLock, globalLock } from "../lock/lock";
import { SearchCache, IndexCache } from "../cache/cache";
import { TransactionManager, BatchManager } from "../transaction/transaction";
import { PerformanceMonitor } from "../monitor/monitor";
import { QueryOptimizer, QueryExecutor } from "../optimizer/optimizer";
import { Query, SearchResult } from "../types/types";
import * as path from "path";

export class DatabaseManager {
    private db: any;
    private docCount: number;
    private lock: ReadWriteLock;
    private transactionManager: TransactionManager;
    private batchManager: BatchManager;
    private performanceMonitor: PerformanceMonitor;
    private queryOptimizer: QueryOptimizer;
    private queryExecutor: QueryExecutor;
    private indexStats: Map<string, number>;

    constructor() {
        this.docCount = 0;
        this.lock = globalLock;
        this.indexStats = new Map();
    }

    async initializeDatabase(dbAddress, options) {
        const { Level } = require("level");
        
        try {
            // If path is not absolute, join with current working directory
            if (!path.isAbsolute(dbAddress)) {
                dbAddress = path.join(process.cwd(), dbAddress);
            }
            
            // If there's an existing database connection, close it first
            if (this.db) {
                try {
                    if (this.db.status === 'open') {
                        await this.db.close();
                    }
                } catch (closeError) {
                    console.warn('Warning when closing existing database connection:', closeError.message);
                }
            }
            
            options = options || {};
            this.db = new Level(dbAddress, options);

            // Try to open database, wait and retry if failed
            let maxRetries = 3;
            let retryDelay = 100; // ms
            
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    console.log(`Attempting to open database (attempt ${attempt}/${maxRetries}), current status: ${this.db.status || 'unknown'}`);
                    if (!this.db.status || this.db.status !== 'open') {
                        await this.db.open();
                    }
                    console.log(`Database opened successfully, status: ${this.db.status}`);
                    break; // Successfully opened, break retry loop
                } catch (openError) {
                    console.log(`Failed to open database (attempt ${attempt}/${maxRetries}):`, openError.code || openError.message);
                    if (attempt === maxRetries) {
                        console.error(`Reached maximum retry count ${maxRetries}, giving up`);
                        throw openError; // Last retry failed, throw error
                    }
                    
                    // If it's a lock error, wait and retry
                    if (openError.code === 'LEVEL_LOCKED' || (openError.cause && openError.cause.code === 'LEVEL_LOCKED')) {
                        console.warn(`Database is locked, waiting ${retryDelay}ms before retry (attempt ${attempt}/${maxRetries})`);
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                        retryDelay *= 2; // Exponential backoff
                    } else {
                        console.error(`Non-lock error, throwing directly:`, openError.code || openError.message);
                        throw openError; // Other errors, throw directly
                    }
                }
            }

            // Initialize optimization components
            this.transactionManager = new TransactionManager(this.db, this.lock);
            this.batchManager = new BatchManager(this.db, 100, 5000);
            this.performanceMonitor = new PerformanceMonitor();
            this.queryOptimizer = new QueryOptimizer(this.performanceMonitor);
            this.queryExecutor = new QueryExecutor(this.performanceMonitor);

            try {
                const val = await this.db.get("0x000_docCount");
                this.docCount = parseInt(val) ? parseInt(val) : 0;

                // Initialize index statistics
                await this.initializeIndexStats();
            } catch (err) {
                if (err.code === "LEVEL_NOT_FOUND") {
                    this.docCount = 0;
                } else {
                    throw err;
                }
            }

            console.log("Leveldb selected: " + dbAddress);
        } catch (e) {
            console.error("Leveldb setup failed at: " + dbAddress + " \nPlease check your dbAddress and options.");
            console.error(e);
            throw e;
        }
    }

    // Initialize index statistics
    private async initializeIndexStats(): Promise<void> {
        try {
            // Iterate through all index keys, count token frequencies
            for await (const [key, value] of this.db.iterator({
                gte: "0x001_",
                lte: "0x002_"
            })) {
                if (!value) {
                    console.warn(`Index data for key ${key} is undefined, skipping`);
                    continue;
                }
                const indexData = JSON.parse(value);
                const token = key.substring(5); // Remove "0x001_" prefix
                this.indexStats.set(token, indexData.l);
            }

            // Cache token frequencies
            await this.queryOptimizer.cacheTokenFrequencies(this.indexStats);
        } catch (error) {
            console.warn("Failed to initialize index stats:", error);
        }
    }

    async getDocCount() {
        // Return docCount from memory directly, ensure sync with actual operations
        return this.docCount || 0;
    }

    async dumpAllDocuments() {
        console.log('Dumping all documents from database:');
        for await (const data of this.db.iterator()) {
            console.log('Document:', data);
        }
    }

    async recalculateDocumentCount() {
        console.log('Recalculating document count...');
        let docCount = 0;
        let pattern = /^0x002_/;
        let db = this.db;
        for await (const key of db.keys({ lte: "0x003_" })) {
            if (pattern.test(key)) docCount++;
        }
        console.log(`Recalculated document count: ${docCount}`);
        return docCount;
    }

    // Close database connection and clean up resources
    async close() {
        try {
            // Close database connection
            if (this.db && this.db.status === 'open') {
                await this.db.close();
                console.log('Database connection closed');
            }
            
            // Reset state
            this.db = null;
            this.docCount = 0;
            this.indexStats.clear();
            
            console.log('Database manager closed successfully');
        } catch (error) {
            console.error('Error closing database manager:', error);
            throw error;
        }
    }

    // Getter methods for accessing private properties
    getDb() {
        return this.db;
    }

    getLock() {
        return this.lock;
    }

    getTransactionManager() {
        return this.transactionManager;
    }

    getBatchManager() {
        return this.batchManager;
    }

    getPerformanceMonitor() {
        return this.performanceMonitor;
    }

    getQueryOptimizer() {
        return this.queryOptimizer;
    }

    getQueryExecutor() {
        return this.queryExecutor;
    }

    getIndexStats() {
        return this.indexStats;
    }

    setDocCount(count: number) {
        this.docCount = count;
    }
}