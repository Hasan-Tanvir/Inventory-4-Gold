create table if not exists public.app_kv (
  owner_id uuid not null,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (owner_id, key)
);

alter table public.app_kv enable row level security;

drop policy if exists "Allow authenticated read" on public.app_kv;
drop policy if exists "Allow authenticated write" on public.app_kv;

create policy "Allow authenticated read"
on public.app_kv
for select
to authenticated
using (auth.uid() = owner_id);

create policy "Allow authenticated write"
on public.app_kv
for all
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);
