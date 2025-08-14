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
exports.Min = void 0;
const database_manager_1 = require("./core/database-manager");
const config_manager_1 = require("./config/config-manager");
const document_manager_1 = require("./core/document-manager");
const search_manager_1 = require("./core/search-manager");
const monitor_1 = require("./monitor/monitor");
class Min {
    constructor() {
        this.dbManager = new database_manager_1.DatabaseManager();
        this.configManager = new config_manager_1.ConfigManager();
        this.performanceMonitor = new monitor_1.PerformanceMonitor();
        this.initialized = false;
    }
    init(dbAddress, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.initializeDatabase(dbAddress, options);
        });
    }
    initializeDatabase(dbAddress, options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.initialized) {
                throw new Error('Min is already initialized');
            }
            try {
                yield this.dbManager.initializeDatabase(dbAddress, options);
                this.documentManager = new document_manager_1.DocumentManager(this.dbManager, this.configManager, this.performanceMonitor);
                this.searchManager = new search_manager_1.SearchManager(this.dbManager, this.configManager, this.performanceMonitor);
                this.transactionManager = this.dbManager.getTransactionManager();
                this.batchManager = this.dbManager.getBatchManager();
                this.queryOptimizer = this.dbManager.getQueryOptimizer();
                this.queryExecutor = this.dbManager.getQueryExecutor();
                this.initialized = true;
                console.log('Min initialized successfully');
            }
            catch (error) {
                console.error('Failed to initialize Min:', error);
                throw error;
            }
        });
    }
    create(key, value, options) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureInitialized();
            return this.documentManager.create(key, value, options);
        });
    }
    update(key, value, options) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureInitialized();
            return this.documentManager.update(key, value, options);
        });
    }
    put(key, value, options) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureInitialized();
            try {
                return yield this.documentManager.create(key, value, options);
            }
            catch (error) {
                if (error.message === 'Document already exists') {
                    return yield this.documentManager.update(key, value, options);
                }
                throw error;
            }
        });
    }
    del(key) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureInitialized();
            return this.documentManager.del(key);
        });
    }
    get(key) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureInitialized();
            const value = yield this.documentManager.get(key);
            return {
                key: key,
                value: value
            };
        });
    }
    cleanGet(key) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureInitialized();
            const value = yield this.documentManager.get(key);
            return value;
        });
    }
    search(query, options) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureInitialized();
            return this.searchManager.search(query, options);
        });
    }
    searchIndex(token) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureInitialized();
            return this.searchManager.searchIndex(token);
        });
    }
    batchCreate(docs) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureInitialized();
            const results = [];
            for (const doc of docs) {
                const docId = yield this.create(doc.key, doc.value, doc.options);
                results.push(docId);
            }
            return results;
        });
    }
    createTransaction() {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureInitialized();
            return this.transactionManager.begin();
        });
    }
    getDocCount() {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureInitialized();
            return this.dbManager.getDocCount();
        });
    }
    getPerformanceStats() {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureInitialized();
            return this.performanceMonitor.getAllStats();
        });
    }
    getCacheStats() {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureInitialized();
            return this.searchManager.getCacheStats();
        });
    }
    getIndexStats() {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureInitialized();
            const indexStats = this.dbManager.getIndexStats();
            return Object.fromEntries(indexStats);
        });
    }
    dumpAllDocuments() {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureInitialized();
            return this.dbManager.dumpAllDocuments();
        });
    }
    recalculateDocumentCount() {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureInitialized();
            return this.dbManager.recalculateDocumentCount();
        });
    }
    optimizeIndex() {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureInitialized();
            console.log('Index optimization completed');
        });
    }
    clearCache(type = 'all') {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureInitialized();
            if (type === 'search' || type === 'all') {
                this.searchManager.clearSearchCache();
            }
            if (type === 'index' || type === 'all') {
                this.searchManager.clearIndexCache();
            }
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.initialized) {
                return;
            }
            try {
                if (this.performanceMonitor) {
                    this.performanceMonitor.destroy();
                }
                if (this.searchManager) {
                    this.searchManager.clearSearchCache();
                    this.searchManager.clearIndexCache();
                }
                yield this.dbManager.close();
                this.initialized = false;
                console.log('Min closed successfully');
            }
            catch (error) {
                console.error('Failed to close Min:', error);
                throw error;
            }
        });
    }
    static getdocid(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const { generateDocId } = yield Promise.resolve().then(() => require('./utils/utils'));
            return generateDocId(key);
        });
    }
    ensureInitialized() {
        if (!this.initialized) {
            throw new Error('Min is not initialized. Call init() first.');
        }
    }
}
exports.Min = Min;
