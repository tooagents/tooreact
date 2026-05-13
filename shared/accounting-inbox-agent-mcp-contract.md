# Accounting Inbox Agent/MCP Contract

Date: 2026-05-12

This document is the cross-domain contract for the accounting inbox chat flow.
The current business behavior is intentionally simple; the important part is that
each boundary has a stable request, response, and auth rule.

## Services

| Layer | Repo | Responsibility |
| --- | --- | --- |
| Frontend | `A:\tooreact` | Collect user input, call core, show success/error, refresh transactions. |
| Core proxy | `A:\toocore` | Frontend-facing proxy for agent calls. Adds internal service trust header. |
| Agent | `A:\tooagent` | Chat contract, tool routing, direct tool calls, trace wrapping. |
| MCP | `A:\toomcp` | Tool registry and tool execution surface. May run native tools or forward to core. |
| Core callback | `A:\toocore` | Owns accounting DB write, tenant/user JWT interpretation, OpenAI accounting generation. |

## Auth Contract

All protected cross-service calls carry two trust signals:

| Header | Set by | Used by | Purpose |
| --- | --- | --- | --- |
| `Authorization: Bearer <jwt>` | frontend, then forwarded | agent, MCP, core callback | User identity, tenant, business, user id. |
| `X-Internal-Service-Key: <shared-secret>` | core proxy, then BearerBridge forwarding | agent, MCP, core callback | Service-to-service trust. |

Rules:

- Frontend sends only the user bearer token.
- Core proxy is the first service allowed to add `X-Internal-Service-Key`.
- Agent and MCP require both user JWT and internal service key.
- MCP forwards both headers to core callback.
- Core callback validates the JWT with `get_zjwt` and validates the internal key with `_require_internal_service`.

If `INTERNAL_SERVICE_KEY` is missing in agent or MCP, BearerBridge rejects protected routes with `403`.

## Primary Frontend Flow

### Branch A: Inbox direct accounting tool

This is the current `Inbox.tsx` path.

```text
Inbox.tsx
  -> inboxAPI.addToInbox(message)
  -> POST core /too/proxy/chat
  -> POST agent /chat
  -> GET  MCP /list_tools
  -> POST MCP /call_tool
  -> POST core /too/mcpcallback/transaction2je
  -> DB commit
  <- response bubbles back through the same HTTP chain
```

Frontend request to core:

```http
POST /too/proxy/chat
Content-Type: application/json
Authorization: Bearer <jwt>
```

```json
{
  "tool_choice": "tool_transaction2je",
  "arguments": {
    "message": "Uber 23 yesterday"
  }
}
```

Current frontend behavior:

- Waits for successful JSON response.
- Ignores response body.
- Shows `Added to inbox: <message>`.
- Calls `/acc/get_transactions?limit=200` to reload displayed rows.

Recommended frontend-facing response shape:

```json
{
  "ok": true,
  "message": "Added to inbox",
  "tool": "tool_transaction2je",
  "transaction_id": "uuid",
  "journal_entry_id": "uuid"
}
```

Current actual response is agent-shaped and includes `answer`, `tool`, `arguments`,
`result`, and `trace`. React should not depend on that internal shape.

## Core Proxy Contract

Routes:

- `POST /too/proxy/chat`
- `POST /too/proxy/run_tool`
- `GET /too/proxy/diagnostics`

Responsibilities:

- Accept frontend call.
- Preserve `Authorization` if present.
- Add `X-Internal-Service-Key` if configured.
- Forward to configured `TOO_AGENT_API`.
- Return downstream JSON or surface downstream error.

Current behavior:

```text
POST /too/proxy/chat -> POST {TOO_AGENT_API}/chat
POST /too/proxy/run_tool -> POST {TOO_AGENT_API}/run_tool
GET /too/proxy/diagnostics -> GET {TOO_AGENT_API}/diagnose_mcp
```

Recommendation:

- Keep downstream trace for diagnostics, but normalize frontend responses for product UI routes.
- If normalization is added, do it in core proxy because it is the frontend-facing boundary.

## Agent Contract

