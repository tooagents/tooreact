export type ApiContext = {
  baseUrl: string;
  ownerId: string;
};

async function request<T>(
  ctx: ApiContext,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = 15000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (ctx.ownerId) {
    headers.set("X-Owner-Id", ctx.ownerId);
  }

  try {
    const res = await fetch(`${ctx.baseUrl}${path}`, { ...init, headers, signal: controller.signal });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`${res.status} ${detail}`);
    }
    const contentType = res.headers.get("Content-Type") || "";
    if (contentType.includes("application/json")) {
      return (await res.json()) as T;
    }
    return (await res.blob()) as T;
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error("Request timed out. Please check backend/OpenAI settings.");
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  health: (ctx: ApiContext) => request<{ status: string }>(ctx, "/healthz"),
  listAccounts: (ctx: ApiContext) => request<any[]>(ctx, "/accounts"),
  createAccount: (ctx: ApiContext, payload: any) => request<any>(ctx, "/accounts", { method: "POST", body: JSON.stringify(payload) }),
  applyGenericCoa: (ctx: ApiContext) => request<{ created: number; existing: number }>(ctx, "/coa/templates/generic/apply", { method: "POST" }),
  listTransactions: (ctx: ApiContext) => request<any[]>(ctx, "/transactions?limit=200"),
  importCsv: (ctx: ApiContext, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<any>(ctx, "/transactions/import-csv", { method: "POST", body: form });
  },
  generateDraft: (ctx: ApiContext, transactionId: string) =>
    request<any>(ctx, "/je-drafts/generate", { method: "POST", body: JSON.stringify({ transaction_id: transactionId }) }),
  listDrafts: (ctx: ApiContext) => request<any[]>(ctx, "/je-drafts"),
  patchDraft: (ctx: ApiContext, draftId: string, payload: any) =>
    request<any>(ctx, `/je-drafts/${draftId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  postFromDraft: (ctx: ApiContext, draftId: string) => request<any>(ctx, `/journal-entries/from-draft/${draftId}`, { method: "POST" }),
  listEntries: (ctx: ApiContext) => request<any[]>(ctx, "/journal-entries?limit=200"),
  getLedger: (ctx: ApiContext) => request<{ rows: any[] }>(ctx, "/ledger/general"),
  getTrialBalance: (ctx: ApiContext, period: string) => request<{ rows: any[] }>(ctx, `/reports/trial-balance?period_yyyymm=${period}`),
  getBalanceSheet: (ctx: ApiContext, asOf: string) => request<any>(ctx, `/reports/balance-sheet?as_of=${asOf}`),
  getIncomeStatement: (ctx: ApiContext, fromDate: string, toDate: string) =>
    request<any>(ctx, `/reports/income-statement?from_date=${fromDate}&to_date=${toDate}`),
  closePeriod: (ctx: ApiContext, period: string) => request<any>(ctx, `/periods/${period}/close`, { method: "POST" }),
  reopenPeriod: (ctx: ApiContext, period: string) => request<any>(ctx, `/periods/${period}/reopen`, { method: "POST" })
};
