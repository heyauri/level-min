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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseManager = void 0;
const lock_1 = require("./lock");
const transaction_1 = require("./transaction");
const monitor_1 = require("./monitor");
const optimizer_1 = require("./optimizer");
const path = require("path");
class DatabaseManager {
    constructor() {
        this.docCount = 0;
        this.lock = lock_1.globalLock;
        this.indexStats = new Map();
    }
    initializeDatabase(dbAddress, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { ClassicLevel } = require("classic-level");
            try {
                if (!path.isAbsolute(dbAddress)) {
                    dbAddress = path.join(process.cwd(), dbAddress);
                }
                if (this.db) {
                    try {
                        if (this.db.status === 'open') {
                            yield this.db.close();
                        }
                    }
                    catch (closeError) {
                        console.warn('关闭现有数据库连接时出现警告:', closeError.message);
                    }
                }
                options = options || {};
                this.db = new ClassicLevel(dbAddress, options);
                let maxRetries = 3;
                let retryDelay = 100;
                for (let attempt = 1; attempt <= maxRetries; attempt++) {
                    try {
                        console.log(`尝试打开数据库 (尝试 ${attempt}/${maxRetries}), 当前状态: ${this.db.status || 'unknown'}`);
                        if (!this.db.status || this.db.status !== 'open') {
                            yield this.db.open();
                        }
                        console.log(`数据库成功打开，状态: ${this.db.status}`);
                        break;
                    }
                    catch (openError) {
                        console.log(`打开数据库失败 (尝试 ${attempt}/${maxRetries}):`, openError.code || openError.message);
                        if (attempt === maxRetries) {
                            console.error(`达到最大重试次数 ${maxRetries}，放弃重试`);
                            throw openError;
                        }
                        if (openError.code === 'LEVEL_LOCKED' || (openError.cause && openError.cause.code === 'LEVEL_LOCKED')) {
                            console.warn(`数据库被锁定，等待 ${retryDelay}ms 后重试 (尝试 ${attempt}/${maxRetries})`);
                            yield new Promise(resolve => setTimeout(resolve, retryDelay));
                            retryDelay *= 2;
                        }
                        else {
                            console.error(`非锁错误，直接抛出:`, openError.code || openError.message);
                            throw openError;
                        }
                    }
                }
                this.transactionManager = new transaction_1.TransactionManager(this.db, this.lock);
                this.batchManager = new transaction_1.BatchManager(this.db, 100, 5000);
                this.performanceMonitor = new monitor_1.PerformanceMonitor();
                this.queryOptimizer = new optimizer_1.QueryOptimizer(this.performanceMonitor);
                this.queryExecutor = new optimizer_1.QueryExecutor(this.performanceMonitor);
                try {
                    const val = yield this.db.get("0x000_docCount");
                    this.docCount = parseInt(val) ? parseInt(val) : 0;
                    yield this.initializeIndexStats();
                }
                catch (err) {
                    if (err.code === "LEVEL_NOT_FOUND") {
                        this.docCount = 0;
                    }
                    else {
                        throw err;
                    }
                }
                console.log("Leveldb selected: " + dbAddress);
            }
            catch (e) {
                console.error("Leveldb setup failed at: " + dbAddress + " \nPlease check your dbAddress and options.");
                console.error(e);
                throw e;
            }
        });
    }
    initializeIndexStats() {
        var _a, e_1, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                try {
                    for (var _d = true, _e = __asyncValues(this.db.iterator({
                        gte: "0x001_",
                        lte: "0x002_"
                    })), _f; _f = yield _e.next(), _a = _f.done, !_a;) {
                        _c = _f.value;
                        _d = false;
                        try {
                            const [key, value] = _c;
                            const indexData = JSON.parse(value);
                            const token = key.substring(5);
                            this.indexStats.set(token, indexData.l);
                        }
                        finally {
                            _d = true;
                        }
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                yield this.queryOptimizer.cacheTokenFrequencies(this.indexStats);
            }
            catch (error) {
                console.warn("Failed to initialize index stats:", error);
            }
        });
    }
    getDocCount() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.docCount || 0;
        });
    }
    dumpAllDocuments() {
        var _a, e_2, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Dumping all documents from database:');
            try {
                for (var _d = true, _e = __asyncValues(this.db.iterator()), _f; _f = yield _e.next(), _a = _f.done, !_a;) {
                    _c = _f.value;
                    _d = false;
                    try {
                        const data = _c;
                        console.log('Document:', data);
                    }
                    finally {
                        _d = true;
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
                }
                finally { if (e_2) throw e_2.error; }
            }
        });
    }
    recalculateDocumentCount() {
        var _a, e_3, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Recalculating document count...');
            let docCount = 0;
            let pattern = /^0x002_/;
            let db = this.db;
            try {
                for (var _d = true, _e = __asyncValues(db.keys({ lte: "0x003_" })), _f; _f = yield _e.next(), _a = _f.done, !_a;) {
                    _c = _f.value;
                    _d = false;
                    try {
                        const key = _c;
                        if (pattern.test(key))
                            docCount++;
                    }
                    finally {
                        _d = true;
                    }
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
                }
                finally { if (e_3) throw e_3.error; }
            }
            console.log(`Recalculated document count: ${docCount}`);
            return docCount;
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (this.db && this.db.status === 'open') {
                    yield this.db.close();
                    console.log('数据库连接已关闭');
                }
                this.db = null;
                this.docCount = 0;
                this.indexStats.clear();
                console.log('数据库管理器已成功关闭');
            }
            catch (error) {
                console.error('关闭数据库管理器时出错:', error);
                throw error;
            }
        });
    }
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
    setDocCount(count) {
        this.docCount = count;
    }
}
exports.DatabaseManager = DatabaseManager;
