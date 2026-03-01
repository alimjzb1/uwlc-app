import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Use service role key if available, otherwise anon key might not work due to RLS,
// but let's try reading the env vars.
// We need to bypass RLS to update if not authenticated as admin, 
// so service role key is better. If not available, we can print a migration.
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setAdmin() {
  console.log("Looking up user: alimajzoub007@gmail.com...");
  
  // First update the profile
  const { data: updateData, error: updateError } = await supabase
    .from('profiles')
    .update({ role: 'admin' })
    .eq('email', 'alimajzoub007@gmail.com')
    .select();
    
  if (updateError) {
    console.error("Error updating profile:", updateError.message);
  } else if (updateData && updateData.length > 0) {
    console.log("Successfully updated user to admin role: ", updateData[0]);
  } else {
    console.log("User alimajzoub007@gmail.com not found in profiles table.");
  }
}

setAdmin();
