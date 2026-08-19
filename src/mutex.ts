/**
 * FIFO mutex guarding the single Playwright page.
 *
 * acquire() takes an optional timeout. Without one a waiter queues forever, which is how a
 * jammed page took the whole API down: a stuck modal made the balance scraper hold the lock
 * for its full 30s Playwright click timeout, over and over, while the 1Hz price warmer kept
 * enqueueing waiters. The queue grew without bound and every HTTP request that reached the
 * lock hung permanently instead of failing. Callers on a request path should pass a timeout
 * and surface PAGE_BUSY rather than block a client indefinitely.
 */
export class Mutex {
    private queue: Array<{
        resolve: (release: () => void) => void;
        reject: (err: Error) => void;
        timer?: ReturnType<typeof setTimeout>;
    }> = [];
    private locked = false;

    /**
     * @param timeoutMs give up after this long waiting in the queue (rejects with PAGE_BUSY).
     *                  Omit for the previous unbounded behaviour (background loops only).
     */
    async acquire(timeoutMs?: number): Promise<() => void> {
        if (!this.locked) {
            this.locked = true;
            return this.makeRelease();
        }
        return new Promise<() => void>((resolve, reject) => {
            const waiter: (typeof this.queue)[number] = { resolve, reject };
            if (timeoutMs && timeoutMs > 0) {
                waiter.timer = setTimeout(() => {
                    const i = this.queue.indexOf(waiter);
                    if (i !== -1) this.queue.splice(i, 1);
                    reject(new Error('PAGE_BUSY'));
                }, timeoutMs);
            }
            this.queue.push(waiter);
        });
    }

    /** Releases are idempotent — a double call would otherwise hand the lock to two holders. */
    private makeRelease(): () => void {
        let released = false;
        return () => {
            if (released) return;
            released = true;
            this.release();
        };
    }

    private release() {
        const next = this.queue.shift();
        if (next) {
            if (next.timer) clearTimeout(next.timer);
            next.resolve(this.makeRelease());
        } else {
            this.locked = false;
        }
    }

    /** Waiters currently queued — surfaced by /health so a jam is visible before it bites. */
    get waiting(): number { return this.queue.length; }
    get isLocked(): boolean { return this.locked; }
}

export const pageLock = new Mutex();
