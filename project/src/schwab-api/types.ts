export interface SchwabConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope?: string;
}

export interface OAuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
  tokenType: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export interface SchwabRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  baseUrl?: string;
}

export interface Quote {
  symbol: string;
  bidPrice: number;
  askPrice: number;
  lastPrice: number;
  volume: number;
  timestamp: number;
}

export interface FutureQuote {
  symbol: string;
  bidPrice: number;
  askPrice: number;
  lastPrice: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  openInterest: number;
}

export interface OptionChain {
  underlyingSymbol: string;
  optionSymbol: string;
  strikePrice: number;
  expirationDate: string;
  contractType: 'C' | 'P';
  bidPrice: number;
  askPrice: number;
  lastPrice: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  greeks: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    rho: number;
  };
}

export type PeriodType = 'day' | 'month' | 'year' | 'ytd';
export type FrequencyType = 'minute' | 'daily' | 'weekly' | 'monthly';

export interface PriceHistoryParams {
  periodType?: PeriodType;
  period?: number;
  frequencyType?: FrequencyType;
  frequency?: number;
  startDate?: number;
  endDate?: number;
  needExtendedHoursData?: boolean;
}

export interface Candle {
  datetime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  symbol?: string;
}

export type MoversSort = 'VOLUME' | 'TRADES' | 'PERCENT_CHANGE_UP' | 'PERCENT_CHANGE_DOWN';

export interface MoversParams {
  sort?: MoversSort;
  frequency?: 0 | 1 | 5 | 10 | 30 | 60;
}

export interface Mover {
  symbol: string;
  description: string;
  last: number;
  netChange: number;
  percentChange: number;
  totalVolume: number;
  direction: 'up' | 'down';
}

export interface OptionChainParams {
  strikeCount?: number;
  includeQuotes?: boolean;
  strategy?: string;
  interval?: number;
  strike?: number;
  contractType?: 'CALL' | 'PUT' | 'ALL';
  expMonth?: string;
  optionType?: 'STANDARD' | 'NON_STANDARD' | 'ALL';
}

export interface StreamerCredentials {
  schwabClientCustomerId: string;
  schwabClientCorrelId: string;
  schwabClientChannel: string;
  schwabClientFunctionId: string;
  streamerUrl: string;
  accessToken: string;
}

export type StreamerService =
  | 'ADMIN'
  | 'LEVELONE_EQUITIES'
  | 'LEVELONE_OPTIONS'
  | 'LEVELONE_FUTURES'
  | 'LEVELONE_FUTURES_OPTIONS'
  | 'LEVELONE_FOREX'
  | 'CHART_EQUITY'
  | 'CHART_FUTURES'
  | 'NYSE_BOOK'
  | 'NASDAQ_BOOK'
  | 'OPTIONS_BOOK'
  | 'ACCT_ACTIVITY';

export interface StreamerRequest {
  requestid: string;
  service: StreamerService;
  command: 'LOGIN' | 'SUBS' | 'ADD' | 'UNSUBS' | 'VIEW' | 'LOGOUT';
  SchwabClientCustomerId: string;
  SchwabClientCorrelId: string;
  parameters: Record<string, string>;
}

export interface StreamerEnvelope {
  requests: StreamerRequest[];
}

export interface StreamMessage<T = unknown> {
  notify?: Array<Record<string, T>>;
  snapshot?: Array<Record<string, T>>;
  response?: Array<Record<string, T>>;
  data?: Array<Record<string, T>>;
}
