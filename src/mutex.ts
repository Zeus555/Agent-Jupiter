export class Mutex {
    private queue: (() => void)[] = [];
    private locked = false;

    async acquire(): Promise<() => void> {
        if (!this.locked) {
            this.locked = true;
            return () => this.release();
        }
        return new Promise<() => void>((resolve) => {
            this.queue.push(() => {
                resolve(() => this.release());
            });
        });
    }

    private release() {
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            if (next) next();
        } else {
            this.locked = false;
        }
    }
}

export const pageLock = new Mutex();
