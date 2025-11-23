# Security Policy

## Supported Versions

This project is under active development and does not yet publish formal versioned releases. All work currently targets the `main` branch.

Security fixes are applied to the latest `main` branch and deployed to production environments as soon as practical.

## Reporting a Vulnerability

If you discover a security vulnerability, **do not open a public GitHub issue**.

Instead, please use one of the following channels:

- **GitHub Private Vulnerability Reporting** (preferred), if enabled for this repository.
- Or email the maintainers using the contact information in the repository description or organization profile.

When reporting a vulnerability, please include:

- A description of the issue and potential impact.
- Steps to reproduce the vulnerability.
- Any relevant logs, stack traces, or screenshots.
- Suggested remediation ideas, if you have them.

We aim to acknowledge valid reports within **3 business days** and provide a resolution or mitigation plan as soon as reasonably possible.

## Scope

This security policy covers:

- The Stock Whisperer frontend (`frontend/`)
- Supabase Edge Functions in `supabase/functions/`
- Supporting backend services under `backend/`

Third-party services (Supabase, Alpaca, Schwab, broker APIs, etc.) are **out of scope** for this policy, but we will coordinate with those providers when necessary.

## Handling of Security Fixes

When a vulnerability is confirmed:

1. A private issue is created and triaged by maintainers.
2. A fix is implemented and tested (including regression tests where applicable).
3. The fix is merged into `main` and deployed.
4. If appropriate, a public note is added to `CHANGELOG.md` summarizing the issue and fix, without exposing exploit details.

## Hardening and Dependency Management

This repository uses the following mechanisms to reduce security risk:

- **Dependabot** for npm, pip, and GitHub Actions dependency updates.
- **Automated security scans**:
  - `npm audit --audit-level=high` for JavaScript/TypeScript dependencies.
  - `pip-audit` for Python dependencies under `backend/`.
- **Environment variable best practices**:
  - Secrets are never committed to source control.
  - Supabase Edge Functions and deployments rely on environment variables and secrets configured in the hosting platform.

If you have suggestions for improving the projects security posture, feel free to open a discussion or proposal issue (without sensitive details).
