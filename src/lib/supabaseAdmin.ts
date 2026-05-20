import { createClient } from '@supabase/supabase-js';

// This is meant for server-side usage ONLY (server.ts or API routes)
// It uses the service_role key to bypass RLS.
const supabaseUrl = process.env.VITE_SUPABASE_URL; // Can reuse the URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;
