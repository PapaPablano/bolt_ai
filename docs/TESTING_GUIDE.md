# Testing Guide: Two-Tier Data Fetching

## Quick Verification Steps

### 1. Open Browser Developer Console
1. Open the app in browser (http://localhost:8080)
2. Press F12 or Cmd+Option+I (Mac) to open DevTools
3. Go to Console tab
4. Clear console (Cmd+K or Ctrl+L)

### 2. Test Short Range (1 Month)
**This is the critical test - SMA 200 should work!**

1. Click the **"1M"** button on the price chart
2. Watch the console output - you should see:
   ```
   [Index] Display range: 1mo, Fetching: 1y for calculations
   [useStockHistorical] Fetching AAPL with range: 1y
   [Index] Using 252 data points for calculations
   [Index] Filtered to 23 data points for display range: 1mo
   [TechnicalAnalysisDashboard] Calculation data: 252 points
   [TechnicalAnalysisDashboard] Display data: 23 points
   ```

3. Check the debug badge at top - should show:
   ```
   Range: 1mo | Display: 23 pts | Calc: 252 pts
   ```

4. Look at the price chart X-axis:
   - Should show approximately 1 month of dates
   - Example: Oct 8 → Nov 7
   - NOT May → November!

5. Scroll down to Technical Indicators section
6. Enable **SMA 200** from the left sidebar
7. Verify:
   - [ ] SMA 200 chart appears
   - [ ] Shows data (not empty/null)
   - [ ] X-axis matches 1-month range
   - [ ] Values look reasonable

### 3. Test Other Ranges

#### Test 5 Days
1. Click **"5D"** button
2. Console should show: `Fetching: 1y for calculations`
3. Debug badge: `Range: 5d | Display: 5 pts | Calc: 252 pts`
4. Charts show 5 days of data
5. All indicators still work

#### Test 3 Months
1. Click **"3M"** button
2. Console should show: `Fetching: 1y for calculations`
3. Debug badge: `Range: 3mo | Display: ~66 pts | Calc: 252 pts`
4. Charts show 3 months of data
5. SMA 200 still has values

#### Test 1 Year
1. Click **"1Y"** button
2. Console should show: `Fetching: 2y for calculations`
3. Debug badge: `Range: 1y | Display: ~252 pts | Calc: ~504 pts`
4. Charts show 1 year of data
5. All indicators work perfectly

### 4. Test Multiple Indicators

Enable these indicators from the left sidebar:
- [ ] SMA 20
- [ ] SMA 50
- [ ] SMA 200
- [ ] RSI (14)
- [ ] MACD
- [ ] Stochastic
- [ ] KDJ (9)
- [ ] OBV
- [ ] VROC (14)
- [ ] MFI (14)
- [ ] ATR (14)
- [ ] ADX (14)

For each indicator, verify:
- [ ] Chart appears without errors
- [ ] Data is displayed (not all null/empty)
- [ ] X-axis shows correct date range
- [ ] Values look reasonable (not NaN or Infinity)

### 5. Test Symbol Changes

1. Select "1M" range
2. Search for a different stock (e.g., "MSFT")
3. Verify:
   - [ ] New data fetches
   - [ ] Indicators recalculate
   - [ ] All charts update correctly
   - [ ] Debug badge shows new data point counts

### 6. Visual Inspection

Check the main price chart:
- [ ] Candlesticks/line visible
- [ ] Volume bars below price
- [ ] X-axis shows correct dates
- [ ] Y-axis shows reasonable prices
- [ ] No visual glitches

Check indicator charts:
- [ ] Each selected indicator has its own chart
- [ ] Lines are smooth (not jagged with gaps)
- [ ] Colors are distinct
- [ ] Legend shows indicator names
- [ ] Hover tooltips work

### 7. Performance Check

1. Switch between different ranges rapidly:
   - 1D → 5D → 1M → 3M → 6M → 1Y → 5Y
2. Verify:
   - [ ] UI remains responsive
   - [ ] No lag or freezing
   - [ ] Charts update smoothly
   - [ ] Console shows caching (some requests skip API call)

## Expected Results Summary

### ✅ PASS Criteria
- SMA 200 shows values on 1-month view
- All indicators calculate without errors
- X-axis always matches selected range
- Console logs show correct data point counts
- Debug badge updates correctly
- No JavaScript errors in console
- Performance is smooth

### ❌ FAIL Indicators
- SMA 200 is empty on 1-month view
- Indicators show all null values
- X-axis shows wrong date range
- Console errors appear
- Page freezes or becomes unresponsive
- Debug badge shows 0 data points

## Troubleshooting

### Issue: No data appears
**Solution:**
1. Check if Supabase Edge Functions are running
2. Verify API keys in environment
3. Check console for network errors
4. Try with mock data first

### Issue: Indicators show gaps
**Solution:**
1. Verify calculation data has enough points (should be 252+ for 1mo)
2. Check console logs for filtering issues
3. Ensure indicator calculation functions handle null values

### Issue: X-axis shows wrong dates
**Solution:**
1. Verify displayData is being used (not calculationData)
2. Check date filtering logic in Index.tsx
3. Ensure formatDate function works correctly

### Issue: Performance is slow
**Solution:**
1. Check if React Query caching is working
2. Verify useMemo dependencies are correct
3. Consider reducing number of active indicators

## Console Commands for Manual Testing

Open browser console and run:

```javascript
// Check current state
console.log('Date Range:', localStorage.getItem('dateRange'));

// Force refetch
localStorage.clear();
location.reload();

// Check React Query cache
// (View in React DevTools > Components > useStockHistorical)
```

## Success Screenshot Checklist

Take screenshots showing:
1. [ ] 1-month view with SMA 200 displayed
2. [ ] Debug badge showing "Display: 23 pts | Calc: 252 pts"
3. [ ] Console logs showing data fetching
4. [ ] Multiple indicators working simultaneously
5. [ ] X-axis clearly showing correct 1-month range

## Next Steps After Testing

If all tests pass:
- ✅ Implementation is successful
- ✅ Ready for production
- ✅ Document any edge cases discovered
- ✅ Consider adding automated tests

If tests fail:
- ❌ Review console logs for errors
- ❌ Check network requests in DevTools
- ❌ Verify code changes were applied correctly
- ❌ Test with simpler scenarios first
- ❌ Report specific failure cases
