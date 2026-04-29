import csv
import hashlib
import io
import zipfile
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.db.models.ledger import (
    Account,
    JeDraft,
    JeDraftLine,
    JournalEntry,
    JournalEntryLine,
    PeriodClose,
    TransactionRaw,
)


@dataclass
class ImportResult:
    imported_count: int
    duplicate_count: int
    ids: list[str]


def _txn_hash(txn_date: date, description: str, amount: Decimal, currency: str) -> str:
    raw = f"{txn_date.isoformat()}|{description.strip().lower()}|{amount}|{currency.upper()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def parse_csv_transactions(content: bytes, owner_id: UUID, file_name: str | None, default_currency: str) -> list[TransactionRaw]:
    text = content.decode("utf-8-sig")
    rows = csv.DictReader(io.StringIO(text))
    txns: list[TransactionRaw] = []
    for row in rows:
        txn_date = date.fromisoformat((row.get("date") or row.get("txn_date") or "").strip())
        description = (row.get("description") or row.get("memo") or "").strip() or "Unlabeled transaction"
        amount = Decimal((row.get("amount") or "0").strip())
        currency = (row.get("currency") or default_currency).strip().upper()
        txns.append(
            TransactionRaw(
                owner_id=owner_id,
                source="csv",
                source_file_name=file_name,
                txn_date=txn_date,
                description=description,
                amount=amount,
                currency=currency,
                hash=_txn_hash(txn_date, description, amount, currency),
                status="new",
            )
        )
    return txns


def import_transactions(db: Session, owner_id: UUID, txns: list[TransactionRaw]) -> ImportResult:
    imported = 0
    dupes = 0
    ids: list[str] = []
    for txn in txns:
        exists = db.execute(select(TransactionRaw.id).where(and_(TransactionRaw.owner_id == owner_id, TransactionRaw.hash == txn.hash))).first()
        if exists:
            dupes += 1
            continue
        db.add(txn)
        db.flush()
        imported += 1
        ids.append(str(txn.id))
    db.commit()
    return ImportResult(imported_count=imported, duplicate_count=dupes, ids=ids)


def yyyymm_from_date(d: date) -> int:
    return d.year * 100 + d.month


def is_period_closed(db: Session, owner_id: UUID, period_yyyymm: int) -> bool:
    row = db.execute(
        select(PeriodClose).where(
            and_(PeriodClose.owner_id == owner_id, PeriodClose.period_yyyymm == period_yyyymm, PeriodClose.is_closed.is_(True))
        )
    ).scalar_one_or_none()
    return row is not None


def assert_draft_balanced(lines: list[JeDraftLine]) -> None:
    debit = sum((line.amount for line in lines if line.line_type == "debit"), Decimal("0"))
    credit = sum((line.amount for line in lines if line.line_type == "credit"), Decimal("0"))
    if debit != credit:
        raise ValueError("Draft is not balanced")


def ledger_rows(db: Session, owner_id: UUID, from_date: date | None = None, to_date: date | None = None, account_id: UUID | None = None):
    stmt = (
        select(JournalEntry.entry_date, Account.id, Account.code, Account.name, Account.type, JournalEntryLine.line_type, JournalEntryLine.amount)
        .join(JournalEntryLine, JournalEntry.id == JournalEntryLine.journal_entry_id)
        .join(Account, Account.id == JournalEntryLine.account_id)
        .where(JournalEntry.owner_id == owner_id)
        .order_by(JournalEntry.entry_date.asc(), JournalEntry.posted_at.asc())
    )
    if from_date:
        stmt = stmt.where(JournalEntry.entry_date >= from_date)
    if to_date:
        stmt = stmt.where(JournalEntry.entry_date <= to_date)
    if account_id:
        stmt = stmt.where(Account.id == account_id)
    return db.execute(stmt).all()


def account_signed_amount(account_type: str, line_type: str, amount: Decimal) -> Decimal:
    debit_positive = account_type in {"asset", "expense"}
    if debit_positive:
        return amount if line_type == "debit" else -amount
    return -amount if line_type == "debit" else amount


