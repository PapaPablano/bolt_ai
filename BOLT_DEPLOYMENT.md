# Deploying Stock Whisperer on Bolt.new

This guide explains how to run the Stock Whisperer application on Bolt.new.

## Overview

Stock Whisperer is a full-stack trading application with:
- **Frontend**: React + Vite + TypeScript with real-time charts and trading tools
- **Backend**: Supabase Edge Functions (Deno) for market data APIs
- **Data Source**: Alpaca Markets API for real-time stock quotes and historical data

## Prerequisites

1. **Supabase Project**: Create a free account at [supabase.com](https://supabase.com)
2. **Alpaca Account**: Sign up at [alpaca.markets](https://alpaca.markets) for free market data

## Quick Start on Bolt.new

### Step 1: Environment Setup

1. Copy `.env.example` to create your environment file:
   ```bash
   cp .env.example .env.local
   cp .env.example frontend/.env.local
   ```

2. Get your Supabase credentials:
   - Go to [Supabase Dashboard](https://app.supabase.com)
   - Select your project
   - Go to **Settings > API**
   - Copy the **Project URL** and **anon/public** key

3. Update both `.env.local` and `frontend/.env.local`:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

### Step 2: Database Setup

1. Go to your Supabase Dashboard > **SQL Editor**
2. Run the migration file at `supabase/migrations/20250109_create_schema.sql`
3. This creates all necessary tables (watchlists, portfolios, stock_cache, etc.)

### Step 3: Configure Supabase Secrets

Set your Alpaca API credentials as Supabase secrets:

**Via Supabase Dashboard:**
1. Go to **Project Settings > Edge Functions > Manage Secrets**
2. Add these secrets:
   - `ALPACA_KEY_ID`: Your Alpaca API Key ID
   - `ALPACA_SECRET_KEY`: Your Alpaca Secret Key
   - `ALPACA_STOCK_FEED`: Set to `iex` (or `sip` for paid plans)

**Via Supabase CLI:**
```bash
supabase secrets set ALPACA_KEY_ID="your-key-id"
supabase secrets set ALPACA_SECRET_KEY="your-secret-key"
supabase secrets set ALPACA_STOCK_FEED="iex"
```

### Step 4: Deploy Edge Functions

Deploy the backend functions to Supabase:

```bash
# Install Supabase CLI if needed
npm install -g supabase

# Login to Supabase
supabase login

# Deploy all functions
supabase functions deploy stock-quote --project-ref your-project-ref
supabase functions deploy stock-historical-v3 --project-ref your-project-ref
supabase functions deploy stock-news --project-ref your-project-ref
supabase functions deploy ml-signals --project-ref your-project-ref
supabase functions deploy schwab-quote --project-ref your-project-ref
supabase functions deploy schwab-historical --project-ref your-project-ref
```

Or deploy all at once:
```bash
cd supabase/functions
for func in */; do
  supabase functions deploy ${func%/} --project-ref your-project-ref
done
```

### Step 5: Install Dependencies & Run

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..

# Or use the convenience script
npm run install:all

# Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`

## Running on Bolt.new

When running on Bolt.new:

1. **Ensure environment variables are set** in the Bolt.new environment settings
2. **Use the dev script**: `npm run dev`
3. **The app should auto-start** and be accessible via the Bolt.new preview

### Environment Variables for Bolt.new

Make sure these are set in your Bolt.new project settings:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## Features

- **Real-time Stock Quotes**: Live price updates from Alpaca Markets
- **Interactive Charts**: TradingView-style candlestick charts with drawing tools
- **Pattern Detection**: Automatic detection of chart patterns
- **Watchlists**: Create and manage multiple watchlists
- **Stock Comparison**: Compare multiple stocks side-by-side
- **News Feed**: Latest stock-related news
- **Technical Indicators**: SMA, EMA, RSI, and more

## Architecture

```
Frontend (Vite/React)
    ↓ HTTP Requests
Supabase Edge Functions (Deno)
    ↓ API Calls
Alpaca Markets API
    ↓ Market Data
PostgreSQL (Supabase)
```

## API Endpoints

The following Supabase Edge Functions are available:

- `stock-quote`: Get real-time stock quotes
- `stock-historical-v3`: Get historical OHLCV data
- `stock-news`: Get latest stock news
- `ml-signals`: Get ML-based trading signals
- `schwab-quote`: Schwab API quotes (if configured)
- `schwab-historical`: Schwab historical data

## Troubleshooting

### "Missing Supabase environment variables"

Make sure both `.env.local` and `frontend/.env.local` exist with correct values:
```bash
cp .env.example .env.local
cp .env.example frontend/.env.local
# Then edit both files with your credentials
```

### "Failed to fetch stock quote"

1. Verify Alpaca credentials are set in Supabase secrets
2. Check Edge Functions are deployed: `supabase functions list`
3. View function logs: `supabase functions logs stock-quote`

### Build Errors

If you see build errors:
```bash
# Clean install
rm -rf node_modules frontend/node_modules
rm -rf frontend/dist
npm install
cd frontend && npm install && cd ..
npm run build
```

### CORS Issues

Ensure your Edge Functions have proper CORS headers (already configured in the code).

## Development Workflow

```bash
# Run frontend dev server
npm run dev

# Test Edge Functions locally
npm run smoke  # Runs smoke tests
npm run invoke stock-quote '{"symbol":"AAPL"}'  # Test specific function

# Lint code
npm run lint

# Build for production
npm run build
```

## Production Deployment

For production deployment:

1. Build the frontend: `npm run build`
2. Deploy to your hosting platform (Vercel, Netlify, etc.)
3. Ensure all environment variables are set in your hosting platform
4. Edge Functions are automatically served by Supabase

## Support

For issues specific to:
- **Bolt.new**: Check [support.bolt.new](https://support.bolt.new/)
- **Supabase**: See [supabase.com/docs](https://supabase.com/docs)
- **Alpaca API**: Visit [alpaca.markets/docs](https://alpaca.markets/docs/api-references/)

## License

Private - Stock Whisperer AI
