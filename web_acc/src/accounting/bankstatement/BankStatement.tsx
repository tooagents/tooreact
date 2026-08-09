import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { Badge } from 'src/components/ui/badge';
import { Button } from 'src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/ui/card';
import { Input } from 'src/components/ui/input';
import { Table, TBody, TCell, THead, THeader, TRow } from 'src/components/ui/table';
import { Textarea } from 'src/components/ui/textarea';
import { formatMoney, toNumber } from 'src/core/format';
import {
    BankTxn,
    oBankAPI,
    ReconcileCandidate,
    ReconcileView,
} from 'src/accounting/bankstatement/o_bank-api';

/* ------------------------------------------------------------------ */
/* Paste parsing (deterministic, client-side)                          */
/* ------------------------------------------------------------------ */

type ParsedRow = {
    key: string;
    txn_date: string | null;
    description: string;
    debit: number | null;
    credit: number | null;
    balance: number | null;
    note: string; // trace note: how this line was read
};

type TraceItem = { title: string; detail?: string; tone?: 'ok' | 'warn' };

const DATE_PATTERNS: Array<(t: string) => string | null> = [
    // 2024-08-23
    (t) => (/^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null),
    // 08/23/2024 or 23/08/2024 -> keep as-is ISO-ish (MM/DD/YYYY assumed)
    (t) => {
        const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (!m) return null;
        const [, a, b, y] = m;
        const year = y.length === 2 ? `20${y}` : y;
        return `${year}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`;
    },
];

const parseDateToken = (token: string): string | null => {
    const t = token.trim();
    for (const p of DATE_PATTERNS) {
        const r = p(t);
        if (r) return r;
    }
    return null;
};

const parseAmount = (token: string | undefined): number | null => {
    if (!token) return null;
    const cleaned = token.replace(/[$,\s]/g, '');
    if (!cleaned || cleaned === '-') return null;
    // Handle (123.45) accounting negatives
    const neg = /^\(.*\)$/.test(cleaned);
    const num = Number(cleaned.replace(/[()]/g, ''));
    if (!Number.isFinite(num)) return null;
    return neg ? -num : num;
};

const splitLine = (line: string): string[] => {
    if (line.includes('\t')) return line.split('\t').map((c) => c.trim());
    if (line.includes(',')) return line.split(',').map((c) => c.trim());
    return line.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
};

/**
 * Best-effort parse of one pasted statement line into a bank transaction.
 * Supported column shapes (after delimiter split):
 *   [date, description, debit, credit, balance]
 *   [date, description, amount, balance]   (sign: -=debit, +=credit)
 *   [date, description, amount]
 */
const parseRow = (line: string, index: number): ParsedRow | null => {
    const cols = splitLine(line);
    if (cols.length < 2) return null;

    const txn_date = parseDateToken(cols[0]);
    const rest = txn_date ? cols.slice(1) : cols;

    // Trailing numeric tokens are amounts; the leading text is the description.
    const numericTail: number[] = [];
    let cut = rest.length;
    for (let i = rest.length - 1; i >= 0; i -= 1) {
        const n = parseAmount(rest[i]);
        if (n === null) break;
        numericTail.unshift(n);
        cut = i;
    }
    const description = rest.slice(0, cut).join(' ').trim() || '(no description)';

    let debit: number | null = null;
    let credit: number | null = null;
    let balance: number | null = null;
    let note = '';

    if (numericTail.length >= 3) {
        // date, desc, debit, credit, balance
        [debit, credit, balance] = numericTail.slice(-3);
        debit = debit || null;
        credit = credit || null;
        note = 'debit/credit/balance';
    } else if (numericTail.length === 2) {
        // date, desc, amount, balance
        const [amount, bal] = numericTail;
        balance = bal;
        if (amount < 0) debit = Math.abs(amount);
        else credit = amount;
        note = 'amount + balance';
    } else if (numericTail.length === 1) {
        const amount = numericTail[0];
        if (amount < 0) debit = Math.abs(amount);
        else credit = amount;
        note = 'single amount';
    } else {
        return null;
    }

    return {
        key: `row-${index}`,
        txn_date,
        description,
        debit,
        credit,
        balance,
        note: txn_date ? note : `${note}, no date`,
    };
};

