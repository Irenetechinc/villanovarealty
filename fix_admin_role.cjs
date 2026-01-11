const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://glsjjrktrighwqeodhfp.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdsc2pqcmt0cmlnaHdxZW9kaGZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjY5MjE2NiwiZXhwIjoyMDgyMjY4MTY2fQ.ZWFSD8mpuB1actpwomoYSWdJp50MsU9jhE-LUY4E2Ok';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function fixPublicUserConflict() {
  const email = 'megerdavstar@gmail.com';
  console.log(`Resolving conflict for ${email}...`);
  
  // 1. Get auth user id
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) return console.error(authError);
  const authUser = users.find(u => u.email === email);
  if (!authUser) return console.error('Auth user not found');
  console.log(`New Auth ID: ${authUser.id}`);

  // 2. Find the stale record in public.users
  const { data: staleUser, error: staleError } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (staleError && staleError.code !== 'PGRST116') {
      console.error('Error checking stale user:', staleError);
      return;
  }

  if (staleUser) {
      console.log(`Found stale user record: ID=${staleUser.id}`);
      if (staleUser.id !== authUser.id) {
          console.log('IDs do not match. Deleting stale record...');
          const { error: deleteError } = await supabase
            .from('users')
            .delete()
            .eq('id', staleUser.id);
          
          if (deleteError) {
              console.error('Failed to delete stale record:', deleteError);
              return;
          }
          console.log('Stale record deleted.');
      } else {
          console.log('IDs match. Proceeding to update.');
      }
  } else {
      console.log('No stale record found by email.');
  }

  // 3. Insert/Update the correct record
  console.log('Upserting correct user record...');
  const { data, error } = await supabase
    .from('users')
    .upsert({ 
        id: authUser.id, 
        email: email, 
        name: 'Divine David',
        role: 'admin',
        password_hash: 'managed_by_supabase_auth'
    })
    .select();
  
  if (error) {
      console.error('Failed to fix public user:', error);
  } else {
      console.log('Public user fixed successfully:', data);
  }
}

fixPublicUserConflict();
