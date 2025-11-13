# Alpaca API Capabilities

This document provides a summary of the Alpaca API's capabilities, based on the official documentation.

## 1. Market Data

Alpaca provides access to real-time and historical market data for stocks, options, and crypto.

### 1.1. Historical Market Data (REST API)

**Project Implementation:**
- **Supabase Edge Function**: `supabase/functions/stock-historical/index.ts`
- **Frontend Hook**: `src/hooks/useStockHistorical.ts`

The Historical API is a RESTful service that provides historical market data for:

-   **Stocks**: Tick, trade, bar, and quote data.
-   **Crypto**: Tick, trade, bar, and quote data.
-   **Options**: Tick, trade, bar, and quote data.
-   **News**: Historical news articles.

**Base URL**: `https://data.alpaca.markets/{version}`

### 1.2. Real-Time Market Data (WebSocket)

**Project Implementation:**
- **Supabase Edge Function**: `supabase/functions/stock-stream/index.ts`
- **Frontend Hook**: `src/hooks/useStockStream.ts`
- **UI Component**: `src/components/EnhancedDashboard.tsx`

The WebSocket stream provides real-time updates for:

-   **Stocks**: Trades, quotes, bars, daily bars, statuses, and LULDs.
-   **Crypto**: Trades, quotes, bars, daily bars, and order books.
-   **Options**: Trades and quotes.
-   **News**: Real-time news articles.

**WebSocket URL**: `wss://stream.data.alpaca.markets/{version}/{feed}`

-   A test stream is available at `wss://stream.data.alpaca.markets/v2/test` using the symbol "FAKEPACA".
-   Authentication is required via API keys.
-   Subscription messages are used to specify the desired data channels and symbols.

## 2. Real-Time Data Streaming Implementation Guide

This section outlines the steps required to implement real-time data streaming for stocks, crypto, options, and news using Alpaca's WebSocket API. The current project already has a foundation for stock streaming in `supabase/functions/stock-stream`, which can be extended.

### 2.1. Real-Time Stocks (Trades, Quotes, Bars)

This is partially implemented and can be extended.

*   **Backend (Supabase Edge Function)**:
    *   **File**: `supabase/functions/stock-stream/index.ts` (existing)
    *   **Action**: Modify the function to handle different subscription types (trades, quotes, bars) based on client requests.
    *   **WebSocket URL**: `wss://stream.data.alpaca.markets/v2/sip` (for paid plans) or `wss://stream.data.alpaca.markets/v2/iex` (for free plans).
    *   **Example Subscription**:
        ```json
        {
          "action": "subscribe",
          "trades": ["AAPL"],
          "quotes": ["MSFT"],
          "bars": ["GOOG"]
        }
        ```

*   **Frontend (React)**:
    *   **Hook**: `src/hooks/useStockStream.ts` (existing).
    *   **Action**: Enhance the hook to manage different event types (trades, quotes, bars) and update the UI accordingly.
    *   **UI**: Components like `src/components/EnhancedPriceChart.tsx` can be updated to show live price ticks.

### 2.2. Real-Time Crypto

*   **Backend (Supabase Edge Function)**:
    *   **File**: Create a new function, e.g., `supabase/functions/crypto-stream/index.ts`.
    *   **Action**: This function will connect to Alpaca's crypto WebSocket and proxy data.
    *   **WebSocket URL**: `wss://stream.data.alpaca.markets/v1beta3/crypto/us`
    *   **Example Subscription**:
        ```json
        {
          "action": "subscribe",
          "trades": ["BTC/USD"],
          "quotes": ["ETH/USD"],
          "orderbooks": ["LTC/USD"]
        }
        ```

*   **Frontend (React)**:
    *   **Hook**: Create `src/hooks/useCryptoStream.ts`.
    *   **Action**: This hook will connect to the `crypto-stream` Edge Function and provide real-time data to the UI.
    *   **UI**: Create a new component, e.g., `src/components/CryptoChart.tsx`, to display the live data.

### 2.3. Real-Time Options

