import { useState } from 'react';
import { fetchBB, fetchKDJ, fetchSTAI, fireAlerts } from '@/lib/apiIndicators';

export default function AlertTester() {
  const [symbol, setSymbol] = useState('AAPL');
  const [tf, setTf] = useState<'10m' | '1h' | '4h'>('1h');
  const [log, setLog] = useState('');

  const run = (msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setLog((prev) => `[${ts}] ${msg}\n${prev}`);
  };

  const onBB = async () => {
    try {
      const data = await fetchBB(symbol, tf);
      run(`BB ok: ${data.length} rows`);
    } catch (e: any) {
      run(`BB error: ${e.message ?? String(e)}`);
    }
  };

  const onKDJ = async () => {
    try {
      const data = await fetchKDJ(symbol, tf);
      run(`KDJ ok: ${data.length} rows`);
    } catch (e: any) {
      run(`KDJ error: ${e.message ?? String(e)}`);
    }
  };

  const onSTAI = async (persist = false) => {
    try {
      const data = await fetchSTAI(symbol, tf, { persist });
      run(`STAI ok: bands=${data.bands.length}`);
    } catch (e: any) {
      run(`STAI error: ${e.message ?? String(e)}`);
    }
  };

  const onAlerts = async () => {
    try {
      const data = await fireAlerts(symbol, tf);
      run(`Alerts inserted: ${data.inserted ?? 0}`);
    } catch (e: any) {
      run(`Alerts error: ${e.message ?? String(e)}`);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Alert Tester</h1>
      <div className="flex flex-wrap gap-2 items-center">
        <label htmlFor="at-symbol" className="sr-only">
          Symbol
        </label>
        <input
          id="at-symbol"
          name="symbol"
          className="border rounded px-2 py-1"
          value={symbol}
          aria-label="Symbol"
          title="Symbol"
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
        />
        <label htmlFor="at-tf" className="sr-only">
          Timeframe
        </label>
        <select
          id="at-tf"
          name="tf"
          className="border rounded px-2 py-1"
          value={tf}
          aria-label="Timeframe"
          title="Timeframe"
          onChange={(e) => setTf(e.target.value as '10m' | '1h' | '4h')}
        >
          <option value="10m">10m</option>
          <option value="1h">1h</option>
          <option value="4h">4h</option>
        </select>
        <button className="border rounded px-3 py-1" type="button" onClick={onBB}>
          BB
        </button>
        <button className="border rounded px-3 py-1" type="button" onClick={onKDJ}>
          KDJ
        </button>
        <button className="border rounded px-3 py-1" type="button" onClick={() => onSTAI(false)}>
          STAI
        </button>
        <button className="border rounded px-3 py-1" type="button" onClick={() => onSTAI(true)}>
          STAI+Persist
        </button>
        <button className="border rounded px-3 py-1" type="button" onClick={onAlerts}>
          Alerts
        </button>
      </div>
      <label htmlFor="at-log" className="sr-only">
        Debug log
      </label>
      <textarea
        id="at-log"
        aria-label="Debug log"
        title="Debug log"
        className="w-full h-64 border rounded p-2 font-mono text-sm"
        value={log}
        readOnly
      />
    </div>
  );
}
