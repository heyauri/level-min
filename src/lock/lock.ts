import { EventEmitter } from 'events';

export class ReadWriteLock extends EventEmitter {
    private readers = 0;
    private writers = 0;
    private writeQueue: Array<() => void> = [];
    private readQueue: Array<() => void> = [];
    private maxWaitTime = 30000; // 30 seconds timeout

    async readLock(): Promise<void> {
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
            } else {
                this.readQueue.push(wrappedResolve);
            }
        });
    }

    async writeLock(): Promise<void> {
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
            } else {
                this.writeQueue.push(wrappedResolve);
            }
        });
    }

    async unlock(): Promise<void> {
        if (this.writers > 0) {
            this.writers--;
            this.emit('writeUnlock');
        } else if (this.readers > 0) {
            this.readers--;
            this.emit('readUnlock');
        }

        // Prioritize write lock queue
        if (this.writeQueue.length > 0 && this.readers === 0 && this.writers === 0) {
            const nextWrite = this.writeQueue.shift();
            if (nextWrite) {
                this.writers++;
                nextWrite();
            }
        } else if (this.readQueue.length > 0 && this.writers === 0) {
            // Process read lock queue
            while (this.readQueue.length > 0 && this.writers === 0) {
                const nextRead = this.readQueue.shift();
                if (nextRead) {
                    this.readers++;
                    nextRead();
                }
            }
        }
    }

    getStats() {
        return {
            readers: this.readers,
            writers: this.writers,
            writeQueueLength: this.writeQueue.length,
            readQueueLength: this.readQueue.length
        };
    }

    reset(): void {
        this.readers = 0;
        this.writers = 0;
        this.writeQueue = [];
        this.readQueue = [];
    }
}

// Singleton instance
export const globalLock = new ReadWriteLock();