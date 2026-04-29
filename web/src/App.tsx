import { useEffect, useMemo, useState } from "react";

import { api, ApiContext } from "./api";

type Tab = "inbox" | "entries" | "ledger" | "reports" | "close";

const defaultBase = import.meta.env.VITE_API_BASE || "http://localhost:8000/api/v1";

function formatMoney(value: number | string) {
  const n = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(Number.isFinite(n) ? n : 0);
}

export default function App() {
  const [tab, setTab] = useState<Tab>("inbox");
  const [baseUrl, setBaseUrl] = useState(localStorage.getItem("tooacc_base") || defaultBase);
  const [ownerId, setOwnerId] = useState(localStorage.getItem("tooacc_owner") || "");
  const [msg, setMsg] = useState("");
  const ctx: ApiContext = useMemo(() => ({ baseUrl, ownerId }), [baseUrl, ownerId]);

  const saveSettings = () => {
    localStorage.setItem("tooacc_base", baseUrl);
    localStorage.setItem("tooacc_owner", ownerId);
    setMsg("Settings saved.");
  };

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>TooAcc</h1>
          <p>AI-first accounting for teams of one</p>
        </div>
        <div className="settings">
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="API base URL" />
          <input value={ownerId} onChange={(e) => setOwnerId(e.target.value)} placeholder="Owner UUID (optional in dev)" />
          <button onClick={saveSettings}>Save</button>
        </div>
      </header>
      <nav className="tabs">
        {(["inbox", "entries", "ledger", "reports", "close"] as Tab[]).map((name) => (
          <button key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}>
            {name}
          </button>
        ))}
      </nav>
      {msg && <div className="notice">{msg}</div>}
      <main className="panel">
        {tab === "inbox" && <Inbox ctx={ctx} setMsg={setMsg} />}
        {tab === "entries" && <Entries ctx={ctx} setMsg={setMsg} />}
        {tab === "ledger" && <Ledger ctx={ctx} setMsg={setMsg} />}
        {tab === "reports" && <Reports ctx={ctx} setMsg={setMsg} />}
        {tab === "close" && <ClosePeriod ctx={ctx} setMsg={setMsg} />}
      </main>
    </div>
  );
}

