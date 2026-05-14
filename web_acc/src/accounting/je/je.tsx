import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';
import BreadcrumbComp from 'src/_layouts/shared/breadcrumb/BreadcrumbComp';
import LoadingSpinner from 'src/components/shared/LoadingSpinner';
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

const getConfidence = (entry: JournalEntryRow) => {
    const value = Number(entry.confidence);
    return Number.isFinite(value) ? value.toFixed(2) : '-';
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

const getEntryLabel = (entry: JournalEntryRow) => {
    const entryNo = String(entry.entry_no ?? '').trim();
    return entryNo ? `JE-${entryNo}` : entry.id.slice(0, 8);
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

                    <Card className="shadow-none border-secondary/20">
                        <CardHeader className="p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <CardTitle className="text-base">Journal Entry</CardTitle>
                                {selectedEntry ? (
                                    <div className="flex items-center gap-2">
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
                        <CardContent className="p-4 min-h-[220px] border-t border-ld">
                            {selectedEntry ? (
                                <div className="flex flex-col gap-3">
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                        <div>
                                            {isEditingSelectedEntry && entryDraft ? (
                                                <div className="grid gap-2 sm:grid-cols-[150px_minmax(220px,1fr)]">
                                                    <Input
                                                        type="date"
                                                        className="h-9"
                                                        value={entryDraft.entry_date}
                                                        onChange={(event) => updateDraftHeader('entry_date', event.target.value)}
                                                        disabled={isSavingEntry}
                                                    />
                                                    <Input
                                                        className="h-9"
                                                        value={entryDraft.memo}
                                                        onChange={(event) => updateDraftHeader('memo', event.target.value)}
                                                        placeholder="Memo"
                                                        disabled={isSavingEntry}
                                                    />
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="font-semibold text-sm text-foreground">
                                                        {getEntryLabel(selectedEntry)} · {selectedEntry.memo || 'No memo'}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {selectedEntry.entry_date || '-'} · {selectedEntry.source || 'entry'} · Confidence {getConfidence(selectedEntry)}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {selectedEntry.status || selectedEntry.period_yyyymm || ''}
                                        </div>
                                    </div>
                                    {isEditingSelectedEntry && entryDraft ? (
                                        <div className="flex flex-col gap-2 rounded-md border border-ld bg-muted/20 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex flex-wrap gap-4">
                                                <span>Debit {formatMoney(draftTotals.debit)}</span>
                                                <span>Credit {formatMoney(draftTotals.credit)}</span>
                                                <span className={isDraftBalanced ? 'text-green-700' : 'text-red-600'}>
                                                    Difference {formatMoney(draftTotals.difference)}
                                                </span>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="h-8 rounded-full px-3"
                                                onClick={addDraftLine}
                                                disabled={isSavingEntry}
                                            >
                                                <Icon icon="mdi:plus" className="h-4 w-4" />
                                                Add line
                                            </Button>
                                        </div>
                                    ) : null}
                                    <div className="overflow-x-auto rounded-md border border-ld">
                                        <Table>
                                            <THeader>
                                                <TRow>
                                                    <THead className="min-w-24 px-2">Type</THead>
                                                    <THead className="min-w-28 px-2 text-right">Amount</THead>
                                                    <THead className="min-w-48 px-2">Account</THead>
                                                    {isEditingSelectedEntry ? (
                                                        <>
                                                            <THead className="min-w-48 px-2">Description</THead>
                                                            <THead className="w-12 px-2 text-right">Action</THead>
                                                        </>
                                                    ) : null}
                                                </TRow>
                                            </THeader>
                                            <TBody>
                                                {isEditingSelectedEntry && entryDraft ? (
                                                    entryDraft.lines.map((line) => (
                                                        <TRow key={line.client_id}>
                                                            <TCell className="px-2 py-2 text-sm">
                                                                <Select
                                                                    value={line.line_type}
                                                                    onValueChange={(value) => updateDraftLine(line.client_id, {
                                                                        line_type: value === 'credit' ? 'credit' : 'debit',
                                                                    })}
                                                                    disabled={isSavingEntry}
                                                                >
                                                                    <SelectTrigger className="h-9 min-w-24">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="debit">Debit</SelectItem>
                                                                        <SelectItem value="credit">Credit</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </TCell>
                                                            <TCell className="px-2 py-2">
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    className="h-9 text-right font-mono tabular-nums"
                                                                    value={line.amount}
                                                                    onChange={(event) => updateDraftLine(line.client_id, { amount: event.target.value })}
                                                                    disabled={isSavingEntry}
                                                                />
                                                            </TCell>
                                                            <TCell className="px-2 py-2">
                                                                <Select
                                                                    value={line.account_id || undefined}
                                                                    onValueChange={(value) => updateDraftLine(line.client_id, { account_id: value })}
                                                                    disabled={isSavingEntry}
                                                                >
                                                                    <SelectTrigger className="h-9 min-w-48">
                                                                        <SelectValue placeholder="Account" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {accounts.map((account) => (
                                                                            <SelectItem key={account.id} value={account.id}>
                                                                                {getAccountLabel(account)}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </TCell>
                                                            <TCell className="px-2 py-2">
                                                                <Input
                                                                    className="h-9"
                                                                    value={line.description}
                                                                    onChange={(event) => updateDraftLine(line.client_id, { description: event.target.value })}
                                                                    disabled={isSavingEntry}
                                                                />
                                                            </TCell>
                                                            <TCell className="px-2 py-2 text-right">
                                                                <button
                                                                    type="button"
                                                                    className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-50"
                                                                    onClick={() => removeDraftLine(line.client_id)}
                                                                    disabled={isSavingEntry || entryDraft.lines.length <= 1}
                                                                    aria-label="Remove journal line"
                                                                >
                                                                    <Icon icon="mdi:trash-can-outline" height={18} />
                                                                </button>
                                                            </TCell>
                                                        </TRow>
                                                    ))
                                                ) : (
                                                    (selectedEntry.lines ?? []).map((line, index) => (
                                                        <TRow key={line.id ?? `${selectedEntry.id}-${index}`}>
                                                            <TCell className="px-2 py-2 text-sm">{line.line_type || '-'}</TCell>
                                                            <TCell className="px-2 py-2 text-right text-sm font-mono tabular-nums">
                                                                {formatMoney(line.amount ?? 0)}
                                                            </TCell>
                                                            <TCell className="px-2 py-2 text-sm">
                                                                {getLineAccountLabel(line, accountLabelById)}
                                                            </TCell>
                                                        </TRow>
                                                    ))
                                                )}
                                                {(!isEditingSelectedEntry && (selectedEntry.lines ?? []).length === 0) ||
                                                (isEditingSelectedEntry && entryDraft && entryDraft.lines.length === 0) ? (
                                                    <TRow>
                                                        <TCell className="px-2 py-3 text-sm text-muted-foreground" colSpan={isEditingSelectedEntry ? 5 : 3}>
                                                            No lines found.
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
