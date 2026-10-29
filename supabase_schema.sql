-- TMC Stock Take V1.3 • Supabase SQL Editor • Run once in your own project.
-- Authenticated users can access only their OWN stock-take batches and scans.
-- Use same email/password on PC & phone. Do not place the service_role/secret key in web code.

create extension if not exists pgcrypto;

create table if not exists public.stocktake_batches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  report_name text not null default '',
  imported_at text not null default '',
  inventory jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint stocktake_inventory_is_array check (jsonb_typeof(inventory) = 'array')
);

create table if not exists public.stocktake_scans (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.stocktake_batches(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  label text not null default '',
  status text not null check (status in ('accepted','counted_variance','counted_multi','duplicate','unmatched','invalid','mismatch','ambiguous','legacy')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists stocktake_batches_owner_created_idx on public.stocktake_batches (owner_id, created_at desc);
create index if not exists stocktake_scans_batch_created_idx on public.stocktake_scans (batch_id, created_at, id);
create index if not exists stocktake_scans_owner_idx on public.stocktake_scans (owner_id);
-- Database-level duplicate protection, even when two devices scan simultaneously.
create unique index if not exists stocktake_unique_counted_label on public.stocktake_scans (batch_id, label) where status in ('accepted','counted_variance','counted_multi');

alter table public.stocktake_batches enable row level security;
alter table public.stocktake_scans enable row level security;
revoke all on public.stocktake_batches from anon, authenticated;
revoke all on public.stocktake_scans from anon, authenticated;
grant select, insert, delete on public.stocktake_batches to authenticated;
grant select, insert, delete on public.stocktake_scans to authenticated;

create policy "stocktake batches read own" on public.stocktake_batches for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "stocktake batches create own" on public.stocktake_batches for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "stocktake batches delete own" on public.stocktake_batches for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy "stocktake scans read own" on public.stocktake_scans for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "stocktake scans add own" on public.stocktake_scans for insert to authenticated
  with check (owner_id = (select auth.uid()) and exists (
    select 1 from public.stocktake_batches b
    where b.id = batch_id and b.owner_id = (select auth.uid())
  ) and batch_id = (
    select latest.id from public.stocktake_batches latest
    where latest.owner_id = (select auth.uid())
    order by latest.created_at desc, latest.id desc limit 1
  ));
create policy "stocktake scans delete own" on public.stocktake_scans for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Supabase Realtime uses this publication to notify browser clients.
-- Tables should be added only once; this block is safe to re-run.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='stocktake_batches') then
    alter publication supabase_realtime add table public.stocktake_batches;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='stocktake_scans') then
    alter publication supabase_realtime add table public.stocktake_scans;
  end if;
end $$;

-- V1.3.2 upgrade (safe on existing V1.3/V1.3.1 projects): new counted statuses.
alter table public.stocktake_scans drop constraint if exists stocktake_scans_status_check;
alter table public.stocktake_scans add constraint stocktake_scans_status_check
  check (status in ('accepted','counted_variance','counted_multi','duplicate','unmatched','invalid','mismatch','ambiguous','legacy'));
drop index if exists public.stocktake_unique_accepted_label;
create unique index if not exists stocktake_unique_counted_label on public.stocktake_scans (batch_id, label)
  where status in ('accepted','counted_variance','counted_multi');
