-- DEV-LOCKDOWN FORMER DEV-OPEN POLICIES
-- Reverts anon read access granted by 20251127_dev_open_read_policies.sql.


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
    -- Revoke anon SELECT.
    execute format('revoke select on public.%I from anon;', t);

    -- Drop the dev-open read policy if present.
    execute format(
      'drop policy if exists %I on public.%I;',
      format('ro_%s_anon', t), t
    );

    -- Keep RLS enabled so authenticated policies continue to apply.
  end loop;
end $$;
