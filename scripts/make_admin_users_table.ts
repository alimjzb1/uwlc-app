import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setAdmin() {
  console.log("Looking up user: alimajzoub007@gmail.com in auth.users to get ID...");
  
  // Since we might not have the UUID handy, let's first get the user ID using the service role key
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
      console.log("Could not list users (likely missing service role key), cannot securely map email to ID for public.users.", authError);
      return;
  }
  
  const targetUser = users.find(u => u.email === 'alimajzoub007@gmail.com');
  
  if (!targetUser) {
      console.log("Could not find user in auth.users.");
      return;
  }
  
  console.log(`Found user ID: ${targetUser.id}. Upserting into public.users...`);
  
  const { data, error } = await supabase
    .from('users')
    .upsert({ 
        id: targetUser.id, 
        email: targetUser.email,
        role: 'admin',
        permissions: [] // Granting empty array or specific jsonb for permissions
    })
    .select();
    
  if (error) {
    console.error("Error upserting into public.users:", error);
  } else {
    console.log("Successfully updated public.users permissions: ", data);
  }
}

setAdmin();
