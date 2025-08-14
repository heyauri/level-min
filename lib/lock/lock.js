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
exports.globalLock = exports.ReadWriteLock = void 0;
const events_1 = require("events");
class ReadWriteLock extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this.readers = 0;
        this.writers = 0;
        this.writeQueue = [];
        this.readQueue = [];
        this.maxWaitTime = 30000;
    }
    readLock() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    const index = this.readQueue.indexOf(resolve);
                    if (index > -1) {
                        this.readQueue.splice(index, 1);
                    }
                    reject(new Error('Read lock acquisition timeout'));
                }, this.maxWaitTime);
                const wrappedResolve = () => {
                    clearTimeout(timeout);
                    resolve();
                };
                if (this.writers === 0 && this.writeQueue.length === 0) {
                    this.readers++;
                    wrappedResolve();
                }
                else {
                    this.readQueue.push(wrappedResolve);
                }
            });
        });
    }
    writeLock() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    const index = this.writeQueue.indexOf(resolve);
                    if (index > -1) {
                        this.writeQueue.splice(index, 1);
                    }
                    reject(new Error('Write lock acquisition timeout'));
                }, this.maxWaitTime);
                const wrappedResolve = () => {
                    clearTimeout(timeout);
                    resolve();
                };
                if (this.readers === 0 && this.writers === 0) {
                    this.writers++;
                    wrappedResolve();
                }
                else {
                    this.writeQueue.push(wrappedResolve);
                }
            });
        });
    }
    unlock() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.writers > 0) {
                this.writers--;
                this.emit('writeUnlock');
            }
            else if (this.readers > 0) {
                this.readers--;
                this.emit('readUnlock');
            }
            if (this.writeQueue.length > 0 && this.readers === 0 && this.writers === 0) {
                const nextWrite = this.writeQueue.shift();
                if (nextWrite) {
                    this.writers++;
                    nextWrite();
                }
            }
            else if (this.readQueue.length > 0 && this.writers === 0) {
                while (this.readQueue.length > 0 && this.writers === 0) {
                    const nextRead = this.readQueue.shift();
                    if (nextRead) {
                        this.readers++;
                        nextRead();
                    }
                }
            }
        });
    }
    getStats() {
        return {
            readers: this.readers,
            writers: this.writers,
            writeQueueLength: this.writeQueue.length,
            readQueueLength: this.readQueue.length
        };
    }
    reset() {
        this.readers = 0;
        this.writers = 0;
        this.writeQueue = [];
        this.readQueue = [];
    }
}
exports.ReadWriteLock = ReadWriteLock;
exports.globalLock = new ReadWriteLock();
