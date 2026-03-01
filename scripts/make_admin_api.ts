import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const envVars: any = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.trim();
  }
});

const supabaseUrl = process.env.VITE_SUPABASE_URL || envVars['VITE_SUPABASE_URL'];
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || envVars['VITE_SUPABASE_SERVICE_ROLE_KEY'] || envVars['VITE_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setAdminP() {
  console.log("Fetching target user ID...");
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
      console.log("listUsers failed:", authError);
      return;
  }
  
  const targetUser = users.find(u => u.email === 'alimajzoub007@gmail.com');
  if (!targetUser) {
      console.log("Could not find user in auth.users.");
      return;
  }
  
  console.log(`User ID: ${targetUser.id}. Upserting permissions into public.users...`);
  
  const { data, error } = await supabase
    .from('users')
    .upsert({ 
        id: targetUser.id, 
        role: 'admin',
        permissions: ["all"],
        settings: { theme: 'system', density: 'comfortable' }
    })
    .select();
    
  if (error) {
    console.error("Error upserting into public.users:", error);
  } else {
    console.log("Successfully updated public.users permissions: ", data);
  }
}

setAdminP();
