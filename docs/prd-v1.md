# TooAcc V1 PRD (Team of One)

## 1) Product Summary
TooAcc is a minimal web app for solo operators who need tax-ready accounting without learning accounting software.

Core outcome: turn raw transactions into reviewable journal entries and produce up-to-date General Ledger, Balance Sheet, and Income Statement.

AI operating stance:
- AI-first: workflows are initiated by AI suggestions.
- AI-originated: first-pass bookkeeping intelligence is AI generated.
- AI-internal: rationale, confidence, and prompt/version lineage are retained.
- AI-inherited: source-to-ledger traceability is preserved across every posting step.

## 2) Target User
- Team of one founder/operator
- Not an accountant
- Needs periodic tax reporting with confidence and clean records

## 3) Problem
- Manual bookkeeping is slow and error-prone
- JE, GL, BS, and IS are hard to produce consistently
- Tax time creates stress due to missing audit trail

## 4) V1 Goals
- Import transactions (CSV upload first)
- Draft journal entries with AI assistance
- Require explicit user approval before posting
- Post approved entries to immutable ledger
- Generate BS and IS for a selected period
- Export tax package files

## 5) Non-Goals (V1)
- Full ERP features (inventory, payroll, fixed assets)
- Multi-entity consolidation
- Automatic filing of taxes
- Multi-user collaboration workflows

## 6) Success Metrics
- Time to first completed month close: under 30 minutes
- Manual JE edits per 100 imported transactions: under 20
- User can export tax package in under 2 minutes
- Zero silent posting by AI (100% approval gate)

## 7) UX Principles
- Clean, minimal screens
- One primary action per screen
- Every AI suggestion shows reason and source
- Permanent audit trail for all changes

Visual direction:
- Primary brand color: `#F28500`
- Neutral, light-first interface
- Simple typography and high contrast for tabular accounting data

## 8) User Flows (V1)
1. User signs in (Supabase Auth).
2. User uploads transaction CSV.
3. AI agent proposes account mapping and JE draft.
4. User approves or edits JE line items.
5. System posts JE and updates GL balances.
6. User opens Reports and views BS/IS.
7. User exports tax package.

## 9) Functional Requirements
- Auth and tenancy
- Supabase Auth JWT validation in FastAPI
- Row-level data isolation by `owner_id`

- Transactions Inbox
- CSV upload, parse, dedupe, and store raw rows
- Statuses: `new`, `mapped`, `posted`, `needs_review`

- Journal Entry Drafting
- LLM proposes debit/credit lines, memo, and confidence score
- Store model output + rationale snapshot
- User can edit lines before approval

- Posting Engine
- Double-entry validation (sum debit = sum credit)
- Block posting if validation fails
- Posted entries are immutable; corrections via reversing JE

- Reporting
- General Ledger detail by account and period
- Balance Sheet point-in-time
- Income Statement for date range
- Optional Trial Balance endpoint for diagnostics

- Tax Export
- Export GL, JE detail, BS, and IS as CSV

## 10) Technical Stack and Deployment
- Frontend: React app on Cloudflare
- Backend: FastAPI on FastAPI Cloud
- Database/Auth: Supabase PostgreSQL + Supabase Auth
- LLM: OpenAI via backend service
- Agent orchestration: MCP tools + FastAPI orchestration layer
- Default tax jurisdiction: Canada
- Default currency: CAD

## 11) Security and Compliance Baseline
- No client-side direct OpenAI calls
- Server-side secrets only
- JWT verification for every protected endpoint
- Request/response logging for accounting actions
- Immutable audit log table for compliance and debugging

## 12) Open Questions Before Build
- Chart of accounts bootstrapping policy: dynamic account creation by agent/tool with optional generic fallback template
- Month-end close policy (manual close vs auto-close reminder)
