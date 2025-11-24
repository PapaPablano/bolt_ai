import { createClient } from '@supabase/supabase-js';
import { env } from './env';

const envVars = (import.meta as unknown as { env?: { MODE?: string } }).env;
const nodeProcess =
  typeof globalThis !== 'undefined'
    ? (globalThis as { process?: { env?: { NODE_ENV?: string; VITEST?: string } } }).process
    : undefined;

const mode = envVars?.MODE ?? (nodeProcess?.env?.NODE_ENV as string | undefined) ?? 'production';
const isTestEnv = mode === 'test' || Boolean(nodeProcess?.env?.VITEST);
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
} else if (isTestEnv) {
  supabaseClient = createMockSupabaseClient();
} else {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = supabaseClient;
