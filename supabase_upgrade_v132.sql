-- Run this ONCE in Supabase SQL Editor when upgrading an existing V1.3 or V1.3.1 project.
-- V1.3.2 upgrade (safe on existing V1.3/V1.3.1 projects): new counted statuses.
alter table public.stocktake_scans drop constraint if exists stocktake_scans_status_check;
alter table public.stocktake_scans add constraint stocktake_scans_status_check
  check (status in ('accepted','counted_variance','counted_multi','duplicate','unmatched','invalid','mismatch','ambiguous','legacy'));
drop index if exists public.stocktake_unique_accepted_label;
create unique index if not exists stocktake_unique_counted_label on public.stocktake_scans (batch_id, label)
  where status in ('accepted','counted_variance','counted_multi');
