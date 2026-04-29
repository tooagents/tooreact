-- TooAcc V1 schema (Supabase PostgreSQL)
-- Assumes Supabase Auth; `owner_id` references auth.users(id)
-- Uses UUIDs and UTC timestamps.

create extension if not exists pgcrypto;

-- ---------- core reference ----------
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  name text not null,
  type text not null check (type in ('asset','liability','equity','revenue','expense')),
  subtype text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (owner_id, code)
);

create index if not exists idx_accounts_owner on public.accounts(owner_id);
create index if not exists idx_accounts_owner_type on public.accounts(owner_id, type);

-- ---------- imported source data ----------
create table if not exists public.transactions_raw (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'csv',
  source_file_name text,
  external_id text,
  txn_date date not null,
  description text not null,
  amount numeric(14,2) not null,
  currency char(3) not null default 'CAD',
  hash text not null, -- deterministic hash for dedupe
  status text not null default 'new' check (status in ('new','mapped','needs_review','posted')),
  created_at timestamptz not null default now(),
  unique (owner_id, hash)
);

create index if not exists idx_transactions_owner_status
  on public.transactions_raw(owner_id, status, txn_date);

-- ---------- AI suggestion ----------
create table if not exists public.je_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid references public.transactions_raw(id) on delete set null,
  ai_model text not null,
  confidence numeric(5,4) not null check (confidence >= 0 and confidence <= 1),
  rationale text not null,
  memo text,
  suggested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  approved boolean,
  approved_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_je_drafts_owner on public.je_drafts(owner_id, suggested_at desc);

create table if not exists public.je_draft_lines (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.je_drafts(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  line_type text not null check (line_type in ('debit','credit')),
  amount numeric(14,2) not null check (amount > 0),
  note text
);

create index if not exists idx_je_draft_lines_draft on public.je_draft_lines(draft_id);

-- ---------- posted ledger ----------
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  entry_no bigint generated always as identity,
  entry_date date not null,
  memo text,
  source text not null default 'manual' check (source in ('manual','ai','import','reversal')),
  source_ref_id uuid,
  posted_by uuid not null references auth.users(id) on delete restrict,
  posted_at timestamptz not null default now(),
  period_yyyymm int not null,
  is_reversal boolean not null default false,
  reversed_entry_id uuid references public.journal_entries(id) on delete set null
);

create unique index if not exists uq_journal_entries_owner_entry_no
  on public.journal_entries(owner_id, entry_no);
create index if not exists idx_journal_entries_owner_period
  on public.journal_entries(owner_id, period_yyyymm, entry_date);

create table if not exists public.journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.journal_entries(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  line_type text not null check (line_type in ('debit','credit')),
  amount numeric(14,2) not null check (amount > 0),
  description text
);

create index if not exists idx_journal_lines_je on public.journal_entry_lines(journal_entry_id);
create index if not exists idx_journal_lines_account on public.journal_entry_lines(account_id);

-- ---------- period close ----------
create table if not exists public.period_closes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  period_yyyymm int not null,
  is_closed boolean not null default false,
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  unique (owner_id, period_yyyymm)
);

-- ---------- audit ----------
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_owner_created on public.audit_events(owner_id, created_at desc);

-- ---------- helper function ----------
create or replace function public.validate_je_balanced(p_journal_entry_id uuid)
returns boolean
language sql
stable
as $$
  select
    coalesce(sum(case when line_type = 'debit' then amount else 0 end), 0) =
    coalesce(sum(case when line_type = 'credit' then amount else 0 end), 0)
  from public.journal_entry_lines
  where journal_entry_id = p_journal_entry_id
$$;

-- ---------- row level security ----------
alter table public.accounts enable row level security;
alter table public.transactions_raw enable row level security;
alter table public.je_drafts enable row level security;
alter table public.je_draft_lines enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_entry_lines enable row level security;
alter table public.period_closes enable row level security;
alter table public.audit_events enable row level security;

create policy "owner can access own accounts"
on public.accounts for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "owner can access own transactions_raw"
on public.transactions_raw for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "owner can access own je_drafts"
on public.je_drafts for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "owner can access own journal_entries"
on public.journal_entries for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "owner can access own period_closes"
on public.period_closes for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "owner can access own audit_events"
on public.audit_events for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

-- Draft lines accessible through draft ownership
create policy "owner can access own je_draft_lines"
on public.je_draft_lines for all
using (
  exists (
    select 1 from public.je_drafts d
    where d.id = je_draft_lines.draft_id and d.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.je_drafts d
    where d.id = je_draft_lines.draft_id and d.owner_id = auth.uid()
  )
);

-- JE lines accessible through JE ownership
create policy "owner can access own journal_entry_lines"
on public.journal_entry_lines for all
using (
  exists (
    select 1 from public.journal_entries je
    where je.id = journal_entry_lines.journal_entry_id and je.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.journal_entries je
    where je.id = journal_entry_lines.journal_entry_id and je.owner_id = auth.uid()
  )
);
