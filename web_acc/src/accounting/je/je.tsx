import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';
import BreadcrumbComp from 'src/_layouts/shared/breadcrumb/BreadcrumbComp';
import LoadingSpinner from 'src/components/shared/LoadingSpinner';
import { Badge } from 'src/components/ui/badge';
import { Button } from 'src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/ui/card';
import { Input } from 'src/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'src/components/ui/select';
import { Table, TBody, TCell, THead, THeader, TRow } from 'src/components/ui/table';
import { formatMoney } from 'src/core/format';
import { AccountRow, jeAPI, JournalEntryLine, JournalEntryRow } from 'src/accounting/je/je-api';

const BCrumb = [{ to: '/', title: 'Home' }, { title: 'Entries' }];

type JournalLineDraft = {
    client_id: string;
    id?: string | null;
    account_id: string;
    line_type: 'debit' | 'credit';
    amount: string;
    description: string;
};

type JournalEntryDraft = {
    entry_date: string;
    memo: string;
    lines: JournalLineDraft[];
};

const getAccountLabel = (account: AccountRow) => {
    const code = String(account.account_code ?? account.code ?? account.coa_code ?? '').trim();
    const name = String(account.account_name ?? account.name ?? account.title ?? '').trim();

    if (code && name) return `${code} - ${name}`;
    if (name) return name;
    if (code) return code;
    return String(account.id);
};

const getLineAccountLabel = (line: JournalEntryLine, accountLabelById: Record<string, string>) => {
    const accountCode = String(line.account_code ?? '').trim();
    const accountName = String(line.account_name ?? '').trim();
    const accountLabel = String(line.account_label ?? '').trim();
    const accountId = String(line.account_id ?? '').trim();

    if (accountCode && accountName) return `${accountCode} ${accountName}`;
    if (accountCode) return accountCode;
    if (accountName) return accountName;
    if (accountId && accountLabelById[accountId]) return accountLabelById[accountId];
    return accountLabel || accountId || '-';
};

const getEntryTotal = (entry: JournalEntryRow) => {
    const debitLines = (entry.lines ?? []).filter((line) => String(line.line_type ?? '').toLowerCase() === 'debit');
    const totalLines = debitLines.length > 0 ? debitLines : (entry.lines ?? []);

    return totalLines.reduce((sum, line) => {
        const amount = Number(line.amount ?? 0);
        return Number.isFinite(amount) ? sum + amount : sum;
    }, 0);
};

const getEntryLineTotals = (entry: JournalEntryRow | undefined) => {
    const lines = entry?.lines ?? [];
    const debit = lines.reduce((sum, line) => {
        const amount = Number(line.amount ?? 0);
        return String(line.line_type ?? '').toLowerCase() === 'debit' && Number.isFinite(amount)
            ? sum + amount
            : sum;
    }, 0);
    const credit = lines.reduce((sum, line) => {
        const amount = Number(line.amount ?? 0);
        return String(line.line_type ?? '').toLowerCase() === 'credit' && Number.isFinite(amount)
            ? sum + amount
            : sum;
    }, 0);

    return {
        debit,
        credit,
        difference: debit - credit,
    };
};

const getEntryLabel = (entry: JournalEntryRow) => {
    const entryNo = String(entry.entry_no ?? '').trim();
    return entryNo ? `JE-${entryNo}` : entry.id.slice(0, 8);
};

const getDisplayStatus = (entry: JournalEntryRow) => {
    const status = String(entry.status ?? '').trim();
    if (status) return status;
    const period = String(entry.period_yyyymm ?? '').trim();
    return period || 'entry';
};

const toDraft = (entry: JournalEntryRow): JournalEntryDraft => ({
    entry_date: String(entry.entry_date ?? ''),
    memo: String(entry.memo ?? ''),
    lines: (entry.lines ?? []).map((line, index) => ({
        client_id: line.id ?? `${entry.id}-${index}`,
        id: line.id ?? null,
        account_id: String(line.account_id ?? ''),
        line_type: String(line.line_type ?? 'debit').toLowerCase() === 'credit' ? 'credit' : 'debit',
        amount: String(line.amount ?? ''),
        description: String(line.description ?? ''),
    })),
});

const createBlankLine = (): JournalLineDraft => ({
    client_id: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    account_id: '',
    line_type: 'debit',
    amount: '',
    description: '',
});

