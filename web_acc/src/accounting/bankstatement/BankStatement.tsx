import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { Badge } from 'src/components/ui/badge';
import { Button } from 'src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from 'src/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from 'src/components/ui/dropdown-menu';
import { Input } from 'src/components/ui/input';
import { Table, TBody, TCell, THead, THeader, TRow } from 'src/components/ui/table';
import { Textarea } from 'src/components/ui/textarea';
import { formatMoney, toNumber } from 'src/core/format';
import {
    BankTxn,
    InterpretedTxn,
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

type StreamItem = {
    event: string;
    title: string;
    detail?: string;
    tone?: 'ok' | 'warn';
    pending?: boolean; // still being typed — shows the bouncing dots
};

// Editable fields of a bank row (edit dialog draft).
type TxnDraft = {
    txn_date: string;
    description: string;
    // A bank line is a single amount in one direction, not separate debit/credit.
    direction: 'in' | 'out';
    amount: string;
    type: string;
    note: string;
};

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
    // 2+ spaces usually mark column boundaries (Excel / PDF copy).
    const wide = line.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
    if (wide.length >= 2) return wide;
    // Fall back to single-space tokens so key-in and single-space pastes still
    // read — parseRow re-joins the leading text back into the description.
    return line.split(/\s+/).map((c) => c.trim()).filter(Boolean);
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
/* Live "AI-like" interpretation (mirrors WorkSpace composer)          */
/* ------------------------------------------------------------------ */

const money = (v: number | null) => (v == null ? null : formatMoney(v));

// One parsed row → a human-readable line describing how it was read.
const describeRow = (row: ParsedRow): StreamItem => {
    const dir =
        row.credit != null
            ? `+${money(row.credit)} in`
            : row.debit != null
            ? `-${money(row.debit)} out`
            : '—';
    const bal = row.balance != null ? ` · balance ${money(row.balance)}` : '';
    return {
        event: 'row_read',
        title: `${row.txn_date ?? '(no date)'} · ${row.description}`,
        detail: `${dir} · read as ${row.note}${bal}`,
        tone: row.txn_date ? 'ok' : 'warn',
    };
};

// An AI-interpreted row (strings from the stream) → a stream line.
const describeInterpreted = (row: InterpretedTxn): StreamItem => {
    const credit = row.credit != null ? toNumber(row.credit) : null;
    const debit = row.debit != null ? toNumber(row.debit) : null;
    const balance = row.balance != null ? toNumber(row.balance) : null;
    const cfg = typeConfig(row.type);
    const parts = [
        cfg.label,
        credit != null ? `+${formatMoney(credit)} in` : debit != null ? `-${formatMoney(debit)} out` : '—',
    ];
    if (balance != null) parts.push(`balance ${formatMoney(balance)}`);
    return {
        event: 'row_saved',
        title: `${row.txn_date ?? '(no date)'} · ${row.description}`,
        detail: parts.join(' · '),
        tone: row.txn_date ? 'ok' : 'warn',
    };
};

// SSE status frames from interpret_stream → human stream lines (WorkSpace-style).
const formatBankStatus = (status: string, meta: Record<string, unknown>): StreamItem | null => {
    switch (status) {
        case 'start':
        case 'reading_text':
            return null;
        case 'calling_ai_model':
            return {
                event: status,
                title: 'Calling AI model',
                detail: typeof meta.model === 'string' ? `Model: ${meta.model}` : undefined,
            };
        case 'transactions_found':
            return { event: status, title: `Understood ${String(meta.count ?? 0)} transactions` };
        case 'row_saved':
            return describeInterpreted(meta as unknown as InterpretedTxn);
        case 'import_summary':
            return null;
        default:
            return { event: status, title: status.replace(/_/g, ' ') };
    }
};

/**
 * Build the live interpretation shown on the right as the user types or pastes.
 * Complete lines (anything before the final line break, or all lines when the
 * text ends in a newline) are read into finished items immediately. The final
 * line still being typed shows as a pending "reading…" item so the panel keeps
 * up with each keystroke — like an AI narrating what it sees.
 */
const getLiveInterpretation = (text: string): StreamItem[] => {
    if (text.trim().length === 0) return [];

    const endsComplete = /\r?\n$/.test(text);
    const rawLines = text.split(/\r?\n/);
    const trailing = endsComplete ? '' : rawLines.pop() ?? '';

    const items: StreamItem[] = [];
    rawLines
        .map((l) => l.trim())
        .filter(Boolean)
        .forEach((line, i) => {
            const row = parseRow(line, i);
            if (row) items.push(describeRow(row));
            else items.push({ event: 'row_skip', title: line, detail: 'no amount found — skipped', tone: 'warn' });
        });

    const partial = trailing.trim();
    if (partial) {
        const row = parseRow(partial, items.length);
        items.push(
            row
                ? { ...describeRow(row), event: 'row_reading', pending: true }
                : { event: 'row_reading', title: partial, detail: 'reading…', pending: true },
        );
    }

    return items;
};

/* ------------------------------------------------------------------ */
/* Transaction type visual config                                      */
/* ------------------------------------------------------------------ */

// How each Gemini-assigned type looks and behaves in the ledger.
//  rail   — left accent colour on the row
//  chip   — badge background / text / border
//  icon   — iconify id shown on the rail
//  reconcile — what the detail panel offers for this type
type TypeConfig = {
    label: string;
    icon: string;
    rail: string;
    chip: string;
    reconcile: 'invoice' | 'receipt' | 'none';
};

const TYPE_CONFIG: Record<string, TypeConfig> = {
    invoice: {
        label: 'Invoice',
        icon: 'mdi:file-document-outline',
        rail: '#1f5a34',
        chip: 'border-[#9fca9f] bg-[#e9f5e9] text-[#1f5a34]',
        reconcile: 'invoice',
    },
    expense: {
        label: 'Expense',
        icon: 'mdi:cart-outline',
        rail: '#8a6d3b',
        chip: 'border-[#e0cfa0] bg-[#faf3df] text-[#8a6d3b]',
        reconcile: 'receipt',
    },
    transfer: {
        label: 'Transfer',
        icon: 'mdi:swap-horizontal',
        rail: '#3b5b8a',
        chip: 'border-[#a9bfe0] bg-[#eaf0fb] text-[#3b5b8a]',
        reconcile: 'none',
    },
    opening_balance: {
        label: 'Balance',
        icon: 'mdi:bank-outline',
        rail: '#5a5a5a',
        chip: 'border-[#cbd0d8] bg-[#eef0f3] text-[#4b5563]',
        reconcile: 'none',
    },
    other: {
        label: 'Other',
        icon: 'mdi:help-circle-outline',
        rail: '#94a3b8',
        chip: 'border-[#d3dae3] bg-[#f1f4f8] text-[#64748b]',
        reconcile: 'none',
    },
};

const typeConfig = (type: string | null | undefined): TypeConfig =>
    TYPE_CONFIG[String(type || 'other')] ?? TYPE_CONFIG.other;

// Order shown in the Edit dialog's Type dropdown.
const TYPE_ORDER = ['invoice', 'expense', 'transfer', 'opening_balance', 'other'] as const;

// One-line explanation of what reconcile does for each type's mode.
const RECONCILE_HINT: Record<TypeConfig['reconcile'], string> = {
    invoice: 'Reconcile: link this deposit to invoices.',
    receipt: 'Reconcile: attach a receipt to this expense.',
    none: 'Reconcile: recorded — no match needed.',
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

    // AI-like stream (live interpretation while typing/pasting, then import steps)
    const [streamItems, setStreamItems] = useState<StreamItem[]>([]);

    // Selection + reconcile
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [reconcile, setReconcile] = useState<ReconcileView | null>(null);
    const [reconcileLoading, setReconcileLoading] = useState(false);
    const [checked, setChecked] = useState<Record<string, boolean>>({});
    const [isSaving, setIsSaving] = useState(false);

    // Row actions (3-dot menu): edit dialog + delete confirm
    const [editingTxn, setEditingTxn] = useState<BankTxn | null>(null);
    const [editDraft, setEditDraft] = useState<TxnDraft | null>(null);
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [txnToDelete, setTxnToDelete] = useState<BankTxn | null>(null);
    const [isDeletingTxn, setIsDeletingTxn] = useState(false);

    const parsedPreview = useMemo(() => parsePaste(pasteText), [pasteText]);
    const liveItems = useMemo(() => getLiveInterpretation(pasteText), [pasteText]);

    // Right panel content: live interpretation while composing, the import
    // steps while importing, and the final summary once import finishes.
    const previewItems = useMemo<StreamItem[]>(
        () => (!isImporting && pasteText.trim() ? liveItems : streamItems),
        [isImporting, pasteText, liveItems, streamItems],
    );

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

    // What the detail panel offers for the selected row, driven by its AI type.
    const selectedCfg = useMemo(() => typeConfig(selectedTxn?.type), [selectedTxn?.type]);
    const reconcileMode = selectedCfg.reconcile; // 'invoice' | 'receipt' | 'none'

    // Load invoice candidates only when an invoice row is selected.
    useEffect(() => {
        if (!selectedTxn) {
            setReconcile(null);
            return;
        }
        if (reconcileMode !== 'invoice') {
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
    }, [selectedTxn?.id, reconcileMode]);

    /* ---------------- import (AI interpret paste/type -> DB) ---------------- */

    const importParsed = async () => {
        const text = pasteText.trim();
        if (!text || isImporting) return;
        setIsImporting(true);
        setError(null);
        setMsg(null);
        setStreamItems([]);
        try {
            const result = await oBankAPI.interpretStream(text, (event, payload) => {
                if (event === 'status') {
                    const status = String(payload.status || 'working');
                    const meta =
                        payload.meta && typeof payload.meta === 'object'
                            ? (payload.meta as Record<string, unknown>)
                            : {};
                    const item = formatBankStatus(status, meta);
                    if (item) setStreamItems((prev) => [...prev, item]);
                }
            });
            setStreamItems((prev) => [
                ...prev,
                {
                    event: 'import_done',
                    title: `Imported ${result.imported_count} transaction${
                        result.imported_count === 1 ? '' : 's'
                    }`,
                    tone: 'ok',
                },
            ]);
            setPasteText('');
            setMsg(`Imported ${result.imported_count} transactions.`);
            await refresh(result.first_id);
        } catch (e: any) {
            setStreamItems((prev) => [
                ...prev,
                { event: 'import_error', title: 'Import failed', detail: e?.message, tone: 'warn' },
            ]);
            setError(e?.message || 'Failed to interpret transactions.');
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
            setStreamItems((prev) => [
                ...prev,
                {
                    event: 'reconciled',
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

    /* ---------------- row actions: edit + delete ---------------- */

    const startEditingTxn = (txn: BankTxn) => {
        setSelectedId(txn.id);
        setEditingTxn(txn);
        const credit = toNumber(txn.credit);
        const debit = toNumber(txn.debit);
        // Money out if there's a debit and no credit; otherwise treat as money in.
        const isOut = debit > 0 && credit <= 0;
        const amount = isOut ? debit : credit;
        setEditDraft({
            txn_date: txn.txn_date ?? '',
            description: txn.description ?? '',
            direction: isOut ? 'out' : 'in',
            amount: amount > 0 ? String(amount) : '',
            type: txn.type ?? 'other',
            note: txn.note ?? '',
        });
        setError(null);
        setMsg(null);
    };

    const closeEditDialog = () => {
        if (isSavingEdit) return;
        setEditingTxn(null);
        setEditDraft(null);
    };

    const updateEditDraft = (field: keyof TxnDraft, value: string) => {
        setEditDraft((cur) => (cur ? { ...cur, [field]: value } : cur));
    };

    const saveEditTxn = async () => {
        if (!editingTxn || !editDraft || isSavingEdit) return;
        setIsSavingEdit(true);
        setError(null);
        setMsg(null);
        try {
            const trimmed = (v: string) => (v.trim() ? v.trim() : null);
            const amount = editDraft.amount.trim() ? Number(editDraft.amount) : null;
            await oBankAPI.updateTxn(editingTxn.id, {
                txn_date: trimmed(editDraft.txn_date),
                description: trimmed(editDraft.description),
                // Money in -> credit, money out -> debit; the other side is cleared.
                debit: editDraft.direction === 'out' ? amount : null,
                credit: editDraft.direction === 'in' ? amount : null,
                type: editDraft.type,
                note: editDraft.note.trim(),
            });
            setEditingTxn(null);
            setEditDraft(null);
            setMsg('Bank transaction saved.');
            await refresh(editingTxn.id);
        } catch (e: any) {
            setError(e?.message || 'Failed to save bank transaction.');
        } finally {
            setIsSavingEdit(false);
        }
    };

    const confirmDeleteTxn = async () => {
        if (!txnToDelete || isDeletingTxn) return;
        setIsDeletingTxn(true);
        setError(null);
        setMsg(null);
        try {
            await oBankAPI.deleteTxn(txnToDelete.id);
            const deletedId = txnToDelete.id;
            setTxnToDelete(null);
            setMsg('Bank transaction deleted.');
            setSelectedId((cur) => (cur === deletedId ? null : cur));
            await refresh();
        } catch (e: any) {
            setError(e?.message || 'Failed to delete bank transaction.');
        } finally {
            setIsDeletingTxn(false);
        }
    };

    /* ------------------------------------------------------------------ */
    /* Render                                                              */
    /* ------------------------------------------------------------------ */

    return (
        <>
            {/* Edit dialog */}
            <Dialog open={Boolean(editingTxn)} onOpenChange={(open) => { if (!open) closeEditDialog(); }}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Edit bank transaction</DialogTitle>
                        <DialogDescription>
                            Update the raw bank row. This does not change any linked invoices.
                        </DialogDescription>
                    </DialogHeader>
                    {editDraft ? (
                        <div className="flex flex-col gap-4">
                            {/* Date + Type share a row — both are short, fixed-shape fields. */}
                            <div className="grid grid-cols-2 gap-3">
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Date</span>
                                    <Input
                                        type="date"
                                        value={editDraft.txn_date}
                                        onChange={(e) => updateEditDraft('txn_date', e.target.value)}
                                        disabled={isSavingEdit}
                                    />
                                </label>
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Type</span>
                                    <select
                                        value={editDraft.type}
                                        onChange={(e) => updateEditDraft('type', e.target.value)}
                                        disabled={isSavingEdit}
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {TYPE_ORDER.map((t) => (
                                            <option key={t} value={t}>
                                                {TYPE_CONFIG[t].label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            <p className="-mt-1.5 text-xs text-[#6f7d95]">
                                {RECONCILE_HINT[typeConfig(editDraft.type).reconcile]}
                            </p>

                            {editingTxn && editingTxn.paid_inv_ids.length > 0
                                && typeConfig(editDraft.type).reconcile !== 'invoice' ? (
                                <div className="flex gap-2 rounded-md border border-[#e6c98a] bg-[#fbf3df] px-3 py-2 text-xs text-[#8a6d3b]">
                                    <Icon icon="mdi:alert-outline" className="mt-0.5 h-4 w-4 shrink-0" />
                                    <span>
                                        This deposit is linked to {editingTxn.paid_inv_ids.length} invoice
                                        {editingTxn.paid_inv_ids.length === 1 ? '' : 's'}. Changing the type away from
                                        Invoice keeps those payments but hides the reconcile link — unreconcile first if
                                        you want to release them.
                                    </span>
                                </div>
                            ) : null}

                            <label className="flex flex-col gap-1.5">
                                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Description</span>
                                <Input
                                    value={editDraft.description}
                                    onChange={(e) => updateEditDraft('description', e.target.value)}
                                    placeholder="Bank narration"
                                    disabled={isSavingEdit}
                                />
                            </label>

                            <div className="grid grid-cols-2 gap-3">
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Direction</span>
                                    <div className="inline-flex h-9 w-full overflow-hidden rounded-md border border-input">
                                        <button
                                            type="button"
                                            onClick={() => updateEditDraft('direction', 'in')}
                                            disabled={isSavingEdit}
                                            className={`flex-1 text-sm transition-colors ${editDraft.direction === 'in'
                                                ? 'bg-[#e9f5e9] font-medium text-[#1f5a34]'
                                                : 'text-muted-foreground hover:bg-muted'}`}
                                        >
                                            In
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => updateEditDraft('direction', 'out')}
                                            disabled={isSavingEdit}
                                            className={`flex-1 border-l border-input text-sm transition-colors ${editDraft.direction === 'out'
                                                ? 'bg-[#f7e9e9] font-medium text-[#7a2a2a]'
                                                : 'text-muted-foreground hover:bg-muted'}`}
                                        >
                                            Out
                                        </button>
                                    </div>
                                </label>
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Amount</span>
                                    <div className="relative">
                                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                                        <Input
                                            inputMode="decimal"
                                            value={editDraft.amount}
                                            onChange={(e) => updateEditDraft('amount', e.target.value)}
                                            placeholder="0.00"
                                            disabled={isSavingEdit}
                                            className="w-full pl-7 text-right font-mono text-base tabular-nums"
                                        />
                                    </div>
                                    {editDraft.amount.trim() && !Number.isNaN(Number(editDraft.amount)) ? (
                                        <span className={`text-right font-mono text-xs tabular-nums ${editDraft.direction === 'in' ? 'text-[#1f5a34]' : 'text-[#7a2a2a]'}`}>
                                            {editDraft.direction === 'in' ? '+ ' : '− '}
                                            {formatMoney(Number(editDraft.amount))}
                                        </span>
                                    ) : null}
                                </label>
                            </div>

                            <label className="flex flex-col gap-1.5">
                                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Note</span>
                                <Textarea
                                    value={editDraft.note}
                                    onChange={(e) => updateEditDraft('note', e.target.value)}
                                    placeholder="Add a note for this transaction (optional)"
                                    rows={3}
                                    disabled={isSavingEdit}
                                />
                            </label>
                        </div>
                    ) : null}
                    <DialogFooter className="flex gap-2">
                        <Button type="button" variant="outline" onClick={closeEditDialog} disabled={isSavingEdit}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={saveEditTxn} disabled={isSavingEdit}>
                            {isSavingEdit ? (
                                <Icon icon="mdi:loading" className="h-4 w-4 animate-spin" />
                            ) : (
                                <Icon icon="mdi:content-save-outline" className="h-4 w-4" />
                            )}
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirm dialog */}
            <Dialog
                open={Boolean(txnToDelete)}
                onOpenChange={(open) => { if (!open && !isDeletingTxn) setTxnToDelete(null); }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete transaction?</DialogTitle>
                        <DialogDescription>
                            This removes the bank transaction and releases any invoice payments it reconciled.
                            Confirm to continue.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-2">
                        <Button type="button" variant="outline" onClick={() => setTxnToDelete(null)} disabled={isDeletingTxn}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            className="bg-red-600 text-white hover:bg-red-700"
                            onClick={confirmDeleteTxn}
                            disabled={isDeletingTxn}
                        >
                            {isDeletingTxn ? 'Deleting...' : 'Confirm delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        <div className="flex flex-col gap-6">
            {/* Top row: compose (left) + live AI-like interpretation (right) */}
            <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-2">
                {/* 1. Paste / key-in */}
                <div className="flex h-full min-h-[260px] flex-col gap-3 rounded-md border border-secondary/20 bg-muted/20 p-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Icon icon="mdi:bank-outline" className="h-4 w-4" />
                        Paste or type bank transactions
                    </div>
                    <Textarea
                        className="min-h-[128px] flex-1 resize-none font-mono text-xs"
                        value={pasteText}
                        onChange={(e) => setPasteText(e.target.value)}
                        placeholder={
                            'Paste or key in rows — one per line. Anything works:\n' +
                            '2024-08-04 ACME FAST PAY 9000.00 51000.00\n' +
                            '2024-08-06\tTRANSFER TO SELF\t3000.00\t\t48000.00'
                        }
                        disabled={isImporting}
                    />
                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            className="h-9 rounded-full px-5"
                            onClick={importParsed}
                            disabled={!pasteText.trim() || isImporting}
                        >
                            {isImporting ? (
                                <Icon icon="mdi:loading" className="h-4 w-4 animate-spin" />
                            ) : (
                                <Icon icon="mdi:auto-fix" className="h-4 w-4" />
                            )}
                            {isImporting ? 'Interpreting…' : 'Interpret & import'}
                        </Button>
                        {pasteText.trim() && !isImporting ? (
                            <span className="text-xs text-muted-foreground">
                                {parsedPreview.length > 0
                                    ? `~${parsedPreview.length} row${parsedPreview.length === 1 ? '' : 's'} · AI will confirm`
                                    : 'AI will read this on import'}
                            </span>
                        ) : null}
                    </div>
                    {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
                    {error ? <p className="text-sm text-red-600">Error: {error}</p> : null}
                </div>

                {/* 2. Live interpretation stream */}
                <div className="h-full min-w-0 max-w-full overflow-hidden">
                    <div className="flex h-full min-h-[260px] w-full min-w-0 max-w-full flex-col overflow-hidden rounded-md border border-dashed border-secondary/30 bg-background px-4 py-3 text-xs text-muted-foreground shadow-sm">
                        {previewItems.length > 0 || isImporting ? (
                            <div className="flex min-h-0 flex-1 flex-col gap-3">
                                <div className="flex shrink-0 flex-wrap items-center gap-2">
                                    <span className="max-w-full rounded-full border border-secondary/20 bg-muted/40 px-2 py-1 font-medium text-foreground">
                                        {isImporting ? 'AI stream' : 'Preview'}
                                    </span>
                                    <span>
                                        {isImporting
                                            ? 'Gemini reading & saving each line'
                                            : 'draft reading — AI confirms on import'}
                                    </span>
                                </div>

                                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                                    {previewItems.map((item, index) => (
                                        <div key={`${item.event}-${index}`} className="flex min-w-0 gap-2">
                                            <span
                                                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                                                    item.tone === 'warn' ? 'bg-amber-500' : 'bg-primary/80'
                                                }`}
                                            />
                                            <div className="min-w-0 flex-1">
                                                <p className="flex flex-wrap items-center gap-1.5 break-words text-foreground">
                                                    <span className="font-medium">{item.title}</span>
                                                    {item.detail ? (
                                                        <span className="font-normal text-muted-foreground">
                                                            {item.detail}
                                                        </span>
                                                    ) : null}
                                                    {item.pending ? (
                                                        <span
                                                            className="flex items-center gap-0.5 text-primary"
                                                            aria-label="Reading"
                                                        >
                                                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.2s]" />
                                                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.1s]" />
                                                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
                                                        </span>
                                                    ) : null}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {isImporting ? (
                                    <div className="flex shrink-0 items-center gap-2 border-t border-secondary/10 pt-2 text-muted-foreground">
                                        <Icon icon="mdi:loading" className="h-4 w-4 animate-spin text-primary" />
                                        <span>AI is reading your statement…</span>
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <>
                                <p className="font-medium text-foreground">
                                    Paste or type your bank statement on the left.
                                </p>
                                <p className="mt-2">Each line is read as you go:</p>
                                <div className="mt-1 space-y-1">
                                    <p>"2024-08-04 ACME FAST PAY 9000 51000"</p>
                                    <p>"aug 6 transfer to self -3000"</p>
                                </div>
                                <p className="mt-2">
                                    On import, AI classifies each row — invoice, expense, transfer or opening
                                    balance — and only the matchable ones ask to reconcile.
                                </p>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Master–detail: transactions list (left) + reconcile detail (right) */}
            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">

            {/* 3. Bank transactions (流水账) — card-style rows */}
            <Card className="gap-4 shadow-none border-[#d8c6a1] bg-[#f8f1de]">
                <CardHeader className="p-4 pb-1">
                    <CardTitle className="text-base text-[#2b2f38]">Bank Transactions</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table className="table-fixed">
                            <THeader>
                                <TRow className="border-b border-[#d8c6a1]">
                                    <THead className="h-7 pt-0 pl-4 pr-1 align-middle text-xs font-normal text-[#1f3a67]">
                                        Description
                                    </THead>
                                    <THead className="h-7 w-[76px] pt-0 px-1 text-left align-middle text-xs font-normal text-[#1f3a67]">
                                        Date
                                    </THead>
                                    <THead className="h-7 w-[96px] pt-0 px-1 text-right align-middle text-xs font-normal text-[#1f3a67]">
                                        Amount
                                    </THead>
                                    <THead className="h-7 w-[60px] pt-0 px-1 text-left align-middle text-xs font-normal text-[#1f3a67]">
                                        Type
                                    </THead>
                                    <THead className="h-7 w-[92px] pt-0 px-1 text-right align-middle text-xs font-normal text-[#1f3a67]">
                                        Reconcile
                                    </THead>
                                    <THead className="h-7 w-8 pl-0 pr-1" />
                                </TRow>
                            </THeader>
                            <TBody>
                                {txns.map((t) => {
                                    const isSel = t.id === selectedId;
                                    const cfg = typeConfig(t.type);
                                    const unapplied = num(t.unapplied);
                                    const credit = num(t.credit);
                                    const debit = num(t.debit);
                                    return (
                                        <TRow
                                            key={t.id}
                                            role="button"
                                            tabIndex={0}
                                            aria-selected={isSel}
                                            className={[
                                                'cursor-pointer border-b border-[#d8c6a1]/70 transition-colors last:border-b-0 hover:bg-[#efe4c7]',
                                                isSel ? 'bg-[#efe4c7]' : '',
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
                                            {/* Zone 1 — description */}
                                            <TCell className="min-w-0 py-2.5 pl-4 pr-1 align-middle">
                                                <span className="block truncate text-xs text-[#1f2f4a]">
                                                    {t.description || '(no description)'}
                                                </span>
                                            </TCell>
                                            {/* Zone 2 — date */}
                                            <TCell className="w-[76px] truncate py-2.5 px-1 text-left align-middle font-mono text-[11px] tabular-nums text-[#6f7d95]">
                                                {t.txn_date || '—'}
                                            </TCell>
                                            {/* Zone 3 — amount with direction arrow (balance moved to ⋮) */}
                                            <TCell className="whitespace-nowrap py-2.5 px-1 text-right align-middle">
                                                {credit > 0 ? (
                                                    <div className="font-mono text-xs tabular-nums text-[#1f5a34]">
                                                        ↑ {formatMoney(t.credit)}
                                                    </div>
                                                ) : null}
                                                {debit > 0 ? (
                                                    <div className="font-mono text-xs tabular-nums text-[#7a2a2a]">
                                                        ↓ {formatMoney(t.debit)}
                                                    </div>
                                                ) : null}
                                                {credit <= 0 && debit <= 0 ? (
                                                    <div className="font-mono text-xs tabular-nums text-[#94a3b8]">—</div>
                                                ) : null}
                                            </TCell>
                                            {/* Zone 4 — type */}
                                            <TCell className="w-[60px] truncate py-2.5 px-1 text-left align-middle text-xs text-[#6f7d95]">
                                                {cfg.label}
                                            </TCell>
                                            {/* Zone 5 — reconcile call-to-action, by type */}
                                            <TCell className="overflow-hidden truncate py-2.5 px-1 text-right align-middle text-xs">
                                                {cfg.reconcile === 'none' ? (
                                                    <span className="text-[#94a3b8]">Recorded</span>
                                                ) : cfg.reconcile === 'receipt' ? (
                                                    <span className="text-[#8a6d3b]">Receipt →</span>
                                                ) : t.paid_inv_ids.length > 0 ? (
                                                    <span className="inline-flex items-center justify-end gap-1">
                                                        <Badge className="border-[#9fca9f] bg-[#e9f5e9] text-[#1f5a34]">
                                                            {t.paid_inv_ids.length} inv
                                                        </Badge>
                                                        {unapplied > 0 ? (
                                                            <span className="text-amber-600">{formatMoney(unapplied)}</span>
                                                        ) : (
                                                            <span className="text-[#1f5a34]">✓</span>
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span className="text-[#1f5a34]">Link →</span>
                                                )}
                                            </TCell>
                                            {/* Zone 6 — row actions (balance / edit / delete) */}
                                            <TCell className="w-8 py-2.5 pl-0 pr-1 text-right align-middle">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <button
                                                            type="button"
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#1f3a67] hover:bg-[#efe4c7]"
                                                            aria-label="Bank transaction actions"
                                                            onClick={(e) => e.stopPropagation()}
                                                            onKeyDown={(e) => e.stopPropagation()}
                                                        >
                                                            <Icon icon="mdi:dots-vertical" height={18} />
                                                        </button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-44">
                                                        {t.balance != null ? (
                                                            <div className="px-2 py-1.5 text-left font-mono text-xs tabular-nums text-[#6f7d95]">
                                                                Balance {formatMoney(t.balance)}
                                                            </div>
                                                        ) : null}
                                                        <DropdownMenuItem
                                                            className="flex items-center gap-2"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                startEditingTxn(t);
                                                            }}
                                                        >
                                                            <Icon icon="solar:pen-new-square-broken" height={16} />
                                                            <span>Edit</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="flex items-center gap-2 text-red-600 focus:text-red-600"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setTxnToDelete(t);
                                                            }}
                                                        >
                                                            <Icon icon="solar:trash-bin-minimalistic-outline" height={16} />
                                                            <span>Delete</span>
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
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

            {/* 4. Detail panel — content swaps by the selected row's type */}
            <Card className="shadow-none border-[#d8c6a1] bg-[#f8f1de]">
                <CardHeader className="p-4 pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-col gap-1">
                            <CardTitle className="text-base text-[#2b2f38]">
                                {reconcileMode === 'receipt'
                                    ? 'Attach a Receipt'
                                    : reconcileMode === 'invoice'
                                    ? 'Reconcile to Invoices'
                                    : 'Transaction Detail'}
                            </CardTitle>
                            <p className="text-xs text-[#506080]">
                                {reconcileMode === 'receipt'
                                    ? 'Match this expense to its receipt or bill.'
                                    : reconcileMode === 'invoice'
                                    ? 'Tick the invoices this deposit paid. One deposit can cover several invoices.'
                                    : 'Transfers and opening balances need no matching.'}
                            </p>
                        </div>
                        {selectedTxn ? (
                            <Badge
                                className={`inline-flex items-center gap-1 whitespace-nowrap ${selectedCfg.chip}`}
                            >
                                <Icon icon={selectedCfg.icon} className="h-3.5 w-3.5" />
                                {selectedCfg.label}
                            </Badge>
                        ) : null}
                    </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    {!selectedTxn ? (
                        <div className="flex min-h-[120px] items-center justify-center text-sm text-muted-foreground">
                            Select a bank transaction.
                        </div>
                    ) : reconcileMode === 'none' ? (
                        <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                            <Icon icon={selectedCfg.icon} className="h-7 w-7 text-[#94a3b8]" />
                            <p>
                                {selectedCfg.label === 'Transfer'
                                    ? 'This is a transfer between your own accounts — nothing to reconcile.'
                                    : selectedCfg.label === 'Balance'
                                    ? 'This is an opening balance that seeds the ledger — nothing to reconcile.'
                                    : 'Nothing to reconcile for this transaction.'}
                            </p>
                        </div>
                    ) : reconcileMode === 'receipt' ? (
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#d8c6a1] bg-[#fdf8ec] px-3 py-2 text-sm">
                                <span className="text-[#172033]">
                                    Expense {selectedTxn.txn_date || ''} ·{' '}
                                    <span className="font-mono font-semibold">
                                        {formatMoney(num(selectedTxn.debit))}
                                    </span>
                                </span>
                            </div>
                            <div className="flex min-h-[120px] flex-col items-center justify-center gap-3 rounded-md border border-dashed border-[#e0cfa0] bg-[#fdf8ec]/60 px-4 py-6 text-center text-sm text-muted-foreground">
                                <Icon icon="mdi:receipt-text-outline" className="h-7 w-7 text-[#b99a5e]" />
                                <p>No receipts to match yet.</p>
                                <Button variant="outline" className="h-9 rounded-full px-4" disabled>
                                    <Icon icon="mdi:tray-arrow-up" className="h-4 w-4" />
                                    Upload receipt
                                </Button>
                            </div>
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
        </div>
        </>
    );
};

export default BankStatement;
