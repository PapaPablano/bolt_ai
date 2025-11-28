-- DEV-OPEN READ POLICIES (reversible)
-- Grants anon read access on key market/analytics tables, with RLS enabled.
-- To revert, apply 20251127_dev_lockdown_read_policies.sql.

do $$
declare
  t text;
  tbls text[] := array[
    'symbols',
    'options_contracts','options_quotes','options_chains','iv_history',
    'earnings_events','alert_events',
    'price_history','market_quotes','futures_data',
    'ml_training_data','ml_predictions',
    'ta_bbands','ta_kdj','ta_supertrend_ai','ta_clusters'
  ];
begin
  foreach t in array tbls loop
    -- Enable RLS so we can control it explicitly.
    execute format('alter table public.%I enable row level security;', t);

    -- Create a read-only policy for anon if it doesn't exist.
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = t
        and policyname = format('ro_%s_anon', t)
    ) then
      execute format(
        'create policy %I on public.%I for select to anon using (true);',
        format('ro_%s_anon', t), t
      );
    end if;

    -- Allow anon to read.
    execute format('grant select on public.%I to anon;', t);
  end loop;
end $$;
