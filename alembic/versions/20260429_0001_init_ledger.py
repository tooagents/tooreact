"""init ledger

Revision ID: 20260429_0001
Revises:
Create Date: 2026-04-29 12:45:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260429_0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("create extension if not exists pgcrypto;")

    op.create_table(
        "accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("subtype", sa.String(length=100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("type in ('asset','liability','equity','revenue','expense')", name="ck_accounts_type"),
        sa.UniqueConstraint("owner_id", "code", name="uq_accounts_owner_code"),
    )
    op.create_index("idx_accounts_owner", "accounts", ["owner_id"])
    op.create_index("idx_accounts_owner_type", "accounts", ["owner_id", "type"])

    op.create_table(
        "transactions_raw",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source", sa.String(length=20), nullable=False, server_default=sa.text("'csv'")),
        sa.Column("source_file_name", sa.String(length=255), nullable=True),
        sa.Column("external_id", sa.String(length=255), nullable=True),
        sa.Column("txn_date", sa.Date(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default=sa.text("'CAD'")),
        sa.Column("hash", sa.String(length=128), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default=sa.text("'new'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("status in ('new','mapped','needs_review','posted')", name="ck_transactions_raw_status"),
        sa.UniqueConstraint("owner_id", "hash", name="uq_transactions_owner_hash"),
    )
    op.create_index("idx_transactions_owner_status", "transactions_raw", ["owner_id", "status", "txn_date"])

    op.create_table(
        "je_drafts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("transaction_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("ai_model", sa.String(length=120), nullable=False),
        sa.Column("confidence", sa.Numeric(5, 4), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=False),
        sa.Column("memo", sa.Text(), nullable=True),
        sa.Column("suggested_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved", sa.Boolean(), nullable=True),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.CheckConstraint("confidence >= 0 and confidence <= 1", name="ck_je_drafts_confidence"),
        sa.ForeignKeyConstraint(["transaction_id"], ["transactions_raw.id"], ondelete="SET NULL"),
    )
    op.create_index("idx_je_drafts_owner", "je_drafts", ["owner_id", "suggested_at"])

    op.create_table(
        "je_draft_lines",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("draft_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("line_type", sa.String(length=10), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.CheckConstraint("line_type in ('debit','credit')", name="ck_je_draft_lines_line_type"),
        sa.CheckConstraint("amount > 0", name="ck_je_draft_lines_amount_positive"),
        sa.ForeignKeyConstraint(["draft_id"], ["je_drafts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="RESTRICT"),
    )
    op.create_index("idx_je_draft_lines_draft", "je_draft_lines", ["draft_id"])

    op.create_table(
        "journal_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("entry_no", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("memo", sa.Text(), nullable=True),
        sa.Column("source", sa.String(length=20), nullable=False, server_default=sa.text("'manual'")),
        sa.Column("source_ref_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("posted_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("posted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("period_yyyymm", sa.Integer(), nullable=False),
        sa.Column("is_reversal", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("reversed_entry_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.CheckConstraint("source in ('manual','ai','import','reversal')", name="ck_journal_entries_source"),
        sa.ForeignKeyConstraint(["reversed_entry_id"], ["journal_entries.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("owner_id", "entry_no", name="uq_journal_entries_owner_entry_no"),
    )
    op.create_index("idx_journal_entries_owner_period", "journal_entries", ["owner_id", "period_yyyymm", "entry_date"])

    op.create_table(
        "journal_entry_lines",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("journal_entry_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("line_type", sa.String(length=10), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.CheckConstraint("line_type in ('debit','credit')", name="ck_journal_entry_lines_line_type"),
        sa.CheckConstraint("amount > 0", name="ck_journal_entry_lines_amount_positive"),
        sa.ForeignKeyConstraint(["journal_entry_id"], ["journal_entries.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="RESTRICT"),
    )
    op.create_index("idx_journal_lines_je", "journal_entry_lines", ["journal_entry_id"])
    op.create_index("idx_journal_lines_account", "journal_entry_lines", ["account_id"])

    op.create_table(
        "period_closes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("period_yyyymm", sa.Integer(), nullable=False),
        sa.Column("is_closed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.UniqueConstraint("owner_id", "period_yyyymm", name="uq_period_closes_owner_period"),
    )

    op.create_table(
        "audit_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("entity_type", sa.String(length=100), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_audit_owner_created", "audit_events", ["owner_id", "created_at"])

    op.execute(
        """
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
"""
    )

    # Supabase RLS policies for tenancy isolation.
    op.execute("alter table public.accounts enable row level security;")
    op.execute("alter table public.transactions_raw enable row level security;")
    op.execute("alter table public.je_drafts enable row level security;")
    op.execute("alter table public.je_draft_lines enable row level security;")
    op.execute("alter table public.journal_entries enable row level security;")
    op.execute("alter table public.journal_entry_lines enable row level security;")
    op.execute("alter table public.period_closes enable row level security;")
    op.execute("alter table public.audit_events enable row level security;")

    op.execute(
        "create policy \"owner can access own accounts\" "
        "on public.accounts for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());"
    )
    op.execute(
        "create policy \"owner can access own transactions_raw\" "
        "on public.transactions_raw for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());"
    )
    op.execute(
        "create policy \"owner can access own je_drafts\" "
        "on public.je_drafts for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());"
    )
    op.execute(
        "create policy \"owner can access own journal_entries\" "
        "on public.journal_entries for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());"
    )
    op.execute(
        "create policy \"owner can access own period_closes\" "
        "on public.period_closes for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());"
    )
    op.execute(
        "create policy \"owner can access own audit_events\" "
        "on public.audit_events for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());"
    )
    op.execute(
        """
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
"""
    )
    op.execute(
        """
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
"""
    )


def downgrade() -> None:
    op.execute('drop policy if exists "owner can access own journal_entry_lines" on public.journal_entry_lines;')
    op.execute('drop policy if exists "owner can access own je_draft_lines" on public.je_draft_lines;')
    op.execute('drop policy if exists "owner can access own audit_events" on public.audit_events;')
    op.execute('drop policy if exists "owner can access own period_closes" on public.period_closes;')
    op.execute('drop policy if exists "owner can access own journal_entries" on public.journal_entries;')
    op.execute('drop policy if exists "owner can access own je_drafts" on public.je_drafts;')
    op.execute('drop policy if exists "owner can access own transactions_raw" on public.transactions_raw;')
    op.execute('drop policy if exists "owner can access own accounts" on public.accounts;')

    op.execute("drop function if exists public.validate_je_balanced(uuid);")

    op.drop_index("idx_audit_owner_created", table_name="audit_events")
    op.drop_table("audit_events")
    op.drop_table("period_closes")
    op.drop_index("idx_journal_lines_account", table_name="journal_entry_lines")
    op.drop_index("idx_journal_lines_je", table_name="journal_entry_lines")
    op.drop_table("journal_entry_lines")
    op.drop_index("idx_journal_entries_owner_period", table_name="journal_entries")
    op.drop_table("journal_entries")
    op.drop_index("idx_je_draft_lines_draft", table_name="je_draft_lines")
    op.drop_table("je_draft_lines")
    op.drop_index("idx_je_drafts_owner", table_name="je_drafts")
    op.drop_table("je_drafts")
    op.drop_index("idx_transactions_owner_status", table_name="transactions_raw")
    op.drop_table("transactions_raw")
    op.drop_index("idx_accounts_owner_type", table_name="accounts")
    op.drop_index("idx_accounts_owner", table_name="accounts")
    op.drop_table("accounts")

