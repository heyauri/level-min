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
exports.BatchManager = exports.TransactionManager = void 0;
const events_1 = require("events");
class TransactionManager extends events_1.EventEmitter {
    constructor(db, lock) {
        super();
        this.activeTransactions = new Map();
        this.maxTransactionTime = 30000;
        this.db = db;
        this.lock = lock;
        this.startCleanup();
    }
    startCleanup() {
        setInterval(() => {
            this.cleanupExpiredTransactions();
        }, 10000);
    }
    cleanupExpiredTransactions() {
        const now = Date.now();
        for (const [id, transaction] of this.activeTransactions.entries()) {
            if (now - transaction.createdAt > this.maxTransactionTime) {
                this.activeTransactions.delete(id);
                this.emit('transactionExpired', { id, transaction });
            }
        }
    }
    begin() {
        return __awaiter(this, void 0, void 0, function* () {
            const transactionId = this.generateTransactionId();
            yield this.lock.writeLock();
            const transaction = new TransactionImpl(transactionId, this.db, this.lock);
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
        });
    }
    generateTransactionId() {
        return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    getActiveTransactions() {
        const now = Date.now();
        return Array.from(this.activeTransactions.entries()).map(([id, tx]) => ({
            id,
            operations: tx.operations.length,
            age: now - tx.createdAt
        }));
    }
}
exports.TransactionManager = TransactionManager;
class TransactionImpl extends events_1.EventEmitter {
    constructor(id, db, lock) {
        super();
        this.operations = [];
        this.committed = false;
        this.rolledback = false;
        this.originalData = new Map();
        this.id = id;
        this.db = db;
        this.lock = lock;
        this.createdAt = Date.now();
    }
    put(key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureActive();
            if (!this.originalData.has(key)) {
                try {
                    const originalValue = yield this.db.get(key);
                    this.originalData.set(key, originalValue);
                }
                catch (err) {
                    this.originalData.set(key, undefined);
                }
            }
            this.operations.push({ type: 'put', key, value });
        });
    }
    del(key) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureActive();
            if (!this.originalData.has(key)) {
                try {
                    const originalValue = yield this.db.get(key);
                    this.originalData.set(key, originalValue);
                }
                catch (err) {
                    this.originalData.set(key, undefined);
                }
            }
            this.operations.push({ type: 'del', key });
        });
    }
    get(key) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureActive();
            for (let i = this.operations.length - 1; i >= 0; i--) {
                const operation = this.operations[i];
                if (operation.key === key) {
                    if (operation.type === 'put') {
                        return operation.value;
                    }
                    else if (operation.type === 'del') {
                        return undefined;
                    }
                }
            }
            try {
                return yield this.db.get(key);
            }
            catch (err) {
                if (err.code === 'LEVEL_NOT_FOUND') {
                    return undefined;
                }
                throw err;
            }
        });
    }
    commit() {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureActive();
            try {
                if (this.operations.length > 0) {
                    yield this.db.batch(this.operations);
                }
                this.committed = true;
                this.emit('committed');
            }
            catch (error) {
                yield this.rollback();
                throw error;
            }
            finally {
                yield this.lock.unlock();
            }
        });
    }
    rollback() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.committed || this.rolledback) {
                return;
            }
            this.rolledback = true;
            try {
                const rollbackOperations = [];
                for (const [key, originalValue] of this.originalData) {
                    if (originalValue === undefined) {
                        rollbackOperations.push({ type: 'del', key });
                    }
                    else {
                        rollbackOperations.push({ type: 'put', key, value: originalValue });
                    }
                }
                if (rollbackOperations.length > 0) {
                    yield this.db.batch(rollbackOperations);
                }
            }
            catch (error) {
                console.error(`事务回滚失败: ${error.message}`);
                throw error;
            }
            finally {
                this.operations = [];
                this.originalData.clear();
                this.emit('rolledback');
                yield this.lock.unlock();
            }
        });
    }
    ensureActive() {
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
class BatchManager {
    constructor(db, batchSize = 100, flushInterval = 5000) {
        this.pendingOperations = [];
        this.flushTimeout = null;
        this.db = db;
        this.batchSize = batchSize;
        this.flushInterval = flushInterval;
    }
    put(key, value) {
        this.pendingOperations.push({ type: 'put', key, value });
        this.checkFlush();
    }
    del(key) {
        this.pendingOperations.push({ type: 'del', key });
        this.checkFlush();
    }
    checkFlush() {
        if (this.pendingOperations.length >= this.batchSize) {
            this.flush();
        }
        else if (!this.flushTimeout) {
            this.flushTimeout = setTimeout(() => {
                this.flush();
            }, this.flushInterval);
        }
    }
    flush() {
        return __awaiter(this, void 0, void 0, function* () {
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
                yield this.db.batch(operations);
            }
            catch (error) {
                this.pendingOperations.unshift(...operations);
                throw error;
            }
        });
    }
    forceFlush() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.flush();
        });
    }
    getStats() {
        return {
            pendingOperations: this.pendingOperations.length,
            batchSize: this.batchSize,
            flushInterval: this.flushInterval
        };
    }
}
exports.BatchManager = BatchManager;
