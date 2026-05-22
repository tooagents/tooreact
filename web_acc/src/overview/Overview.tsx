import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react/dist/iconify.js';
import { Badge } from 'src/components/ui/badge';
import { Button } from 'src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/ui/card';
import { formatDate, formatMoney } from 'src/core/format';
import { AccountRow, jeAPI, JournalEntryRow, LedgerRow } from 'src/accounting/je/je-api';

type OverviewData = {
    accounts: AccountRow[];
    entries: JournalEntryRow[];
    ledgerRows: LedgerRow[];
};

type StatusTone = 'emerald' | 'amber' | 'blue';

const getNumber = (value: unknown) => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
};

const getEntryTotal = (entry: JournalEntryRow) => {
    const debitLines = (entry.lines ?? []).filter((line) => String(line.line_type ?? '').toLowerCase() === 'debit');
    const totalLines = debitLines.length > 0 ? debitLines : (entry.lines ?? []);

    return totalLines.reduce((sum, line) => sum + getNumber(line.amount), 0);
};

const getEntryStatus = (entry: JournalEntryRow) =>
    String(entry.entry_status ?? entry.status ?? '').trim() || 'draft';

const isPostedEntry = (entry: JournalEntryRow) => {
    const status = getEntryStatus(entry).toLowerCase();
    return Boolean(entry.posted_at) || ['posted', 'approved', 'closed'].includes(status);
};

const getActivePostingAccounts = (accounts: AccountRow[]) =>
    accounts.filter((account) => account.is_active !== false && account.is_posting !== false);

const getLedgerDebit = (row: LedgerRow) => {
    if (row.debit !== undefined) return getNumber(row.debit);
    return String(row.line_type ?? '').toLowerCase() === 'debit' ? getNumber(row.amount) : 0;
};

const getLedgerCredit = (row: LedgerRow) => {
    if (row.credit !== undefined) return getNumber(row.credit);
    return String(row.line_type ?? '').toLowerCase() === 'credit' ? getNumber(row.amount) : 0;
};

const sortByEntryDate = (entries: JournalEntryRow[]) =>
    [...entries].sort((left, right) => String(right.entry_date ?? '').localeCompare(String(left.entry_date ?? '')));

const statusToneClass: Record<StatusTone, string> = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300',
    amber: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300',
    blue: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300',
};

