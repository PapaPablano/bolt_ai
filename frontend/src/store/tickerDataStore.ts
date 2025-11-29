import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Bar } from '@/types/bars';
import type { StockQuote } from '@/lib/api';
import { fetchHistoricalData, fetchQuote, jsonOrText, type ApiPayload } from '@/lib/api';
import { api } from '@/lib/api/client';

export type Interval = '1m' | '5m' | '15m' | '1h' | '1d';
export type Range = '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' | '10y' | 'max';

export type Candle = Bar;
export type Quote = StockQuote;
export type OptionChain = unknown;

export type FetchSource = 'chart' | 'prefetch' | 'ml';

export interface FetchedMeta {
  fetchedAt: number;
  staleAfter: number;
  source: FetchSource;
}

export interface TickerData {
  candles: Candle[] | null;
  quote: Quote | null;
  options: OptionChain | null;
  status: {
    candlesLoading: boolean;
    quoteLoading: boolean;
    optionsLoading: boolean;
  };
  meta: {
    candles?: FetchedMeta;
    quote?: FetchedMeta;
    options?: FetchedMeta;
  };
}

export interface TickerRangeSelection {
  interval: Interval;
  range: Range;
}

interface FetchTickerOpts {
  force?: boolean;
  signal?: AbortSignal;
}

export interface TickerDataState {
  currentTicker: string | null;
  selectedRange: TickerRangeSelection;
  data: Record<string, TickerData>;
  fetchTickerData: (ticker: string, interval: Interval, range: Range, opts?: FetchTickerOpts) => Promise<void>;
  prefetchOptions: (ticker: string) => Promise<void>;
  backfillHistorical: (ticker: string) => Promise<void>;
  setQuote: (ticker: string, quote: Quote) => void;
  clearTicker: (ticker: string) => void;
}

const FIVE_MIN_MS = 5 * 60_000;
const FIFTEEN_SEC_MS = 15 * 1000;
const TEN_SEC_MS = 10 * 1000;
const ONE_HOUR_MS = 60 * 60_000;
const ONE_DAY_MS = 24 * 60 * 60_000;

const createEmptyTicker = (): TickerData => ({
  candles: null,
  quote: null,
  options: null,
  status: {
    candlesLoading: false,
    quoteLoading: false,
    optionsLoading: false,
  },
  meta: {},
});

