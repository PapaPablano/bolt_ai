-- TA caches (optional)
create table if not exists public.ta_bbands (
  symbol_id bigint not null,
  timeframe text not null,
  ts timestamptz not null,
  mid numeric(18,6),
  upper numeric(18,6),
  lower numeric(18,6),
  pct_b numeric(12,8),
  bandwidth numeric(12,8),
  primary key (symbol_id, timeframe, ts)
);

create table if not exists public.ta_kdj (
  symbol_id bigint not null,
  timeframe text not null,
  ts timestamptz not null,
  k numeric(12,8),
  d numeric(12,8),
  j numeric(12,8),
  primary key (symbol_id, timeframe, ts)
);

create table if not exists public.ta_supertrend_ai (
  symbol_id bigint not null references public.symbols(id) on delete cascade,
  timeframe text not null,
  ts timestamptz not null,
  factor numeric(12,6) not null,
  perf numeric(18,8) not null,
  cluster text not null check (cluster in ('LOW','AVG','TOP')),
  primary key (symbol_id, timeframe, ts)
);

create index if not exists ta_stai_idx
  on public.ta_supertrend_ai(symbol_id, timeframe, ts desc);

-- Alerts idempotency (critical)
alter table public.alert_events
  add column if not exists symbol_id bigint,
  add column if not exists timeframe text,
  add column if not exists bar_ts timestamptz;

create unique index if not exists alert_events_uniq
  on public.alert_events (alert_id, symbol_id, timeframe, bar_ts);
