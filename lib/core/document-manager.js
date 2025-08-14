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
const utils = require("../utils/utils");
const tokenizer = require("../tokenizer/tokenizer");
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
                        const existingDocData = yield db.get("0x002_" + docId);
                        if (existingDocData !== undefined && existingDocData !== null && existingDocData !== "") {
                            throw new Error("Document already exists");
                        }
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
                    const optionsTokens = this.configManager.getTokensList();
                    const contentTokens = yield this.tokenizeContent(value);
                    const allTokens = {};
                    for (const token of optionsTokens) {
                        allTokens[token] = 1;
                    }
                    for (const [token, frequency] of Object.entries(contentTokens)) {
                        if (allTokens[token]) {
                            allTokens[token] += frequency;
                        }
                        else {
                            allTokens[token] = frequency;
                        }
                    }
                    const doc = {
                        key: key,
                        value: value,
                        options: compressedOptions,
                        tokens: allTokens,
                        timestamp: Date.now()
                    };
                    yield db.put("0x002_" + docId, JSON.stringify(doc));
                    yield this.updateIndex(docId, allTokens, "create");
                    const newCount = (yield this.dbManager.getDocCount()) + 1;
                    this.dbManager.setDocCount(newCount);
                    yield db.put("0x000_docCount", newCount.toString());
                    this.performanceMonitor.record("put", Date.now() - startTime);
                    return `Document ${key} created successfully`;
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
                        if (docData === undefined || docData === null) {
                            throw new Error(`Document ${key} does not exist`);
                        }
                        existingDoc = JSON.parse(docData);
                    }
                    catch (err) {
                        if (err.code === "LEVEL_NOT_FOUND") {
                            throw new Error(`Document ${key} does not exist`);
                        }
                        throw err;
                    }
                    if (options) {
                        yield this.configManager.updateOptions(options);
                    }
                    const compressedOptions = this.configManager.getCompressedOptions();
                    const optionsTokens = this.configManager.getTokensList();
                    const contentTokens = yield this.tokenizeContent(value);
                    const allTokens = {};
                    for (const token of optionsTokens) {
                        allTokens[token] = 1;
                    }
                    for (const [token, frequency] of Object.entries(contentTokens)) {
                        if (allTokens[token]) {
                            allTokens[token] += frequency;
                        }
                        else {
                            allTokens[token] = frequency;
                        }
                    }
                    const updatedDoc = Object.assign(Object.assign({}, existingDoc), { key: key, value: value, options: compressedOptions, tokens: allTokens, timestamp: Date.now() });
                    yield db.put("0x002_" + docId, JSON.stringify(updatedDoc));
                    yield this.updateIndex(docId, allTokens, "update", existingDoc.tokens);
                    this.performanceMonitor.record("put", Date.now() - startTime);
                    return `Document ${key} updated successfully`;
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
                        if (docData === undefined || docData === null) {
                            return `Document ${key} does not exist`;
                        }
                        existingDoc = JSON.parse(docData);
                    }
                    catch (err) {
                        if (err.code === "LEVEL_NOT_FOUND") {
                            return `Document ${key} does not exist`;
                        }
                        throw err;
                    }
                    yield db.del("0x002_" + docId);
                    yield this.updateIndex(docId, existingDoc.tokens, "delete");
                    const newCount = (yield this.dbManager.getDocCount()) - 1;
                    this.dbManager.setDocCount(newCount);
                    yield db.put("0x000_docCount", newCount.toString());
                    this.performanceMonitor.record("del", Date.now() - startTime);
                    return `Document ${key} deleted successfully`;
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
                    if (!docData || docData === undefined || docData === null || docData === "") {
                        throw new Error(`Document ${key} does not exist`);
                    }
                    const doc = JSON.parse(docData);
                    this.performanceMonitor.record("get", Date.now() - startTime);
                    return doc.value;
                }
                finally {
                    lock.unlock();
                }
            }
            catch (error) {
                if (error.code === "LEVEL_NOT_FOUND") {
                    throw new Error(`Document ${key} does not exist`);
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
                const tokensToRemove = operation === "delete" ? (tokens || {}) : (oldTokens || {});
                for (const token of Object.keys(tokensToRemove)) {
                    try {
                        const indexData = yield db.get("0x001_" + token);
                        if (!indexData) {
                            throw new Error('Index data is undefined');
                        }
                        const index = JSON.parse(indexData);
                        const docIndex = index.i.findIndex((item) => item.docId === docId);
                        if (docIndex !== -1) {
                            index.i.splice(docIndex, 1);
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
                const tokensToAdd = tokens || {};
                for (const token of Object.keys(tokensToAdd)) {
                    const frequency = tokensToAdd[token];
                    try {
                        const indexData = yield db.get("0x001_" + token);
                        if (!indexData) {
                            throw new Error('Index data is undefined');
                        }
                        const index = JSON.parse(indexData);
                        const docIndex = index.i.findIndex((item) => item.docId === docId);
                        if (docIndex === -1) {
                            index.i.push({ docId, frequency });
                            index.l = index.i.length;
                        }
                        else {
                            index.i[docIndex].frequency = frequency;
                        }
                        indexStats.set(token, index.l);
                        yield db.put("0x001_" + token, JSON.stringify(index));
                    }
                    catch (err) {
                        if (err.code === "LEVEL_NOT_FOUND" || err.message === 'Index data is undefined') {
                            const newIndex = {
                                i: [{ docId, frequency }],
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
    tokenizeContent(content) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let tokenResult;
                if (typeof content === 'string') {
                    tokenResult = tokenizer.tokenize(content);
                }
                else if (typeof content === 'object' && content !== null) {
                    const jsonString = JSON.stringify(content);
                    tokenResult = tokenizer.tokenize(jsonString);
                }
                else {
                    const contentString = String(content);
                    tokenResult = tokenizer.tokenize(contentString);
                }
                if (tokenResult && typeof tokenResult === 'object') {
                    return tokenResult;
                }
                return {};
            }
            catch (error) {
                console.error("Failed to tokenize content:", error);
                return {};
            }
        });
    }
}
exports.DocumentManager = DocumentManager;
