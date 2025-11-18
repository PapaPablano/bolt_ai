create table if not exists public.chart_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_timeframe text not null default '1Hour',
  default_range text not null default '1Y',
  presets jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.chart_prefs enable row level security;

create policy chart_prefs_select on public.chart_prefs
  for select using (user_id = auth.uid());

create policy chart_prefs_insert on public.chart_prefs
  for insert with check (user_id = auth.uid());

create policy chart_prefs_update on public.chart_prefs
  for update using (user_id = auth.uid());

create or replace function public.chart_prefs_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists trg_chart_prefs_touch on public.chart_prefs;
create trigger trg_chart_prefs_touch
before update on public.chart_prefs
for each row execute procedure public.chart_prefs_touch_updated_at();
