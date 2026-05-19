import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';
import BreadcrumbComp from 'src/_layouts/shared/breadcrumb/BreadcrumbComp';
import LoadingSpinner from 'src/components/shared/LoadingSpinner';
import { Button } from 'src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/ui/card';
import { Input } from 'src/components/ui/input';
import { Table, TBody, TCell, THead, THeader, TRow } from 'src/components/ui/table';
import { formatMoney } from 'src/core/format';
import { AccountRow, jeAPI, JournalEntryRow, LedgerRow } from 'src/accounting/je/je-api';

const BCrumb = [{ to: '/', title: 'Home' }, { title: 'Ledger' }];
const allAccountsValue = 'all';
const pageSize = 20;

type AccountGroupSummary = {
    key: string;
    label: string;
    debit: number;
    credit: number;
    running: number;
};

const getAccountLabel = (account: AccountRow) => {
    const code = String(account.coa_code ?? account.account_code ?? account.code ?? '').trim();
    const name = String(account.coa_name ?? account.account_name ?? account.name ?? account.title ?? '').trim();

    if (code && name) return `${code} - ${name}`;
    if (name) return name;
    if (code) return code;
    return String(account.id);
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
    const value = row.account_id ?? row.coa_code ?? row.code ?? row.coa_name ?? row.name;
    return String(value ?? '').trim();
};

