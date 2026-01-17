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

        // 1. Leads Data (Fetch timestamps for aggregation)
        const { data: leadsData, error: leadsError } = await supabaseAdmin
            .from('leads')
            .select('created_at')
            .eq('user_id', adminId)
            .gte('created_at', startDate.toISOString());
            
        if (leadsError) throw leadsError;

        // 2. Interactions Data (Fetch timestamps for aggregation)
        const { data: interactionsData, error: interactionsError } = await supabaseAdmin
            .from('adroom_interactions')
            .select('created_at')
            .eq('admin_id', adminId)
            .gte('created_at', startDate.toISOString());
            
        if (interactionsError) throw interactionsError;

        const leadsCount = leadsData?.length || 0;
        const interactionsCount = interactionsData?.length || 0;

        // 3. Daily Breakdown (Real Aggregation)
        const dailyData = [];
        const days = range === '30d' ? 30 : 7;
        
        for (let i = 0; i < days; i++) {
            const d = new Date();
            d.setDate(now.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            
            // Filter for this specific date (local time approximation or UTC based on string split)
            const dayLeads = leadsData?.filter(l => l.created_at.startsWith(dateStr)).length || 0;
            const dayReach = interactionsData?.filter(i => i.created_at.startsWith(dateStr)).length || 0;
            
            dailyData.push({
                date: dateStr,
                leads: dayLeads,
                reach: dayReach
            });
        }

        res.json({
            summary: {
                leads: leadsCount,
                interactions: interactionsCount,
                conversion_rate: interactionsCount > 0 ? ((leadsCount / interactionsCount) * 100).toFixed(1) + '%' : '0%'
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
