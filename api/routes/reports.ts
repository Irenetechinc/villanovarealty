import express from 'express';
import { supabaseAdmin } from '../supabase.js';

const router = express.Router();

// Get Report Stats
router.get('/stats/:adminId', async (req, res) => {
    try {
        const { adminId } = req.params;
        const { range } = req.query; // '7d', '30d'

        // Fetch aggregated data (Mocking complex aggregation for now using raw counts)
        // In production, use materialized views or optimized queries
        
        const now = new Date();
        const startDate = new Date();
        startDate.setDate(now.getDate() - (range === '30d' ? 30 : 7));

        // 1. Leads Count
        const { count: leadsCount } = await supabaseAdmin
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', adminId)
            .gte('created_at', startDate.toISOString());

        // 2. Impressions/Reach (from adroom_strategies or manual logs)
        // Assuming we have a way to track this, using adroom_interactions for now as proxy
        const { count: interactionsCount } = await supabaseAdmin
            .from('adroom_interactions')
            .select('*', { count: 'exact', head: true })
            .eq('admin_id', adminId)
            .gte('created_at', startDate.toISOString());

        // 3. Daily Breakdown (Mocked for UI demo if no data)
        const dailyData = [];
        for (let i = 0; i < (range === '30d' ? 30 : 7); i++) {
            const d = new Date();
            d.setDate(now.getDate() - i);
            dailyData.push({
                date: d.toISOString().split('T')[0],
                leads: Math.floor(Math.random() * 5), // Replace with actual group_by query
                reach: Math.floor(Math.random() * 1000)
            });
        }

        res.json({
            summary: {
                leads: leadsCount || 0,
                interactions: interactionsCount || 0,
                conversion_rate: '2.4%'
            },
            history: dailyData.reverse()
        });

    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Trigger Test Notification (For testing requirements)
router.post('/test-notification', async (req, res) => {
    try {
        const { adminId, type } = req.body;
        const { notificationService } = await import('../services/notificationService.js');
        
        await notificationService.send({
            userId: adminId,
            type: type || 'system',
            title: 'Test Notification',
            message: 'This is a verified test notification from AdRoom.',
            metadata: {
                action: 'check_reports'
            }
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router;