const Overview = () => {
    const [data, setData] = useState<OverviewData>({
        accounts: [],
        entries: [],
        ledgerRows: [],
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        const loadOverview = async () => {
            setLoading(true);
            setError(null);
            try {
                const [accounts, entries, ledgerRows] = await Promise.all([
                    jeAPI.listAccounts(),
                    jeAPI.listEntries(),
                    jeAPI.listLedger(),
                ]);

                if (!mounted) return;
                setData({ accounts, entries, ledgerRows });
            } catch (err) {
                if (!mounted) return;
                setError(err instanceof Error ? err.message : 'Failed to load accounting overview.');
            } finally {
                if (mounted) setLoading(false);
            }
        };

        void loadOverview();

        return () => {
            mounted = false;
        };
    }, []);

    const activeAccounts = useMemo(() => getActivePostingAccounts(data.accounts), [data.accounts]);
    const recentEntries = useMemo(() => sortByEntryDate(data.entries).slice(0, 5), [data.entries]);
    const openEntries = useMemo(() => data.entries.filter((entry) => !isPostedEntry(entry)), [data.entries]);
    const ledgerDebit = useMemo(() => data.ledgerRows.reduce((sum, row) => sum + getLedgerDebit(row), 0), [data.ledgerRows]);
    const ledgerCredit = useMemo(() => data.ledgerRows.reduce((sum, row) => sum + getLedgerCredit(row), 0), [data.ledgerRows]);
    const ledgerDifference = ledgerDebit - ledgerCredit;
    const lastEntryDate = recentEntries[0]?.entry_date ? formatDate(String(recentEntries[0].entry_date)) : 'No activity yet';

    const healthTone: StatusTone = Math.abs(ledgerDifference) < 0.005 ? 'emerald' : 'amber';
    const healthLabel = Math.abs(ledgerDifference) < 0.005 ? 'Ledger balanced' : 'Review ledger';

    return (
        <div className="space-y-6">
            <div className="rounded-md border border-secondary/20 bg-white p-5 shadow-none dark:bg-dark">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                            <Badge variant="lightInfo" className="rounded-md">Accounting workspace</Badge>
                            <span className={`rounded-md border px-2.5 py-1 text-xs font-medium ${statusToneClass[healthTone]}`}>
                                {healthLabel}
                            </span>
                        </div>
                        <h1 className="text-2xl font-semibold tracking-normal text-[#172033] dark:text-white">
                            Financial overview
                        </h1>
                        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                            A practical snapshot of journal activity, ledger balance, and setup readiness for the books.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button asChild shape="pill" className="h-9">
                            <Link to="/app/acc/inbox">
                                <Icon icon="mdi:plus" />
                                Add transaction
                            </Link>
                        </Button>
                        <Button asChild variant="outline" shape="pill" className="h-9">
                            <Link to="/app/acc/reports">
                                <Icon icon="mdi:file-chart-outline" />
                                Reports
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>

            {error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                    {error}
                </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                    icon="mdi:book-open-page-variant-outline"
                    label="Journal entries"
                    value={loading ? '...' : String(data.entries.length)}
                    detail={`${openEntries.length} open for review`}
                    tone="blue"
                />
                <MetricCard
                    icon="mdi:scale-balance"
                    label="Ledger check"
                    value={loading ? '...' : formatMoney(Math.abs(ledgerDifference))}
                    detail={Math.abs(ledgerDifference) < 0.005 ? 'Debits and credits match' : 'Difference needs attention'}
                    tone={healthTone}
                />
                <MetricCard
                    icon="mdi:format-list-bulleted-type"
                    label="Posting accounts"
                    value={loading ? '...' : String(activeAccounts.length)}
                    detail={`${data.accounts.length} total COA rows`}
                    tone="emerald"
                />
                <MetricCard
                    icon="mdi:tray-arrow-down"
                    label="Work queue"
                    value={loading ? '...' : String(openEntries.length)}
                    detail="Journal entries to finish"
                    tone={openEntries.length > 0 ? 'amber' : 'emerald'}
                />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
                <Card className="border-secondary/20 shadow-none">
                    <CardHeader className="flex flex-row items-start justify-between gap-3 p-4">
                        <div>
                            <CardTitle className="text-base">Recent journal work</CardTitle>
                            <p className="mt-1 text-xs text-muted-foreground">Last activity: {lastEntryDate}</p>
                        </div>
                        <Button asChild variant="ghostprimary" size="sm" className="h-8 px-3">
                            <Link to="/app/acc/je">
                                View all
                                <Icon icon="mdi:arrow-right" />
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent className="border-t border-ld p-0">
                        {loading ? (
                            <EmptyState label="Loading journal entries..." />
                        ) : recentEntries.length > 0 ? (
                            <div className="divide-y divide-ld">
                                {recentEntries.map((entry) => (
                                    <Link
                                        key={entry.id}
                                        to={`/app/acc/je/${entry.id}`}
                                        className="grid gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:grid-cols-[1fr_auto] sm:items-center"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                <span className="font-mono text-xs font-semibold text-primary">
                                                    {entry.entry_no ? `JE-${entry.entry_no}` : entry.id.slice(0, 8)}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {formatDate(String(entry.entry_date ?? '')) || 'No date'}
                                                </span>
                                                <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${isPostedEntry(entry) ? statusToneClass.emerald : statusToneClass.amber}`}>
                                                    {getEntryStatus(entry)}
                                                </span>
                                            </div>
                                            <div className="mt-1 line-clamp-1 text-sm font-medium text-[#172033] dark:text-white">
                                                {String(entry.memo ?? '').trim() || 'Journal entry'}
                                            </div>
                                        </div>
                                        <div className="font-mono text-sm font-semibold tabular-nums text-[#172033] dark:text-white">
                                            {formatMoney(getEntryTotal(entry))}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <EmptyState label="No journal entries yet. Add the first transaction from the inbox." />
                        )}
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card className="border-secondary/20 shadow-none">
                        <CardHeader className="p-4">
                            <CardTitle className="text-base">Next best actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 border-t border-ld p-4">
                            <ActionLink
                                icon="mdi:tray-arrow-down"
                                title="Capture source transactions"
                                detail="Create or review inbox items before they become journal entries."
                                to="/app/acc/inbox"
                            />
                            <ActionLink
                                icon="mdi:chart-tree"
                                title="Review chart of accounts"
                                detail="Keep posting accounts clean before period-end reporting."
                                to="/app/settings/coa"
                            />
                            <ActionLink
                                icon="mdi:ledger"
                                title="Check the general ledger"
                                detail="Scan balances by account and inspect supporting entries."
                                to="/app/acc/ledger"
                            />
                        </CardContent>
                    </Card>

                    <Card className="border-secondary/20 shadow-none">
                        <CardHeader className="p-4">
                            <CardTitle className="text-base">Period readiness</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 border-t border-ld p-4">
                            <ReadinessRow
                                label="COA ready"
                                ready={activeAccounts.length > 0}
                                detail={activeAccounts.length > 0 ? `${activeAccounts.length} posting accounts` : 'Add accounts first'}
                            />
                            <ReadinessRow
                                label="Entries reviewed"
                                ready={openEntries.length === 0 && data.entries.length > 0}
                                detail={openEntries.length === 0 ? 'No open entries' : `${openEntries.length} open entries`}
                            />
                            <ReadinessRow
                                label="Ledger balanced"
                                ready={Math.abs(ledgerDifference) < 0.005}
                                detail={formatMoney(Math.abs(ledgerDifference))}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

const MetricCard = ({
    icon,
    label,
    value,
    detail,
    tone,
}: {
    icon: string;
    label: string;
    value: string;
    detail: string;
    tone: StatusTone;
}) => (
    <Card className="border-secondary/20 shadow-none">
        <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
                    <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#172033] dark:text-white">
                        {value}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
                </div>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border ${statusToneClass[tone]}`}>
                    <Icon icon={icon} className="h-5 w-5" />
                </div>
            </div>
        </CardContent>
    </Card>
);

const ActionLink = ({ icon, title, detail, to }: { icon: string; title: string; detail: string; to: string }) => (
    <Link
        to={to}
        className="flex items-start gap-3 rounded-md border border-secondary/20 p-3 transition-colors hover:border-primary/40 hover:bg-muted/30"
    >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-lightprimary text-primary">
            <Icon icon={icon} className="h-5 w-5" />
        </span>
        <span className="min-w-0">
            <span className="block text-sm font-semibold text-[#172033] dark:text-white">{title}</span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">{detail}</span>
        </span>
    </Link>
);

const ReadinessRow = ({ label, ready, detail }: { label: string; ready: boolean; detail: string }) => (
    <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
            <div className="text-sm font-medium text-[#172033] dark:text-white">{label}</div>
            <div className="text-xs text-muted-foreground">{detail}</div>
        </div>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${ready ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            <Icon icon={ready ? 'mdi:check' : 'mdi:clock-outline'} className="h-4 w-4" />
        </span>
    </div>
);

const EmptyState = ({ label }: { label: string }) => (
    <div className="px-4 py-8 text-center text-sm text-muted-foreground">{label}</div>
);

export default Overview;
