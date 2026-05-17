import { useEffect, useMemo, useState } from 'react';
import { Badge } from 'src/components/ui/badge';
import BreadcrumbComp from 'src/_layouts/shared/breadcrumb/BreadcrumbComp';
import LoadingSpinner from 'src/components/shared/LoadingSpinner';
import { Button } from 'src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/ui/card';
import { Input } from 'src/components/ui/input';
import { Table, TBody, TCell, THead, THeader, TRow } from 'src/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'src/components/ui/tabs';
import { apiFetch } from 'src/core/apihttp';
import { formatMoney } from 'src/core/format';

const BCrumb = [{ to: '/', title: 'Home' }, { title: 'Reports' }];

type TrialBalanceRow = {
    account_id?: string | null;
    coa_code?: string | null;
    coa_posting_name?: string | null;
    coa_group_level1?: string | null;
    coa_group_level2?: string | null;
    coa_group_level3?: string | null;
    normal_balance?: string | null;
    code?: string | null;
    name?: string | null;
    type?: string | null;
    debit?: number | string | null;
    credit?: number | string | null;
    net?: number | string | null;
    balance?: number | string | null;
};

type StatementPostingAccount = {
    account_id?: string | null;
    coa_code?: string | null;
    coa_posting_name?: string | null;
    coa_group_level1?: string | null;
    coa_group_level2?: string | null;
    coa_group_level3?: string | null;
    code?: string | null;
    name?: string | null;
    amount?: number | string | null;
};

type StatementLevel3 = {
    coa_group_level3?: string | null;
    amount?: number | string | null;
    posting_accounts?: StatementPostingAccount[];
};

type StatementLevel2 = {
    coa_group_level2?: string | null;
    amount?: number | string | null;
    level3?: StatementLevel3[];
};

type StatementSection = {
    coa_group_level1?: string | null;
    amount?: number | string | null;
    level2?: StatementLevel2[];
};

type BalanceSheetReport = {
    as_of?: string | null;
    sections?: Record<string, StatementSection | undefined>;
    totals?: {
        asset?: number | string | null;
        liability?: number | string | null;
        equity?: number | string | null;
        assets?: number | string | null;
        liabilities?: number | string | null;
    };
};

type IncomeStatementReport = {
    from_date?: string | null;
    to_date?: string | null;
    sections?: Record<string, StatementSection | undefined>;
    totals?: {
        revenue?: number | string | null;
        expense?: number | string | null;
        expenses?: number | string | null;
        net_income?: number | string | null;
    };
};

type DisplayStatementSection = {
    key: string;
    title: string;
    total: number;
    totalLabel: string;
    section?: StatementSection;
};

type HierarchyNode = {
    key: string;
    label: string;
    amount: number;
    count: number;
    level: number;
    accounts: StatementPostingAccount[];
    sectionKey?: string;
    level2Name?: string | null;
    level3Name?: string | null;
};

const getNumber = (value: unknown) => {
    const numberValue = Number(value ?? 0);
    return Number.isFinite(numberValue) ? numberValue : 0;
};

const getAccountCode = (row: StatementPostingAccount | TrialBalanceRow) => String(row.coa_code ?? row.code ?? '').trim();

const getAccountName = (row: StatementPostingAccount | TrialBalanceRow) => String(row.coa_posting_name ?? row.name ?? '').trim();

const getAccountLabel = (row: StatementPostingAccount | TrialBalanceRow) => {
    const code = getAccountCode(row);
    const name = getAccountName(row);
    if (code && name) return `${code} ${name}`;
    return name || code || String(row.account_id ?? '-');
};

const getCurrentMonthValue = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const getPeriodYyyymm = (monthValue: string) => Number(monthValue.replace('-', ''));

const getMonthDateRange = (monthValue: string) => {
    const [yearText, monthText] = monthValue.split('-');
    const year = Number(yearText);
    const monthIndex = Number(monthText) - 1;
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0);

    const formatDate = (date: Date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    return {
        fromDate: formatDate(start),
        toDate: formatDate(end),
    };
};

const getSignedClass = (value: number) => {
    if (Math.abs(value) < 0.005) return 'text-emerald-700';
    return value > 0 ? 'text-blue-700' : 'text-red-700';
};

