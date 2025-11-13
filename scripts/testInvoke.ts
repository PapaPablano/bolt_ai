import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error('Missing env');
}

const supabase = createClient(url, key);

(async () => {
  const functionName = process.argv[2];
  const payload = process.argv[3] ? JSON.parse(process.argv[3]) : {};

  if (!functionName) {
    console.error('Error: Function name not provided.');
    console.log('Usage: npx tsx scripts/testInvoke.ts <function-name> [json-payload]');
    process.exit(1);
  }

  console.log(`Invoking function "${functionName}" with payload:`, payload);

  const { data, error } = await supabase.functions.invoke(functionName, {
    body: payload,
  });

  if (error) {
    console.error('Error invoking function:', error);
    if (error.context && typeof error.context.json === 'function') {
      try {
        const errorBody = await error.context.json();
        console.error('Error response body (JSON):', JSON.stringify(errorBody, null, 2));
      } catch {
        // if .json() fails, try .text()
        try {
          const errorText = await error.context.text();
          console.error('Error response body (text):', errorText);
        } catch {
          console.error('Failed to read detailed error response body.');
        }
      }
    }
  } else {
    console.log('Function returned data:');
    console.log(JSON.stringify(data, null, 2));
  }
})();
