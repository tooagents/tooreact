# tooacc

AI-first accounting platform for teams of one.

Core flow:
1. Import transactions.
2. AI drafts JEs with rationale + confidence.
3. Human approves posting.
4. GL + BS + IS update immediately.
5. Export tax package.

## What Is Included

- FastAPI backend with accounting APIs
- Alembic migration baseline
- React web app (minimal clean UI, brand color `#F28500`)
- MCP server exposing accounting tools for agent workflows

## Stack

- Backend: FastAPI + SQLAlchemy + Alembic
- Database: Supabase PostgreSQL
- Auth: Supabase Auth target (dev fallback via `X-Owner-Id` header)
- LLM: OpenAI
- Frontend: React + Vite
- Agent tools: FastMCP

## Quick Start (Immediate Local Use)

1. Copy env template.
```bash
cp .env.example .env
```

2. Install backend deps.
```bash
uv sync
```

3. Run DB migrations (point `DATABASE_URL` to your Supabase/Postgres first).
```bash
uv run alembic upgrade head
```

4. Start backend.
```bash
uv run fastapi dev main.py
```

5. Start frontend.
```bash
cd web
npm install
npm run dev
```

6. Open web app at `http://localhost:5173`.

## Default Dev Auth Behavior

- In `APP_ENV=dev`, if `X-Owner-Id` is missing, API uses a fixed demo owner UUID.
- For realistic multi-user testing, set an explicit UUID in the web app settings.

## MCP Server

Start MCP server:
```bash
uv run python -m tooacc_mcp.server
```

Environment used by MCP:
- `TOOACC_API_BASE` default `http://localhost:8000/api/v1`
- `TOOACC_OWNER_ID` optional owner UUID

## Key API Routes

- `POST /api/v1/transactions/import-csv`
- `POST /api/v1/je-drafts/generate`
- `POST /api/v1/journal-entries/from-draft/{draft_id}`
- `GET /api/v1/ledger/general`
- `GET /api/v1/reports/balance-sheet`
- `GET /api/v1/reports/income-statement`
- `GET /api/v1/reports/export-tax-package`
- `POST /api/v1/periods/{yyyymm}/close`

## Input CSV Format

Headers expected:
- `date` (YYYY-MM-DD)
- `description`
- `amount`
- optional `currency`

## Deployment Targets

- API: FastAPI Cloud
- Web: Cloudflare
