import { Router } from 'express';
import { supabaseAdmin } from '../supabase.ts';

const router = Router();

// Get all properties with filtering
router.get('/', async (req, res) => {
  try {
    const { type, min_price, max_price, location, status } = req.query;
    
    let query = supabaseAdmin
      .from('properties')
      .select('*, property_images(*)');

    if (type) query = query.eq('type', type);
    if (min_price) query = query.gte('price', min_price);
    if (max_price) query = query.lte('price', max_price);
    if (status) query = query.eq('status', status);
    // Location search would ideally use PostGIS or text search, for now simple ilike
    if (location) query = query.ilike('address->>city', `%${location}%`);

    const { data, error } = await query;

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get single property
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('properties')
      .select('*, property_images(*), users(name, email, phone)')
      .eq('id', id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create property (Protected)
router.post('/', async (req, res) => {
  try {
    // In a real app, verify JWT token here
    const { title, description, price, type, address, specifications, agent_id } = req.body;
    
    const { data, error } = await supabaseAdmin
      .from('properties')
      .insert([
        { title, description, price, type, address, specifications, agent_id }
      ])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;