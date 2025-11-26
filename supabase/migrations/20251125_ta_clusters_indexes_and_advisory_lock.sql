-- === Idempotent indexes for ta_clusters ===
create index if not exists ta_clusters_scan_idx
  on public.ta_clusters (symbol_id, timeframe, ts desc);

create index if not exists ta_clusters_label_idx
  on public.ta_clusters (label);

-- === Advisory lock wrappers for Edge function ===
-- Expose pg_try_advisory_lock / pg_advisory_unlock via simple RPC-safe functions.
-- We expect only the service role to call them (from jobs-stai-batch).

create or replace function public.try_advisory_lock(key bigint)
returns boolean
language sql
as $$
  select pg_try_advisory_lock(key);
$$;

create or replace function public.advisory_unlock(key bigint)
returns boolean
language sql
as $$
  select pg_advisory_unlock(key);
$$;

-- (Optional hardening) Restrict execute to service/authorized roles only.
-- Commented out by default; uncomment if youve set up a dedicated DB role.
-- revoke all on function public.try_advisory_lock(bigint)    from public;
-- revoke all on function public.advisory_unlock(bigint)      from public;
-- grant execute on function public.try_advisory_lock(bigint) to service_role;
-- grant execute on function public.advisory_unlock(bigint)   to service_role;
