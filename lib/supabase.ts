import { createClient } from '@supabase/supabase-js';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
  | string
  | undefined;
export const supabaseConfigured = Boolean(
  supabaseUrl && /^https?:\/\//.test(supabaseUrl) && supabasePublishableKey,
);
// Home shows a setup screen when configuration is absent; no queries run against this placeholder.
export const supabase = createClient(
  supabaseConfigured ? supabaseUrl! : 'https://unconfigured.invalid',
  supabasePublishableKey || 'unconfigured',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
