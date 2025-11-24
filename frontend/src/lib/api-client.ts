import { supabase } from './supabase';

class SchwabClient {
  private async call<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
    const { data, error } = await supabase.functions.invoke('schwab-proxy', {
      body: { action, params },
    });
    if (error) throw error;
    return data as T;
  }

  getQuote(symbols: string[] | string) {
    const arr = Array.isArray(symbols) ? symbols : [symbols];
    return this.call<unknown>('get_quote', { symbols: arr });
  }

  getPriceHistory(
    symbol: string,
    options: {
      periodType?: string;
      period?: string;
      frequencyType?: string;
      frequency?: string;
    } = {},
  ) {
    return this.call<unknown>('get_price_history', { symbol, ...options });
  }

  getMarketHours(markets?: string, date?: string) {
    return this.call<unknown>('get_market_hours', { markets, date });
  }
}

class AlpacaClient {
  private async call<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
    const { data, error } = await supabase.functions.invoke('alpaca-proxy', {
      body: { action, params },
    });
    if (error) throw error;
    return data as T;
  }

  getBars(
    symbol: string,
    options: {
      timeframe?: string;
      start?: string;
      end?: string;
      limit?: number;
    } = {},
  ) {
    return this.call<unknown>('get_bars', { symbol, ...options });
  }

  getLatestQuote(symbol: string) {
    return this.call<unknown>('get_latest_quote', { symbol });
  }

  getLatestTrade(symbol: string) {
    return this.call<unknown>('get_latest_trade', { symbol });
  }

  getSnapshot(symbols: string[] | string) {
    const arr = Array.isArray(symbols) ? symbols : [symbols];
    return this.call<unknown>('get_snapshot', { symbols: arr });
  }
}

class NewsClient {
  private async call<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
    const { data, error } = await supabase.functions.invoke('news-proxy', {
      body: { action, params },
    });
    if (error) throw error;
    return data as T;
  }

  getEconomicCalendar(options: { date?: string; currency?: string; impact?: string } = {}) {
    return this.call<unknown>('get_economic_calendar', options);
  }

  getTodayEvents() {
    return this.call<unknown>('get_today_events');
  }

  getHighImpactEvents(startDate?: string) {
    return this.call<unknown>('get_high_impact_events', { startDate });
  }
}

export const api = {
  schwab: new SchwabClient(),
  alpaca: new AlpacaClient(),
  news: new NewsClient(),
};
