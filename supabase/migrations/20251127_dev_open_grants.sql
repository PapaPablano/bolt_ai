-- DEV-OPEN grants: add explicit SELECT privileges for anon (RLS stays ON)
-- This complements 20251127_dev_open_read_policies.sql.

grant usage on schema public to anon;

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
    if exists (
      select 1
      from pg_tables
      where schemaname = 'public'
        and tablename = t
    ) then
      execute format('grant select on public.%I to anon;', t);
    end if;
  end loop;
end $$;
