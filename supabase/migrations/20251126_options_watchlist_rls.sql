-- Options watchlist RLS and indexes

-- 2) RLS: owners only
alter table public.options_watchlist enable row level security;
alter table public.options_watchlist_items enable row level security;

-- policy assumes options_watchlist has user_id column tied to auth.users.id
create policy if not exists options_watchlist_owner_rw
on public.options_watchlist
as permissive
for all
to authenticated
using ( user_id = auth.uid() )
with check ( user_id = auth.uid() );

create policy if not exists options_watchlist_items_owner_rw
on public.options_watchlist_items
as permissive
for all
to authenticated
using (
  exists (
    select 1 from public.options_watchlist w
    where w.id = options_watchlist_items.watchlist_id
      and w.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.options_watchlist w
    where w.id = options_watchlist_items.watchlist_id
      and w.user_id = auth.uid()
  )
);

-- 3) convenience indexes
create index if not exists idx_owl_items_watchlist on public.options_watchlist_items(watchlist_id);
create index if not exists idx_owl_items_contract on public.options_watchlist_items(contract_id);
