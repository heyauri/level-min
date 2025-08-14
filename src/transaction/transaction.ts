import { Operation, Transaction } from '../types/types';
import { ReadWriteLock } from '../lock/lock';
import { EventEmitter } from 'events';

export class TransactionManager extends EventEmitter {
    private activeTransactions = new Map<string, TransactionImpl>();
    private lock: ReadWriteLock;
    private db: any; // LevelDB instance
    private maxTransactionTime = 30000; // 30 seconds timeout

    constructor(db: any, lock: ReadWriteLock) {
        super();
        this.db = db;
        this.lock = lock;
        this.startCleanup();
    }

    private startCleanup(): void {
        setInterval(() => {
            this.cleanupExpiredTransactions();
        }, 10000); // Clean up every 10 seconds
    }

    private cleanupExpiredTransactions(): void {
        const now = Date.now();
        for (const [id, transaction] of this.activeTransactions.entries()) {
            if (now - transaction.createdAt > this.maxTransactionTime) {
                this.activeTransactions.delete(id);
                this.emit('transactionExpired', { id, transaction });
            }
        }
    }

    async begin(): Promise<Transaction> {
        const transactionId = this.generateTransactionId();
        await this.lock.writeLock();
        
        const transaction = new TransactionImpl(
            transactionId,
            this.db,
            this.lock
        );
        
        this.activeTransactions.set(transactionId, transaction);
        
        transaction.once('committed', () => {
            this.activeTransactions.delete(transactionId);
            this.emit('transactionCommitted', { id: transactionId, transaction });
        });
        
        transaction.once('rolledback', () => {
            this.activeTransactions.delete(transactionId);
            this.emit('transactionRolledback', { id: transactionId, transaction });
        });
        
        return transaction;
    }

    private generateTransactionId(): string {
        return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getActiveTransactions(): Array<{ id: string; operations: number; age: number }> {
        const now = Date.now();
        return Array.from(this.activeTransactions.entries()).map(([id, tx]) => ({
            id,
            operations: tx.operations.length,
            age: now - tx.createdAt
        }));
    }
}

class TransactionImpl extends EventEmitter implements Transaction {
    public operations: Operation[] = [];
    public readonly createdAt: number;
    private readonly id: string;
    private readonly db: any;
    private readonly lock: ReadWriteLock;
    private committed = false;
    private rolledback = false;
    private originalData: Map<string, any> = new Map(); // Store original data for rollback

    constructor(id: string, db: any, lock: ReadWriteLock) {
        super();
        this.id = id;
        this.db = db;
        this.lock = lock;
        this.createdAt = Date.now();
    }

    async put(key: string, value: any): Promise<void> {
        this.ensureActive();
        // Save original data for rollback
        if (!this.originalData.has(key)) {
            try {
                const originalValue = await this.db.get(key);
                this.originalData.set(key, originalValue);
            } catch (err: any) {
                // If key doesn't exist, mark as undefined
                if (err.code === 'LEVEL_NOT_FOUND') {
                    this.originalData.set(key, undefined);
                } else {
                    throw err;
                }
            }
        }
        this.operations.push({ type: 'put', key, value });
    }

    async del(key: string): Promise<void> {
        this.ensureActive();
        // 保存原始数据用于回滚
        if (!this.originalData.has(key)) {
            try {
                const originalValue = await this.db.get(key);
                this.originalData.set(key, originalValue);
            } catch (err: any) {
                // 如果键不存在，标记为undefined
                if (err.code === 'LEVEL_NOT_FOUND') {
                    this.originalData.set(key, undefined);
                } else {
                    throw err;
                }
            }
        }
        this.operations.push({ type: 'del', key });
    }

    async get(key: string): Promise<any> {
        this.ensureActive();
        
        // First check operations in transaction, return latest state
        for (let i = this.operations.length - 1; i >= 0; i--) {
            const operation = this.operations[i];
            if (operation.key === key) {
                if (operation.type === 'put') {
                    return operation.value;
                } else if (operation.type === 'del') {
                    return undefined;
                }
            }
        }
        
        // If no related operations in transaction, query database
        try {
            return await this.db.get(key);
        } catch (err: any) {
            if (err.code === 'LEVEL_NOT_FOUND') {
                return undefined;
            }
            throw err;
        }
    }

    async commit(): Promise<void> {
        this.ensureActive();
        
        try {
            if (this.operations.length > 0) {
                await this.db.batch(this.operations);
            }
            
            this.committed = true;
            this.emit('committed');
        } catch (error) {
            await this.rollback();
            throw error;
        } finally {
            await this.lock.unlock();
        }
    }

    async rollback(): Promise<void> {
        if (this.committed || this.rolledback) {
            return;
        }
        
        this.rolledback = true;
        
        try {
            // Restore original data
            const rollbackOperations: Operation[] = [];
            
            for (const [key, originalValue] of this.originalData) {
                if (originalValue === undefined) {
                    // If original value doesn't exist, this key was newly added, need to delete
                    rollbackOperations.push({ type: 'del', key });
                } else {
                    // Restore original value
                    rollbackOperations.push({ type: 'put', key, value: originalValue });
                }
            }
            
            // Execute rollback operations
            if (rollbackOperations.length > 0) {
                await this.db.batch(rollbackOperations);
            }
            
        } catch (error) {
            console.error(`Transaction rollback failed: ${error.message}`);
            throw error;
        } finally {
            this.operations = [];
            this.originalData.clear();
            this.emit('rolledback');
            await this.lock.unlock();
        }
    }

    private ensureActive(): void {
        if (this.committed) {
            throw new Error('Transaction has already been committed');
        }
        if (this.rolledback) {
            throw new Error('Transaction has already been rolled back');
        }
    }

    getStats() {
        return {
            id: this.id,
            operations: this.operations.length,
            createdAt: this.createdAt,
            age: Date.now() - this.createdAt,
            committed: this.committed,
            rolledback: this.rolledback
        };
    }
}

// Batch operation manager
export class BatchManager {
    private db: any;
    private pendingOperations: Operation[] = [];
    private batchSize: number;
    private flushTimeout: NodeJS.Timeout | null = null;
    private flushInterval: number;

    constructor(db: any, batchSize: number = 100, flushInterval: number = 5000) {
        this.db = db;
        this.batchSize = batchSize;
        this.flushInterval = flushInterval;
    }

    put(key: string, value: any): void {
        this.pendingOperations.push({ type: 'put', key, value });
        this.checkFlush();
    }

    del(key: string): void {
        this.pendingOperations.push({ type: 'del', key });
        this.checkFlush();
    }

    private checkFlush(): void {
        if (this.pendingOperations.length >= this.batchSize) {
            this.flush();
        } else if (!this.flushTimeout) {
            this.flushTimeout = setTimeout(() => {
                this.flush();
            }, this.flushInterval);
        }
    }

    async flush(): Promise<void> {
        if (this.pendingOperations.length === 0) {
            return;
        }

        if (this.flushTimeout) {
            clearTimeout(this.flushTimeout);
            this.flushTimeout = null;
        }

        const operations = [...this.pendingOperations];
        this.pendingOperations = [];

        try {
            await this.db.batch(operations);
        } catch (error) {
            // If failed, re-add to pending queue
            this.pendingOperations.unshift(...operations);
            throw error;
        }
    }

    async forceFlush(): Promise<void> {
        await this.flush();
    }

    getStats() {
        return {
            pendingOperations: this.pendingOperations.length,
            batchSize: this.batchSize,
            flushInterval: this.flushInterval
        };
    }
}