# TooAcc V1 Route Map

## 1) Frontend (React on Cloudflare)
Minimal app shell with top nav and 4 primary pages.

- `/inbox`
Purpose: upload/import transactions and queue review items.

- `/entries`
Purpose: review AI draft JEs, edit lines, approve and post.

- `/ledger`
Purpose: account-level GL view with filters.

- `/reports`
Purpose: BS/IS report viewer and export actions.

- `/close`
Purpose: close period and lock prior month.

Design notes:
- Keep interface light and calm.
- Use `#F28500` as primary action color.
- Prioritize table readability and status tags.

## 2) FastAPI (deployed to FastAPI Cloud)
API base prefix: `/api/v1`

Auth:
- Validate Supabase JWT on protected routes.
- Derive `owner_id` from token (`sub` claim).

### Health
- `GET /healthz`
Returns service health.

### Transactions
- `POST /transactions/import-csv`
Input: multipart CSV file.
Output: imported count, duplicate count, new record ids.

- `GET /transactions`
Query: `status`, `from_date`, `to_date`, `page`, `page_size`.
Output: paginated raw transactions.

- `GET /transactions/{transaction_id}`
Output: single transaction detail.

### Journal Entry Drafts (AI)
- `POST /je-drafts/generate`
Input: `{ transaction_id }`.
Action: run OpenAI classification/drafting agent.
Output: draft header + lines + confidence + rationale.

- `GET /je-drafts`
Query: `approved`, `from_date`, `to_date`.
Output: draft list.

- `GET /je-drafts/{draft_id}`
Output: draft detail with lines.

- `PATCH /je-drafts/{draft_id}`
Input: editable fields (`memo`, `lines`).
Output: updated draft.

### Journal Entries (posting)
- `POST /journal-entries/from-draft/{draft_id}`
Action: validate debit=credit, post JE, mark transaction posted.
Output: posted JE id and entry number.

- `POST /journal-entries`
Input: manual JE payload for edge cases.
Output: posted JE id and entry number.

- `GET /journal-entries`
Query: `period_yyyymm`, `account_id`, `page`, `page_size`.
Output: JE header + line summary.

- `GET /journal-entries/{journal_entry_id}`
Output: JE detail with lines.

- `POST /journal-entries/{journal_entry_id}/reverse`
Action: create reversing JE.
Output: new JE id.

### Ledger + Reports
- `GET /ledger/general`
Query: `account_id`, `from_date`, `to_date`.
Output: GL detail rows with running balance.

- `GET /reports/trial-balance`
Query: `period_yyyymm`.
Output: account trial balance.

- `GET /reports/balance-sheet`
Query: `as_of`.
Output: grouped assets, liabilities, equity.

- `GET /reports/income-statement`
Query: `from_date`, `to_date`.
Output: grouped revenue, expenses, net income.

- `GET /reports/export-tax-package`
Query: `period_yyyymm`, `format=csv`.
Output: downloadable zipped CSV package.

### Chart of Accounts (COA)
- `GET /coa/templates/generic`
Action: optional bootstrap template for Canada/CAD startup use.
Note: seed is not mandatory; dynamic COA creation via MCP/tool/agent remains the default direction.

### Close
- `POST /periods/{period_yyyymm}/close`
Action: close and lock period.

- `POST /periods/{period_yyyymm}/reopen`
Action: reopen period (owner-only safeguard).

## 3) Service Layer Layout (FastAPI)
Suggested module structure:

- `app/api/`
- `r_transactions.py`
- `r_je_drafts.py`
- `r_journal_entries.py`
- `r_reports.py`
- `r_periods.py`

- `app/service/`
- `ser_csv_import.py`
- `ser_agent_draft.py`
- `ser_posting.py`
- `ser_reporting.py`
- `ser_period_close.py`

- `app/db/repo/`
- `repo_transactions.py`
- `repo_je_drafts.py`
- `repo_journal_entries.py`
- `repo_reports.py`

## 4) First Build Slice (recommended)
Build in this exact sequence:

1. Auth middleware with Supabase JWT verification.
2. Accounts + transactions import endpoints.
3. JE draft generation endpoint with mocked AI response.
4. Posting endpoint with balance validation.
5. GL + BS + IS report endpoints.
6. React pages in this order: Inbox, Entries, Reports.

## 5) Agent Behavior Guardrails
- Never auto-post without explicit user approval.
- Always return rationale text and confidence.
- Log prompt/version/model with each draft.
- If confidence below threshold (for example 0.70), force `needs_review`.
