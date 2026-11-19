-- CableTrack database setup
-- Run this entire script in Supabase -> SQL Editor -> New query.
create extension if not exists pgcrypto;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  cells jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_updated_at_idx on public.jobs (updated_at desc);

alter table public.jobs enable row level security;

-- NO-LOGIN MODE: these policies allow anyone with the public website URL
-- and Supabase anon key to read, add, edit and delete jobs.
-- Use only if the website is intended to be openly accessible.
drop policy if exists "Public can read jobs" on public.jobs;
create policy "Public can read jobs"
on public.jobs for select to anon, authenticated using (true);

drop policy if exists "Public can add jobs" on public.jobs;
create policy "Public can add jobs"
on public.jobs for insert to anon, authenticated with check (true);

drop policy if exists "Public can edit jobs" on public.jobs;
create policy "Public can edit jobs"
on public.jobs for update to anon, authenticated using (true) with check (true);

drop policy if exists "Public can delete jobs" on public.jobs;
create policy "Public can delete jobs"
on public.jobs for delete to anon, authenticated using (true);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();
