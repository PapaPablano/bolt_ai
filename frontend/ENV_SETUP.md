# Environment Variables Setup

## Issue Found

The app is not showing because it's missing required Supabase environment variables.

## Quick Fix

1. **Create `.env.local` file in the `frontend/` directory:**

```bash
cd frontend
touch .env.local
```

2. **Add the following content:**

```env
VITE_SUPABASE_URL=https://iwwdxshzrxilpzehymeu.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
```

3. **Get your Anon Key from Supabase Dashboard:**

   - Go to: https://supabase.com/dashboard/project/iwwdxshzrxilpzehymeu/settings/api
   - Find the "Project API keys" section
   - Copy the `anon` `public` key
   - Paste it as the value for `VITE_SUPABASE_ANON_KEY` in `.env.local`

4. **Restart the dev server:**

```bash
npm run dev
```

## Alternative: Use Local Supabase

If you want to use the local Supabase instance instead:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
```

**Note:** The local key shown above is from your current Supabase CLI output.

## Verify Setup

After creating the `.env.local` file and restarting the server, the app should load without errors. Check the browser console to confirm no "Missing Supabase environment variables" error appears.