const getLedgerAccountLabel = (row: LedgerRow, accountLabelById: Record<string, string>) => {
    const accountId = String(row.account_id ?? '').trim();
    if (accountId && accountLabelById[accountId]) return accountLabelById[accountId];
    return [row.coa_code ?? row.code, row.coa_name ?? row.name].filter(Boolean).join(' ') || accountId || '-';
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

const formatBalanceDirection = (value: number) => {
    if (value > 0) return `Debit ${formatMoney(value)}`;
    if (value < 0) return `Credit ${formatMoney(Math.abs(value))}`;
    return formatMoney(0);
};

const getRowKey = (row: LedgerRow, idx: number) =>
    String(row.id ?? `${row.entry_date ?? 'row'}-${getLedgerAccountKey(row)}-${idx}`);

const Ledger = () => {
    const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([]);
    const [entries, setEntries] = useState<JournalEntryRow[]>([]);
    const [accountLabelById, setAccountLabelById] = useState<Record<string, string>>({});
    const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
    const [accountFilter, setAccountFilter] = useState(allAccountsValue);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [pageIndex, setPageIndex] = useState(0);
    const [isLedgerLoading, setIsLedgerLoading] = useState(false);
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
            setAccountLabelById(map);
            setSelectedRowKey((currentKey) => {
                if (currentKey && rows.some((row, idx) => getRowKey(row, idx) === currentKey)) return currentKey;
                return rows[0] ? getRowKey(rows[0], 0) : null;
            });
        } catch (err) {
            setLedgerError(err instanceof Error ? err.message : 'Failed to load general ledger.');
            setLedgerRows([]);
            setEntries([]);
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
        return map;
    }, [entries]);

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

    const dateFilteredRows = useMemo(() => ledgerRows
        .filter((row) => {
            const rowDate = String(row.entry_date ?? '').slice(0, 10);
            const matchesStart = !dateFrom || rowDate >= dateFrom;
            const matchesEnd = !dateTo || rowDate <= dateTo;
            return matchesStart && matchesEnd;
        })
        .sort((a, b) => {
            const accountCompare = getLedgerAccountLabel(a, accountLabelById)
                .localeCompare(getLedgerAccountLabel(b, accountLabelById));
            if (accountCompare) return accountCompare;
            return String(a.entry_date ?? '').localeCompare(String(b.entry_date ?? ''));
        }), [ledgerRows, dateFrom, dateTo, accountLabelById]);

    const accountGroupSummaries = useMemo<AccountGroupSummary[]>(() => {
        const summaries = new Map<string, AccountGroupSummary>();

        dateFilteredRows.forEach((row) => {
            const key = getLedgerAccountKey(row);
            const summary = summaries.get(key) ?? {
                key,
                label: getLedgerAccountLabel(row, accountLabelById),
                debit: 0,
                credit: 0,
                running: 0,
            };

            summary.debit += getDebitAmount(row);
            summary.credit += getCreditAmount(row);
            summary.running = getNumber(row.running_balance);
            summaries.set(key, summary);
        });

        return Array.from(summaries.values()).sort((a, b) => a.label.localeCompare(b.label));
    }, [dateFilteredRows, accountLabelById]);

    const allAccountsSummary = useMemo<AccountGroupSummary>(() => ({
        key: allAccountsValue,
        label: 'All accounts',
        debit: dateFilteredRows.reduce((sum, row) => sum + getDebitAmount(row), 0),
        credit: dateFilteredRows.reduce((sum, row) => sum + getCreditAmount(row), 0),
        running: dateFilteredRows.reduce((sum, row) => sum + getDebitAmount(row) - getCreditAmount(row), 0),
    }), [dateFilteredRows]);

    const filteredRows = useMemo(() => {
        if (accountFilter === allAccountsValue) return dateFilteredRows;
        return dateFilteredRows.filter((row) => getLedgerAccountKey(row) === accountFilter);
    }, [accountFilter, dateFilteredRows]);

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

    useEffect(() => {
        if (accountFilter === allAccountsValue) return;
        if (accountGroupSummaries.some((summary) => summary.key === accountFilter)) return;
        setAccountFilter(allAccountsValue);
    }, [accountFilter, accountGroupSummaries]);

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
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <Card className="border-secondary/20 shadow-none">
                    <CardHeader className="flex flex-col gap-3 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <CardTitle className="text-base">Account Summary</CardTitle>
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
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                                        <THead className="min-w-40 px-2 text-xs">Account</THead>
                                        <THead className="min-w-20 px-2 text-right text-xs">Debit</THead>
                                        <THead className="min-w-20 px-2 text-right text-xs">Credit</THead>
                                        <THead className="min-w-24 px-2 text-right text-xs">Balance</THead>
                                    </TRow>
                                </THeader>
                                <TBody>
                                    {[allAccountsSummary, ...accountGroupSummaries].map((summary) => {
                                        const isSelected = accountFilter === summary.key;

                                        return (
                                            <TRow
                                                key={summary.key}
                                                role="button"
                                                tabIndex={0}
                                                aria-selected={isSelected}
                                                className={[
                                                    'cursor-pointer transition-colors hover:bg-muted/50',
                                                    isSelected ? 'bg-muted shadow-[inset_3px_0_0_hsl(var(--primary))]' : '',
                                                ].filter(Boolean).join(' ')}
                                                onClick={() => setAccountFilter(summary.key)}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                        setAccountFilter(summary.key);
                                                    }
                                                }}
                                            >
                                                <TCell className="px-2 py-2 text-xs font-medium">{summary.label}</TCell>
                                                <TCell className="px-2 py-2 text-right text-xs tabular-nums">{formatMoney(summary.debit)}</TCell>
                                                <TCell className="px-2 py-2 text-right text-xs tabular-nums">{formatMoney(summary.credit)}</TCell>
                                                <TCell className="px-2 py-2 text-right text-xs tabular-nums">{formatBalanceDirection(summary.running)}</TCell>
                                            </TRow>
                                        );
                                    })}
                                    {isLedgerLoading ? (
                                        <TRow>
                                            <TCell className="px-3 py-4 text-xs text-muted-foreground" colSpan={4}>
                                                Loading account summary...
                                            </TCell>
                                        </TRow>
                                    ) : null}
                                    {!isLedgerLoading && dateFilteredRows.length === 0 ? (
                                        <TRow>
                                            <TCell className="px-2 py-3 text-xs text-muted-foreground" colSpan={4}>
                                                No account summaries match the current filters.
                                            </TCell>
                                        </TRow>
                                    ) : null}
                                </TBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-secondary/20 shadow-none">
                    <CardHeader className="flex flex-col gap-1 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <CardTitle className="text-base">General Ledger</CardTitle>
                            <div className="text-xs text-muted-foreground">{filteredRows.length} rows</div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
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
            </div>
        </>
    );
};

export default Ledger;