const parsePaste = (text: string): ParsedRow[] => {
    return text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l, i) => parseRow(l, i))
        .filter((r): r is ParsedRow => r !== null);
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const num = (v: unknown) => toNumber(v);

const BankStatement = () => {
    const [txns, setTxns] = useState<BankTxn[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [msg, setMsg] = useState<string | null>(null);

    // Paste / compose
    const [pasteText, setPasteText] = useState('');
    const [isImporting, setIsImporting] = useState(false);

    // Trace
    const [trace, setTrace] = useState<TraceItem[]>([]);

    // Selection + reconcile
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [reconcile, setReconcile] = useState<ReconcileView | null>(null);
    const [reconcileLoading, setReconcileLoading] = useState(false);
    const [checked, setChecked] = useState<Record<string, boolean>>({});
    const [isSaving, setIsSaving] = useState(false);

    const parsedPreview = useMemo(() => parsePaste(pasteText), [pasteText]);

    const refresh = async (preferId?: string | null) => {
        setLoading(true);
        setError(null);
        try {
            const rows = await oBankAPI.listTxns();
            setTxns(rows);
            setSelectedId((cur) => {
                if (preferId && rows.some((r) => r.id === preferId)) return preferId;
                if (cur && rows.some((r) => r.id === cur)) return cur;
                return rows[0]?.id ?? null;
            });
        } catch (e: any) {
            setError(e?.message || 'Failed to load bank transactions.');
            setTxns([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void refresh();
    }, []);

    const selectedTxn = useMemo(
        () => txns.find((t) => t.id === selectedId) ?? null,
        [txns, selectedId],
    );

    // Load reconcile view whenever a credit row is selected.
    useEffect(() => {
        if (!selectedTxn) {
            setReconcile(null);
            return;
        }
        // Only inflows (credits) reconcile to invoices.
        if (num(selectedTxn.credit) <= 0) {
            setReconcile(null);
            setChecked({});
            return;
        }
        let cancelled = false;
        setReconcileLoading(true);
        oBankAPI
            .getReconcileView(selectedTxn.id)
            .then((view) => {
                if (cancelled) return;
                setReconcile(view);
                const preset: Record<string, boolean> = {};
                view.bank_txn.paid_inv_ids.forEach((id) => {
                    preset[id] = true;
                });
                setChecked(preset);
            })
            .catch((e) => {
                if (!cancelled) setError(e?.message || 'Failed to load reconcile view.');
            })
            .finally(() => {
                if (!cancelled) setReconcileLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [selectedTxn?.id]);

    /* ---------------- import (paste -> DB) ---------------- */

    const importParsed = async () => {
        if (parsedPreview.length === 0 || isImporting) return;
        setIsImporting(true);
        setError(null);
        setMsg(null);
        const newTrace: TraceItem[] = [
            { title: `Split paste → ${parsedPreview.length} rows` },
        ];
        let firstId: string | null = null;
        try {
            for (const row of parsedPreview) {
                const created = await oBankAPI.postTxn({
                    txn_date: row.txn_date,
                    description: row.description,
                    debit: row.debit,
                    credit: row.credit,
                    balance: row.balance,
                    source: 'paste',
                });
                if (!firstId) firstId = created.id;
                const dir =
                    row.credit != null
                        ? `+${formatMoney(row.credit)}`
                        : row.debit != null
                        ? `-${formatMoney(row.debit)}`
                        : '—';
                newTrace.push({
                    title: `${row.txn_date ?? '(no date)'} ${row.description}`,
                    detail: `${dir} · read as ${row.note}`,
                    tone: row.txn_date ? 'ok' : 'warn',
                });
            }
            newTrace.push({ title: `Imported ${parsedPreview.length} transactions`, tone: 'ok' });
            setTrace(newTrace);
            setPasteText('');
            setMsg(`Imported ${parsedPreview.length} transactions.`);
            await refresh(firstId);
        } catch (e: any) {
            newTrace.push({ title: 'Import failed', detail: e?.message, tone: 'warn' });
            setTrace(newTrace);
            setError(e?.message || 'Failed to import transactions.');
        } finally {
            setIsImporting(false);
        }
    };

    /* ---------------- reconcile allocation math ---------------- */

    const depositAmount = num(selectedTxn?.credit);
    const candidates = reconcile?.candidates ?? [];

    // Live allocation: each ticked invoice takes min(its balance_due, remaining deposit).
    const allocation = useMemo(() => {
        let remaining = depositAmount;
        const alloc: Record<string, number> = {};
        for (const c of candidates) {
            if (!checked[c.inv_id]) continue;
            const due = num(c.inv_balance_due ?? c.inv_total);
            const take = Math.max(0, Math.min(due, remaining));
            alloc[c.inv_id] = take;
            remaining = Math.round((remaining - take) * 100) / 100;
        }
        return { alloc, unapplied: Math.max(0, Math.round(remaining * 100) / 100) };
    }, [candidates, checked, depositAmount]);

    const selectedTotal = useMemo(
        () => Object.values(allocation.alloc).reduce((s, v) => s + v, 0),
        [allocation],
    );

    const saveReconcile = async () => {
        if (!selectedTxn || isSaving) return;
        setIsSaving(true);
        setError(null);
        setMsg(null);
        try {
            const allocations = Object.entries(allocation.alloc)
                .filter(([, amt]) => amt > 0)
                .map(([inv_id, pay_amount]) => ({ inv_id, pay_amount }));
            const view = await oBankAPI.reconcile(selectedTxn.id, allocations);
            setReconcile(view);
            setMsg(
                allocation.unapplied > 0
                    ? `Reconciled. ${formatMoney(allocation.unapplied)} left unapplied.`
                    : 'Reconciled — deposit fully applied.',
            );
            setTrace((prev) => [
                ...prev,
                {
                    title: `Reconciled ${selectedTxn.txn_date ?? ''} ${formatMoney(depositAmount)}`,
                    detail: `${allocations.length} invoice(s)${
                        allocation.unapplied > 0 ? ` · unapplied ${formatMoney(allocation.unapplied)}` : ' · exact'
                    }`,
                    tone: 'ok',
                },
            ]);
            await refresh(selectedTxn.id);
        } catch (e: any) {
            setError(e?.message || 'Failed to reconcile.');
        } finally {
            setIsSaving(false);
        }
    };

    /* ------------------------------------------------------------------ */
    /* Render                                                              */
    /* ------------------------------------------------------------------ */

    return (
        <div className="flex flex-col gap-6">
            {/* Top row: paste (left) + trace (right) */}
            <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-2">
                {/* 1. Paste / key-in */}
                <div className="flex h-full min-h-[260px] flex-col gap-3 rounded-md border border-secondary/20 bg-muted/20 p-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Icon icon="mdi:bank-outline" className="h-4 w-4" />
                        Paste bank transactions
                    </div>
                    <Textarea
                        className="min-h-[128px] flex-1 resize-none font-mono text-xs"
                        value={pasteText}
                        onChange={(e) => setPasteText(e.target.value)}
                        placeholder={
                            'Paste rows: date  description  debit  credit  balance\n' +
                            '2024-08-04\tACME FAST PAY\t\t9000.00\t51000.00\n' +
                            '2024-08-06\tTRANSFER TO SELF\t3000.00\t\t48000.00'
                        }
                        disabled={isImporting}
                    />
                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            className="h-9 rounded-full px-5"
                            onClick={importParsed}
                            disabled={parsedPreview.length === 0 || isImporting}
                        >
                            <Icon icon="mdi:table-arrow-down" className="h-4 w-4" />
                            {isImporting ? 'Importing…' : `Parse & import ${parsedPreview.length || ''}`.trim()}
                        </Button>
                        {pasteText.trim() ? (
                            <span className="text-xs text-muted-foreground">
                                {parsedPreview.length} row{parsedPreview.length === 1 ? '' : 's'} detected
                            </span>
                        ) : null}
                    </div>
                    {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
                    {error ? <p className="text-sm text-red-600">Error: {error}</p> : null}
                </div>

                {/* 2. Trace */}
                <div className="flex h-full min-h-[260px] flex-col overflow-hidden rounded-md border border-dashed border-secondary/30 bg-background px-4 py-3 text-xs text-muted-foreground shadow-sm">
                    <div className="mb-2 flex items-center gap-2">
                        <span className="rounded-full border border-secondary/20 bg-muted/40 px-2 py-1 font-medium text-foreground">
                            Trace
                        </span>
                        <span>what happened & why</span>
                    </div>
                    {parsedPreview.length > 0 && !isImporting ? (
                        <div className="mb-2 rounded-md bg-muted/30 px-2 py-1 text-foreground">
                            Preview: {parsedPreview.length} rows ready to import.
                        </div>
                    ) : null}
                    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                        {trace.length === 0 && parsedPreview.length === 0 ? (
                            <div className="space-y-1">
                                <p className="font-medium text-foreground">
                                    Paste your bank statement on the left.
                                </p>
                                <p>Each line is read into the table below (流水账).</p>
                                <p>Select a deposit to link it to invoices.</p>
                            </div>
                        ) : null}
                        {(parsedPreview.length > 0 && trace.length === 0
                            ? parsedPreview.map((r) => ({
                                  title: `${r.txn_date ?? '(no date)'} ${r.description}`,
                                  detail: `${
                                      r.credit != null
                                          ? `+${formatMoney(r.credit)}`
                                          : r.debit != null
                                          ? `-${formatMoney(r.debit)}`
                                          : '—'
                                  } · ${r.note}`,
                                  tone: r.txn_date ? ('ok' as const) : ('warn' as const),
                              }))
                            : trace
                        ).map((item, i) => (
                            <div key={i} className="flex min-w-0 gap-2">
                                <span
                                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                                        item.tone === 'warn' ? 'bg-amber-500' : 'bg-primary/80'
                                    }`}
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="break-words text-foreground">{item.title}</p>
                                    {item.detail ? (
                                        <p className="break-words text-muted-foreground">{item.detail}</p>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 3. Bank transactions (流水账) */}
            <Card className="shadow-none border-[#d8c6a1] bg-[#f8f1de]">
                <CardHeader className="p-4">
                    <CardTitle className="text-base text-[#2b2f38]">Bank Transactions</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <THeader>
                                <TRow className="border-b border-[#d8c6a1]">
                                    <THead className="px-3 text-[#1f3a67]">Date</THead>
                                    <THead className="px-2 text-[#1f3a67]">Description</THead>
                                    <THead className="px-2 text-right text-[#1f3a67]">Debit</THead>
                                    <THead className="px-2 text-right text-[#1f3a67]">Credit</THead>
                                    <THead className="px-2 text-right text-[#1f3a67]">Balance</THead>
                                    <THead className="px-2 text-[#1f3a67]">Applied</THead>
                                </TRow>
                            </THeader>
                            <TBody>
                                {txns.map((t) => {
                                    const isSel = t.id === selectedId;
                                    const isCredit = num(t.credit) > 0;
                                    const applied = num(t.applied_total);
                                    const unapplied = num(t.unapplied);
                                    return (
                                        <TRow
                                            key={t.id}
                                            role="button"
                                            tabIndex={0}
                                            aria-selected={isSel}
                                            className={[
                                                'cursor-pointer border-b border-[#d8c6a1]/70 transition-colors last:border-b-0 hover:bg-[#efe4c7]',
                                                isSel ? 'bg-[#efe4c7] shadow-[inset_3px_0_0_#1f3a67]' : '',
                                            ]
                                                .filter(Boolean)
                                                .join(' ')}
                                            onClick={() => setSelectedId(t.id)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    setSelectedId(t.id);
                                                }
                                            }}
                                        >
                                            <TCell className="px-3 py-3 text-xs text-[#1f2f4a]">
                                                {t.txn_date || '-'}
                                            </TCell>
                                            <TCell className="px-2 py-3 text-sm text-[#1f2f4a]">
                                                {t.description || '(no description)'}
                                            </TCell>
                                            <TCell className="px-2 py-3 text-right font-mono text-sm tabular-nums text-[#7a2a2a]">
                                                {num(t.debit) > 0 ? formatMoney(t.debit) : '—'}
                                            </TCell>
                                            <TCell className="px-2 py-3 text-right font-mono text-sm tabular-nums text-[#1f5a34]">
                                                {num(t.credit) > 0 ? formatMoney(t.credit) : '—'}
                                            </TCell>
                                            <TCell className="px-2 py-3 text-right font-mono text-sm tabular-nums text-[#1f2f4a]">
                                                {t.balance != null ? formatMoney(t.balance) : '—'}
                                            </TCell>
                                            <TCell className="px-2 py-3 text-xs">
                                                {!isCredit ? (
                                                    <span className="text-[#94a3b8]">—</span>
                                                ) : t.paid_inv_ids.length > 0 ? (
                                                    <span className="flex flex-wrap items-center gap-1">
                                                        <Badge className="border-[#9fca9f] bg-[#e9f5e9] text-[#1f5a34]">
                                                            {t.paid_inv_ids.length} inv
                                                        </Badge>
                                                        {unapplied > 0 ? (
                                                            <span className="text-amber-600">
                                                                unapplied {formatMoney(unapplied)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[#1f5a34]">✓</span>
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span className="text-[#8a6d3b]">○ unlinked</span>
                                                )}
                                            </TCell>
                                        </TRow>
                                    );
                                })}
                                {loading ? (
                                    <TRow>
                                        <TCell colSpan={6} className="px-3 py-4 text-sm text-[#596986]">
                                            Loading…
                                        </TCell>
                                    </TRow>
                                ) : null}
                                {!loading && txns.length === 0 ? (
                                    <TRow>
                                        <TCell colSpan={6} className="px-3 py-4 text-sm text-[#596986]">
                                            No bank transactions yet. Paste a statement above.
                                        </TCell>
                                    </TRow>
                                ) : null}
                            </TBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* 4. Reconcile (selected deposit -> invoices) */}
            <Card className="shadow-none border-[#d8c6a1] bg-[#f8f1de]">
                <CardHeader className="p-4 pb-3">
                    <div className="flex flex-col gap-1">
                        <CardTitle className="text-base text-[#2b2f38]">Reconcile to Invoices</CardTitle>
                        <p className="text-xs text-[#506080]">
                            Tick the invoices this deposit paid. One deposit can cover several invoices.
                        </p>
                    </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    {!selectedTxn ? (
                        <div className="flex min-h-[120px] items-center justify-center text-sm text-muted-foreground">
                            Select a bank transaction.
                        </div>
                    ) : num(selectedTxn.credit) <= 0 ? (
                        <div className="flex min-h-[120px] items-center justify-center text-sm text-muted-foreground">
                            This is a debit/transfer — nothing to reconcile to invoices.
                        </div>
                    ) : reconcileLoading ? (
                        <div className="flex min-h-[120px] items-center justify-center text-sm text-muted-foreground">
                            <Icon icon="mdi:loading" className="mr-2 h-4 w-4 animate-spin" /> Loading candidates…
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#d8c6a1] bg-[#fdf8ec] px-3 py-2 text-sm">
                                <span className="text-[#172033]">
                                    Deposit {selectedTxn.txn_date || ''} ·{' '}
                                    <span className="font-mono font-semibold">{formatMoney(depositAmount)}</span>
                                </span>
                                <span
                                    className={
                                        allocation.unapplied > 0 ? 'text-amber-600' : 'text-[#1f5a34]'
                                    }
                                >
                                    Applied {formatMoney(selectedTotal)} / {formatMoney(depositAmount)}
                                    {allocation.unapplied > 0
                                        ? ` · unapplied ${formatMoney(allocation.unapplied)}`
                                        : ' ✓'}
                                </span>
                            </div>

                            <div className="overflow-x-auto rounded-md border border-[#9eb8dc]/70 bg-[#fdf8ec]/70">
                                <Table>
                                    <THeader>
                                        <TRow className="border-b border-[#6fa0d8]/60">
                                            <THead className="w-10 px-2" />
                                            <THead className="px-2 text-xs uppercase text-[#1f3a67]">Invoice</THead>
                                            <THead className="px-2 text-xs uppercase text-[#1f3a67]">Client</THead>
                                            <THead className="px-2 text-right text-xs uppercase text-[#1f3a67]">Total</THead>
                                            <THead className="px-2 text-right text-xs uppercase text-[#1f3a67]">Balance due</THead>
                                            <THead className="px-2 text-right text-xs uppercase text-[#1f3a67]">Will apply</THead>
                                        </TRow>
                                    </THeader>
                                    <TBody>
                                        {candidates.map((c: ReconcileCandidate) => {
                                            const isOn = !!checked[c.inv_id];
                                            const apply = allocation.alloc[c.inv_id] ?? 0;
                                            return (
                                                <TRow
                                                    key={c.inv_id}
                                                    className="border-b border-[#e2e8f0] last:border-b-0 hover:bg-[#f8fafc]"
                                                >
                                                    <TCell className="px-2 py-2">
                                                        <input
                                                            type="checkbox"
                                                            className="h-4 w-4 cursor-pointer"
                                                            checked={isOn}
                                                            onChange={(e) =>
                                                                setChecked((prev) => ({
                                                                    ...prev,
                                                                    [c.inv_id]: e.target.checked,
                                                                }))
                                                            }
                                                        />
                                                    </TCell>
                                                    <TCell className="px-2 py-2 text-xs font-medium text-[#172033]">
                                                        {c.inv_number || c.inv_id.slice(0, 8)}
                                                    </TCell>
                                                    <TCell className="px-2 py-2 text-xs text-[#506080]">
                                                        {c.client_company_name || '—'}
                                                    </TCell>
                                                    <TCell className="px-2 py-2 text-right font-mono text-xs tabular-nums text-[#172033]">
                                                        {formatMoney(c.inv_total)}
                                                    </TCell>
                                                    <TCell className="px-2 py-2 text-right font-mono text-xs tabular-nums text-[#172033]">
                                                        {formatMoney(c.inv_balance_due ?? c.inv_total)}
                                                    </TCell>
                                                    <TCell
                                                        className={`px-2 py-2 text-right font-mono text-xs tabular-nums ${
                                                            apply > 0 ? 'text-[#1f5a34]' : 'text-[#94a3b8]'
                                                        }`}
                                                    >
                                                        {apply > 0 ? formatMoney(apply) : '—'}
                                                    </TCell>
                                                </TRow>
                                            );
                                        })}
                                        {candidates.length === 0 ? (
                                            <TRow>
                                                <TCell colSpan={6} className="px-3 py-4 text-sm text-[#64748b]">
                                                    No outstanding invoices to match.
                                                </TCell>
                                            </TRow>
                                        ) : null}
                                    </TBody>
                                </Table>
                            </div>

                            <div className="flex items-center justify-end gap-2">
                                <Button
                                    className="h-9 rounded-full px-5"
                                    onClick={saveReconcile}
                                    disabled={isSaving}
                                >
                                    {isSaving ? (
                                        <Icon icon="mdi:loading" className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Icon icon="mdi:link-variant" className="h-4 w-4" />
                                    )}
                                    Save reconcile
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default BankStatement;
