import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Helper to validate URL
const isValidUrl = (urlString: string) => {
  try { 
    return Boolean(new URL(urlString)); 
  }
  catch(e){ 
    return false; 
  }
}

if (!supabaseUrl || !isValidUrl(supabaseUrl) || !supabaseAnonKey) {
  console.error('Supabase configuration missing or invalid. Check your .env file.');
  // Render a visual error if in browser
  if (typeof window !== 'undefined') {
    document.body.innerHTML = `
      <div style="display:flex;height:100vh;justify-content:center;align-items:center;flex-direction:column;font-family:sans-serif;text-align:center;padding:20px;">
        <h1 style="color:#e11d48;">Configuration Error</h1>
        <p>Supabase environment variables are missing or invalid.</p>
        <p>Please check your <code>.env</code> file.</p>
        <pre style="background:#f1f5f9;padding:10px;border-radius:4px;text-align:left;">
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
        </pre>
      </div>
    `;
  }
}

// Fallback to prevent crash, though calls will fail
export const supabase = createClient(
  isValidUrl(supabaseUrl) ? supabaseUrl : 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'umlc-app-auth-token'
    }
  }
)