function Inbox({ ctx, setMsg }: { ctx: ApiContext; setMsg: (v: string) => void }) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const [tx, accts] = await Promise.all([api.listTransactions(ctx), api.listAccounts(ctx)]);
      setTransactions(tx);
      setAccounts(accts);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const applyCoa = async () => {
    try {
      const res = await api.applyGenericCoa(ctx);
      setMsg(`COA applied. Created ${res.created}, existing ${res.existing}.`);
      await refresh();
    } catch (e: any) {
      setMsg(e.message);
    }
  };

  const upload = async () => {
    if (!file) return;
    try {
      const res = await api.importCsv(ctx, file);
      setMsg(`Imported ${res.imported_count}, duplicates ${res.duplicate_count}.`);
      await refresh();
    } catch (e: any) {
      setMsg(e.message);
    }
  };

  return (
    <section>
      <h2>Inbox</h2>
      <div className="row">
        <button onClick={applyCoa}>Apply Generic COA</button>
        <button onClick={refresh} disabled={loading}>
          Refresh
        </button>
      </div>
      <p>Accounts: {accounts.length}</p>
      <div className="row">
        <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <button onClick={upload} disabled={!file}>
          Upload CSV
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id}>
              <td>{t.txn_date}</td>
              <td>{t.description}</td>
              <td>{formatMoney(t.amount)}</td>
              <td>{t.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Entries({ ctx, setMsg }: { ctx: ApiContext; setMsg: (v: string) => void }) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});

  const refresh = async () => {
    try {
      let accounts = await api.listAccounts(ctx);
      if (accounts.length === 0) {
        await api.applyGenericCoa(ctx);
        accounts = await api.listAccounts(ctx);
        setMsg("No accounts found. Applied generic COA automatically.");
      }

      const [tx, dr] = await Promise.all([api.listTransactions(ctx), api.listDrafts(ctx)]);
      const activeTx = tx.filter((t) => t.status !== "posted");
      const draftedTxIds = new Set(dr.map((d) => d.transaction_id).filter(Boolean));
      const missingDraftTx = activeTx.filter((t) => !draftedTxIds.has(t.id));
      setTransactions(missingDraftTx);
      setDrafts(dr);
      const toGenerate = missingDraftTx;
      if (toGenerate.length === 0) {
        setDraftErrors({});
        return;
      }

      setAutoGenerating(true);
      let success = 0;
      let failed = 0;
      const errors: Record<string, string> = {};
      for (const txn of toGenerate) {
        try {
          await api.generateDraft(ctx, txn.id);
          success += 1;
        } catch (e: any) {
          // Keep going so one failed transaction does not block the rest.
          failed += 1;
          errors[txn.id] = e?.message || "Draft generation failed";
        }
      }
      const [tx2, dr2] = await Promise.all([api.listTransactions(ctx), api.listDrafts(ctx)]);
      const draftedTxIds2 = new Set(dr2.map((d) => d.transaction_id).filter(Boolean));
      setTransactions(tx2.filter((t) => t.status !== "posted" && !draftedTxIds2.has(t.id)));
      setDrafts(dr2);
      setDraftErrors(errors);
      if (failed > 0) {
        setMsg(`Auto-generated ${success} draft(s), ${failed} failed.`);
      } else {
        setMsg(`Auto-generated ${success} draft(s).`);
      }
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setAutoGenerating(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.baseUrl, ctx.ownerId]);

  const post = async (draftId: string) => {
    try {
      await api.postFromDraft(ctx, draftId);
      setMsg("Draft posted to ledger.");
      await refresh();
    } catch (e: any) {
      setMsg(e.message);
    }
  };

  return (
    <section>
      <h2>Entries</h2>
      <button onClick={refresh} disabled={autoGenerating}>
        {autoGenerating ? "Auto-generating..." : "Refresh"}
      </button>
      <h3>Transactions Needing Draft</h3>
      <ul>
        {transactions.map((t) => (
          <li key={t.id}>
            {t.txn_date} | {t.description} | {formatMoney(t.amount)}
            {draftErrors[t.id] ? <div className="error-text">Reason: {draftErrors[t.id]}</div> : null}
          </li>
        ))}
      </ul>
      <h3>Drafts</h3>
      <div>
        {drafts.map((d) => (
          <div className="card" key={d.id}>
            <div>
              <b>{d.memo || "No memo"}</b> | confidence {Number(d.confidence).toFixed(2)}
            </div>
            <div>{d.rationale}</div>
            <ul>
              {d.lines.map((line: any) => (
                <li key={line.id}>
                  {line.line_type} | {formatMoney(line.amount)} | {line.account_id}
                </li>
              ))}
            </ul>
            <button onClick={() => post(d.id)}>Post</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function Ledger({ ctx, setMsg }: { ctx: ApiContext; setMsg: (v: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const load = async () => {
    try {
      const data = await api.getLedger(ctx);
      setRows(data.rows);
    } catch (e: any) {
      setMsg(e.message);
    }
  };
  return (
    <section>
      <h2>General Ledger</h2>
      <button onClick={load}>Refresh</button>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Account</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Running</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={idx}>
              <td>{r.entry_date}</td>
              <td>
                {r.code} {r.name}
              </td>
              <td>{r.line_type}</td>
              <td>{formatMoney(r.amount)}</td>
              <td>{formatMoney(r.running_balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Reports({ ctx, setMsg }: { ctx: ApiContext; setMsg: (v: string) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7).replace("-", ""));
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(today);
  const [tb, setTb] = useState<any[]>([]);
  const [bs, setBs] = useState<any | null>(null);
  const [isData, setIsData] = useState<any | null>(null);

  const load = async () => {
    try {
      const [tbRes, bsRes, isRes] = await Promise.all([
        api.getTrialBalance(ctx, period),
        api.getBalanceSheet(ctx, toDate),
        api.getIncomeStatement(ctx, fromDate, toDate)
      ]);
      setTb(tbRes.rows);
      setBs(bsRes);
      setIsData(isRes);
    } catch (e: any) {
      setMsg(e.message);
    }
  };

  const exportZip = async () => {
    try {
      const res = await fetch(`${ctx.baseUrl}/reports/export-tax-package?period_yyyymm=${period}`, {
        headers: ctx.ownerId ? { "X-Owner-Id": ctx.ownerId } : {}
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tax_package_${period}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setMsg(e.message);
    }
  };

  return (
    <section>
      <h2>Reports</h2>
      <div className="row">
        <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="YYYYMM" />
        <input value={fromDate} onChange={(e) => setFromDate(e.target.value)} type="date" />
        <input value={toDate} onChange={(e) => setToDate(e.target.value)} type="date" />
        <button onClick={load}>Load</button>
        <button onClick={exportZip}>Export Tax Package</button>
      </div>
      <h3>Trial Balance</h3>
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Debit</th>
            <th>Credit</th>
          </tr>
        </thead>
        <tbody>
          {tb.map((r) => (
            <tr key={r.account_id}>
              <td>{r.code}</td>
              <td>{r.name}</td>
              <td>{formatMoney(r.debit)}</td>
              <td>{formatMoney(r.credit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {bs && (
        <div className="row-grid">
          <ReportBlock title="Assets" rows={bs.assets} />
          <ReportBlock title="Liabilities" rows={bs.liabilities} />
          <ReportBlock title="Equity" rows={bs.equity} />
        </div>
      )}
      {isData && (
        <div className="row-grid">
          <ReportBlock title="Revenue" rows={isData.revenue} />
          <ReportBlock title="Expenses" rows={isData.expenses} />
        </div>
      )}
    </section>
  );
}

function ReportBlock({ title, rows }: { title: string; rows: any[] }) {
  return (
    <div className="card">
      <h4>{title}</h4>
      <ul>
        {rows.map((r) => (
          <li key={r.account_id}>
            {r.code} {r.name} | {formatMoney(r.amount)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ClosePeriod({ ctx, setMsg }: { ctx: ApiContext; setMsg: (v: string) => void }) {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7).replace("-", ""));

  const close = async () => {
    try {
      const res = await api.closePeriod(ctx, period);
      setMsg(`Period ${res.period_yyyymm} closed.`);
    } catch (e: any) {
      setMsg(e.message);
    }
  };
  const reopen = async () => {
    try {
      const res = await api.reopenPeriod(ctx, period);
      setMsg(`Period ${res.period_yyyymm} reopened.`);
    } catch (e: any) {
      setMsg(e.message);
    }
  };
  return (
    <section>
      <h2>Close Period</h2>
      <div className="row">
        <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="YYYYMM" />
        <button onClick={close}>Close</button>
        <button onClick={reopen}>Reopen</button>
      </div>
    </section>
  );
}
