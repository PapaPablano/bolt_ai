# Date Range Selection Troubleshooting Guide

## Issue: Date Range Buttons Not Updating Charts

### Symptoms
- User clicks different time range buttons (1D, 5D, 1M, 3M, 6M, 1Y, 5Y)
- Button highlights change (showing selection is working)
- But chart data doesn't update - still shows same date range
- X-axis labels remain the same

### Root Causes & Solutions

## 1. React Query Cache Issue

**Problem:** React Query is serving stale cached data instead of refetching.

**Solution A: Force Refetch on Range Change**

Add `refetchOnMount: "always"` to the query options:

```typescript
// In src/hooks/useStockHistorical.ts
export const useStockHistorical = (symbol: string, range: string = '1mo') => {
  return useQuery({
    queryKey: ['stock-historical', symbol, range],
    queryFn: async () => {
      // ... existing code
    },
    enabled: !!symbol,
    staleTime: 0, // Changed from 5 minutes to 0 to always refetch
    refetchOnMount: "always",
    refetchOnWindowFocus: false, // Prevent refetch on window focus
  });
};
```

**Solution B: Manual Cache Invalidation**

Add a button to force refresh:

```typescript
// In Index.tsx
import { useQueryClient } from '@tanstack/react-query';

const Index = () => {
  const queryClient = useQueryClient();
  
  const handleDateRangeChange = (range: string) => {
    setDateRange(range);
    // Force invalidate the cache
    queryClient.invalidateQueries({ 
      queryKey: ['stock-historical', selectedSymbol] 
    });
  };
};
```

## 2. API Errors Being Silent

**Problem:** The Supabase Edge Function is returning an error, but it's falling back to mock data.

**Check:**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for error messages starting with `[useStockHistorical]`
4. Check Network tab for failed requests to `stock-historical`

**Common API Errors:**

### Error: "Missing VITE_SUPABASE_URL environment variable"
**Fix:** Ensure `.env` file exists with:
```bash
VITE_SUPABASE_URL=https://iwwdxshzrxilpzehymeu.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### Error: CORS or 401 Unauthorized
**Fix:** Check that the Supabase anon key is correct and hasn't expired.

### Error: Edge Function not found
**Fix:** Redeploy Edge Functions:
```bash
supabase functions deploy stock-historical --project-ref iwwdxshzrxilpzehymeu
```

## 3. Mock Data Fallback Always Triggering

**Problem:** The code always falls into the mock data generation path.

**Current Code Issue:**
```typescript
if (!historicalData || historicalData.length === 0) {
  // Generate mock data - was hardcoded to 30 days
}
```

**Fix Applied:**
Mock data now respects the `dateRange` parameter:
```typescript
// Calculate number of days based on date range
let daysToGenerate = 30;
switch(dateRange) {
  case '1d': daysToGenerate = 1; break;
  case '5d': daysToGenerate = 5; break;
  case '1mo': daysToGenerate = 30; break;
  case '3mo': daysToGenerate = 90; break;
  case '6mo': daysToGenerate = 180; break;
  case '1y': daysToGenerate = 365; break;
  case '5y': daysToGenerate = 1825; break;
}
```

## 4. Loveable Deployment Issues

**Problem:** Code works locally but not on Loveable deployed version.

**Checklist:**

### A. Environment Variables in Loveable
1. Go to Loveable project settings
2. Verify environment variables are set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Redeploy after changing env vars

### B. Supabase Edge Functions
1. Verify functions are deployed:
```bash
supabase functions list --project-ref iwwdxshzrxilpzehymeu
```

Expected output:
```
stock-historical | ACTIVE | v5
stock-quote      | ACTIVE | v6
stock-intraday   | ACTIVE | v4
stock-search     | ACTIVE | v1
```

2. Test function directly:
```bash
curl -X POST "https://iwwdxshzrxilpzehymeu.supabase.co/functions/v1/stock-historical" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"symbol": "AAPL", "range": "6mo"}'
```

### C. CORS Configuration
If you see CORS errors in the browser console, the Edge Functions already have CORS headers. Check that your Supabase project allows requests from your Loveable domain.

## 5. Date Format Issues

**Problem:** API returns dates in different format than expected.

**Check API Response:**
```javascript
// In browser console after clicking a range button
// You should see logs like:
[useStockHistorical] Fetching AAPL with range: 6mo
[useStockHistorical] Received 180 data points from yahoo
```

**Expected Date Format:**
API should return: `"2025-11-07"` (YYYY-MM-DD)
Chart displays: `"Nov 7"` (MMM DD)

## Testing Steps

### 1. Test Locally
```bash
npm run dev
```
1. Open http://localhost:5173
2. Open DevTools Console (F12)
3. Click different date range buttons
4. Watch for console logs showing data fetching
5. Verify chart X-axis updates with different date ranges

### 2. Test API Directly
```bash
# Test 1 month
curl -s -X POST "https://iwwdxshzrxilpzehymeu.supabase.co/functions/v1/stock-historical" \
  -H "Authorization: Bearer eyJh..." \
  -H "Content-Type: application/json" \
  -d '{"symbol": "AAPL", "range": "1mo"}' | jq '.data | length'

