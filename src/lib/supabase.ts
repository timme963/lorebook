import { createClient } from '@supabase/supabase-js';

// public values (publishable key); access control is enforced by row level security
const SUPABASE_URL = 'https://pvzzxmwtaokcefkuyevn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_KrtX2Pj4oT8GwgAMfRqwpw__NE6HmOf';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // sign-in with a code from the email instead of a link – also works in the installed app
    detectSessionInUrl: false,
  },
});
