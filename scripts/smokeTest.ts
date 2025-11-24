import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in your environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const TEST_SYMBOL = 'AAPL';
const FUTURES_TEST_SYMBOL = process.env.FUTURES_TEST_SYMBOL ?? 'MESZ2025';
const ENABLE_FUTURES_TESTS =
  (process.env.ENABLE_FUTURES_TESTS ?? 'false').trim().toLowerCase() === 'true';

interface TestConfig {
  functionName: string;
  payload: object;
  validateResponse: (data: unknown) => boolean;
  optional?: boolean;
}

const hasDataArray = (value: unknown): value is { data: unknown[] } =>
  typeof value === 'object' && value !== null && Array.isArray((value as { data?: unknown[] }).data);

const isQuoteResponse = (value: unknown): value is { symbol: string; price: number } => {
  if (!value || typeof value !== 'object') return false;
  const { symbol, price } = value as { symbol?: unknown; price?: unknown };
  return typeof symbol === 'string' && typeof price === 'number';
};

const hasArticlesArray = (value: unknown): value is { articles: unknown[] } =>
  typeof value === 'object' && value !== null && Array.isArray((value as { articles?: unknown[] }).articles);

const isSignalResponse = (value: unknown): value is { symbol: string; signal: string } => {
  if (!value || typeof value !== 'object') return false;
  const { symbol, signal } = value as { symbol?: unknown; signal?: unknown };
  return (
    typeof symbol === 'string' &&
    typeof signal === 'string' &&
    ['Buy', 'Sell', 'Hold'].includes(signal)
  );
};

const hasSearchResults = (
  value: unknown,
): value is { results: Array<{ symbol?: string }> } => {
  if (!value || typeof value !== 'object') return false;
  const { results } = value as { results?: unknown };
  return (
    Array.isArray(results) &&
    results.some((result) => typeof result === 'object' && result !== null && typeof (result as { symbol?: unknown }).symbol === 'string')
  );
};

const isFuturesPayload = (
  value: unknown,
): value is { instrumentType: string; data: unknown[] } => {
  if (!value || typeof value !== 'object') return false;
  const { instrumentType, data } = value as { instrumentType?: unknown; data?: unknown };
  return instrumentType === 'future' && Array.isArray(data);
};

const isNonEmptyObjectOrArray = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }
  return false;
};

const tests: TestConfig[] = [
  {
    functionName: 'stock-historical-v3',
    payload: { body: { symbol: TEST_SYMBOL, range: '1mo' } },
    validateResponse: (data) => hasDataArray(data) && data.data.length > 0,
  },
  {
    functionName: 'stock-intraday',
    payload: { body: { symbol: TEST_SYMBOL, interval: '15m', range: '1d' } },
    validateResponse: (data) => hasDataArray(data) && data.data.length > 0,
  },
  {
    functionName: 'stock-quote',
    payload: { body: { symbol: TEST_SYMBOL } },
    validateResponse: (data) => isQuoteResponse(data) && data.symbol === TEST_SYMBOL,
  },
  {
    functionName: 'stock-news',
    payload: { body: { symbol: TEST_SYMBOL, limit: 5 } },
    validateResponse: (data) => hasArticlesArray(data),
  },
  {
    functionName: 'ml-signals',
    payload: { body: { symbol: TEST_SYMBOL } },
    validateResponse: (data) => isSignalResponse(data) && data.symbol === TEST_SYMBOL,
  },
  {
    functionName: 'stock-search',
    payload: { body: { query: 'Apple' } },
    validateResponse: (data) => hasSearchResults(data) && data.results.some((d) => d.symbol === 'AAPL'),
  },
  {
    functionName: 'alpaca-proxy',
    payload: { body: { action: 'get_latest_quote', params: { symbol: TEST_SYMBOL } } },
    validateResponse: (data) => isNonEmptyObjectOrArray(data),
    optional: true,
  },
  {
    functionName: 'schwab-proxy',
    payload: { body: { action: 'get_quote', params: { symbols: [TEST_SYMBOL] } } },
    validateResponse: (data) => isNonEmptyObjectOrArray(data),
    optional: true,
  },
  {
    functionName: 'news-proxy',
    payload: { body: { action: 'get_today_events' } },
    validateResponse: (data) => isNonEmptyObjectOrArray(data),
    optional: true,
  },
];

if (ENABLE_FUTURES_TESTS) {
  console.log(`🔁 Futures smoke tests enabled for ${FUTURES_TEST_SYMBOL}`);
  tests.push(
    {
      functionName: 'stock-historical-v3',
      payload: { body: { symbol: FUTURES_TEST_SYMBOL, range: '1mo', instrumentType: 'future' } },
      validateResponse: (data) =>
        isFuturesPayload(data) && data.data.length > 0,
    },
    {
      functionName: 'stock-intraday',
      payload: {
        body: { symbol: FUTURES_TEST_SYMBOL, interval: '15m', range: '1d', instrumentType: 'future' },
      },
      validateResponse: (data) =>
        isFuturesPayload(data) && data.data.length > 0,
    },
  );
} else {
  console.log('⚠️ Futures smoke tests disabled (set ENABLE_FUTURES_TESTS=true to enable).');
}

const runSmokeTests = async () => {
  console.log('🚀 Starting Supabase Edge Function Smoke Test...');
  let allTestsPassed = true;

  for (const test of tests) {
    process.stdout.write(`- Testing ${test.functionName}... `);
    try {
      const { data, error } = await supabase.functions.invoke(test.functionName, test.payload);

      if (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (test.optional && message.toLowerCase().includes('not_found')) {
          console.log(`⚪ SKIPPED (optional function not deployed: ${message})`);
          const context = (error as { context?: { body?: unknown } }).context;
          if (context?.body) {
            try {
              const errorBody = await new Response(context.body as BodyInit).text();
              console.log('   Error response:', errorBody.substring(0, 500));
            } catch (streamError) {
              console.log('   Error response could not be read:', streamError);
            }
          }
          if (data) {
            console.log('   Response payload:', JSON.stringify(data, null, 2).substring(0, 500));
          }
          continue;
        } else {
          allTestsPassed = false;
          console.log(`❌ FAILED (${message})`);
          const context = (error as { context?: { body?: unknown } }).context;
          if (context?.body) {
            try {
              const errorBody = await new Response(context.body as BodyInit).text();
              console.log('   Error response:', errorBody.substring(0, 500));
            } catch (streamError) {
              console.log('   Error response could not be read:', streamError);
            }
          }
          if (data) {
            console.log('   Response payload:', JSON.stringify(data, null, 2).substring(0, 500));
          }
          continue;
        }
      }

      if (test.validateResponse(data)) {
        console.log('✅ PASSED');
      } else {
        allTestsPassed = false;
        console.log('❌ FAILED (Invalid response structure)');
        console.log('   Response:', JSON.stringify(data, null, 2).substring(0, 300));
      }
    } catch (error) {
      allTestsPassed = false;
      const message = error instanceof Error ? error.message : String(error);
      console.log(`❌ FAILED (${message})`);
    }
  }

  console.log('\n----------------------------------------');
  if (allTestsPassed) {
    console.log('🎉 All smoke tests passed successfully!');
  } else {
    console.log('🔥 Some smoke tests failed. Please review the logs.');
    process.exit(1);
  }
};

runSmokeTests();
