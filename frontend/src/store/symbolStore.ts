import { create } from 'zustand';
import { env } from '@/lib/env';

type Timeframe = '1Min' | '5Min' | '10Min' | '15Min' | '1Hour' | '4Hour' | '1Day';

type State = {
  symbol: string;
  timeframe: Timeframe;
  setSymbol: (s: string) => void;
  setTimeframe: (t: Timeframe) => void;
};

const normalizeTimeframe = (value: string | undefined): Timeframe => {
  const allowed: Timeframe[] = ['1Min', '5Min', '10Min', '15Min', '1Hour', '4Hour', '1Day'];
  return allowed.find((tf) => tf === value) ?? '1Hour';
};

export const useSymbolStore = create<State>((set) => ({
  symbol: env.defaultSymbol || 'AAPL',
  timeframe: normalizeTimeframe(env.defaultTimeframe),
  setSymbol: (symbol) => set({ symbol: symbol.toUpperCase() }),
  setTimeframe: (timeframe) => set({ timeframe }),
}));