const getReportRowKey = (section: string, row: StatementPostingAccount, index: number) =>
    `${section}-${row.account_id ?? row.coa_code ?? row.code ?? row.coa_posting_name ?? row.name ?? index}`;

const titleCase = (value: string) =>
    value
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');

const getGroupLabel = (value: string | null | undefined, fallback: string) => {
    const text = String(value ?? '').trim();
    return text ? titleCase(text) : fallback;
};

const getTrialBalanceType = (row: TrialBalanceRow) =>
    getGroupLabel(row.coa_group_level1 ?? row.type, '-');

const getTrialBalanceNet = (row: TrialBalanceRow) => getNumber(row.balance ?? row.net);

const getSectionTotal = (
    reportTotals: Record<string, number | string | null | undefined> | undefined,
    section: StatementSection | undefined,
    keys: string[],
) => {
    for (const key of keys) {
        const total = reportTotals?.[key];
        if (total !== undefined && total !== null) return getNumber(total);
    }
    return getNumber(section?.amount);
};

const flattenSectionAccounts = (section: StatementSection | undefined) =>
    (section?.level2 ?? []).flatMap((level2) =>
        (level2.level3 ?? []).flatMap((level3) => level3.posting_accounts ?? []),
    );

const makeBalanceSheetSections = (report: BalanceSheetReport): DisplayStatementSection[] => [
    {
        key: 'asset',
        title: 'Assets',
        section: report.sections?.asset,
        total: getSectionTotal(report.totals, report.sections?.asset, ['asset', 'assets']),
        totalLabel: 'Total Assets',
    },
    {
        key: 'liability',
        title: 'Liabilities',
        section: report.sections?.liability,
        total: getSectionTotal(report.totals, report.sections?.liability, ['liability', 'liabilities']),
        totalLabel: 'Total Liabilities',
    },
    {
        key: 'equity',
        title: 'Equity',
        section: report.sections?.equity,
        total: getSectionTotal(report.totals, report.sections?.equity, ['equity']),
        totalLabel: 'Total Equity',
    },
];

const makeIncomeStatementSections = (report: IncomeStatementReport): DisplayStatementSection[] => [
    {
        key: 'revenue',
        title: 'Revenue',
        section: report.sections?.revenue,
        total: getSectionTotal(report.totals, report.sections?.revenue, ['revenue']),
        totalLabel: 'Total Revenue',
    },
    {
        key: 'expense',
        title: 'Expenses',
        section: report.sections?.expense,
        total: getSectionTotal(report.totals, report.sections?.expense, ['expense', 'expenses']),
        totalLabel: 'Total Expenses',
    },
];

async function parseApiResponse<T>(response: Response, message: string): Promise<T> {
    if (!response.ok) {
        const details = await response.text().catch(() => '');
        throw new Error(`${message}: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`);
    }

    return response.json();
}

const reportsAPI = {
    async trialBalance(periodYyyymm: number): Promise<TrialBalanceRow[]> {
        const response = await apiFetch(`/acc/reports/trial-balance?period_yyyymm=${periodYyyymm}`);
        const data = await parseApiResponse<{ rows?: TrialBalanceRow[] }>(response, 'Failed to fetch trial balance');
        return data.rows ?? [];
    },

    async balanceSheet(asOf: string): Promise<BalanceSheetReport> {
        const response = await apiFetch(`/acc/reports/balance-sheet?as_of=${encodeURIComponent(asOf)}`);
        return parseApiResponse<BalanceSheetReport>(response, 'Failed to fetch balance sheet');
    },

    async incomeStatement(fromDate: string, toDate: string): Promise<IncomeStatementReport> {
        const response = await apiFetch(`/acc/reports/income-statement?from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}`);
        return parseApiResponse<IncomeStatementReport>(response, 'Failed to fetch income statement');
    },

    async exportTaxPackage(periodYyyymm: number): Promise<Blob> {
        const response = await apiFetch(`/acc/reports/export-tax-package?period_yyyymm=${periodYyyymm}`);
        if (!response.ok) {
            const details = await response.text().catch(() => '');
            throw new Error(`Failed to export tax package: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`);
        }
        return response.blob();
    },
};

