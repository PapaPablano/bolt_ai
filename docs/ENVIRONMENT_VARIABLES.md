# Environment Variables Reference

This document clarifies all environment variable naming conventions across the codebase.

## Summary

There are **two different contexts** that use different variable naming:

1. **Frontend (Vite/React)** - Uses `VITE_` prefix
2. **Edge Functions (Deno/Supabase)** - Uses different names

## Frontend Environment Variables

**Location:** `frontend/.env.local` (local file on your computer)

```env
VITE_SUPABASE_URL=https://iwwdxshzrxilpzehymeu.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

**Why `VITE_` prefix?**
- Vite only exposes variables with this prefix to frontend code
- Without it, the variable won't be available to your React app
- This is a Vite security feature

**These are PUBLIC values** - The anon key is meant to be exposed to the browser.

## Edge Functions Environment Variables

**Location:** Supabase Dashboard → Edge Functions → Secrets (server-side)

### Supabase Variables (Auto-Provided)

Supabase **automatically provides** these to all Edge Functions:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (bypasses RLS)

**You don't need to set these manually** - Supabase injects them automatically.

### Alpaca Variables (Manual Secrets)

You must set these in Supabase secrets:

```bash
# Set via Supabase CLI or Dashboard
ALPACA_KEY_ID=your_alpaca_key_id
ALPACA_SECRET_KEY=your_alpaca_secret_key
ALPACA_STOCK_FEED=iex  # or 'sip' for premium
```

**Important:** The code uses `ALPACA_KEY_ID` (not `APCA_API_KEY_ID`)

**Why the difference?**
- **HTTP Headers** use: `APCA-API-KEY-ID` and `APCA-API-SECRET-KEY` (Alpaca's official format)
- **Environment Variables** use: `ALPACA_KEY_ID` and `ALPACA_SECRET_KEY` (shorter, clearer names)
- The Edge Functions read from env vars and map them to HTTP headers

## Quick Reference Table

| Context | Variable Name | Location | Purpose |
|---------|--------------|----------|---------|
| Frontend | `VITE_SUPABASE_URL` | `.env.local` | Supabase project URL |
| Frontend | `VITE_SUPABASE_ANON_KEY` | `.env.local` | Public anon key |
| Edge Function | `SUPABASE_URL` | Auto-provided | Supabase project URL |
| Edge Function | `SUPABASE_SERVICE_ROLE_KEY` | Auto-provided | Service role key |
| Edge Function | `ALPACA_KEY_ID` | Supabase Secrets | Alpaca API key |
| Edge Function | `ALPACA_SECRET_KEY` | Supabase Secrets | Alpaca API secret |
| Edge Function | `ALPACA_STOCK_FEED` | Supabase Secrets | Data feed (iex/sip) |

## Common Mistakes

❌ **Wrong:** Using `APCA_API_KEY_ID` in Supabase secrets  
✅ **Correct:** Use `ALPACA_KEY_ID` in Supabase secrets

❌ **Wrong:** Using `SUPABASE_URL` in frontend `.env.local`  
✅ **Correct:** Use `VITE_SUPABASE_URL` in frontend `.env.local`

❌ **Wrong:** Setting `SUPABASE_URL` as a secret (it's auto-provided)  
✅ **Correct:** Let Supabase provide it automatically

## Code Examples

### Frontend (React/Vite)
```typescript
// frontend/src/lib/supabase.ts
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
```

### Edge Function (Deno)
```typescript
// supabase/functions/stock-quote/index.ts
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',           // Auto-provided
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Auto-provided
)

const keyId = Deno.env.get('ALPACA_KEY_ID')        // From secrets
const secretKey = Deno.env.get('ALPACA_SECRET_KEY') // From secrets

// Use in HTTP headers
headers: {
  'APCA-API-KEY-ID': keyId,        // Alpaca's HTTP header format
  'APCA-API-SECRET-KEY': secretKey,
}
```

## Setting Up Secrets

### Via Supabase CLI
```bash
supabase secrets set \
  ALPACA_KEY_ID="your_key" \
  ALPACA_SECRET_KEY="your_secret" \
  ALPACA_STOCK_FEED="iex" \
  --project-ref iwwdxshzrxilpzehymeu
```

### Via Supabase Dashboard
1. Go to: https://supabase.com/dashboard/project/iwwdxshzrxilpzehymeu/settings/functions
2. Click "Manage secrets"
3. Add:
   - `ALPACA_KEY_ID` = your Alpaca key ID
   - `ALPACA_SECRET_KEY` = your Alpaca secret key
   - `ALPACA_STOCK_FEED` = `iex` or `sip`

## Verification

### Check Frontend Variables
```bash
cd frontend
cat .env.local
# Should see VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

### Check Edge Function Secrets
```bash
supabase secrets list --project-ref iwwdxshzrxilpzehymeu
# Should see ALPACA_KEY_ID, ALPACA_SECRET_KEY, ALPACA_STOCK_FEED
```

### Test Edge Function
```bash
curl -X POST "https://iwwdxshzrxilpzehymeu.supabase.co/functions/v1/stock-quote" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"symbol": "AAPL"}'
```

## Troubleshooting

**Error: "Missing Supabase environment variables"**
- Check `frontend/.env.local` exists
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
- Restart dev server after creating `.env.local`

**Error: "Missing Alpaca credentials"**
- Check Supabase secrets are set correctly
- Verify variable names are `ALPACA_KEY_ID` (not `APCA_API_KEY_ID`)
- Redeploy Edge Functions after setting secrets

**Error: "SUPABASE_URL is undefined" in Edge Function**
- This should never happen - Supabase provides this automatically
- If it does, check your Supabase project is linked correctly