*   **Backend (Supabase Edge Function)**:
    *   **File**: Create a new function, e.g., `supabase/functions/options-stream/index.ts`.
    *   **Action**: Connect to the options WebSocket. Note that this stream uses `msgpack` format.
    *   **WebSocket URL**: `wss://stream.data.alpaca.markets/v1beta1/options`
    *   **Example Subscription**:
        ```json
        {
          "action": "subscribe",
          "trades": ["AAPL240119C00100000"],
          "quotes": ["SPY240119P00400000"]
        }
        ```

*   **Frontend (React)**:
    *   **Hook**: Create `src/hooks/useOptionsStream.ts`.
    *   **Action**: Connect to the `options-stream` function and parse the incoming data.
    *   **UI**: Create components to display options chains and live pricing, e.g., `src/components/OptionsChain.tsx`.

### 2.4. Real-Time News

*   **Backend (Supabase Edge Function)**:
    *   **File**: Create a new function, e.g., `supabase/functions/news-stream/index.ts`.
    *   **Action**: Connect to the news WebSocket.
    *   **WebSocket URL**: `wss://stream.data.alpaca.markets/v1beta1/news`
    *   **Example Subscription**:
        ```json
        {
          "action": "subscribe",
          "news": ["*"]
        }
        ```

*   **Frontend (React)**:
    *   **Hook**: Create `src/hooks/useNewsStream.ts`.
    *   **Action**: Connect to the `news-stream` function.
    *   **UI**: The existing `src/components/NewsWidget.tsx` could be updated to display news articles as they arrive in real-time.

## 3. Account Management

**Project Implementation:**
- **Database Tables**: `watchlists`, `portfolios`, `price_alerts` in Supabase.
- **Frontend Hooks**: `src/hooks/useWatchlists.ts`, `src/hooks/usePortfolio.ts`, `src/hooks/usePriceAlerts.ts`

The Alpaca API provides endpoints for managing your account:

-   **Account Information**: Retrieve account details, balances, and positions.
-   **Account Activities**: Track trade and non-trade activities.
-   **Watchlists**: Create and manage watchlists of symbols.

## 4. Authentication

**Project Implementation:**
- **Credential Storage**: Alpaca API keys are stored as secrets in Supabase using the `supabase secrets set` command.
- **Server-Side Retrieval**: Edge Functions retrieve these keys from environment variables. See `supabase/functions/_shared/alpaca/client.ts`.
- **Client-Side Access**: The frontend calls Supabase functions using the public `anon` key, ensuring the Alpaca secret keys are never exposed on the client.

The authentication flow is designed to be secure by keeping all secret credentials on the server side.

1.  **Store Alpaca Keys as Supabase Secrets**:
    ```bash
    supabase secrets set ALPACA_KEY_ID="PKW7MRBG7GL4PINWOSIWCAUB5T"
    supabase secrets set ALPACA_SECRET_KEY="CCcV4kQsJSXeUPbbJ21ic6e8bs1SA6RkcGzbeHisyxj9"
    ```

    **Note:** Edge Functions use `ALPACA_KEY_ID` and `ALPACA_SECRET_KEY` (not `APCA_API_KEY_ID`). The HTTP headers still use `APCA-API-KEY-ID` and `APCA-API-SECRET-KEY`.

2.  **Server-Side Functions Retrieve Keys**: Edge Functions read these secrets from environment variables:

    ```typescript
    // Edge Functions use ALPACA_KEY_ID and ALPACA_SECRET_KEY
    const keyId = Deno.env.get('ALPACA_KEY_ID')
    const secretKey = Deno.env.get('ALPACA_SECRET_KEY')
    
    // Then use them in HTTP headers with APCA-API-KEY-ID format
    headers: {
      'APCA-API-KEY-ID': keyId,
      'APCA-API-SECRET-KEY': secretKey,
    }
      // ... error handling ...
      return { keyId, secretKey, paper: keyId.startsWith('P') }
    }
    ```

3.  **Frontend Securely Calls Functions**: The React application uses the public Supabase `anon` key to invoke Edge Functions. The functions then use the securely stored Alpaca keys to make authenticated requests to the Alpaca API.

-   API keys (Key ID and Secret Key) are used for authentication.
-   OAuth is available for third-party applications.

## 5. SDKs

Alpaca provides official SDKs for:

-   Python
-   JavaScript
-   C#
-   Go

This summary covers the main features of the Alpaca API. For more detailed information, please refer to the official [Alpaca API Documentation](https://docs.alpaca.markets/).
