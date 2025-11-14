# Setup Guide

This guide will help you set up the Stock Whisperer application on your local machine.

## Prerequisites

- **Node.js**: Version 18.x or higher
- **npm**: Comes with Node.js (version 9.x or higher recommended)
- **Git**: For cloning the repository

## Understanding the Project Structure

This is a **multi-package project** with two main components:
- **Root package** (`/`): Backend scripts and utilities for Supabase Edge Functions
- **Frontend package** (`/frontend`): React + Vite application

Both packages need to be installed separately.

## Package Manager

⚠️ **Important**: This project uses **npm** as the package manager.

You may notice both `package-lock.json` and `yarn.lock` files in the root directory. This can happen when different contributors use different package managers. To avoid conflicts:

- **Use npm only**: `npm install`
- **Do not use yarn**: Avoid running `yarn` or `yarn install`

If you accidentally run `yarn`, you may need to delete `node_modules` and reinstall with npm.

## Installation Steps

### Step 1: Clone the Repository

```bash
git clone https://github.com/PapaPablano/bolt_ai.git
cd bolt_ai
```

### Step 2: Install All Dependencies

The easiest way to install all dependencies for both the root and frontend packages:

```bash
npm run install:all
```

This command will:
1. Install root package dependencies (`npm install` in root)
2. Install frontend dependencies (`npm install` in frontend)

**Alternative: Manual Installation**

If you prefer to install dependencies manually or if `npm run install:all` fails:

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### Step 3: Set Up Environment Variables

The application requires environment variables to connect to Supabase and external APIs.

#### Root Environment Variables

Copy the example file:

```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials:

```env
# Supabase Configuration (Required)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Alpaca API Configuration (Optional - for backend/Edge Functions)
ALPACA_KEY_ID=your-alpaca-key-id
ALPACA_SECRET_KEY=your-alpaca-secret-key
ALPACA_STOCK_FEED=iex
```

#### Frontend Environment Variables

Copy the frontend example file:

```bash
cp frontend/.env.local.example frontend/.env.local
```

Edit `frontend/.env.local` and fill in your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Where to get these credentials:**
- **Supabase URL and Anon Key**: Available in your [Supabase Dashboard](https://app.supabase.com) → Project Settings → API
- **Alpaca Keys**: Sign up at [Alpaca](https://alpaca.markets/) and get your API keys from the dashboard

### Step 4: Run the Development Server

```bash
npm run dev
```

This will start the frontend development server. Visit `http://localhost:5173` to see the app!

## Troubleshooting

### Dependencies Not Installing Completely

If you encounter issues with dependencies not installing completely:

#### 1. Check for Multiple Package Managers

**Problem**: Both `package-lock.json` and `yarn.lock` exist, causing conflicts.

**Solution**: Use **npm only**. If you've used yarn by mistake:

```bash
# Remove all node_modules
rm -rf node_modules frontend/node_modules

# Reinstall with npm
npm run install:all
```

#### 2. Check Your Node.js Version

**Problem**: Incompatible Node.js version.

**Solution**: Verify you're using Node.js 18.x or higher:

```bash
node --version
```

If your version is too old, update Node.js from [nodejs.org](https://nodejs.org/).

#### 3. Clear npm Cache

**Problem**: Corrupted npm cache.

**Solution**:

```bash
npm cache clean --force
rm -rf node_modules frontend/node_modules
npm run install:all
```

#### 4. Network Issues

**Problem**: Slow or failing package downloads.

**Solution**:

```bash
# Use a different npm registry
npm config set registry https://registry.npmjs.org/
npm run install:all
```

#### 5. Permission Issues

**Problem**: Permission errors during installation.

**Solution** (Linux/Mac):

```bash
# Don't use sudo! Instead, fix npm permissions:
# https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally
```

### Development Server Won't Start

#### Missing Environment Variables

**Problem**: `npm run dev` fails with missing environment errors.

**Solution**: Ensure you've created and filled in:
- `frontend/.env.local` with your Supabase credentials
- Verify the file exists: `ls -la frontend/.env.local`

#### Port Already in Use

**Problem**: Port 5173 is already in use.

**Solution**:

```bash
# Find and kill the process using port 5173
lsof -ti:5173 | xargs kill -9

# Or run on a different port
cd frontend
vite --port 3000
```

#### Build Errors

**Problem**: TypeScript or build errors when starting dev server.

**Solution**:

```bash
# Try building first to see detailed errors
cd frontend
npm run build

# Fix any errors shown, then try dev server again
npm run dev
```

### Still Having Issues?

1. **Check the package.json scripts**: Review `package.json` to understand what each script does
2. **Look for setup instructions**: Check `README.md`, `BOLT_DEPLOYMENT.md`, and other documentation files
3. **Verify all dependencies installed**: Run `npm list` in both root and frontend to check for missing packages
4. **Check for workspace/monorepo structure**: This project has two separate packages, both need installation
5. **Review error messages carefully**: They often indicate what's missing or misconfigured

## Available Scripts

### Root Package Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Starts the frontend development server |
| `npm run build` | Builds the frontend for production |
| `npm run preview` | Previews the production build |
| `npm run lint` | Lints both frontend and root TypeScript code |
| `npm run install:all` | Installs all dependencies (root + frontend) |
| `npm run smoke` | Runs smoke tests for Supabase Edge Functions |
| `npm run invoke` | Manually invokes a Supabase Edge Function |

### Frontend Package Scripts

```bash
cd frontend
npm run dev       # Start development server
npm run build     # Build for production
npm run preview   # Preview production build
npm run lint      # Lint frontend code
```

## Next Steps

After successful setup:

1. **Explore the application** at `http://localhost:5173`
2. **Read the documentation**:
   - `BOLT_DEPLOYMENT.md` - Deployment instructions
   - `docs/` - Architecture and API references
3. **Test the Edge Functions**: `npm run smoke`
4. **Start developing**: Make changes and see them live reload!

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)
- [Alpaca API Documentation](https://alpaca.markets/docs/)
