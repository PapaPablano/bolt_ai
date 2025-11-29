import { useEffect } from 'react';
import { useTickerDataStore } from '@/store/tickerDataStore';

export const useHookQuote = (ticker: string) => {
  const { fetchTickerData, data } = useTickerDataStore();

  useEffect(() => {
    if (ticker) {
      // interval/range required for fetch, but only quote used here
      fetchTickerData(ticker, '1d', '1y');
    }
  }, [ticker, fetchTickerData]);

  const quote = data[ticker]?.quote;
  const loading = data[ticker]?.status.quoteLoading;
  const meta = data[ticker]?.meta.quote;

  return { quote, loading, meta };
};
