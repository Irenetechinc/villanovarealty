import express from 'express';
import { interactionQueue } from '../services/queueService.js';

const router = express.Router();

router.get('/health', (_req, res) => {
    const queueStats = interactionQueue.stats;
    res.json({
        status: 'online',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        queue: {
            pending: queueStats.pending,
            size: queueStats.size
        },
        memory: process.memoryUsage()
    });
});

export default router;
