import os
from typing import Any

import httpx
from fastmcp import FastMCP

API_BASE = os.getenv("TOOACC_API_BASE", "http://localhost:8000/api/v1")
OWNER_ID = os.getenv("TOOACC_OWNER_ID", "")

mcp = FastMCP("tooacc-mcp")


def _headers() -> dict[str, str]:
    if OWNER_ID:
        return {"X-Owner-Id": OWNER_ID}
    return {}


def _get(path: str) -> Any:
    with httpx.Client(timeout=30.0) as client:
        resp = client.get(f"{API_BASE}{path}", headers=_headers())
        resp.raise_for_status()
        return resp.json()


def _post(path: str, payload: dict[str, Any] | None = None) -> Any:
    with httpx.Client(timeout=30.0) as client:
        resp = client.post(f"{API_BASE}{path}", headers=_headers(), json=payload or {})
        resp.raise_for_status()
        if resp.headers.get("content-type", "").startswith("application/json"):
            return resp.json()
        return {"status": "ok"}


@mcp.tool
def health() -> dict[str, Any]:
    return _get("/healthz")


@mcp.tool
def apply_generic_coa() -> dict[str, Any]:
    return _post("/coa/templates/generic/apply")


@mcp.tool
def list_transactions() -> list[dict[str, Any]]:
    return _get("/transactions?limit=200")


@mcp.tool
def generate_draft(transaction_id: str) -> dict[str, Any]:
    return _post("/je-drafts/generate", {"transaction_id": transaction_id})


@mcp.tool
def list_drafts() -> list[dict[str, Any]]:
    return _get("/je-drafts")


@mcp.tool
def post_draft(draft_id: str) -> dict[str, Any]:
    return _post(f"/journal-entries/from-draft/{draft_id}")


@mcp.tool
def trial_balance(period_yyyymm: int) -> dict[str, Any]:
    return _get(f"/reports/trial-balance?period_yyyymm={period_yyyymm}")


@mcp.tool
def close_period(period_yyyymm: int) -> dict[str, Any]:
    return _post(f"/periods/{period_yyyymm}/close")


if __name__ == "__main__":
    mcp.run()

