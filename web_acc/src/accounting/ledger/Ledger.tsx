import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { ledgerPaperStyle } from 'src/accounting/inbox/inbox-journal-entry';
import { AccountRow, jeAPI, JournalEntryLine, JournalEntryRow, LedgerRow } from 'src/accounting/je/je-api';

const BCrumb = [{ to: '/', title: 'Home' }, { title: 'Ledger' }];
const allAccountsValue = 'all';
const pageSize = 20;

const getAccountLabel = (account: AccountRow) => {
    const code = String(account.coa_code ?? account.account_code ?? account.code ?? '').trim();
    const name = String(account.coa_posting_name ?? account.account_name ?? account.name ?? account.title ?? '').trim();

    if (code && name) return `${code} - ${name}`;
    if (name) return name;
    if (code) return code;
    return String(account.id);
};

const getLineAccountLabel = (line: JournalEntryLine, accountLabelById: Record<string, string>) => {
    const accountCode = String(line.coa_code ?? line.account_code ?? '').trim();
    const accountName = String(line.coa_posting_name ?? line.account_name ?? '').trim();
    const accountLabel = String(line.account_label ?? '').trim();
    const accountId = String(line.account_id ?? '').trim();

    if (accountCode && accountName) return `${accountCode} ${accountName}`;
    if (accountCode) return accountCode;
    if (accountName) return accountName;
    if (accountId && accountLabelById[accountId]) return accountLabelById[accountId];
    return accountLabel || accountId || '-';
};

const getEntryLabel = (entry: JournalEntryRow) => {
    const entryNo = String(entry.entry_no ?? '').trim();
    return entryNo ? `JE-${entryNo}` : entry.id.slice(0, 8);
};

const getEntryStatus = (entry: JournalEntryRow) => {
    const status = String(entry.entry_status ?? entry.status ?? '').trim();
    if (status) return status;
    return String(entry.period_yyyymm ?? '').trim() || 'entry';
};

const getLedgerJournalEntryId = (row: LedgerRow) => {
    const embeddedEntry = getEmbeddedLedgerEntry(row);
    const value =
        embeddedEntry?.id ??
        row.journal_entry_id ??
        row.journal_id ??
        row.entry_id ??
        row.je_id ??
        row.jeId ??
        row.journalEntryId;

    return String(value ?? '').trim() || null;
};

const getLedgerLineId = (row: LedgerRow) => {
    const value =
        row.journal_entry_line_id ??
        row.journalEntryLineId ??
        row.line_id ??
        row.lineId ??
        row.id;

    return String(value ?? '').trim() || null;
};

const getEmbeddedLedgerEntry = (row: LedgerRow): JournalEntryRow | null => {
    const entry = row.journal_entry ?? row.journalEntry ?? row.entry ?? row.je;
    return entry && typeof entry === 'object' && 'id' in entry ? entry : null;
};

const getLedgerAccountKey = (row: LedgerRow) => {
    const value = row.account_id ?? row.coa_code ?? row.code ?? row.coa_posting_name ?? row.name;
    return String(value ?? '').trim();
};

const getLedgerAccountLabel = (row: LedgerRow, accountLabelById: Record<string, string>) => {
    const accountId = String(row.account_id ?? '').trim();
    if (accountId && accountLabelById[accountId]) return accountLabelById[accountId];
    return [row.coa_code ?? row.code, row.coa_posting_name ?? row.name].filter(Boolean).join(' ') || accountId || '-';
};

const getNumber = (value: unknown) => {
    const numberValue = Number(value ?? 0);
    return Number.isFinite(numberValue) ? numberValue : 0;
};

const getDebitAmount = (row: LedgerRow) => {
    if (row.debit !== undefined) return getNumber(row.debit);
    return String(row.line_type ?? '').toLowerCase() === 'debit' ? getNumber(row.amount) : 0;
};

const getCreditAmount = (row: LedgerRow) => {
    if (row.credit !== undefined) return getNumber(row.credit);
    return String(row.line_type ?? '').toLowerCase() === 'credit' ? getNumber(row.amount) : 0;
};

const getRowKey = (row: LedgerRow, idx: number) =>
    String(row.id ?? `${row.entry_date ?? 'row'}-${getLedgerAccountKey(row)}-${idx}`);

