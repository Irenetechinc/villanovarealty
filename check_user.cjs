const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://glsjjrktrighwqeodhfp.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdsc2pqcmt0cmlnaHdxZW9kaGZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjY5MjE2NiwiZXhwIjoyMDgyMjY4MTY2fQ.ZWFSD8mpuB1actpwomoYSWdJp50MsU9jhE-LUY4E2Ok';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkUser() {
  const email = 'megerdavstar@gmail.com';
  console.log(`Checking status for ${email}...`);
  
  const { data: { users }, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error('Error fetching users:', error);
    return;
  }

  const user = users.find(u => u.email === email);

  if (!user) {
    console.log('User not found!');
  } else {
    console.log('User details:');
    console.log(`ID: ${user.id}`);
    console.log(`Email: ${user.email}`);
    console.log(`Email Confirmed At: ${user.email_confirmed_at}`);
    console.log(`Confirmed At: ${user.confirmed_at}`);
    console.log(`Last Sign In: ${user.last_sign_in_at}`);
    console.log(`Role: ${user.role}`);
    
    // Attempt to force confirm again if needed
    if (!user.email_confirmed_at) {
        console.log('Attempting to re-confirm...');
        const { data, error: updateError } = await supabase.auth.admin.updateUserById(
            user.id,
            { email_confirmed_at: new Date().toISOString() }
        );
        if (updateError) console.error(updateError);
        else console.log('Update success:', data);
    }
  }
}

checkUser();
