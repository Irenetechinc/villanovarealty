import { Router } from 'express';
import { supabaseAdmin } from '../supabase.ts';

const router = Router();

router.get('/dashboard', async (_req, res) => {
  try {
    const { count: propertyCount } = await supabaseAdmin
      .from('properties')
      .select('*', { count: 'exact', head: true });

    const { count: userCount } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Mock data for now as we don't have enough real data
    const analytics = {
      totalProperties: propertyCount || 0,
      totalUsers: userCount || 0,
      totalViews: 1250, // Mock
      dailyStats: {
        visitors: 120,
        pageViews: 450,
        newListings: 2
      }
    };

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;