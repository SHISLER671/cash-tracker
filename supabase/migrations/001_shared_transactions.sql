-- shared_transactions: household sync table for Cash Tracker
-- Run in Supabase SQL Editor if not already applied.

create table if not exists public.shared_transactions (
  id          uuid primary key,
  date        timestamptz not null,
  amount      numeric not null,
  merchant    text,
  category    text not null,  -- free text; presets may be gas, groceries, etc.
  type        text not null check (type in ('in', 'out')),
  note        text,
  account_id  integer,
  device_id   text,
  deleted     boolean not null default false,
  updated_at  timestamptz not null default now()
);

create index if not exists shared_transactions_updated_at_idx
  on public.shared_transactions (updated_at asc);

create or replace function public.set_shared_transactions_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists shared_transactions_updated_at on public.shared_transactions;
create trigger shared_transactions_updated_at
  before insert or update on public.shared_transactions
  for each row execute function public.set_shared_transactions_updated_at();

alter table public.shared_transactions enable row level security;

drop policy if exists "anon_select" on public.shared_transactions;
drop policy if exists "anon_insert" on public.shared_transactions;
drop policy if exists "anon_update" on public.shared_transactions;

create policy "anon_select" on public.shared_transactions for select to anon using (true);
create policy "anon_insert" on public.shared_transactions for insert to anon with check (true);
create policy "anon_update" on public.shared_transactions for update to anon using (true);

-- Enable Realtime (safe to run if already added)
do $$
begin
  alter publication supabase_realtime add table public.shared_transactions;
exception
  when duplicate_object then null;
end $$;