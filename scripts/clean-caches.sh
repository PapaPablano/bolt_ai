#!/usr/bin/env bash
set -euo pipefail

run_dev_server=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dev)
      run_dev_server=true
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--dev]" >&2
      exit 1
      ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "Removing cached build artifacts..."
rm -rf node_modules/.vite node_modules/.cache .eslintcache

echo "Installing dependencies with npm ci..."
npm ci

echo "Running lint to verify clean state..."
npm run lint

if [[ "$run_dev_server" == true ]]; then
  echo "Starting dev server (Ctrl+C to stop)..."
  npm run dev -- --host --port 5173
else
  echo "Caches cleaned and lint passed. Run 'npm run dev -- --host --port 5173' if you need the dev server."
fi
