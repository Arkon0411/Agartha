import { createClient } from '@supabase/supabase-js'

// Create a Supabase client for webhook handlers
// Uses Service Role Key to bypass RLS if available, otherwise uses anon key with RLS policies
export function createWebhookClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  
  // Use service role key if available, otherwise fall back to anon key
  // When using anon key, RLS policies must allow webhook operations
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log("Using anon key for webhook - RLS policies must be configured")
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

