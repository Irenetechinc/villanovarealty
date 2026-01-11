import { Router } from 'express';
import { supabaseAdmin } from '../supabase.ts';

const router = Router();

// Register user
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role }
    });

    if (authError) throw authError;

    // Create public user profile
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert([
        { id: authData.user.id, email, name, role, password_hash: 'managed_by_supabase' }
      ]);

    if (profileError) throw profileError;

    res.status(201).json({ user: authData.user });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;