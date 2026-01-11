
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://glsjjrktrighwqeodhfp.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdsc2pqcmt0cmlnaHdxZW9kaGZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjY5MjE2NiwiZXhwIjoyMDgyMjY4MTY2fQ.ZWFSD8mpuB1actpwomoYSWdJp50MsU9jhE-LUY4E2Ok';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function confirmEmail() {
  const email = 'admin@villanova.ng';
  console.log(`Confirming email for ${email}...`);

  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error('Error listing users:', listError);
    return;
  }

  const user = users.find(u => u.email === email);

  if (!user) {
    console.error(`User with email ${email} not found.`);
    return;
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(
    user.id,
    { email_confirm: true }
  );

  if (updateError) {
    console.error('Error confirming email:', updateError);
  } else {
    console.log('Email confirmed successfully.');
  }
}

confirmEmail();
