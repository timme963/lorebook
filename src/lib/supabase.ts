import { createClient } from '@supabase/supabase-js';

// Öffentliche Werte (Publishable Key). Der Zugriffsschutz läuft über Row Level Security.
const SUPABASE_URL = 'https://pvzzxmwtaokcefkuyevn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_KrtX2Pj4oT8GwgAMfRqwpw__NE6HmOf';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Login per Code aus der E-Mail, kein Link – funktioniert auch in der installierten App
    detectSessionInUrl: false,
  },
});
