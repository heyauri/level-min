import * as utils from "../utils/utils";
import { DatabaseManager } from "./database-manager";
import { ConfigManager } from "../config/config-manager";
import { PerformanceMonitor } from "../monitor/monitor";
import * as tokenizer from "../tokenizer/tokenizer";

export class DocumentManager {
    private dbManager: DatabaseManager;
    private configManager: ConfigManager;
    private performanceMonitor: PerformanceMonitor;

    constructor(dbManager: DatabaseManager, configManager: ConfigManager, performanceMonitor: PerformanceMonitor) {
        this.dbManager = dbManager;
        this.configManager = configManager;
        this.performanceMonitor = performanceMonitor;
    }

    // Create document
    async create(key: string, value: any, options?: any): Promise<string> {
        const startTime = Date.now();
        
        try {
            const db = this.dbManager.getDb();
            const lock = this.dbManager.getLock();
            
            // Generate document ID
            const docId = utils.generateDocId(key);
            
            // Acquire lock
            await lock.writeLock();
            
            try {
                // Check if document already exists
                try {
                    const existingDocData = await db.get("0x002_" + docId);
                    // Only consider document exists if successfully retrieved document data
                    if (existingDocData !== undefined && existingDocData !== null && existingDocData !== "") {
                        throw new Error("Document already exists");
                    }
                } catch (err) {
                    if (err.code !== "LEVEL_NOT_FOUND") {
                        throw err;
                    }
                }
                
                // Process options
                if (options) {
                    await this.configManager.updateOptions(options);
                }
                
                const compressedOptions = this.configManager.getCompressedOptions();
                const optionsTokens = this.configManager.getTokensList();
                
                // Tokenize document content
                const contentTokens = await this.tokenizeContent(value);
                
                // Merge options and content tokens, preserve frequency information
                const allTokens: Record<string, number> = {};
                
                // Add options tokens (frequency set to 1)
                for (const token of optionsTokens) {
                    allTokens[token] = 1;
                }
                
                // Add content tokens, merge frequencies
                for (const [token, frequency] of Object.entries(contentTokens)) {
                    if (allTokens[token]) {
                        allTokens[token] += frequency;
                    } else {
                        allTokens[token] = frequency;
                    }
                }
                
                // Create document
                const doc = {
                    key: key,
                    value: value,
                    options: compressedOptions,
                    tokens: allTokens,
                    timestamp: Date.now()
                };
                
                // Save document
                await db.put("0x002_" + docId, JSON.stringify(doc));
                
                // Update index
                await this.updateIndex(docId, allTokens, "create");
                
                // Update document count
                const newCount = await this.dbManager.getDocCount() + 1;
                this.dbManager.setDocCount(newCount);
                await db.put("0x000_docCount", newCount.toString());
                
                // Record performance metrics
                this.performanceMonitor.record("put", Date.now() - startTime);
                
                return `Document ${key} created successfully`;
            } finally {
                // Release lock
                lock.unlock();
            }
        } catch (error) {
            console.error("Create operation failed:", error);
            throw error;
        }
    }

    // Update document
    async update(key: string, value: any, options?: any): Promise<string> {
        const startTime = Date.now();
        
        try {
            const db = this.dbManager.getDb();
            const lock = this.dbManager.getLock();
            
            // Generate document ID
            const docId = utils.generateDocId(key);
            
            // Acquire lock
            await lock.writeLock();
            
            try {
                // Check if document exists
                let existingDoc;
                try {
                    const docData = await db.get("0x002_" + docId);
                    if (docData === undefined || docData === null) {
                        throw new Error(`Document ${key} does not exist`);
                    }
                    existingDoc = JSON.parse(docData);
                } catch (err) {
                    if (err.code === "LEVEL_NOT_FOUND") {
                        throw new Error(`Document ${key} does not exist`);
                    }
                    throw err;
                }
                
                // Process options
                if (options) {
                    await this.configManager.updateOptions(options);
                }
                
                const compressedOptions = this.configManager.getCompressedOptions();
                const optionsTokens = this.configManager.getTokensList();
                
                // Tokenize document content
                const contentTokens = await this.tokenizeContent(value);
                
                // Merge options and content tokens, preserve frequency information
                const allTokens: Record<string, number> = {};
                
                // Add options tokens (frequency set to 1)
                for (const token of optionsTokens) {
                    allTokens[token] = 1;
                }
                
                // Add content tokens, merge frequencies
                for (const [token, frequency] of Object.entries(contentTokens)) {
                    if (allTokens[token]) {
                        allTokens[token] += frequency;
                    } else {
                        allTokens[token] = frequency;
                    }
                }
                
                // Update document
                  const updatedDoc = {
                      ...existingDoc,
                      key: key,
                      value: value,
                      options: compressedOptions,
                      tokens: allTokens,
                      timestamp: Date.now()
                  };
                
                // Save document
                await db.put("0x002_" + docId, JSON.stringify(updatedDoc));
                
                // Update index
                await this.updateIndex(docId, allTokens, "update", existingDoc.tokens);
                
                // Record performance metrics
                this.performanceMonitor.record("put", Date.now() - startTime);
                
                return `Document ${key} updated successfully`;
            } finally {
                // Release lock
                lock.unlock();
            }
        } catch (error) {
            console.error("Update operation failed:", error);
            throw error;
        }
    }

