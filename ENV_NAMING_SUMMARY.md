# Environment Variable Naming - Summary

## ✅ Current State (Correct)

### Frontend (Vite/React)
- `VITE_SUPABASE_URL` - In `frontend/.env.local`
- `VITE_SUPABASE_ANON_KEY` - In `frontend/.env.local`

### Edge Functions (Deno/Supabase)
**Auto-provided by Supabase:**
- `SUPABASE_URL` - Auto-injected
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-injected

**Manual secrets (set in Supabase Dashboard):**
- `ALPACA_KEY_ID` - Alpaca API key
- `ALPACA_SECRET_KEY` - Alpaca API secret
- `ALPACA_STOCK_FEED` - Data feed (iex/sip)

## 📝 Key Points

1. **Frontend uses `VITE_` prefix** - This is required by Vite to expose variables to browser code
2. **Edge Functions use different names** - They run in Deno, not Vite
3. **Supabase auto-provides** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` - Don't set these manually
4. **Alpaca variables** use `ALPACA_KEY_ID` (not `APCA_API_KEY_ID`) - This is what the code expects

## 🔍 Where Variables Are Used

| Variable | Location | Used By | Set Where |
|----------|----------|---------|-----------|
| `VITE_SUPABASE_URL` | `.env.local` | Frontend | Local file |
| `VITE_SUPABASE_ANON_KEY` | `.env.local` | Frontend | Local file |
| `SUPABASE_URL` | Auto-provided | Edge Functions | Supabase (automatic) |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-provided | Edge Functions | Supabase (automatic) |
| `ALPACA_KEY_ID` | Supabase Secrets | Edge Functions | Supabase Dashboard/CLI |
| `ALPACA_SECRET_KEY` | Supabase Secrets | Edge Functions | Supabase Dashboard/CLI |

## 📚 Reference

See [docs/ENVIRONMENT_VARIABLES.md](./docs/ENVIRONMENT_VARIABLES.md) for complete details.

