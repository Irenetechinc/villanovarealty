const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://glsjjrktrighwqeodhfp.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdsc2pqcmt0cmlnaHdxZW9kaGZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjY5MjE2NiwiZXhwIjoyMDgyMjY4MTY2fQ.ZWFSD8mpuB1actpwomoYSWdJp50MsU9jhE-LUY4E2Ok';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkPublicUserRole() {
  const email = 'megerdavstar@gmail.com';
  console.log(`Checking public.users table for ${email}...`);
  
  // 1. Get auth user id first to be sure
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
      console.error('Auth list error:', authError);
      return;
  }
  const authUser = users.find(u => u.email === email);
  if (!authUser) {
      console.error('Auth user not found!');
      return;
  }
  console.log(`Auth User ID: ${authUser.id}`);

  // 2. Check public.users table
  const { data: publicUser, error: publicError } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single();

  if (publicError) {
      console.error('Error fetching public user:', publicError);
      // If error is "Row not found", we might need to create it
  } else {
      console.log('Public User found:', publicUser);
  }

  // 3. Fix it if needed
  if (!publicUser || publicUser.role !== 'admin') {
      console.log('Fixing public user role to admin...');
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .upsert({ 
            id: authUser.id, 
            email: email, 
            role: 'admin',
            full_name: 'Divine David' // Assuming name from previous context
        })
        .select();
      
      if (updateError) {
          console.error('Failed to update public user:', updateError);
      } else {
          console.log('Public user updated successfully:', updatedUser);
      }
  } else {
      console.log('User is already an admin in public.users');
  }
}

checkPublicUserRole();