    // Delete document
    async del(key: string): Promise<string> {
        const startTime = Date.now();
        
        try {
            const db = this.dbManager.getDb();
            const lock = this.dbManager.getLock();
            
            // Generate document ID
            const docId = utils.generateDocId(key);
            
            // Acquire lock
            await lock.writeLock();
            
            try {
                // Check if document exists
                let existingDoc;
                try {
                    const docData = await db.get("0x002_" + docId);
                    if (docData === undefined || docData === null) {
                        return `Document ${key} does not exist`;
                    }
                    existingDoc = JSON.parse(docData);
                } catch (err) {
                    if (err.code === "LEVEL_NOT_FOUND") {
                        return `Document ${key} does not exist`; // Document does not exist, return message
                    }
                    throw err;
                }
                
                // Delete document
                await db.del("0x002_" + docId);
                
                // Update index
                await this.updateIndex(docId, existingDoc.tokens, "delete");
                
                // Update document count
                const newCount = await this.dbManager.getDocCount() - 1;
                this.dbManager.setDocCount(newCount);
                await db.put("0x000_docCount", newCount.toString());
                
                // Record performance metrics
                this.performanceMonitor.record("del", Date.now() - startTime);
                
                return `Document ${key} deleted successfully`;
            } finally {
                // Release lock
                lock.unlock();
            }
        } catch (error) {
            console.error("Delete operation failed:", error);
            throw error;
        }
    }

    // Get document
    async get(key: string): Promise<any> {
        const startTime = Date.now();
        
        try {
            const db = this.dbManager.getDb();
            const lock = this.dbManager.getLock();
            
            // Generate document ID
            const docId = utils.generateDocId(key);
            
            // Acquire read lock
            await lock.readLock();
            
            try {
                // Get document
                const docData = await db.get("0x002_" + docId);
                if (!docData || docData === undefined || docData === null || docData === "") {
                    throw new Error(`Document ${key} does not exist`);
                }
                const doc = JSON.parse(docData);
                
                // Record performance metrics
                this.performanceMonitor.record("get", Date.now() - startTime);
                
                return doc.value;
            } finally {
                // Release lock
                lock.unlock();
            }
        } catch (error) {
            if (error.code === "LEVEL_NOT_FOUND") {
                throw new Error(`Document ${key} does not exist`);
            }
            console.error("Get operation failed:", error);
            throw error;
        }
    }

    // Update index
    private async updateIndex(docId: string, tokens: Record<string, number>, operation: "create" | "update" | "delete", oldTokens?: Record<string, number>): Promise<void> {
        const db = this.dbManager.getDb();
        const indexStats = this.dbManager.getIndexStats();
        
        // Process old tokens for delete or update operations
        if (operation === "delete" || (operation === "update" && oldTokens)) {
            const tokensToRemove = operation === "delete" ? (tokens || {}) : (oldTokens || {});
            for (const token of Object.keys(tokensToRemove)) {
                try {
                    const indexData = await db.get("0x001_" + token);
                    if (!indexData) {
                        throw new Error('Index data is undefined');
                    }
                    const index = JSON.parse(indexData);
                    
                    // Remove document ID and frequency information from index
                    const docIndex = index.i.findIndex((item: any) => item.docId === docId);
                    if (docIndex !== -1) {
                        index.i.splice(docIndex, 1);
                        index.l = index.i.length;
                        
                        // Update index statistics
                        indexStats.set(token, index.l);
                        
                        // If index is empty, delete index entry
                        if (index.l === 0) {
                            await db.del("0x001_" + token);
                            indexStats.delete(token);
                        } else {
                            await db.put("0x001_" + token, JSON.stringify(index));
                        }
                    }
                } catch (err) {
                    if (err.code !== "LEVEL_NOT_FOUND") {
                        console.error("Failed to update index for token:", token, err);
                    }
                }
            }
        }
        
        // Process new tokens for create or update operations
        if (operation === "create" || operation === "update") {
            const tokensToAdd = tokens || {};
            for (const token of Object.keys(tokensToAdd)) {
                const frequency = tokensToAdd[token];
                try {
                    const indexData = await db.get("0x001_" + token);
                    if (!indexData) {
                        throw new Error('Index data is undefined');
                    }
                    const index = JSON.parse(indexData);
                    
                    // Find if document ID is already in index
                    const docIndex = index.i.findIndex((item: any) => item.docId === docId);
                    if (docIndex === -1) {
                        // Document ID not in index, add it
                        index.i.push({ docId, frequency });
                        index.l = index.i.length;
                    } else {
                        // Document ID already in index, update frequency
                        index.i[docIndex].frequency = frequency;
                    }
                    
                    // Update index statistics
                    indexStats.set(token, index.l);
                    
                    await db.put("0x001_" + token, JSON.stringify(index));
                } catch (err) {
                    if (err.code === "LEVEL_NOT_FOUND" || err.message === 'Index data is undefined') {
                        // Create new index
                        const newIndex = {
                            i: [{ docId, frequency }],
                            l: 1
                        };
                        
                        // Update index statistics
                        indexStats.set(token, 1);
                        
                        await db.put("0x001_" + token, JSON.stringify(newIndex));
                    } else {
                        console.error("Failed to update index for token:", token, err);
                    }
                }
            }
        }
    }

    // Tokenize document content
    private async tokenizeContent(content: any): Promise<Record<string, number>> {
        try {
            let tokenResult;
            
            // If content is string, tokenize directly
            if (typeof content === 'string') {
                tokenResult = tokenizer.tokenize(content);
            }
            
            // If content is object, convert to JSON string then tokenize
            else if (typeof content === 'object' && content !== null) {
                const jsonString = JSON.stringify(content);
                tokenResult = tokenizer.tokenize(jsonString);
            }
            
            // Other types convert to string then tokenize
            else {
                const contentString = String(content);
                tokenResult = tokenizer.tokenize(contentString);
            }
            
            // Return token frequency object
            if (tokenResult && typeof tokenResult === 'object') {
                return tokenResult;
            }
            
            return {};
        } catch (error) {
            console.error("Failed to tokenize content:", error);
            return {};
        }
    }
}