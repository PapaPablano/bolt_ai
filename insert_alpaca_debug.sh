#!/usr/bin/env bash
set -euo pipefail

# Edit this list if any local paths differ
FILES=(
    "/tmp/user_fn_iwwdxshzrxilpzehymeu_7cc04650-d752-4cf1-8c93-d01569145686_30/source/index.ts"
    "/tmp/user_fn_iwwdxshzrxilpzehymeu_1f3203ba-b934-473d-915c-09c10d050017_26/source/index.ts"
    "/Users/ericpeterson/LOVEABLE_ML_SUPERTREND/stock-whisperer-backend/supabase/functions/stock-intraday/index.ts"
    "/tmp/user_fn_iwwdxshzrxilpzehymeu_d86a12bb-ad6a-4372-8cd0-a9624b6f7738_21/source/index.ts"
    "/tmp/user_fn_iwwdxshzrxilpzehymeu_87f67e08-75d4-4699-b073-8cfb5dfebeaa_8/source/index.ts"
    "/tmp/user_fn_iwwdxshzrxilpzehymeu_963a5b67-8ace-4520-8eb0-383d2e7cebc5_8/source/index.ts"
    "/tmp/user_fn_iwwdxshzrxilpzehymeu_55833e24-0646-4f5d-b8ce-786c2959c5be_5/source/index.ts"
    "/Users/ericpeterson/LOVEABLE_ML_SUPERTREND/stock-whisperer-backend/supabase/functions/stock-historical-v3/index.ts"
)

MARKER="// ALPACA_ENV_STATUS_INSERTED"

read -r -d '' SNIPPET <<'SNIP'
/* ALPACA_ENV_STATUS_INSERTED */
// Alpaca env-status helper and route (inserted automatically)
function alpacaEnvStatus() {
  return {
    alpaca_key_id_present: !!Deno.env.get('ALPACA_KEY_ID'),
    alpaca_secret_key_present: !!Deno.env.get('ALPACA_SECRET_KEY'),
    alpaca_base_url: Deno.env.get('ALPACA_BASE_URL') ?? null
  };
}

try {
  // If the function uses Deno.serve with a top-level handler, we add a quick path check.
  // This will not override existing routing — it only adds a top-level guard if Deno.serve is used.
  if (typeof Deno !== 'undefined' && typeof globalThis !== 'undefined') {
    // No-op: marker to show snippet was inserted
  }
} catch (e) {
  // ignore in environments where Deno is not defined at script-edit time
}
SNIP

echo "Inserting Alpaca debug snippet into function files..."
for f in "${FILES[@]}"; do
    if [ ! -f "$f" ]; then
        echo "SKIP (not found): $f"
        continue
    fi

    if grep -q "$MARKER" "$f"; then
        echo "SKIP (already inserted): $f"
        continue
    fi

    # Backup original file unless backup exists
    if [ ! -f "${f}.bak" ]; then
        cp "$f" "${f}.bak"
        echo "Backup created: ${f}.bak"
    fi

    # Attempt to insert after initial import block (after the last import line).
    # If no import lines, insert at top.
    # We detect TypeScript/JS import statements starting with 'import ' at beginning of line.
    insert_after_line=$(grep -n '^import ' "$f" | tail -n1 | cut -d: -f1 || true)

    if [ -z "$insert_after_line" ]; then
        # No imports found — prepend snippet
        awk -v snippet="$SNIPPET" 'BEGIN{print snippet} {print}' "$f" > "${f}.new"
    else
        # Insert snippet after the import block
        awk -v n="$insert_after_line" -v snippet="$SNIPPET" 'NR==n{print; print snippet; next} {print}' "$f" > "${f}.new"
    fi

    mv "${f}.new" "$f"
    echo "Inserted snippet into: $f"
done

echo "Done. Files updated where possible. Remember to review changes and redeploy functions."
