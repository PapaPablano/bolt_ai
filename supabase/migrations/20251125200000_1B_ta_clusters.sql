create table if not exists public.ta_clusters (
  symbol_id bigint not null,
  timeframe text not null,
  ts timestamptz not null,
  label text not null check (label in ('TREND_UP','TREND_DOWN','CHOP')),
  features_json jsonb,
  model_version text not null,
  primary key (symbol_id, timeframe, ts)
);

create index if not exists ta_clusters_idx
  on public.ta_clusters(symbol_id, timeframe, ts desc);
