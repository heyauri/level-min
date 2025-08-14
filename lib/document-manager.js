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
exports.DocumentManager = void 0;
const utils = require("./utils");
class DocumentManager {
    constructor(dbManager, configManager, performanceMonitor) {
        this.dbManager = dbManager;
        this.configManager = configManager;
        this.performanceMonitor = performanceMonitor;
    }
    create(key, value, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            try {
                const db = this.dbManager.getDb();
                const lock = this.dbManager.getLock();
                const docId = utils.generateDocId(key);
                yield lock.writeLock();
                try {
                    try {
                        yield db.get("0x002_" + docId);
                        throw new Error("Document already exists");
                    }
                    catch (err) {
                        if (err.code !== "LEVEL_NOT_FOUND") {
                            throw err;
                        }
                    }
                    if (options) {
                        yield this.configManager.updateOptions(options);
                    }
                    const compressedOptions = this.configManager.getCompressedOptions();
                    const tokens = this.configManager.getTokensList();
                    const doc = {
                        key: key,
                        value: value,
                        options: compressedOptions,
                        tokens: tokens,
                        timestamp: Date.now()
                    };
                    yield db.put("0x002_" + docId, JSON.stringify(doc));
                    yield this.updateIndex(docId, tokens, "create");
                    const newCount = (yield this.dbManager.getDocCount()) + 1;
                    this.dbManager.setDocCount(newCount);
                    yield db.put("0x000_docCount", newCount.toString());
                    this.performanceMonitor.record("create_duration", Date.now() - startTime);
                    return docId;
                }
                finally {
                    lock.unlock();
                }
            }
            catch (error) {
                console.error("Create operation failed:", error);
                throw error;
            }
        });
    }
    update(key, value, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            try {
                const db = this.dbManager.getDb();
                const lock = this.dbManager.getLock();
                const docId = utils.generateDocId(key);
                yield lock.writeLock();
                try {
                    let existingDoc;
                    try {
                        const docData = yield db.get("0x002_" + docId);
                        existingDoc = JSON.parse(docData);
                    }
                    catch (err) {
                        if (err.code === "LEVEL_NOT_FOUND") {
                            throw new Error("Document not found");
                        }
                        throw err;
                    }
                    if (options) {
                        yield this.configManager.updateOptions(options);
                    }
                    const compressedOptions = this.configManager.getCompressedOptions();
                    const tokens = this.configManager.getTokensList();
                    const updatedDoc = Object.assign(Object.assign({}, existingDoc), { value: value, options: compressedOptions, tokens: tokens, timestamp: Date.now() });
                    yield db.put("0x002_" + docId, JSON.stringify(updatedDoc));
                    yield this.updateIndex(docId, tokens, "update", existingDoc.tokens);
                    this.performanceMonitor.record("update_duration", Date.now() - startTime);
                    return docId;
                }
                finally {
                    lock.unlock();
                }
            }
            catch (error) {
                console.error("Update operation failed:", error);
                throw error;
            }
        });
    }
    del(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            try {
                const db = this.dbManager.getDb();
                const lock = this.dbManager.getLock();
                const docId = utils.generateDocId(key);
                yield lock.writeLock();
                try {
                    let existingDoc;
                    try {
                        const docData = yield db.get("0x002_" + docId);
                        existingDoc = JSON.parse(docData);
                    }
                    catch (err) {
                        if (err.code === "LEVEL_NOT_FOUND") {
                            return false;
                        }
                        throw err;
                    }
                    yield db.del("0x002_" + docId);
                    yield this.updateIndex(docId, existingDoc.tokens, "delete");
                    const newCount = (yield this.dbManager.getDocCount()) - 1;
                    this.dbManager.setDocCount(newCount);
                    yield db.put("0x000_docCount", newCount.toString());
                    this.performanceMonitor.record("delete_duration", Date.now() - startTime);
                    return true;
                }
                finally {
                    lock.unlock();
                }
            }
            catch (error) {
                console.error("Delete operation failed:", error);
                throw error;
            }
        });
    }
    get(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            try {
                const db = this.dbManager.getDb();
                const lock = this.dbManager.getLock();
                const docId = utils.generateDocId(key);
                yield lock.readLock();
                try {
                    const docData = yield db.get("0x002_" + docId);
                    const doc = JSON.parse(docData);
                    this.performanceMonitor.record("get_duration", Date.now() - startTime);
                    return doc.value;
                }
                finally {
                    lock.unlock();
                }
            }
            catch (error) {
                if (error.code === "LEVEL_NOT_FOUND") {
                    return null;
                }
                console.error("Get operation failed:", error);
                throw error;
            }
        });
    }
    updateIndex(docId, tokens, operation, oldTokens) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = this.dbManager.getDb();
            const indexStats = this.dbManager.getIndexStats();
            if (operation === "delete" || (operation === "update" && oldTokens)) {
                const tokensToRemove = operation === "delete" ? tokens : oldTokens;
                for (const token of tokensToRemove) {
                    try {
                        const indexData = yield db.get("0x001_" + token);
                        const index = JSON.parse(indexData);
                        const indexPos = index.i.indexOf(docId);
                        if (indexPos !== -1) {
                            index.i.splice(indexPos, 1);
                            index.l = index.i.length;
                            indexStats.set(token, index.l);
                            if (index.l === 0) {
                                yield db.del("0x001_" + token);
                                indexStats.delete(token);
                            }
                            else {
                                yield db.put("0x001_" + token, JSON.stringify(index));
                            }
                        }
                    }
                    catch (err) {
                        if (err.code !== "LEVEL_NOT_FOUND") {
                            console.error("Failed to update index for token:", token, err);
                        }
                    }
                }
            }
            if (operation === "create" || operation === "update") {
                for (const token of tokens) {
                    try {
                        const indexData = yield db.get("0x001_" + token);
                        const index = JSON.parse(indexData);
                        if (!index.i.includes(docId)) {
                            index.i.push(docId);
                            index.l = index.i.length;
                            indexStats.set(token, index.l);
                            yield db.put("0x001_" + token, JSON.stringify(index));
                        }
                    }
                    catch (err) {
                        if (err.code === "LEVEL_NOT_FOUND") {
                            const newIndex = {
                                i: [docId],
                                l: 1
                            };
                            indexStats.set(token, 1);
                            yield db.put("0x001_" + token, JSON.stringify(newIndex));
                        }
                        else {
                            console.error("Failed to update index for token:", token, err);
                        }
                    }
                }
            }
        });
    }
}
exports.DocumentManager = DocumentManager;
