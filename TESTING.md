# Testing Guide

This file provides a high-level overview of how to **run** and **write** tests
for this repository. For detailed, feature-level notes, see
`docs/TESTING_GUIDE.md`.

## Test Types

- **Frontend unit tests**: React components and utilities (Vitest)
- **Frontend E2E tests**: UI flows and charts (Playwright)
- **Supabase Edge Function smoke tests**: Quick verification of key functions
- **Python tests**: (planned/partial) for backend services under `backend/`

## Running Tests Locally

From the repository root:

```bash
# Install all JS dependencies (root + frontend workspace)
npm run install:all

# Lint + Type-check (recommended before PRs)
npm run lint

# Frontend unit tests (Vitest)
cd frontend
npm run test

# Frontend E2E tests (Playwright)
npm run e2e:ci

# Supabase Edge Function smoke tests
cd ..
npm run smoke

# Invoke a specific Edge Function locally
npm run invoke stock-quote '{"symbol":"AAPL"}'
```

Python tests (for `backend/`) will live under `tests/` and are run via `pytest`:

```bash
# Example: run Python tests
python -m pip install -r backend/api/requirements.txt
pytest tests/
```

## Writing Tests

### Frontend (Vitest + React Testing Library)

- Prefer testing **behavior and user-facing output** over internal implementation details.
- Use React Testing Library patterns (`render`, `screen`, `userEvent`) where possible.
- Colocate tests with components (e.g. `ComponentName.test.tsx`) or under `frontend/src/__tests__/`.

### Frontend E2E (Playwright)

- Use Playwright tests under `frontend/tests/` for end-to-end workflows:
  - Key dashboard flows
  - Chart interactions and performance probes
  - Login/auth and critical user journeys
- Keep tests deterministic via seeded/mock data when possible.

### Supabase Edge Functions

- Cover critical paths via `npm run smoke` and function-specific invokes.
- Add targeted integration tests for complex logic or external API interactions.

### Python Backend

- Use `pytest` with clear unit tests for data transformations and service logic.
- Prefer **pure functions** where possible, so they are easy to test.

For deeper guidance and concrete examples, see `docs/TESTING_GUIDE.md`.
