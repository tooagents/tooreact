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
    const value =
        row.journal_entry_id ??
        row.journal_id ??
        row.entry_id ??
        row.je_id ??
        row.jeId ??
        row.journalEntryId;

    return String(value ?? '').trim() || null;
};

const getLedgerAccountKey = (row: LedgerRow) => {
    const value = row.account_id ?? row.code ?? row.name;
    return String(value ?? '').trim();
};

const getLedgerAccountLabel = (row: LedgerRow, accountLabelById: Record<string, string>) => {
    const accountId = String(row.account_id ?? '').trim();
    if (accountId && accountLabelById[accountId]) return accountLabelById[accountId];
    return [row.code, row.name].filter(Boolean).join(' ') || accountId || '-';
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
    const [accountLabelById, setAccountLabelById] = useState<Record<string, string>>({});
    const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
    const [accountFilter, setAccountFilter] = useState(allAccountsValue);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
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

    const selectedRow = useMemo(() => {
        if (!selectedRowKey) return filteredRows[0];
        return filteredRows.find((row, idx) => getRowKey(row, idx) === selectedRowKey) ?? filteredRows[0];
    }, [filteredRows, selectedRowKey]);

    const selectedEntry = selectedRow ? entryById.get(getLedgerJournalEntryId(selectedRow) ?? '') : undefined;

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
                                        <THead className="min-w-28 px-2">Date</THead>
                                        <THead className="min-w-48 px-2">Account</THead>
                                        <THead className="min-w-64 px-2">Memo</THead>
                                        <THead className="min-w-24 px-2 text-right">Debit</THead>
                                        <THead className="min-w-24 px-2 text-right">Credit</THead>
                                        <THead className="min-w-28 px-2 text-right">Running</THead>
                                    </TRow>
                                </THeader>
                                <TBody>
                                    {filteredRows.map((row, idx) => {
                                        const key = getRowKey(row, idx);
                                        const isSelected = row === selectedRow;
                                        const entry = entryById.get(getLedgerJournalEntryId(row) ?? '');

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
                                                <TCell className="px-2 py-2 text-sm">{row.entry_date || '-'}</TCell>
                                                <TCell className="px-2 py-2 text-sm font-medium">{getLedgerAccountLabel(row, accountLabelById)}</TCell>
                                                <TCell className="px-2 py-2 text-sm">
                                                    <div className="line-clamp-2">
                                                        {String(row.memo ?? row.description ?? entry?.memo ?? '-')}
                                                    </div>
                                                </TCell>
                                                <TCell className="px-2 py-2 text-right text-sm tabular-nums">{getDebitAmount(row) ? formatMoney(getDebitAmount(row)) : '-'}</TCell>
                                                <TCell className="px-2 py-2 text-right text-sm tabular-nums">{getCreditAmount(row) ? formatMoney(getCreditAmount(row)) : '-'}</TCell>
                                                <TCell className="px-2 py-2 text-right text-sm tabular-nums">{formatMoney(row.running_balance ?? 0)}</TCell>
                                            </TRow>
                                        );
                                    })}
                                    {isLedgerLoading ? (
                                        <TRow>
                                            <TCell className="px-3 py-4 text-sm text-muted-foreground" colSpan={6}>
                                                Loading general ledger...
                                            </TCell>
                                        </TRow>
                                    ) : null}
                                    {!isLedgerLoading && filteredRows.length === 0 ? (
                                        <TRow>
                                            <TCell className="px-2 py-3 text-sm text-muted-foreground" colSpan={6}>
                                                No general ledger rows match the current filters.
                                            </TCell>
                                        </TRow>
                                    ) : null}
                                </TBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-[#cdd8e8] bg-white shadow-none">
                    <CardHeader className="p-4 pb-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex flex-col gap-1">
                                <CardTitle className="text-base text-[#1f2f4a]">Journal Entry</CardTitle>
                                <p className="text-xs text-[#64748b]">Linked entry for the selected ledger row.</p>
                            </div>
                            {selectedEntry ? (
                                <Button asChild variant="outline" className="h-8 rounded-full px-3">
                                    <Link to={`/app/acc/je/${selectedEntry.id}`}>
                                        <Icon icon="solar:arrow-right-up-linear" className="h-4 w-4" />
                                        Open
                                    </Link>
                                </Button>
                            ) : null}
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {selectedEntry ? (
                            <div className="border-t border-[#d8c6a1] bg-[#f8f1de]" style={ledgerPaperStyle}>
                                <div className="border-b border-[#d8c6a1]/80 px-4 py-3">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-mono text-xs font-semibold uppercase text-[#1f3a67]">{getEntryLabel(selectedEntry)}</span>
                                                <Badge className="border-[#b7c7df] bg-white px-2 py-0.5 text-[#335376]">{getEntryStatus(selectedEntry)}</Badge>
                                            </div>
                                            <div className="mt-2 text-sm font-semibold text-[#172033]">{selectedEntry.memo || 'No memo'}</div>
                                            <div className="mt-1 text-xs text-[#64748b]">{selectedEntry.entry_date || '-'}</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <THeader>
                                            <TRow className="border-b border-[#d8c6a1]/80 bg-[#fdf8ec]/70">
                                                <THead className="min-w-24 px-4 text-xs uppercase text-[#1f3a67]">Type</THead>
                                                <THead className="min-w-48 px-3 text-xs uppercase text-[#1f3a67]">Account</THead>
                                                <THead className="min-w-28 px-3 text-right text-xs uppercase text-[#1f3a67]">Debit</THead>
                                                <THead className="min-w-28 px-4 text-right text-xs uppercase text-[#1f3a67]">Credit</THead>
                                            </TRow>
                                        </THeader>
                                        <TBody>
                                            {(selectedEntry.lines ?? []).map((line, index) => {
                                                const lineType = String(line.line_type ?? '').toLowerCase();
                                                const amount = formatMoney(line.amount ?? 0);

                                                return (
                                                    <TRow key={line.id ?? `${selectedEntry.id}-${index}`} className="border-b border-[#d8c6a1]/60 last:border-b-0">
                                                        <TCell className="px-4 py-3 text-sm">
                                                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${lineType === 'debit' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                                                {line.line_type || '-'}
                                                            </span>
                                                        </TCell>
                                                        <TCell className="px-3 py-3 text-sm font-medium text-[#172033]">{getLineAccountLabel(line, accountLabelById)}</TCell>
                                                        <TCell className="px-3 py-3 text-right font-mono text-sm tabular-nums text-[#172033]">{lineType === 'debit' ? amount : '-'}</TCell>
                                                        <TCell className="px-4 py-3 text-right font-mono text-sm tabular-nums text-[#172033]">{lineType === 'credit' ? amount : '-'}</TCell>
                                                    </TRow>
                                                );
                                            })}
                                            {(selectedEntry.lines ?? []).length === 0 ? (
                                                <TRow>
                                                    <TCell className="px-4 py-4 text-sm text-[#64748b]" colSpan={4}>
                                                        No lines found.
                                                    </TCell>
                                                </TRow>
                                            ) : null}
                                        </TBody>
                                    </Table>
                                </div>
                            </div>
                        ) : (
                            <div className="flex min-h-[260px] items-center justify-center border-t border-ld px-6 text-center text-sm font-medium text-muted-foreground">
                                Select a ledger row with a linked journal entry.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
};

export default Ledger;
