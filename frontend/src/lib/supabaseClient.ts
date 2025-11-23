import { createClient } from '@supabase/supabase-js';
import { env } from './env';

const mode = import.meta.env.MODE;
const hasSupabaseEnv = Boolean(env.supabaseUrl && env.supabaseAnonKey);

const createMockSupabaseClient = () => ({
  auth: {
    getUser: async () => ({ data: { user: null }, error: null }),
  },
  from: () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: null, error: null }),
      }),
    }),
    insert: async () => ({ data: null, error: null }),
    upsert: async () => ({ data: null, error: null }),
  }),
});

let supabaseClient: ReturnType<typeof createClient> | ReturnType<typeof createMockSupabaseClient>;

if (hasSupabaseEnv) {
  supabaseClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
} else if (mode === 'test') {
  supabaseClient = createMockSupabaseClient();
} else {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = supabaseClient;