# Should return: 23 (approximately 1 month of trading days)

# Test 6 months
curl -s -X POST "https://iwwdxshzrxilpzehymeu.supabase.co/functions/v1/stock-historical" \
  -H "Authorization: Bearer eyJh..." \
  -H "Content-Type: application/json" \
  -d '{"symbol": "AAPL", "range": "6mo"}' | jq '.data | length'

# Should return: 128 (approximately 6 months of trading days)
```

### 3. Test on Loveable
1. Deploy to Loveable
2. Open deployed URL
3. Open DevTools Console
4. Click date range buttons
5. Check Network tab for API calls
6. Verify responses contain correct number of data points

## Debug Badge Added

A debug badge has been added to show:
- Current selected range
- Number of data points loaded

Look for: `Range: 6mo | Data Points: 180`

If data points don't change when clicking different ranges, that indicates the issue.

## Quick Fixes to Try

### Fix 1: Clear Browser Cache
1. Open DevTools (F12)
2. Right-click Refresh button
3. Select "Empty Cache and Hard Reload"

### Fix 2: Disable React Query Cache Temporarily
In `src/hooks/useStockHistorical.ts`:
```typescript
staleTime: 0, // Disable cache
cacheTime: 0, // Don't cache at all
```

### Fix 3: Force Refetch on Every Range Change
In `src/pages/Index.tsx`:
```typescript
const handleDateRangeChange = (range: string) => {
  setDateRange(range);
  // Force immediate refetch
  queryClient.resetQueries({ 
    queryKey: ['stock-historical'] 
  });
};
```

### Fix 4: Add Retry Logic
In `src/hooks/useStockHistorical.ts`:
```typescript
return useQuery({
  // ... existing options
  retry: 3,
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
});
```

## Expected Behavior

When working correctly:
1. Click "6M" button
2. Console shows: `[useStockHistorical] Fetching AAPL with range: 6mo`
3. Console shows: `[useStockHistorical] Received 128 data points from yahoo`
4. Console shows: `Using real API data: 128 data points`
5. Debug badge updates: `Range: 6mo | Data Points: 128`
6. Chart X-axis updates to show May - November
7. Technical indicators recalculate with 6 months of data

## If Still Not Working

### Collect Debugging Information:

1. **Browser Console Log:**
   - Click each date range button
   - Copy all console output
   - Look for errors or warnings

2. **Network Tab:**
   - Open DevTools → Network
   - Filter by "stock-historical"
   - Click a date range button
   - Check:
     - Request payload (should have correct range)
     - Response (should have correct number of data points)
     - Status code (should be 200)

3. **React Query DevTools:**
   Install React Query DevTools:
   ```bash
   npm install @tanstack/react-query-devtools
   ```
   
   Add to `src/main.tsx`:
   ```typescript
   import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
   
   <ReactQueryDevtools initialIsOpen={false} />
   ```
   
   This shows:
   - All queries and their cache status
   - When queries are fetching
   - Query keys and data

4. **Take Screenshots:**
   - Show console with error messages
   - Show Network tab with request/response
   - Show chart not updating
   - Show debug badge values

## Contact Support

If issue persists after trying all fixes:
1. Provide console logs
2. Provide Network tab screenshots
3. Describe steps to reproduce
4. Mention if it works locally but not on Loveable
5. Specify which date ranges don't work

## Files Modified

The following files have been updated to fix date range selection:

1. **src/pages/Index.tsx**
   - Added `dateRange` state
   - Added `handleDateRangeChange` callback
   - Fixed mock data to respect date range
   - Added debug badge
   - Added dependency on `dateRange` in `priceData` useMemo

2. **src/components/PriceChart.tsx**
   - Added `selectedRange` and `onRangeChange` props
   - Connected buttons to range change handler
   - Added range mapping (1M → 1mo, etc.)

3. **src/hooks/useStockHistorical.ts**
   - Added console logging for debugging
   - Query key includes range for proper cache invalidation

4. **Supabase Edge Functions** (already deployed)
   - stock-historical handles range parameter
   - Returns correct number of data points
   - Has proper fallback chain (Marketstack → Yahoo → Polygon)

## Version History
- v1.0 (2025-11-09): Initial implementation with known cache issue
- v1.1 (2025-11-09): Fixed mock data to respect date range
- v1.2 (2025-11-09): Added debug logging and badge