const Ledger = () => {
    const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([]);
    const [entries, setEntries] = useState<JournalEntryRow[]>([]);
    const [entryByIdFallback, setEntryByIdFallback] = useState<Record<string, JournalEntryRow>>({});
    const [accountLabelById, setAccountLabelById] = useState<Record<string, string>>({});
    const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
    const [accountFilter, setAccountFilter] = useState(allAccountsValue);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [pageIndex, setPageIndex] = useState(0);
    const [isLedgerLoading, setIsLedgerLoading] = useState(false);
    const [isSelectedEntryLoading, setIsSelectedEntryLoading] = useState(false);
    const [selectedEntryError, setSelectedEntryError] = useState<string | null>(null);
    const [ledgerError, setLedgerError] = useState<string | null>(null);

    const loadLedger = async () => {
        setIsLedgerLoading(true);
        setLedgerError(null);
        try {
            const [rows, journalEntries, accounts] = await Promise.all([
                jeAPI.listLedger(),
                jeAPI.listEntries(),
                jeAPI.listAccounts(),
            ]);
            const map: Record<string, string> = {};
            for (const account of accounts) {
                if (account?.id) map[account.id] = getAccountLabel(account);
            }

            setLedgerRows(rows);
            setEntries(journalEntries);
            setEntryByIdFallback({});
            setAccountLabelById(map);
            setSelectedRowKey((currentKey) => {
                if (currentKey && rows.some((row, idx) => getRowKey(row, idx) === currentKey)) return currentKey;
                return rows[0] ? getRowKey(rows[0], 0) : null;
            });
        } catch (err) {
            setLedgerError(err instanceof Error ? err.message : 'Failed to load general ledger.');
            setLedgerRows([]);
            setEntries([]);
            setEntryByIdFallback({});
            setAccountLabelById({});
            setSelectedRowKey(null);
        } finally {
            setIsLedgerLoading(false);
        }
    };

    useEffect(() => {
        void loadLedger();
    }, []);

    const entryById = useMemo(() => {
        const map = new Map<string, JournalEntryRow>();
        entries.forEach((entry) => map.set(entry.id, entry));
        Object.values(entryByIdFallback).forEach((entry) => map.set(entry.id, entry));
        return map;
    }, [entries, entryByIdFallback]);

    const entryByLineId = useMemo(() => {
        const map = new Map<string, JournalEntryRow>();
        entryById.forEach((entry) => {
            (entry.lines ?? []).forEach((line) => {
                const lineId = String(line.id ?? '').trim();
                if (lineId) map.set(lineId, entry);
            });
        });
        return map;
    }, [entryById]);

    const accountOptions = useMemo(() => {
        const options = new Map<string, string>();
        ledgerRows.forEach((row) => {
            const key = getLedgerAccountKey(row);
            if (key) options.set(key, getLedgerAccountLabel(row, accountLabelById));
        });
        return Array.from(options.entries()).sort((a, b) => a[1].localeCompare(b[1]));
    }, [ledgerRows, accountLabelById]);

    const filteredRows = useMemo(() => ledgerRows.filter((row) => {
        const rowDate = String(row.entry_date ?? '').slice(0, 10);
        const matchesAccount = accountFilter === allAccountsValue || getLedgerAccountKey(row) === accountFilter;
        const matchesStart = !dateFrom || rowDate >= dateFrom;
        const matchesEnd = !dateTo || rowDate <= dateTo;
        return matchesAccount && matchesStart && matchesEnd;
    }), [ledgerRows, accountFilter, dateFrom, dateTo]);

    useEffect(() => {
        setPageIndex(0);
    }, [accountFilter, dateFrom, dateTo, ledgerRows.length]);

    const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    const pageData = useMemo(
        () => filteredRows.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize),
        [filteredRows, pageIndex],
    );
    const canPrev = pageIndex > 0;
    const canNext = pageIndex + 1 < pageCount;

    const selectedRow = useMemo(() => {
        if (!selectedRowKey) return filteredRows[0];
        return filteredRows.find((row, idx) => getRowKey(row, idx) === selectedRowKey) ?? filteredRows[0];
    }, [filteredRows, selectedRowKey]);

    const selectedEntryId = selectedRow ? getLedgerJournalEntryId(selectedRow) : null;
    const selectedLineId = selectedRow ? getLedgerLineId(selectedRow) : null;
    const embeddedSelectedEntry = selectedRow ? getEmbeddedLedgerEntry(selectedRow) : null;
    const selectedEntry =
        embeddedSelectedEntry ??
        (selectedEntryId ? entryById.get(selectedEntryId) : undefined) ??
        (selectedLineId ? entryByLineId.get(selectedLineId) : undefined);

    useEffect(() => {
        if (!selectedEntryId || entryById.has(selectedEntryId) || embeddedSelectedEntry) {
            setIsSelectedEntryLoading(false);
            setSelectedEntryError(null);
            return;
        }

        let isActive = true;
        setIsSelectedEntryLoading(true);
        setSelectedEntryError(null);

        jeAPI.getEntry(selectedEntryId)
            .then((entry) => {
                if (!isActive) return;
                setEntryByIdFallback((current) => ({ ...current, [entry.id]: entry }));
            })
            .catch((err) => {
                if (!isActive) return;
                setSelectedEntryError(err instanceof Error ? err.message : 'Failed to load linked journal entry.');
            })
            .finally(() => {
                if (isActive) setIsSelectedEntryLoading(false);
            });

        return () => {
            isActive = false;
        };
    }, [embeddedSelectedEntry, entryById, selectedEntryId]);

    const totals = useMemo<{ debit: number; credit: number }>(() => filteredRows.reduce<{ debit: number; credit: number }>(
        (sum, row) => ({
            debit: sum.debit + getDebitAmount(row),
            credit: sum.credit + getCreditAmount(row),
        }),
        { debit: 0, credit: 0 },
    ), [filteredRows]);

    const selectedBalance = selectedRow ? getNumber(selectedRow.running_balance) : 0;

    const headBoxes = (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="w-[132px] gap-1 rounded-md border-secondary/20 bg-transparent p-3 shadow-none">
                <CardHeader className="p-0 pb-1">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Rows</CardTitle>
                </CardHeader>
                <CardContent className="p-0 text-2xl font-semibold">{filteredRows.length}</CardContent>
            </Card>
            <Card className="w-[132px] gap-1 rounded-md border-secondary/20 bg-transparent p-3 shadow-none">
                <CardHeader className="p-0 pb-1">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Debit</CardTitle>
                </CardHeader>
                <CardContent className="p-0 text-lg font-semibold tabular-nums">{formatMoney(totals.debit)}</CardContent>
            </Card>
            <Card className="w-[132px] gap-1 rounded-md border-secondary/20 bg-transparent p-3 shadow-none">
                <CardHeader className="p-0 pb-1">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Credit</CardTitle>
                </CardHeader>
                <CardContent className="p-0 text-lg font-semibold tabular-nums">{formatMoney(totals.credit)}</CardContent>
            </Card>
            <Card className="w-[132px] gap-1 rounded-md border-secondary/20 bg-transparent p-3 shadow-none">
                <CardHeader className="p-0 pb-1">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Balance</CardTitle>
                </CardHeader>
                <CardContent className="p-0 text-lg font-semibold tabular-nums">{formatMoney(selectedBalance)}</CardContent>
            </Card>
        </div>
    );

    return (
        <>
            <BreadcrumbComp title="Ledger" items={BCrumb} leftContent={null} rightContent={headBoxes} />
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(420px,0.75fr)]">
                <Card className="border-secondary/20 shadow-none">
                    <CardHeader className="flex flex-col gap-3 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <CardTitle className="text-base">General Ledger</CardTitle>
                            <Button
                                variant="outline"
                                className="h-8 rounded-full px-3"
                                onClick={loadLedger}
                                disabled={isLedgerLoading}
                            >
                                {isLedgerLoading ? <LoadingSpinner size="sm" variant="dots" /> : <Icon icon="mdi:refresh" className="h-4 w-4" />}
                                {isLedgerLoading ? 'Loading...' : 'Refresh GL'}
                            </Button>
                        </div>
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(220px,1fr)_150px_150px]">
                            <Select value={accountFilter} onValueChange={setAccountFilter}>
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Account" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={allAccountsValue}>All accounts</SelectItem>
                                    {accountOptions.map(([key, label]) => (
                                        <SelectItem key={key} value={key}>{label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Input type="date" className="h-9" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
                            <Input type="date" className="h-9" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {ledgerError ? (
                            <div className="px-4 pb-3 text-sm text-red-600">Error: {ledgerError}</div>
                        ) : null}
                        <div className="overflow-x-auto border-t border-ld">
                            <Table>
                                <THeader>
                                    <TRow>
                                        <THead className="min-w-24 px-2 text-xs">Date</THead>
                                        <THead className="min-w-40 px-2 text-xs">Account</THead>
                                        <THead className="min-w-36 px-2 text-xs">Memo</THead>
                                        <THead className="min-w-20 px-2 text-right text-xs">Debit</THead>
                                        <THead className="min-w-20 px-2 text-right text-xs">Credit</THead>
                                        <THead className="min-w-24 px-2 text-right text-xs">Running</THead>
                                    </TRow>
                                </THeader>
                                <TBody>
                                    {pageData.map((row, idx) => {
                                        const rowIndex = pageIndex * pageSize + idx;
                                        const key = getRowKey(row, rowIndex);
                                        const isSelected = row === selectedRow;
                                        const entry =
                                            entryById.get(getLedgerJournalEntryId(row) ?? '') ??
                                            entryByLineId.get(getLedgerLineId(row) ?? '');

                                        return (
                                            <TRow
                                                key={key}
                                                role="button"
                                                tabIndex={0}
                                                aria-selected={isSelected}
                                                className={[
                                                    'cursor-pointer transition-colors hover:bg-muted/50',
                                                    isSelected ? 'bg-muted shadow-[inset_3px_0_0_hsl(var(--primary))]' : '',
                                                ].filter(Boolean).join(' ')}
                                                onClick={() => setSelectedRowKey(key)}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                        setSelectedRowKey(key);
                                                    }
                                                }}
                                            >
                                                <TCell className="px-2 py-2 text-xs">{row.entry_date || '-'}</TCell>
                                                <TCell className="px-2 py-2 text-xs">{getLedgerAccountLabel(row, accountLabelById)}</TCell>
                                                <TCell className="px-2 py-2 text-xs">
                                                    <div className="line-clamp-2">
                                                        {String(row.memo ?? row.description ?? entry?.memo ?? '-')}
                                                    </div>
                                                </TCell>
                                                <TCell className="px-2 py-2 text-right text-xs tabular-nums">{getDebitAmount(row) ? formatMoney(getDebitAmount(row)) : '-'}</TCell>
                                                <TCell className="px-2 py-2 text-right text-xs tabular-nums">{getCreditAmount(row) ? formatMoney(getCreditAmount(row)) : '-'}</TCell>
                                                <TCell className="px-2 py-2 text-right text-xs tabular-nums">{formatMoney(row.running_balance ?? 0)}</TCell>
                                            </TRow>
                                        );
                                    })}
                                    {isLedgerLoading ? (
                                        <TRow>
                                            <TCell className="px-3 py-4 text-xs text-muted-foreground" colSpan={6}>
                                                Loading general ledger...
                                            </TCell>
                                        </TRow>
                                    ) : null}
                                    {!isLedgerLoading && filteredRows.length === 0 ? (
                                        <TRow>
                                            <TCell className="px-2 py-3 text-xs text-muted-foreground" colSpan={6}>
                                                No general ledger rows match the current filters.
                                            </TCell>
                                        </TRow>
                                    ) : null}
                                </TBody>
                            </Table>
                        </div>
                        {filteredRows.length > 0 ? (
                            <div className="flex flex-col gap-4 p-4">
                                <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                                    <div className="flex w-full gap-2 sm:w-auto">
                                        <Button
                                            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                                            disabled={!canPrev}
                                            variant="secondary"
                                            className="flex-1 text-xs sm:flex-none sm:text-sm"
                                        >
                                            Previous
                                        </Button>
                                        <Button
                                            onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
                                            disabled={!canNext}
                                            className="flex-1 text-xs sm:flex-none sm:text-sm"
                                        >
                                            Next
                                        </Button>
                                    </div>

                                    <div className="whitespace-nowrap text-xs text-forest-black dark:text-white/90 xs:text-base">
                                        Page {pageIndex + 1} of {pageCount}
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </CardContent>
                </Card>

                <Card className="border-[#d8c6a1] bg-[#f8f1de] shadow-none">
                    <CardHeader className="p-2 pb-1.5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex flex-col gap-1">
                                <CardTitle className="text-sm text-[#2b2f38]">Journal Entry</CardTitle>
                                <p className="text-[11px] text-[#506080]">Linked entry for the selected ledger row.</p>
                            </div>
                            {selectedEntry ? (
                                <Button asChild variant="outline" className="h-7 rounded-full px-2 text-xs">
                                    <Link to={`/app/acc/je/${selectedEntry.id}`}>
                                        <Icon icon="solar:arrow-right-up-linear" className="h-3.5 w-3.5" />
                                        Open
                                    </Link>
                                </Button>
                            ) : null}
                        </div>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-1.5 p-0 pt-0">
                        {selectedEntry ? (
                            <Card className="overflow-hidden rounded-md border-[#d8c6a1] shadow-none" style={ledgerPaperStyle}>
                                <CardContent className="flex flex-col gap-2.5 p-0">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-mono text-[11px] font-semibold uppercase text-[#1f3a67]">{getEntryLabel(selectedEntry)}</span>
                                                <Badge className="border-[#d8c6a1] bg-[#fdf8ec] px-1.5 py-0 text-[10px] text-[#335376]">{getEntryStatus(selectedEntry)}</Badge>
                                            </div>
                                            <div className="mt-1 truncate text-xs font-semibold text-[#172033]">{selectedEntry.memo || 'No memo'}</div>
                                            <div className="mt-0.5 text-[11px] text-[#506080]">{selectedEntry.entry_date || '-'}</div>
                                        </div>
                                    </div>

                                    <div className="overflow-hidden rounded-md border border-[#9eb8dc]/70 bg-[#fdf8ec]/70">
                                        <Table className="w-full table-fixed">
                                            <THeader>
                                                <TRow className="border-b border-[#6fa0d8]/60 bg-[#fdf8ec]/70">
                                                    <THead className="h-7 w-14 px-1.5 text-[10px] uppercase text-[#1f3a67]">Type</THead>
                                                    <THead className="h-7 px-1.5 text-[10px] uppercase text-[#1f3a67]">Account</THead>
                                                    <THead className="h-7 w-16 px-1.5 text-right text-[10px] uppercase text-[#1f3a67]">Debit</THead>
                                                    <THead className="h-7 w-16 px-1.5 text-right text-[10px] uppercase text-[#1f3a67]">Credit</THead>
                                                </TRow>
                                            </THeader>
                                            <TBody>
                                                {(selectedEntry.lines ?? []).map((line, index) => {
                                                    const lineType = String(line.line_type ?? '').toLowerCase();
                                                    const amount = formatMoney(line.amount ?? 0);

                                                    return (
                                                        <TRow key={line.id ?? `${selectedEntry.id}-${index}`} className="border-b border-[#6fa0d8]/35 last:border-b-0">
                                                            <TCell className="px-1.5 py-1.5 text-[11px]">
                                                                <span className={`inline-flex max-w-full truncate rounded-full px-1.5 py-0.5 text-[10px] font-medium ${lineType === 'debit' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                                                    {line.line_type || '-'}
                                                                </span>
                                                            </TCell>
                                                            <TCell className="truncate px-1.5 py-1.5 text-[11px] font-medium text-[#172033]">{getLineAccountLabel(line, accountLabelById)}</TCell>
                                                            <TCell className="px-1.5 py-1.5 text-right font-mono text-[11px] tabular-nums text-[#172033]">{lineType === 'debit' ? amount : '-'}</TCell>
                                                            <TCell className="px-1.5 py-1.5 text-right font-mono text-[11px] tabular-nums text-[#172033]">{lineType === 'credit' ? amount : '-'}</TCell>
                                                        </TRow>
                                                    );
                                                })}
                                                {(selectedEntry.lines ?? []).length === 0 ? (
                                                    <TRow>
                                                        <TCell className="px-2 py-2 text-xs text-[#596986]" colSpan={4}>
                                                            No lines found.
                                                        </TCell>
                                                    </TRow>
                                                ) : null}
                                            </TBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : isSelectedEntryLoading ? (
                            <div className="flex min-h-[260px] items-center justify-center border-t border-ld px-6 text-center text-sm font-medium text-muted-foreground">
                                <LoadingSpinner size="sm" variant="dots" />
                                <span className="ml-2">Loading linked journal entry...</span>
                            </div>
                        ) : selectedEntryError ? (
                            <div className="flex min-h-[260px] items-center justify-center border-t border-ld px-6 text-center text-sm font-medium text-red-600">
                                {selectedEntryError}
                            </div>
                        ) : selectedEntryId ? (
                            <div className="flex min-h-[260px] items-center justify-center border-t border-ld px-6 text-center text-sm font-medium text-muted-foreground">
                                Linked journal entry was not found for {selectedEntryId}.
                            </div>
                        ) : selectedLineId ? (
                            <div className="flex min-h-[260px] items-center justify-center border-t border-ld px-6 text-center text-sm font-medium text-muted-foreground">
                                The selected ledger row has no journal entry id, and no loaded journal entry line matched {selectedLineId}.
                            </div>
                        ) : (
                            <div className="flex min-h-[260px] items-center justify-center border-t border-ld px-6 text-center text-sm font-medium text-muted-foreground">
                                The selected ledger row has no linked journal entry id.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
};

export default Ledger;