const getDraftTotals = (draft: JournalEntryDraft | null) => {
    const lines = draft?.lines ?? [];
    const debit = lines.reduce((sum, line) => line.line_type === 'debit' ? sum + (Number(line.amount) || 0) : sum, 0);
    const credit = lines.reduce((sum, line) => line.line_type === 'credit' ? sum + (Number(line.amount) || 0) : sum, 0);
    return {
        debit,
        credit,
        difference: debit - credit,
    };
};

const Entries = () => {
    const [entries, setEntries] = useState<JournalEntryRow[]>([]);
    const [accounts, setAccounts] = useState<AccountRow[]>([]);
    const [accountLabelById, setAccountLabelById] = useState<Record<string, string>>({});
    const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
    const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
    const [entryDraft, setEntryDraft] = useState<JournalEntryDraft | null>(null);
    const [isSavingEntry, setIsSavingEntry] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const refresh = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [existingEntries, accounts] = await Promise.all([
                jeAPI.listEntries(),
                jeAPI.listAccounts(),
            ]);
            console.log('[JE API] /acc/journal-entries response:', existingEntries);
            console.log('[JE API] /acc/accounts response:', accounts);

            const map: Record<string, string> = {};
            for (const account of accounts) {
                if (account?.id) {
                    map[account.id] = getAccountLabel(account);
                }
            }

            setAccountLabelById(map);
            setAccounts(accounts);
            setEntries(existingEntries);
            setSelectedEntryId((currentId) =>
                currentId && existingEntries.some((entry) => entry.id === currentId)
                    ? currentId
                    : existingEntries[0]?.id ?? null,
            );
            setMsg(`Loaded ${existingEntries.length} journal entr${existingEntries.length === 1 ? 'y' : 'ies'}.`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load entries.');
            setAccountLabelById({});
            setAccounts([]);
            setSelectedEntryId(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        refresh();
    }, []);

    const selectedEntry = entries.find((entry) => entry.id === selectedEntryId) ?? entries[0];
    const isEditingSelectedEntry = Boolean(selectedEntry && editingEntryId === selectedEntry.id && entryDraft);
    const selectedEntryTotals = getEntryLineTotals(selectedEntry);
    const draftTotals = getDraftTotals(entryDraft);
    const isDraftBalanced = entryDraft !== null &&
        entryDraft.lines.length > 0 &&
        Math.abs(draftTotals.difference) < 0.005 &&
        draftTotals.debit > 0 &&
        draftTotals.credit > 0;
    const isDraftComplete = entryDraft !== null &&
        entryDraft.lines.every((line) =>
            line.account_id &&
            line.line_type &&
            Number(line.amount) > 0,
        );

    const startEditingEntry = (entry: JournalEntryRow) => {
        setEditingEntryId(entry.id);
        setEntryDraft(toDraft(entry));
        setError(null);
        setMsg(null);
    };

    const cancelEditingEntry = () => {
        setEditingEntryId(null);
        setEntryDraft(null);
    };

    const updateDraftHeader = (field: keyof Omit<JournalEntryDraft, 'lines'>, value: string) => {
        setEntryDraft((current) => current ? { ...current, [field]: value } : current);
    };

    const updateDraftLine = (clientId: string, updates: Partial<JournalLineDraft>) => {
        setEntryDraft((current) => current
            ? {
                ...current,
                lines: current.lines.map((line) =>
                    line.client_id === clientId ? { ...line, ...updates } : line,
                ),
            }
            : current,
        );
    };

    const addDraftLine = () => {
        setEntryDraft((current) => current
            ? { ...current, lines: [...current.lines, createBlankLine()] }
            : current,
        );
    };

    const removeDraftLine = (clientId: string) => {
        setEntryDraft((current) => current
            ? { ...current, lines: current.lines.filter((line) => line.client_id !== clientId) }
            : current,
        );
    };

    const saveEntryDraft = async () => {
        if (!selectedEntry || !entryDraft || !isDraftBalanced || !isDraftComplete) return;

        setIsSavingEntry(true);
        setError(null);
        setMsg(null);
        try {
            const savedEntry = await jeAPI.updateEntry(selectedEntry.id, {
                entry_date: entryDraft.entry_date,
                memo: entryDraft.memo,
                lines: entryDraft.lines.map((line) => ({
                    id: line.id || null,
                    account_id: line.account_id,
                    line_type: line.line_type,
                    amount: Number(line.amount),
                    description: line.description || null,
                })),
            });
            setEntries((current) => current.map((entry) => entry.id === savedEntry.id ? savedEntry : entry));
            setSelectedEntryId(savedEntry.id);
            setEditingEntryId(null);
            setEntryDraft(null);
            setMsg('Journal entry saved.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save journal entry.');
        } finally {
            setIsSavingEntry(false);
        }
    };

    const headBoxes = (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card className="w-[150px] gap-1 p-3 rounded-md shadow-none border-secondary/20 bg-transparent">
                <CardHeader className="p-0 pb-1">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Entries</CardTitle>
                </CardHeader>
                <CardContent className="p-0 text-2xl font-semibold">{entries.length}</CardContent>
            </Card>
        </div>
    );

    return (
        <>
            <BreadcrumbComp title="Entries" items={BCrumb} leftContent={null} rightContent={headBoxes} />
            <div className="flex gap-6 flex-col">
                <Card className="shadow-none border-secondary/20">
                    <CardContent className="p-4 flex flex-col gap-3">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                            <div className="text-sm text-muted-foreground">
                                Journal entries are loaded directly from the ledger.
                            </div>
                            <Button
                                className="h-9 px-5 rounded-full shadow-sm"
                                onClick={refresh}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <LoadingSpinner size="sm" variant="dots" />
                                ) : (
                                    <Icon icon="mdi:refresh" className="h-4 w-4" />
                                )}
                                {isLoading ? 'Refreshing...' : 'Refresh Entries'}
                            </Button>
                        </div>
                        {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
                        {error ? <p className="text-sm text-red-600">Error: {error}</p> : null}
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <Card className="shadow-none border-[#d8c6a1] bg-[#f8f1de]">
                        <CardHeader className="p-4">
                            <CardTitle className="text-base text-[#2b2f38]">Journal Entries</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto border-t border-[#d8c6a1]">
                                <Table>
                                    <THeader>
                                        <TRow className="border-b border-[#d8c6a1]">
                                            <THead className="min-w-24 px-3 text-[#1f3a67]">Entry</THead>
                                            <THead className="min-w-28 px-3 text-[#1f3a67]">Date</THead>
                                            <THead className="min-w-56 px-3 text-[#1f3a67]">Memo</THead>
                                            <THead className="min-w-28 px-3 text-right text-[#1f3a67]">Total</THead>
                                        </TRow>
                                    </THeader>
                                    <TBody>
                                        {entries.map((entry) => {
                                            const isSelected = entry.id === selectedEntry?.id;

                                            return (
                                                <TRow
                                                    key={entry.id}
                                                    role="button"
                                                    tabIndex={0}
                                                    aria-selected={isSelected}
                                                    className={[
                                                        'cursor-pointer border-b border-[#d8c6a1]/70 transition-colors last:border-b-0 hover:bg-[#efe4c7]',
                                                        isSelected ? 'bg-[#efe4c7] shadow-[inset_3px_0_0_#1f3a67]' : '',
                                                    ].filter(Boolean).join(' ')}
                                                    onClick={() => {
                                                        setSelectedEntryId(entry.id);
                                                        if (entry.id !== editingEntryId) cancelEditingEntry();
                                                    }}
                                                    onKeyDown={(event) => {
                                                        if (event.key === 'Enter' || event.key === ' ') {
                                                            event.preventDefault();
                                                            setSelectedEntryId(entry.id);
                                                            if (entry.id !== editingEntryId) cancelEditingEntry();
                                                        }
                                                    }}
                                                >
                                                    <TCell className="px-3 py-3 text-sm font-semibold text-[#1f2f4a]">
                                                        {getEntryLabel(entry)}
                                                    </TCell>
                                                    <TCell className="px-3 py-3 text-sm text-[#506080]">
                                                        {entry.entry_date || '-'}
                                                    </TCell>
                                                    <TCell className="px-3 py-3 text-sm text-[#1f2f4a]">
                                                        <div className="line-clamp-2">{entry.memo || 'No memo'}</div>
                                                    </TCell>
                                                    <TCell className="px-3 py-3 text-right text-sm font-mono tabular-nums text-[#1f2f4a]">
                                                        {formatMoney(getEntryTotal(entry))}
                                                    </TCell>
                                                </TRow>
                                            );
                                        })}
                                        {isLoading ? (
                                            <TRow>
                                                <TCell className="px-3 py-4 text-sm text-[#596986]" colSpan={4}>
                                                    Loading journal entries...
                                                </TCell>
                                            </TRow>
                                        ) : null}
                                    </TBody>
                                </Table>
                            </div>
                            {!isLoading && entries.length === 0 ? (
                                <div className="text-sm text-[#596986] p-2">
                                    No journal entries yet.
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>

                    <Card className="shadow-none border-[#cdd8e8] bg-white">
                        <CardHeader className="p-4 pb-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex flex-col gap-1">
                                    <CardTitle className="text-base text-[#1f2f4a]">Journal Entry</CardTitle>
                                    <p className="text-xs text-[#64748b]">
                                        Review the selected ledger entry before posting changes.
                                    </p>
                                </div>
                                {selectedEntry ? (
                                    <div className="flex shrink-0 items-center gap-2">
                                        {isEditingSelectedEntry ? (
                                            <>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="h-9 rounded-full px-4"
                                                    onClick={cancelEditingEntry}
                                                    disabled={isSavingEntry}
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    type="button"
                                                    className="h-9 rounded-full px-4"
                                                    onClick={saveEntryDraft}
                                                    disabled={isSavingEntry || !isDraftBalanced || !isDraftComplete}
                                                >
                                                    {isSavingEntry ? (
                                                        <Icon icon="mdi:loading" className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Icon icon="mdi:content-save-outline" className="h-4 w-4" />
                                                    )}
                                                    Save
                                                </Button>
                                            </>
                                        ) : (
                                            <Button
                                                type="button"
                                                className="h-9 rounded-full px-4"
                                                onClick={() => startEditingEntry(selectedEntry)}
                                            >
                                                <Icon icon="solar:pen-new-square-broken" className="h-4 w-4" />
                                                Edit
                                            </Button>
                                        )}
                                    </div>
                                ) : null}
                            </div>
                        </CardHeader>
                        <CardContent className="min-h-[220px] border-t border-[#dbe4f0] p-0">
                            {selectedEntry ? (
                                <div className="flex flex-col">
                                    <div className="border-b border-[#dbe4f0] bg-[#f8fafc] p-4">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            {isEditingSelectedEntry && entryDraft ? (
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-[#1f3a67]">
                                                            {getEntryLabel(selectedEntry)}
                                                        </span>
                                                        <Badge className="border-[#b7c7df] bg-white px-2 py-0.5 text-[#335376]">
                                                            {getDisplayStatus(selectedEntry)}
                                                        </Badge>
                                                    </div>
                                                    <Input
                                                        className="mt-1.5 h-7 max-w-full border-[#cbd5e1] bg-white px-2 text-sm font-semibold text-[#172033]"
                                                        value={entryDraft.memo}
                                                        onChange={(event) => updateDraftHeader('memo', event.target.value)}
                                                        placeholder="Memo"
                                                        disabled={isSavingEntry}
                                                    />
                                                    <Input
                                                        type="date"
                                                        className="mt-1 h-7 w-[135px] border-[#cbd5e1] bg-white px-2 text-xs text-[#64748b]"
                                                        value={entryDraft.entry_date}
                                                        onChange={(event) => updateDraftHeader('entry_date', event.target.value)}
                                                        disabled={isSavingEntry}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-[#1f3a67]">
                                                            {getEntryLabel(selectedEntry)}
                                                        </span>
                                                        <Badge className="border-[#b7c7df] bg-white px-2 py-0.5 text-[#335376]">
                                                            {getDisplayStatus(selectedEntry)}
                                                        </Badge>
                                                    </div>
                                                    <div className="mt-2 text-sm font-semibold text-[#172033]">
                                                        {selectedEntry.memo || 'No memo'}
                                                    </div>
                                                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#64748b]">
                                                        <span>{selectedEntry.entry_date || '-'}</span>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-3 gap-2 lg:min-w-[300px]">
                                                <div className="rounded-md border border-[#dbe4f0] bg-white px-3 py-2">
                                                    <div className="text-[11px] font-medium uppercase text-[#64748b]">Debit</div>
                                                    <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-[#172033]">
                                                        {formatMoney(isEditingSelectedEntry ? draftTotals.debit : selectedEntryTotals.debit)}
                                                    </div>
                                                </div>
                                                <div className="rounded-md border border-[#dbe4f0] bg-white px-3 py-2">
                                                    <div className="text-[11px] font-medium uppercase text-[#64748b]">Credit</div>
                                                    <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-[#172033]">
                                                        {formatMoney(isEditingSelectedEntry ? draftTotals.credit : selectedEntryTotals.credit)}
                                                    </div>
                                                </div>
                                                <div className="rounded-md border border-[#dbe4f0] bg-white px-3 py-2">
                                                    <div className="text-[11px] font-medium uppercase text-[#64748b]">Diff</div>
                                                    <div className={`mt-1 font-mono text-sm font-semibold tabular-nums ${Math.abs((isEditingSelectedEntry ? draftTotals : selectedEntryTotals).difference) < 0.005 ? 'text-[#15803d]' : 'text-[#dc2626]'}`}>
                                                        {formatMoney(isEditingSelectedEntry ? draftTotals.difference : selectedEntryTotals.difference)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <THeader>
                                                <TRow className="border-b border-[#dbe4f0] bg-white">
                                                    <THead className="min-w-24 px-4 text-xs uppercase text-[#64748b]">Type</THead>
                                                    <THead className="min-w-48 px-3 text-xs uppercase text-[#64748b]">Account</THead>
                                                    <THead className="min-w-28 px-3 text-right text-xs uppercase text-[#64748b]">Debit</THead>
                                                    <THead className="min-w-28 px-4 text-right text-xs uppercase text-[#64748b]">Credit</THead>
                                                </TRow>
                                            </THeader>
                                            <TBody>
                                                {isEditingSelectedEntry && entryDraft ? (
                                                    entryDraft.lines.map((line) => (
                                                        <TRow key={line.client_id} className="border-b border-[#e2e8f0] last:border-b-0 hover:bg-[#f8fafc]">
                                                            <TCell className="px-4 py-3 text-sm">
                                                                <div className="flex items-center gap-1">
                                                                    <Select
                                                                        value={line.line_type}
                                                                        onValueChange={(value) => updateDraftLine(line.client_id, {
                                                                            line_type: value === 'credit' ? 'credit' : 'debit',
                                                                        })}
                                                                        disabled={isSavingEntry}
                                                                    >
                                                                        <SelectTrigger className={`h-7 w-[72px] rounded-full border-0 px-2 text-xs font-medium shadow-none focus:ring-1 focus:ring-[#b7c7df] ${line.line_type === 'debit' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent className="text-xs">
                                                                            <SelectItem className="py-1 text-xs" value="debit">Debit</SelectItem>
                                                                            <SelectItem className="py-1 text-xs" value="credit">Credit</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                    <button
                                                                        type="button"
                                                                        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#94a3b8] hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-40"
                                                                        onClick={() => removeDraftLine(line.client_id)}
                                                                        disabled={isSavingEntry || entryDraft.lines.length <= 1}
                                                                        aria-label="Remove journal line"
                                                                    >
                                                                        <Icon icon="mdi:trash-can-outline" height={16} />
                                                                    </button>
                                                                </div>
                                                            </TCell>
                                                            <TCell className="px-3 py-3">
                                                                <Select
                                                                    value={line.account_id || undefined}
                                                                    onValueChange={(value) => updateDraftLine(line.client_id, { account_id: value })}
                                                                    disabled={isSavingEntry}
                                                                >
                                                                    <SelectTrigger className="h-8 min-w-48 border-0 bg-transparent px-0 text-sm font-medium text-[#172033] shadow-none focus:ring-1 focus:ring-[#b7c7df]">
                                                                        <SelectValue placeholder="Account" />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="text-xs">
                                                                        {accounts.map((account) => (
                                                                            <SelectItem className="py-1 text-xs" key={account.id} value={account.id}>
                                                                                {getAccountLabel(account)}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </TCell>
                                                            <TCell className="px-3 py-3 text-right">
                                                                {line.line_type === 'debit' ? (
                                                                    <Input
                                                                        type="number"
                                                                        step="0.01"
                                                                        className="ml-auto h-8 w-[112px] border-0 bg-transparent px-0 text-right font-mono text-sm tabular-nums text-[#172033] shadow-none focus-visible:ring-1 focus-visible:ring-[#b7c7df]"
                                                                        value={line.amount}
                                                                        onChange={(event) => updateDraftLine(line.client_id, { amount: event.target.value })}
                                                                        disabled={isSavingEntry}
                                                                    />
                                                                ) : (
                                                                    <span className="font-mono text-sm tabular-nums text-[#94a3b8]">-</span>
                                                                )}
                                                            </TCell>
                                                            <TCell className="px-4 py-3 text-right">
                                                                {line.line_type === 'credit' ? (
                                                                    <Input
                                                                        type="number"
                                                                        step="0.01"
                                                                        className="ml-auto h-8 w-[112px] border-0 bg-transparent px-0 text-right font-mono text-sm tabular-nums text-[#172033] shadow-none focus-visible:ring-1 focus-visible:ring-[#b7c7df]"
                                                                        value={line.amount}
                                                                        onChange={(event) => updateDraftLine(line.client_id, { amount: event.target.value })}
                                                                        disabled={isSavingEntry}
                                                                    />
                                                                ) : (
                                                                    <span className="font-mono text-sm tabular-nums text-[#94a3b8]">-</span>
                                                                )}
                                                            </TCell>
                                                        </TRow>
                                                    ))
                                                ) : (
                                                    (selectedEntry.lines ?? []).map((line, index) => {
                                                        const lineType = String(line.line_type ?? '').toLowerCase();
                                                        const amount = formatMoney(line.amount ?? 0);

                                                        return (
                                                            <TRow
                                                                key={line.id ?? `${selectedEntry.id}-${index}`}
                                                                className="border-b border-[#e2e8f0] last:border-b-0 hover:bg-[#f8fafc]"
                                                            >
                                                                <TCell className="px-4 py-3 text-sm">
                                                                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${lineType === 'debit' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                                                        {line.line_type || '-'}
                                                                    </span>
                                                                </TCell>
                                                                <TCell className="px-3 py-3 text-sm font-medium text-[#172033]">
                                                                    {getLineAccountLabel(line, accountLabelById)}
                                                                </TCell>
                                                                <TCell className="px-3 py-3 text-right text-sm font-mono tabular-nums text-[#172033]">
                                                                    {lineType === 'debit' ? amount : '-'}
                                                                </TCell>
                                                                <TCell className="px-4 py-3 text-right text-sm font-mono tabular-nums text-[#172033]">
                                                                    {lineType === 'credit' ? amount : '-'}
                                                                </TCell>
                                                            </TRow>
                                                        );
                                                    })
                                                )}
                                                {(!isEditingSelectedEntry && (selectedEntry.lines ?? []).length === 0) ||
                                                (isEditingSelectedEntry && entryDraft && entryDraft.lines.length === 0) ? (
                                                    <TRow>
                                                        <TCell className="px-4 py-4 text-sm text-[#64748b]" colSpan={4}>
                                                            No lines found.
                                                        </TCell>
                                                    </TRow>
                                                ) : null}
                                                {isEditingSelectedEntry && entryDraft ? (
                                                    <TRow className="border-t border-[#dbe4f0] bg-[#f8fafc]">
                                                        <TCell className="px-4 py-2" colSpan={4}>
                                                            <div className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                                                                <span className={isDraftBalanced ? 'text-[#15803d]' : 'text-[#dc2626]'}>
                                                                    {isDraftBalanced ? 'Entry is balanced.' : 'Debit and credit totals must match before saving.'}
                                                                </span>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    className="h-7 rounded-full border-[#b7c7df] px-3 text-xs text-[#1f3a67]"
                                                                    onClick={addDraftLine}
                                                                    disabled={isSavingEntry}
                                                                >
                                                                    <Icon icon="mdi:plus" className="h-3.5 w-3.5" />
                                                                    Add line
                                                                </Button>
                                                            </div>
                                                        </TCell>
                                                    </TRow>
                                                ) : null}
                                            </TBody>
                                        </Table>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex min-h-[180px] items-center justify-center text-sm font-medium text-muted-foreground">
                                    Select a journal entry.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
};

export default Entries;