Routes:

- `POST /chat`
- `POST /run_tool`
- `GET /diagnose_mcp`
- `GET /health`

Protected routes require:

- `Authorization`
- `X-Internal-Service-Key`

### Branch B: Direct tool via chat

Request:

```json
{
  "tool_choice": "tool_transaction2je",
  "arguments": {
    "message": "Uber 23 yesterday"
  }
}
```

Agent behavior:

1. Lowercases and trims `tool_choice`.
2. Calls MCP `/list_tools`.
3. If `tool_choice` exists in MCP tools, calls MCP `/call_tool`.
4. Wraps result with answer/tool/arguments/result/trace.

Response shape:

```json
{
  "answer": "string",
  "tool": "tool_transaction2je",
  "arguments": {
    "message": "Uber 23 yesterday"
  },
  "result": {},
  "trace": []
}
```

### Branch C: Direct tool via run_tool

Request:

```json
{
  "tool": "tool_transaction2je",
  "arguments": {
    "message": "Uber 23 yesterday"
  }
}
```

Agent behavior:

1. Calls MCP `/list_tools`.
2. Calls MCP `/call_tool` with `name`.
3. Wraps result with answer/tool/arguments/result/trace.

Use this branch for testing exact tools without chat semantics.

### Branch D: Auto routing

Request:

```json
{
  "tool_choice": "auto",
  "arguments": {
    "message": "vendor: acme supplies"
  }
}
```

Current deterministic routing:

| Message contains | Tool selected | Arguments |
| --- | --- | --- |
| `vendor` | `lookup_vendor` | `{ "name": "..." }` |
| `bank` or `account` | `query_bank` | `{ "account_name": "..." }` |
| `ocr` | `ocr_extract` | `{ "text": "..." }` |
| `tool1` | `tool1` | `{ "message": "..." }` |
| `tool2` | `tool2` | `{}` |
| no match | no tool | answer only |

Unknown `tool_choice` also falls back to this auto planner.

### Branch E: Plain chat

Request:

```json
{
  "tool_choice": "plain",
  "arguments": {
    "message": "hello"
  }
}
```

Agent behavior:

- Does not call MCP.
- Returns a plain answer and trace.

Response:

```json
{
  "answer": "No tool call requested for: hello",
  "trace": []
}
```

## MCP Contract

Routes:

- `GET /list_tools`
- `POST /call_tool`
- `GET /config`
- `GET /health`

Protected routes:

- `/list_tools`
- `/call_tool`
- `/config`

Unprotected route:

- `/health`

### List tools

Request:

```http
GET /list_tools
Authorization: Bearer <jwt>
X-Internal-Service-Key: <shared-secret>
```

Response:

```json
{
  "tools": [
    {
      "name": "tool_transaction2je",
      "description": "Forward a natural language transaction message...",
      "input_schema": {
        "type": "object",
        "properties": {
          "message": { "type": "string" }
        },
        "required": ["message"]
      }
    }
  ]
}
```

### Call tool

MCP accepts either `name` or `tool_choice` as the tool name.

Preferred request:

```json
{
  "name": "tool_transaction2je",
  "arguments": {
    "message": "Uber 23 yesterday"
  }
}
```

Legacy-compatible request:

```json
{
  "tool_choice": "tool_transaction2je",
  "arguments": {
    "message": "Uber 23 yesterday"
  }
}
```

Response:

```json
{
  "tool": "tool_transaction2je",
  "arguments": {
    "message": "Uber 23 yesterday"
  },
  "result": {}
}
```

## MCP Tool Execution Branches

| Tool | Execution style | Downstream call |
| --- | --- | --- |
| `tool1` | MCP-native | No downstream backend call. |
| `lookup_vendor` | Core-forwarded | `GET {BACKEND_BASE_URL}/too/mcp/vendors/lookup?name=...` |
| `query_bank` | Core-forwarded | `GET {BACKEND_BASE_URL}/bank/query?account_name=...` |
| `ocr_extract` | Core-forwarded | `POST {BACKEND_BASE_URL}/ocr/extract` |
| `tool2` | Core-forwarded health demo | `GET {BACKEND_BASE_URL}/health` |
| `tool_transaction2je` | Core-forwarded accounting write | `POST {BACKEND_BASE_URL}/too/mcpcallback/transaction2je` |

