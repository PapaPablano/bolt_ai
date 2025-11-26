alter table if not exists public.alerts
  add column if not exists user_id uuid default auth.uid();

alter table public.alerts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'alerts'
      and policyname = 'alerts_owner_rw'
  ) then
    create policy alerts_owner_rw on public.alerts
      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end$$;