const isFresh = (meta?: FetchedMeta | null) => {
  if (!meta) return false;
  return Date.now() - meta.fetchedAt < meta.staleAfter;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toCandles = (value: unknown): Candle[] | null => (Array.isArray(value) ? (value as Candle[]) : null);

const toQuote = (value: unknown): Quote | null => (isRecord(value) ? (value as Quote) : null);

export const useTickerDataStore = create<TickerDataState>()(
  devtools((set, get) => ({
    currentTicker: null,
    selectedRange: { interval: '1d', range: '1y' },
    data: {},

    fetchTickerData: async (ticker, interval, range, opts) => {
      const state = get();
      const existing = state.data[ticker];

      const wantsKey = `${interval}:${range}`;
      const currentKey = `${state.selectedRange.interval}:${state.selectedRange.range}`;

      const candlesFresh =
        !!existing?.candles &&
        isFresh(existing.meta.candles) &&
        wantsKey === currentKey;
      const quoteFresh = !!existing?.quote && isFresh(existing.meta.quote);

      if (!opts?.force && candlesFresh && quoteFresh) {
        set({ currentTicker: ticker, selectedRange: { interval, range } });
        return;
      }

      set((prev) => {
        const prevTicker = prev.data[ticker] ?? createEmptyTicker();
        return {
          currentTicker: ticker,
          selectedRange: { interval, range },
          data: {
            ...prev.data,
            [ticker]: {
              ...prevTicker,
              status: {
                ...prevTicker.status,
                candlesLoading: !candlesFresh,
                quoteLoading: !quoteFresh,
              },
            },
          },
        };
      });

      const candlePromise: Promise<Candle[] | null> = candlesFresh
        ? Promise.resolve(existing?.candles ?? null)
        : fetchHistoricalData(ticker, { range, interval, signal: opts?.signal })
            .then((data) => toCandles(data) ?? existing?.candles ?? null)
            .catch((error) => {
              console.warn('fetchTickerData.candles error', error);
              return existing?.candles ?? null;
            });

      const quotePromise: Promise<Quote | null> = quoteFresh
        ? Promise.resolve(existing?.quote ?? null)
        : fetchQuote(ticker, { signal: opts?.signal })
            .then((data) => toQuote(data) ?? existing?.quote ?? null)
            .catch((error) => {
              console.warn('fetchTickerData.quote error', error);
              return existing?.quote ?? null;
            });

      const [candles, quote] = await Promise.all([candlePromise, quotePromise]);

      const ts = Date.now();

      set((prev) => {
        const prevTicker = prev.data[ticker] ?? createEmptyTicker();
        const nextTicker: TickerData = {
          ...prevTicker,
          candles: candles ?? prevTicker.candles,
          quote: quote ?? prevTicker.quote,
          status: {
            ...prevTicker.status,
            candlesLoading: false,
            quoteLoading: false,
          },
          meta: {
            ...prevTicker.meta,
            candles: candles
              ? { fetchedAt: ts, staleAfter: FIVE_MIN_MS, source: 'chart' }
              : prevTicker.meta.candles,
            quote: quote
              ? { fetchedAt: ts, staleAfter: FIFTEEN_SEC_MS, source: 'chart' }
              : prevTicker.meta.quote,
          },
        };
        return {
          data: {
            ...prev.data,
            [ticker]: nextTicker,
          },
        };
      });
    },

    prefetchOptions: async (ticker) => {
      const existing = get().data[ticker];
      if (existing?.options && isFresh(existing.meta.options)) return;

      set((prev) => {
        const prevTicker = prev.data[ticker] ?? createEmptyTicker();
        return {
          data: {
            ...prev.data,
            [ticker]: {
              ...prevTicker,
              status: {
                ...prevTicker.status,
                optionsLoading: true,
              },
            },
          },
        };
      });

      try {
        const res = await api(`/api/options-chain?ticker=${encodeURIComponent(ticker)}`);
        const payload: ApiPayload = await jsonOrText(res);

        if (!payload.ok) {
          throw new Error(payload.error || 'options-chain failed');
        }

        const candidate = (payload.data ?? payload.options ?? payload.results ?? payload) as OptionChain;
        const options: OptionChain = candidate;
        const ts = Date.now();

        set((prev) => {
          const prevTicker = prev.data[ticker] ?? createEmptyTicker();
          return {
            data: {
              ...prev.data,
              [ticker]: {
                ...prevTicker,
                options,
                status: {
                  ...prevTicker.status,
                  optionsLoading: false,
                },
                meta: {
                  ...prevTicker.meta,
                  options: { fetchedAt: ts, staleAfter: ONE_HOUR_MS, source: 'prefetch' },
                },
              },
            },
          };
        });
      } catch (error) {
        console.warn('prefetchOptions error', error);
        set((prev) => {
          const prevTicker = prev.data[ticker] ?? createEmptyTicker();
          return {
            data: {
              ...prev.data,
              [ticker]: {
                ...prevTicker,
                status: {
                  ...prevTicker.status,
                  optionsLoading: false,
                },
              },
            },
          };
        });
      }
    },

    backfillHistorical: async (ticker) => {
      const existing = get().data[ticker];

      try {
        const candles = await fetchHistoricalData(ticker, { range: 'max', interval: '1d' });
        const ts = Date.now();

        set((prev) => {
          const prevTicker = prev.data[ticker] ?? createEmptyTicker();
          const nextCandles = toCandles(candles) ?? prevTicker.candles;
          const nextTicker: TickerData = {
            ...prevTicker,
            candles: nextCandles,
            meta: {
              ...prevTicker.meta,
              candles: nextCandles
                ? { fetchedAt: ts, staleAfter: ONE_DAY_MS, source: 'ml' }
                : prevTicker.meta.candles,
            },
          };
          return {
            data: {
              ...prev.data,
              [ticker]: nextTicker,
            },
          };
        });
      } catch (error) {
        console.warn('backfillHistorical error', error);
        // preserve existing candles/meta on failure
        if (!existing) return;
      }
    },

    setQuote: (ticker, quote) => {
      const ts = Date.now();
      set((prev) => {
        const prevTicker = prev.data[ticker] ?? createEmptyTicker();
        return {
          data: {
            ...prev.data,
            [ticker]: {
              ...prevTicker,
              quote,
              meta: {
                ...prevTicker.meta,
                quote: { fetchedAt: ts, staleAfter: TEN_SEC_MS, source: 'prefetch' },
              },
            },
          },
        };
      });
    },

    clearTicker: (ticker) => {
      set((prev) => {
        const next = { ...prev.data };
        delete next[ticker];
        return { data: next };
      });
    },
  })),
);
