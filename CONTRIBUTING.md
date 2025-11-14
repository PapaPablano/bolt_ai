# Contributing to Stock Whisperer

Thank you for your interest in contributing to Stock Whisperer! This document provides guidelines and information for contributors.

## Getting Started

1. **Fork the repository** and clone your fork
2. **Follow the setup instructions** in [SETUP.md](./SETUP.md)
3. **Create a feature branch** from `main`
4. **Make your changes** with clear commit messages
5. **Test your changes** thoroughly
6. **Submit a pull request** with a clear description

## Development Setup

### Package Manager

⚠️ **Important**: This project uses **npm** as the standard package manager.

You may notice both `package-lock.json` and `yarn.lock` files in the repository. This can happen when different contributors use different package managers. To maintain consistency:

- **Always use npm**: `npm install`, `npm run dev`, etc.
- **Never commit yarn.lock changes**: If you accidentally run `yarn`, revert any changes to `yarn.lock`
- **Keep package-lock.json updated**: Commit changes to `package-lock.json` when adding/updating dependencies

If you need to remove the yarn.lock file confusion:

```bash
# Remove node_modules and reinstall with npm
rm -rf node_modules frontend/node_modules
npm run install:all
```

### Project Structure

This is a **multi-package monorepo** with two main components:

- **Root package** (`/`): Backend scripts, utilities, and Supabase Edge Functions testing
  - `package.json` - Root dependencies
  - `scripts/` - Testing and utility scripts
  - `supabase/` - Edge Functions
  
- **Frontend package** (`/frontend`): React + Vite application
  - `package.json` - Frontend dependencies
  - `src/` - React components and application code

Both packages must be installed separately. Use `npm run install:all` to install both.

## Making Changes

### Adding Dependencies

When adding new dependencies:

```bash
# For root package dependencies
npm install <package-name>

# For frontend dependencies
cd frontend
npm install <package-name>
```

Always commit the updated `package-lock.json` files.

### Code Style

- **Linting**: Run `npm run lint` before committing
- **TypeScript**: Ensure type safety with `tsc --noEmit`
- **Formatting**: Follow the existing code style

### Environment Variables

- **Never commit** `.env` or `.env.local` files
- **Update example files** when adding new required variables
- **Document** all new environment variables in SETUP.md

## Testing

### Running Tests

```bash
# Run linting
npm run lint

# Test Supabase Edge Functions
npm run smoke

# Test specific function
npm run invoke stock-quote '{"symbol":"AAPL"}'
```

### Before Submitting

Ensure your changes:
- [ ] Pass all linting checks (`npm run lint`)
- [ ] Build successfully (`npm run build`)
- [ ] Work with the dev server (`npm run dev`)
- [ ] Don't break existing functionality
- [ ] Include appropriate documentation updates

## Pull Request Guidelines

### Title Format

Use clear, descriptive titles:
- `feat: Add stock watchlist feature`
- `fix: Resolve chart rendering issue`
- `docs: Update setup instructions`
- `refactor: Improve API client structure`

### Description

Include in your PR description:
- **What**: What changes did you make?
- **Why**: Why were these changes needed?
- **How**: How do the changes work?
- **Testing**: How did you test the changes?
- **Screenshots**: If UI changes, include screenshots

### Review Process

- Be responsive to feedback
- Make requested changes promptly
- Keep discussions professional and constructive
- Be patient - reviews take time

## Common Issues

### Dependencies Not Installing

**Problem**: `npm install` fails or installs incomplete dependencies.

**Solutions**:
1. Use `npm run install:all` instead
2. Clear cache: `npm cache clean --force`
3. Delete `node_modules` and reinstall
4. Check Node.js version (18.x+ required)

See [SETUP.md](./SETUP.md) for more troubleshooting.

### Dev Server Won't Start

**Problem**: `npm run dev` fails.

**Solutions**:
1. Ensure environment variables are set in `frontend/.env.local`
2. Verify all dependencies installed: `npm list`
3. Check port 5173 is not in use
4. Try building first: `cd frontend && npm run build`

## Project Architecture

### Frontend (React + Vite)

- **Components**: Reusable UI components in `frontend/src/components/`
- **Pages**: Route components
- **API**: API integrations in `frontend/src/lib/`
- **State**: Zustand for state management
- **Styling**: Tailwind CSS + shadcn/ui components

### Backend (Supabase Edge Functions)

- **Functions**: Deno-based serverless functions in `supabase/functions/`
- **APIs**: Integration with Alpaca, Schwab, and other financial data providers
- **Database**: PostgreSQL via Supabase

### Scripts

- **TypeScript**: Testing and utility scripts in `scripts/`
- **Schwab API**: Client library in `project/src/schwab-api/`

## Resources

- [SETUP.md](./SETUP.md) - Detailed setup instructions
- [BOLT_DEPLOYMENT.md](./BOLT_DEPLOYMENT.md) - Deployment guide
- [README.md](./README.md) - Project overview
- Documentation in `docs/` directory

## Questions?

If you have questions:
1. Check existing documentation (SETUP.md, README.md, docs/)
2. Search existing issues on GitHub
3. Open a new issue with the question label

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Follow GitHub's Community Guidelines

Thank you for contributing to Stock Whisperer! 🚀
