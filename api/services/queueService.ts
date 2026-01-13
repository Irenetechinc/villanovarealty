import PQueue from 'p-queue';

/**
 * Interaction Queue Service
 * Handles rate limiting, prioritization, and batch processing of Facebook interactions.
 */
class InteractionQueueService {
    private queue: PQueue;
    private processing: boolean = false;

    constructor() {
        // Concurrency 1 ensures we handle one interaction at a time per queue,
        // but we can increase this if we want parallel processing.
        // Given rate limits, sequential or low concurrency is safer.
        // Using PQueue for robust promise based queueing.
        this.queue = new PQueue({ concurrency: 3, interval: 1000, intervalCap: 10 }); 
        // Max 10 requests per second (conservative for Graph API)
    }

    /**
     * Add a task to the queue
     * @param task Function that returns a promise (the interaction processing logic)
     * @param priority High priority for messages, lower for comments
     */
    add(task: () => Promise<void>, priority: number = 0) {
        this.queue.add(task, { priority });
        console.log(`[Queue] Task added. Pending: ${this.queue.pending}, Size: ${this.queue.size}`);
    }

    get stats() {
        return {
            size: this.queue.size,
            pending: this.queue.pending
        };
    }
}

export const interactionQueue = new InteractionQueueService();