def trial_balance(db: Session, owner_id: UUID, from_date: date | None = None, to_date: date | None = None) -> list[dict]:
    totals: dict[UUID, dict] = {}
    for row in ledger_rows(db, owner_id, from_date=from_date, to_date=to_date):
        entry_date, account_id, code, name, account_type, line_type, amount = row
        if account_id not in totals:
            totals[account_id] = {
                "account_id": account_id,
                "code": code,
                "name": name,
                "type": account_type,
                "debit": Decimal("0"),
                "credit": Decimal("0"),
                "net": Decimal("0"),
            }
        if line_type == "debit":
            totals[account_id]["debit"] += amount
        else:
            totals[account_id]["credit"] += amount
        totals[account_id]["net"] = totals[account_id]["debit"] - totals[account_id]["credit"]
    return list(totals.values())


def balance_sheet(db: Session, owner_id: UUID, as_of: date) -> dict:
    grouped: dict[str, list[dict]] = {"asset": [], "liability": [], "equity": []}
    totals = defaultdict(lambda: Decimal("0"))
    for row in trial_balance(db, owner_id, to_date=as_of):
        acct_type = row["type"]
        if acct_type not in grouped:
            continue
        signed = account_signed_amount(acct_type, "debit", row["debit"]) + account_signed_amount(acct_type, "credit", row["credit"])
        if signed == 0:
            continue
        grouped[acct_type].append(
            {"account_id": row["account_id"], "code": row["code"], "name": row["name"], "amount": signed}
        )
        totals[acct_type] += signed
    return {
        "as_of": as_of,
        "assets": grouped["asset"],
        "liabilities": grouped["liability"],
        "equity": grouped["equity"],
        "totals": {
            "assets": totals["asset"],
            "liabilities": totals["liability"],
            "equity": totals["equity"],
        },
    }


def income_statement(db: Session, owner_id: UUID, from_date: date, to_date: date) -> dict:
    grouped: dict[str, list[dict]] = {"revenue": [], "expense": []}
    totals = defaultdict(lambda: Decimal("0"))
    for row in trial_balance(db, owner_id, from_date=from_date, to_date=to_date):
        acct_type = row["type"]
        if acct_type not in grouped:
            continue
        signed = account_signed_amount(acct_type, "debit", row["debit"]) + account_signed_amount(acct_type, "credit", row["credit"])
        if signed == 0:
            continue
        amount = signed if acct_type == "expense" else -signed
        grouped[acct_type].append(
            {"account_id": row["account_id"], "code": row["code"], "name": row["name"], "amount": amount}
        )
        totals[acct_type] += amount

    net_income = totals["revenue"] - totals["expense"]
    return {
        "from_date": from_date,
        "to_date": to_date,
        "revenue": grouped["revenue"],
        "expenses": grouped["expense"],
        "totals": {
            "revenue": totals["revenue"],
            "expenses": totals["expense"],
            "net_income": net_income,
        },
    }


def export_tax_package_zip(db: Session, owner_id: UUID, period_yyyymm: int) -> bytes:
    year = period_yyyymm // 100
    month = period_yyyymm % 100
    from_date = date(year, month, 1)
    to_date = date(year, month, 28)
    # Keep month-end portable without external libs.
    while True:
        try:
            to_date = to_date.replace(day=to_date.day + 1)
        except ValueError:
            break

    tb = trial_balance(db, owner_id, from_date=from_date, to_date=to_date)
    bs = balance_sheet(db, owner_id, as_of=to_date)
    is_data = income_statement(db, owner_id, from_date=from_date, to_date=to_date)

    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for name, rows in [
            ("trial_balance.csv", tb),
            ("balance_sheet_assets.csv", bs["assets"]),
            ("balance_sheet_liabilities.csv", bs["liabilities"]),
            ("balance_sheet_equity.csv", bs["equity"]),
            ("income_statement_revenue.csv", is_data["revenue"]),
            ("income_statement_expenses.csv", is_data["expenses"]),
        ]:
            if not rows:
                zf.writestr(name, "")
                continue
            fieldnames = list(rows[0].keys())
            buf = io.StringIO()
            writer = csv.DictWriter(buf, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
            zf.writestr(name, buf.getvalue())
    return out.getvalue()

