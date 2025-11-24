---
description: Full Stack Validation
auto_execution_mode: 1
---

---
title: Full Stack Validation
description: Comprehensive validation using all MCP tools before major implementation
---

# Full Stack Validation Workflow

## Steps

### Step 1: GitHub Code Search
Search for similar implementations:
- User's existing repos
- Popular public implementations
- Recent relevant commits
Result: Code patterns, known issues, best practices

### Step 2: Perplexity Best Practices
Query for current recommendations:
- Stack Overflow top answers
- Security advisories
- Performance benchmarks
Result: Community-validated approaches, gotchas to avoid

### Step 3: Database Schema Validation
Query actual database:
- Schema and constraints
- Data volumes and distribution
- Index analysis
Result: Schema-aware, performance-optimized data access

### Step 4: UI Behavior Testing
Test with browser automation:
- Current UI behavior
- Console errors
- Accessibility structure
Result: Evidence-based UI recommendations, visual proof

### Step 5: Architecture Synthesis
Combine all MCP findings:
- Cross-reference patterns from GitHub with Perplexity recommendations
- Validate proposed solution against actual database schema
- Confirm UI changes are testable with Playwright
- Present unified recommendation with citations from all sources

### Step 6: Implementation Plan
Generate:
- Architecture proposal with trade-offs
- Code snippets referencing GitHub examples
- Database migrations respecting actual schema
- Playwright test specs for validation
- Rollback plan if issues arise

Example Decision Flow:
User Request: “Add real-time price updates to dashboard”
GitHub Search: Found 8 repos with Streamlit + WebSocket → “trading-platform-v2” uses Socket.IO with Redis (see src/websocket/manager.py)
Perplexity Query: “Streamlit real-time WebSocket 2025” → Stack Overflow #12345 (2.8k votes): Use asyncio, not threading
Database Query: market_data table schema → Has real-time subscription enabled, indexed on (symbol, timestamp)
Playwright Test: Current dashboard behavior → No WebSocket connection, polling every 5s, console shows no errors
Synthesis: Use asyncio WebSocket + Supabase real-time subscriptions (GitHub pattern) + asyncio (SO recommendation) + leverage existing index (DB finding). Test with Playwright WebSocket mock.

