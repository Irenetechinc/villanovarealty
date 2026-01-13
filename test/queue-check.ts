
import { interactionQueue } from '../api/services/queueService';

async function testQueue() {
    console.log('Starting Queue Test...');
    console.log(`Initial Stats: Size=${interactionQueue.stats.size}, Pending=${interactionQueue.stats.pending}`);

    const tasks = [];
    const start = Date.now();

    // Create 10 dummy tasks
    for (let i = 0; i < 10; i++) {
        tasks.push(async () => {
            console.log(`Task ${i} started at ${Date.now() - start}ms`);
            await new Promise(resolve => setTimeout(resolve, 500)); // Simulate 500ms API call
            console.log(`Task ${i} finished at ${Date.now() - start}ms`);
        });
    }

    // Add them to the queue
    console.log('Adding 10 tasks to queue...');
    const promises = tasks.map((t, i) => interactionQueue.add(t));

    console.log(`Stats after add: Size=${interactionQueue.stats.size}, Pending=${interactionQueue.stats.pending}`);

    await Promise.all(promises);
    
    console.log('All tasks completed.');
    console.log(`Final Stats: Size=${interactionQueue.stats.size}, Pending=${interactionQueue.stats.pending}`);
    
    const duration = Date.now() - start;
    console.log(`Total Duration: ${duration}ms`);
    
    // With concurrency 3 and 500ms per task, 10 tasks should take:
    // Batch 1 (0-2): 0-500ms
    // Batch 2 (3-5): 500-1000ms
    // Batch 3 (6-8): 1000-1500ms
    // Batch 4 (9):   1500-2000ms
    // Total approx 2000ms.
    // If sequential (concurrency 1), it would take 5000ms.
    
    if (duration < 4000 && duration > 1500) {
        console.log('TEST PASSED: Queue is processing concurrently as expected.');
    } else {
        console.warn('TEST WARNING: Duration unexpected. Check concurrency settings.');
    }
}

testQueue().catch(console.error);
