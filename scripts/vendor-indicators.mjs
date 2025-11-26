// scripts/vendor-indicators.mjs
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const srcDir = path.join(repoRoot, 'packages', 'indicators-ts', 'dist', 'edge');

const functions = [
  'indicators-bbands',
  'indicators-kdj',
  'regimes-supertrend',
  'alerts-evaluate',
];

for (const fn of functions) {
  const dest = path.join(repoRoot, 'supabase', 'functions', fn, '_indicators');
  fs.mkdirSync(dest, { recursive: true });
  for (const file of fs.readdirSync(srcDir)) {
    if (file.endsWith('.js') || file.endsWith('.d.ts') || file.endsWith('.map')) {
      fs.copyFileSync(path.join(srcDir, file), path.join(dest, file));
    }
  }
  // eslint-disable-next-line no-console
  console.log(`[vendor] Copied indicators to ${dest}`);
}
