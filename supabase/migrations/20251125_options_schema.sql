-- SPEC-2 options schema: earnings, IV history, contracts, quotes, watchlist

create table if not exists public.earnings_events (
  id bigserial primary key,
  symbol_id bigint not null references public.symbols(id) on delete cascade,
  announce_date date not null,
  source text,
  unique(symbol_id, announce_date)
);

create index if not exists earnings_events_symbol_idx
  on public.earnings_events(symbol_id, announce_date desc);

create table if not exists public.iv_history (
  id bigserial primary key,
  symbol_id bigint not null references public.symbols(id) on delete cascade,
  as_of date not null,
  iv_30d double precision not null,
  unique(symbol_id, as_of)
);

create index if not exists iv_history_idx
  on public.iv_history(symbol_id, as_of desc);

create table if not exists public.options_contracts (
  id bigserial primary key,
  symbol_id bigint not null references public.symbols(id) on delete cascade,
  occ_symbol text not null unique,
  right text not null check (right in ('C','P')),
  strike double precision not null,
  expiry date not null
);

create index if not exists options_contracts_symbol_idx
  on public.options_contracts(symbol_id, expiry, strike);

create table if not exists public.options_quotes (
  contract_id bigint primary key references public.options_contracts(id) on delete cascade,
  bid double precision,
  ask double precision,
  last double precision,
  iv double precision,
  delta double precision,
  gamma double precision,
  theta double precision,
  vega double precision,
  oi integer,
  vol integer,
  updated_at timestamptz not null default now()
);

create table if not exists public.options_watchlist (
  id bigserial primary key,
  user_id uuid not null default auth.uid(),
  contract_id bigint not null references public.options_contracts(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, contract_id)
);

alter table public.options_watchlist enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'options_watchlist'
      and policyname = 'options_watchlist_owner_rw'
  ) then
    create policy options_watchlist_owner_rw on public.options_watchlist
      for all
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end$$;
