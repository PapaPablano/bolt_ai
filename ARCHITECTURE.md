# Architecture

This document outlines the architecture of the Bolt AI monorepo.

## Monorepo Structure

The project is organized as a monorepo with the following key directories:

-   `frontend/`: A Vite-powered React application that serves as the user interface. It has its own `package.json` for managing frontend-specific dependencies.
-   `supabase/`: Contains Supabase edge functions. Each function is a self-contained Deno module with its dependencies managed via an `import_map.json` file.
-   `scripts/`: A collection of Node.js scripts for various development and administrative tasks, such as running smoke tests and starting the development server.

## Dependency Management

Dependencies are managed at two levels:

1.  **Root `package.json`**: This file contains dependencies that are shared across the entire project, primarily for development and scripting purposes. This includes tools like `tsx` for running TypeScript scripts, `eslint` for linting, and `typescript` for compiling.

2.  **`frontend/package.json`**: This file manages all the dependencies for the React frontend application. This includes React itself, as well as UI libraries like `shadcn` and data-fetching libraries like `@tanstack/react-query`.

This separation of dependencies ensures that the frontend and backend environments are kept clean and that each part of the project only has access to the dependencies it needs.

## Data Flow

The frontend application communicates with the Supabase backend to fetch data and perform actions. The Supabase edge functions, in turn, may communicate with third-party APIs (such as financial data providers) to retrieve the necessary information.

## Authentication

Authentication is handled by Supabase, which provides a complete authentication solution out of the box.

## CI/CD

The CI/CD pipeline should be configured to:

1.  Install dependencies at both the root and in the `frontend/` directory.
2.  Build the frontend application.
3.  Run tests for both the frontend and the backend scripts.
4.  Deploy the frontend to a static hosting provider and the Supabase functions to Supabase.
