---
trigger: model_decision
description: Financial ML Platform Rules
---

# Financial ML Platform Rules

## Tech Stack
<stack>
Python 3.11+, Streamlit, TimescaleDB, XGBoost, TypeScript
</stack>

## Domain Standards
<domain>
- All timestamps UTC with explicit timezone handling
- Financial calculations use Decimal, never float
- Market data validates against known ranges (prices > 0)
- ML predictions include confidence intervals
- Database: prepared statements only (SQL injection prevention)
</domain>

## Performance Budgets
<performance>
- API response time: <100ms
- Dashboard load time: <2s
- Real-time data pipeline latency: <500ms
</performance>

## Code Style
<style>
- Python: Black formatter, strict MyPy, docstrings for public functions
- TypeScript: ESLint strict, no `any` types
- Commits: Conventional Commits format
</style>

## Testing Requirements
<testing>
- Unit tests: all data transformations
- Integration tests: API endpoints
- Backtests: trading logic changes
</testing>