const Reports = () => {
    const [periodMonth, setPeriodMonth] = useState(getCurrentMonthValue);
    const [trialBalanceRows, setTrialBalanceRows] = useState<TrialBalanceRow[]>([]);
    const [balanceSheet, setBalanceSheet] = useState<BalanceSheetReport>({});
    const [incomeStatement, setIncomeStatement] = useState<IncomeStatementReport>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const periodYyyymm = getPeriodYyyymm(periodMonth);
    const { fromDate, toDate } = useMemo(() => getMonthDateRange(periodMonth), [periodMonth]);

    const loadReports = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [tb, bs, isData] = await Promise.all([
                reportsAPI.trialBalance(periodYyyymm),
                reportsAPI.balanceSheet(toDate),
                reportsAPI.incomeStatement(fromDate, toDate),
            ]);
            setTrialBalanceRows(tb);
            setBalanceSheet(bs);
            setIncomeStatement(isData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load reports.');
            setTrialBalanceRows([]);
            setBalanceSheet({});
            setIncomeStatement({});
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadReports();
    }, [periodMonth]);

    const tbDebit = trialBalanceRows.reduce((sum, row) => sum + getNumber(row.debit), 0);
    const tbCredit = trialBalanceRows.reduce((sum, row) => sum + getNumber(row.credit), 0);
    const tbDifference = tbDebit - tbCredit;
    const isBalanced = Math.abs(tbDebit - tbCredit) < 0.005;
    const balanceSheetSections = useMemo(() => makeBalanceSheetSections(balanceSheet), [balanceSheet]);
    const incomeStatementSections = useMemo(() => makeIncomeStatementSections(incomeStatement), [incomeStatement]);
    const bsAssetsTotal = balanceSheetSections[0].total;
    const bsLiabilitiesTotal = balanceSheetSections[1].total;
    const bsEquityTotal = balanceSheetSections[2].total;
    const bsTotal = bsAssetsTotal - bsLiabilitiesTotal - bsEquityTotal;
    const revenueTotal = incomeStatementSections[0].total;
    const expenseTotal = incomeStatementSections[1].total;
    const isTotal = getNumber(incomeStatement.totals?.net_income);

    const exportReports = async () => {
        setIsExporting(true);
        setError(null);
        try {
            const blob = await reportsAPI.exportTaxPackage(periodYyyymm);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `tax_package_${periodYyyymm}.zip`;
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to export reports.');
        } finally {
            setIsExporting(false);
        }
    };

    const headBoxes = (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <Card className="w-[150px] gap-1 p-3 rounded-md shadow-none border-secondary/20 bg-transparent">
                <CardHeader className="p-0 pb-1">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Period</CardTitle>
                </CardHeader>
                <CardContent className="p-0 text-sm font-semibold">{periodMonth}</CardContent>
            </Card>
            <Card className="w-[150px] gap-1 p-3 rounded-md shadow-none border-secondary/20 bg-transparent">
                <CardHeader className="p-0 pb-1">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Badge className={`rounded-full ${isBalanced ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                        {isBalanced ? 'Balanced' : 'Review'}
                    </Badge>
                </CardContent>
            </Card>
        </div>
    );

    return (
        <>
            <BreadcrumbComp title="Reports" items={BCrumb} leftContent={null} rightContent={headBoxes} />
            <div className="flex flex-col gap-4">
                <Card className="shadow-none border-secondary/20">
                    <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div>
                            <div className="text-sm font-medium">Period reports</div>
                            <div className="text-sm text-muted-foreground">
                                JE-backed trial balance, balance sheet, and income statement for {fromDate} to {toDate}.
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Input
                                type="month"
                                className="h-9 w-[150px]"
                                value={periodMonth}
                                onChange={(event) => setPeriodMonth(event.target.value)}
                            />
                            <Button variant="outline" className="h-9 rounded-full" onClick={loadReports} disabled={isLoading}>
                                {isLoading ? <LoadingSpinner size="sm" variant="dots" /> : null}
                                Refresh
                            </Button>
                            <Button className="h-9 rounded-full" onClick={exportReports} disabled={isExporting || isLoading}>
                                {isExporting ? <LoadingSpinner size="sm" variant="dots" /> : null}
                                Export
                            </Button>
                        </div>
                    </CardContent>
                </Card>
                {error ? (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {error}
                    </div>
                ) : null}

                <Tabs defaultValue="tb" className="w-full">
                    <TabsList className="w-full justify-start overflow-x-auto rounded-none border-b border-secondary/20 bg-transparent p-0">
                        <TabsTrigger
                            value="tb"
                            className="rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                        >
                            Trial Balance
                        </TabsTrigger>
                        <TabsTrigger
                            value="balance-sheet"
                            className="rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                        >
                            Balance Sheet
                        </TabsTrigger>
                        <TabsTrigger
                            value="pl"
                            className="rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                        >
                            P&L
                        </TabsTrigger>
                        <TabsTrigger
                            value="close"
                            className="rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                        >
                            Close
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="tb" className="mt-4">
                        <Card className="shadow-none border-secondary/20">
                            <CardHeader className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <CardTitle className="text-base">Trial Balance</CardTitle>
                                    <div className="mt-1 text-xs text-muted-foreground">Account activity for {periodMonth}</div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-right">
                                    <ReportMetric label="Debits" value={tbDebit} />
                                    <ReportMetric label="Credits" value={tbCredit} />
                                    <ReportMetric label="Diff" value={tbDifference} valueClass={getSignedClass(tbDifference)} />
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto border-t border-ld">
                                    <Table>
                                        <THeader>
                                            <TRow>
                                                <THead className="min-w-56 px-2">Account</THead>
                                                <THead className="min-w-24 px-2">Type</THead>
                                                <THead className="min-w-28 px-2 text-right">Debit</THead>
                                                <THead className="min-w-28 px-2 text-right">Credit</THead>
                                                <THead className="min-w-28 px-2 text-right">Net</THead>
                                            </TRow>
                                        </THeader>
                                        <TBody>
                                            {trialBalanceRows.map((row) => (
                                                <TRow key={String(row.account_id ?? getAccountLabel(row))}>
                                                    <TCell className="text-sm px-2 py-2">{getAccountLabel(row)}</TCell>
                                                    <TCell className="text-sm px-2 py-2">{getTrialBalanceType(row)}</TCell>
                                                    <TCell className="text-sm px-2 py-2 text-right tabular-nums">
                                                        {formatMoney(row.debit ?? 0)}
                                                    </TCell>
                                                    <TCell className="text-sm px-2 py-2 text-right tabular-nums">
                                                        {formatMoney(row.credit ?? 0)}
                                                    </TCell>
                                                    <TCell className={`text-sm px-2 py-2 text-right tabular-nums ${getSignedClass(getTrialBalanceNet(row))}`}>
                                                        {formatMoney(getTrialBalanceNet(row))}
                                                    </TCell>
                                                </TRow>
                                            ))}
                                            {!isLoading && trialBalanceRows.length === 0 ? (
                                                <TRow>
                                                    <TCell className="px-2 py-3 text-sm text-muted-foreground" colSpan={5}>
                                                        No trial balance rows for this period.
                                                    </TCell>
                                                </TRow>
                                            ) : null}
                                        </TBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="balance-sheet" className="mt-4">
                        <Card className="shadow-none border-secondary/20">
                            <CardHeader className="flex flex-col gap-1 p-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="lg:basis-1/4">
                                    <CardTitle className="text-base">Balance Sheet</CardTitle>
                                    <div className="mt-1 text-xs text-muted-foreground">As of {toDate}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:basis-3/4">
                                    <ReportMetric label="Assets" value={bsAssetsTotal} />
                                    <ReportMetric label="Liabilities" value={bsLiabilitiesTotal} />
                                    <ReportMetric label="Equity" value={bsEquityTotal} />
                                    <ReportMetric label="Check" value={bsTotal} valueClass={getSignedClass(bsTotal)} />
                                </div>
                            </CardHeader>
                            <CardContent className="border-t border-ld p-0">
                                <HierarchicalStatementReport
                                    sections={balanceSheetSections}
                                    emptyLabel="No balance sheet rows for this period."
                                    defaultLabel="All Balance Sheet"
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="pl" className="mt-4">
                        <Card className="shadow-none border-secondary/20">
                            <CardHeader className="flex flex-col gap-3 p-4 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <CardTitle className="text-base">Profit & Loss</CardTitle>
                                    <div className="mt-1 text-xs text-muted-foreground">{fromDate} to {toDate}</div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 lg:max-w-[320px]">
                                    <ReportMetric label="Revenue" value={revenueTotal} />
                                    <ReportMetric label="Expenses" value={expenseTotal} />
                                    <ReportMetric label="Net" value={isTotal} valueClass={getSignedClass(isTotal)} />
                                </div>
                            </CardHeader>
                            <CardContent className="border-t border-ld p-0">
                                <HierarchicalStatementReport
                                    sections={incomeStatementSections}
                                    emptyLabel="No income statement rows for this period."
                                    defaultLabel="All Profit & Loss"
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="close" className="mt-4">
                        <Card className="shadow-none border-secondary/20">
                            <CardHeader className="p-4">
                                <CardTitle className="text-base">Close Period</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 flex flex-col gap-4 border-t border-ld">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <CloseStep title="Trial balance reviewed" />
                                    <CloseStep title="Statements reviewed" />
                                    <CloseStep title="Period ready to lock" />
                                </div>
                                <div className="flex justify-end">
                                    <Button className="h-9 rounded-full">Close Period</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </>
    );
};

const ReportMetric = ({ label, value, valueClass = 'text-[#172033]' }: { label: string; value: number; valueClass?: string }) => (
    <div className="min-w-0 rounded-md border border-secondary/20 bg-muted/20 px-2 py-2">
        <div className="text-[11px] font-medium uppercase text-muted-foreground">{label}</div>
        <div className={`mt-1 whitespace-nowrap font-mono text-sm font-semibold tabular-nums ${valueClass}`}>{formatMoney(value)}</div>
    </div>
);

const HierarchicalStatementReport = ({
    sections,
    emptyLabel,
    defaultLabel,
}: {
    sections: DisplayStatementSection[];
    emptyLabel: string;
    defaultLabel: string;
}) => {
    const [selectedKey, setSelectedKey] = useState('all');

    const nodes = useMemo<HierarchyNode[]>(() => {
        const allAccounts = sections.flatMap((section) => flattenSectionAccounts(section.section));
        const allTotal = sections.reduce((sum, section) => sum + section.total, 0);
        const hierarchy: HierarchyNode[] = [
            {
                key: 'all',
                label: defaultLabel,
                amount: allTotal,
                count: allAccounts.length,
                level: 0,
                accounts: allAccounts,
            },
        ];

        sections.forEach((displaySection) => {
            const sectionAccounts = flattenSectionAccounts(displaySection.section);
            hierarchy.push({
                key: displaySection.key,
                label: displaySection.title,
                amount: displaySection.total,
                count: sectionAccounts.length,
                level: 0,
                accounts: sectionAccounts,
                sectionKey: displaySection.key,
            });

            (displaySection.section?.level2 ?? []).forEach((level2, level2Index) => {
                const level2Accounts = (level2.level3 ?? []).flatMap((level3) => level3.posting_accounts ?? []);
                const level2Key = `${displaySection.key}-l2-${level2Index}-${level2.coa_group_level2 ?? 'none'}`;
                hierarchy.push({
                    key: level2Key,
                    label: getGroupLabel(level2.coa_group_level2, 'Unassigned'),
                    amount: getNumber(level2.amount),
                    count: level2Accounts.length,
                    level: 1,
                    accounts: level2Accounts,
                    sectionKey: displaySection.key,
                    level2Name: level2.coa_group_level2 ?? null,
                });

                (level2.level3 ?? []).forEach((level3, level3Index) => {
                    const level3Accounts = level3.posting_accounts ?? [];
                    hierarchy.push({
                        key: `${level2Key}-l3-${level3Index}-${level3.coa_group_level3 ?? 'none'}`,
                        label: getGroupLabel(level3.coa_group_level3, 'Unassigned'),
                        amount: getNumber(level3.amount),
                        count: level3Accounts.length,
                        level: 2,
                        accounts: level3Accounts,
                        sectionKey: displaySection.key,
                        level2Name: level2.coa_group_level2 ?? null,
                        level3Name: level3.coa_group_level3 ?? null,
                    });
                });
            });
        });

        return hierarchy;
    }, [defaultLabel, sections]);

    useEffect(() => {
        if (!nodes.some((node) => node.key === selectedKey)) {
            setSelectedKey('all');
        }
    }, [nodes, selectedKey]);

    const selectedNode = nodes.find((node) => node.key === selectedKey) ?? nodes[0];
    const selectedAccounts = useMemo(
        () =>
            [...(selectedNode?.accounts ?? [])].sort((a, b) =>
                getAccountCode(a).localeCompare(getAccountCode(b), undefined, { numeric: true }),
            ),
        [selectedNode],
    );

    const hasRows = nodes[0]?.count > 0;

    if (!hasRows) {
        return <div className="px-4 py-4 text-sm text-muted-foreground">{emptyLabel}</div>;
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="border-b border-ld lg:border-b-0 lg:border-r">
                <div className="max-h-[560px] overflow-y-auto p-2">
                    {nodes.map((node) => (
                        <button
                            key={node.key}
                            type="button"
                            className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-2 text-left transition-colors ${
                                selectedKey === node.key ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'
                            }`}
                            style={{ paddingLeft: `${8 + node.level * 18}px` }}
                            onClick={() => setSelectedKey(node.key)}
                        >
                            <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">{node.label}</span>
                                <span className="block text-xs text-muted-foreground">
                                    {node.count} {node.count === 1 ? 'account' : 'accounts'}
                                </span>
                            </span>
                            <span className="font-mono text-xs font-semibold tabular-nums">{formatMoney(node.amount)}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="min-w-0">
                <div className="flex items-center justify-between gap-3 border-b border-ld px-4 py-3">
                    <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{selectedNode?.label ?? defaultLabel}</div>
                        <div className="text-xs text-muted-foreground">
                            {selectedAccounts.length} {selectedAccounts.length === 1 ? 'posting account' : 'posting accounts'}
                        </div>
                    </div>
                    <div className="whitespace-nowrap font-mono text-sm font-semibold tabular-nums">
                        {formatMoney(selectedNode?.amount ?? 0)}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <Table>
                        <THeader>
                            <TRow>
                                <THead className="min-w-24 px-4">Code</THead>
                                <THead className="min-w-56 px-4">Account</THead>
                                <THead className="min-w-40 px-4">Group</THead>
                                <THead className="min-w-32 px-4 text-right">Amount</THead>
                            </TRow>
                        </THeader>
                        <TBody>
                            {selectedAccounts.map((row, index) => (
                                <TRow key={getReportRowKey(selectedNode?.key ?? 'statement', row, index)}>
                                    <TCell className="px-4 py-2 font-mono text-sm">{getAccountCode(row) || '-'}</TCell>
                                    <TCell className="px-4 py-2 text-sm">{getAccountName(row) || '-'}</TCell>
                                    <TCell className="px-4 py-2 text-sm text-muted-foreground">
                                        {getGroupLabel(row.coa_group_level3, getGroupLabel(row.coa_group_level2, '-'))}
                                    </TCell>
                                    <TCell className="px-4 py-2 text-right font-mono text-sm tabular-nums">
                                        {formatMoney(row.amount ?? 0)}
                                    </TCell>
                                </TRow>
                            ))}
                            {selectedAccounts.length === 0 ? (
                                <TRow>
                                    <TCell className="px-4 py-3 text-sm text-muted-foreground" colSpan={4}>
                                        No posting accounts in this group.
                                    </TCell>
                                </TRow>
                            ) : null}
                            <TRow className="bg-muted/20">
                                <TCell className="px-4 py-2 text-sm font-semibold" colSpan={3}>
                                    Total
                                </TCell>
                                <TCell className="px-4 py-2 text-right font-mono text-sm font-semibold tabular-nums">
                                    {formatMoney(selectedNode?.amount ?? 0)}
                                </TCell>
                            </TRow>
                        </TBody>
                    </Table>
                </div>
            </div>
        </div>
    );
};

const CloseStep = ({ title }: { title: string }) => (
    <div className="rounded-md border border-secondary/20 p-3">
        <div className="text-sm font-medium">{title}</div>
        <div className="mt-1 text-xs text-muted-foreground">Pending</div>
    </div>
);

export default Reports;