Known mismatch to clean up:

- `tool_transaction2je` points to the current core callback route.
- Some older docs mention `/accounting/post-transaction-journal-entry`; that is stale for this code path.
- Core currently registers vendor/bank/OCR callback routes under `/too/mcpcallback/...`, but MCP currently forwards:
  - `lookup_vendor` to `/too/mcp/vendors/lookup`
  - `query_bank` to `/bank/query`
  - `ocr_extract` to `/ocr/extract`
- Those demo tools should be reviewed for route prefix consistency before being treated as production contracts.

## Core Callback Contract

Route:

- `POST /too/mcpcallback/transaction2je`

Request:

```http
POST /too/mcpcallback/transaction2je
Content-Type: application/json
Authorization: Bearer <jwt>
X-Internal-Service-Key: <shared-secret>
```

```json
{
  "message": "Uber 23 yesterday"
}
```

Responsibilities:

- Validate internal service key.
- Validate user JWT.
- Extract tenant/business/user context.
- Load chart of accounts.
- Ask OpenAI to generate transaction and journal-entry insert statements.
- Validate generated SQL target tables, columns, params, and balanced journal lines.
- Execute inserts.
- Commit DB transaction.
- Return accounting result.

Response:

```json
{
  "message": "Uber 23 yesterday",
  "transaction_id": "uuid",
  "journal_entry_id": "uuid",
  "transaction": {},
  "journal_lines": [],
  "statement_count": 3
}
```

Errors:

| Status | Cause |
| --- | --- |
| `400` | Empty message, missing tenant id, no accounts, invalid generated SQL, unbalanced lines. |
| `401` | Missing or invalid bearer token. |
| `403` | Invalid internal service key. |
| `502` | OpenAI request failed or returned invalid JSON. |
| `503` | `OPENAI_API_KEY` is not configured. |

## Response Ownership

The frontend receives one HTTP response from core proxy. The response is created by the deepest successful service and wrapped while bubbling upward:

```text
core callback creates accounting result
MCP wraps it as tool result
agent wraps it as chat/run_tool result
core proxy returns it to frontend
```

No separate frontend callback is needed while every layer awaits and returns the downstream call.

If any layer later switches to background execution, the contract must change to:

```json
{
  "ok": true,
  "job_id": "uuid",
  "status": "queued"
}
```

and the frontend will need polling, websocket, or server-sent events.

## Recommended Stable Product Contract

For product pages like accounting inbox, use this stable core proxy response:

Success:

```json
{
  "ok": true,
  "message": "Added to inbox",
  "transaction_id": "uuid",
  "journal_entry_id": "uuid"
}
```

Failure:

```json
{
  "ok": false,
  "message": "Failed to add inbox message",
  "error_code": "UPSTREAM_TIMEOUT",
  "details": {}
}
```

Keep full agent/MCP `trace` available only for diagnostics or debug routes.

## Timeout Contract

Current defaults:

| Hop | Timeout |
| --- | --- |
| core proxy -> agent | 60 seconds |
| agent -> MCP | 20 seconds |
| MCP -> core callback | 15 seconds |
| core callback -> OpenAI | 30 seconds |

Recommended:

- The outer timeout must be greater than all inner work.
- MCP timeout should be greater than the core callback OpenAI timeout plus DB work.
- Agent timeout should be greater than MCP timeout.
- Core proxy timeout should be greater than agent timeout.

## Adding A New Tool

1. Add tool metadata in `toomcp/mcp_service/core/tool_registry.py`.
2. Choose execution style:
   - MCP-native: implement in `ToolService`.
   - Core-forwarded: add dispatch in `BackendClient`.
3. If core-forwarded, add the core callback route and response shape.
4. Update this contract with:
   - request JSON
   - response JSON
   - auth requirement
   - timeout expectation
   - whether frontend may depend on the result shape
