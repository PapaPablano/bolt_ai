import process, { stdin, stdout } from 'node:process';

import { supertrendPerfSeries, type Candle, type StPerfParams } from '../frontend/src/utils/indicators-supertrend-perf';

type Payload = {
  candles?: Candle[];
  params?: StPerfParams;
};

async function readPayload(): Promise<Payload> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stdin) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  const text = Buffer.concat(chunks).toString('utf8').trim();
  return text ? (JSON.parse(text) as Payload) : {};
}

async function main() {
  const payload = await readPayload();
  const candles = payload.candles ?? [];
  const params = payload.params ?? ({} as StPerfParams);
  const batch = supertrendPerfSeries(candles, params);
  const response = {
    raw_supertrend: batch.raw,
    ama_supertrend: batch.ama ?? null,
    signals: batch.signals ?? [],
    factor: batch.factor,
  };
  stdout.write(`${JSON.stringify(response)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
