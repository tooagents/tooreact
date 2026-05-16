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
    code?: string | null;
    name?: string | null;
    type?: string | null;
    debit?: number | string | null;
    credit?: number | string | null;
    net?: number | string | null;
};

type StatementRow = {
    account_id?: string | null;
    code?: string | null;
    name?: string | null;
    amount?: number | string | null;
};

type BalanceSheetReport = {
    as_of?: string | null;
    assets?: StatementRow[];
    liabilities?: StatementRow[];
    equity?: StatementRow[];
    totals?: {
        assets?: number | string | null;
        liabilities?: number | string | null;
        equity?: number | string | null;
    };
};

type IncomeStatementReport = {
    from_date?: string | null;
    to_date?: string | null;
    revenue?: StatementRow[];
    expenses?: StatementRow[];
    totals?: {
        revenue?: number | string | null;
        expenses?: number | string | null;
        net_income?: number | string | null;
    };
};

type StatementSection = {
    title: string;
    rows: StatementRow[];
    total: number;
    totalLabel: string;
};

const getNumber = (value: unknown) => {
    const numberValue = Number(value ?? 0);
    return Number.isFinite(numberValue) ? numberValue : 0;
};

const getAccountLabel = (row: StatementRow | TrialBalanceRow) => {
    const code = String(row.code ?? '').trim();
    const name = String(row.name ?? '').trim();
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

const getReportRowKey = (section: string, row: StatementRow, index: number) =>
    `${section}-${row.account_id ?? row.code ?? row.name ?? index}`;

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
    const bsAssetsTotal = getNumber(balanceSheet.totals?.assets);
    const bsLiabilitiesTotal = getNumber(balanceSheet.totals?.liabilities);
    const bsEquityTotal = getNumber(balanceSheet.totals?.equity);
    const bsTotal = bsAssetsTotal - bsLiabilitiesTotal - bsEquityTotal;
    const revenueTotal = getNumber(incomeStatement.totals?.revenue);
    const expenseTotal = getNumber(incomeStatement.totals?.expenses);
    const isTotal = getNumber(incomeStatement.totals?.net_income);

    const balanceSheetSections = useMemo<StatementSection[]>(() => [
        { title: 'Assets', rows: balanceSheet.assets ?? [], total: bsAssetsTotal, totalLabel: 'Total Assets' },
        { title: 'Liabilities', rows: balanceSheet.liabilities ?? [], total: bsLiabilitiesTotal, totalLabel: 'Total Liabilities' },
        { title: 'Equity', rows: balanceSheet.equity ?? [], total: bsEquityTotal, totalLabel: 'Total Equity' },
    ], [balanceSheet, bsAssetsTotal, bsEquityTotal, bsLiabilitiesTotal]);

    const incomeStatementSections = useMemo<StatementSection[]>(() => [
        { title: 'Revenue', rows: incomeStatement.revenue ?? [], total: revenueTotal, totalLabel: 'Total Revenue' },
        { title: 'Expenses', rows: incomeStatement.expenses ?? [], total: expenseTotal, totalLabel: 'Total Expenses' },
    ], [expenseTotal, incomeStatement, revenueTotal]);

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
                            value="bs"
                            className="rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                        >
                            Balance Sheet
                        </TabsTrigger>
                        <TabsTrigger
                            value="is"
                            className="rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                        >
                            Income Statement
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
                                                    <TCell className="text-sm px-2 py-2 capitalize">{row.type || '-'}</TCell>
                                                    <TCell className="text-sm px-2 py-2 text-right tabular-nums">
                                                        {formatMoney(row.debit ?? 0)}
                                                    </TCell>
                                                    <TCell className="text-sm px-2 py-2 text-right tabular-nums">
                                                        {formatMoney(row.credit ?? 0)}
                                                    </TCell>
                                                    <TCell className={`text-sm px-2 py-2 text-right tabular-nums ${getSignedClass(getNumber(row.net))}`}>
                                                        {formatMoney(row.net ?? 0)}
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

                    <TabsContent value="bs" className="mt-4">
                        <Card className="shadow-none border-secondary/20">
                            <CardHeader className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <CardTitle className="text-base">Balance Sheet</CardTitle>
                                    <div className="mt-1 text-xs text-muted-foreground">As of {toDate}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    <ReportMetric label="Assets" value={bsAssetsTotal} />
                                    <ReportMetric label="Liabilities" value={bsLiabilitiesTotal} />
                                    <ReportMetric label="Equity" value={bsEquityTotal} />
                                    <ReportMetric label="Check" value={bsTotal} valueClass={getSignedClass(bsTotal)} />
                                </div>
                            </CardHeader>
                            <CardContent className="border-t border-ld p-0">
                                <StatementReport sections={balanceSheetSections} emptyLabel="No balance sheet rows for this period." />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="is" className="mt-4">
                        <Card className="shadow-none border-secondary/20">
                            <CardHeader className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <CardTitle className="text-base">Income Statement</CardTitle>
                                    <div className="mt-1 text-xs text-muted-foreground">{fromDate} to {toDate}</div>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <ReportMetric label="Revenue" value={revenueTotal} />
                                    <ReportMetric label="Expenses" value={expenseTotal} />
                                    <ReportMetric label="Net" value={isTotal} valueClass={getSignedClass(isTotal)} />
                                </div>
                            </CardHeader>
                            <CardContent className="border-t border-ld p-0">
                                <StatementReport sections={incomeStatementSections} emptyLabel="No income statement rows for this period." />
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
    <div className="min-w-[112px] rounded-md border border-secondary/20 bg-muted/20 px-3 py-2">
        <div className="text-[11px] font-medium uppercase text-muted-foreground">{label}</div>
        <div className={`mt-1 font-mono text-sm font-semibold tabular-nums ${valueClass}`}>{formatMoney(value)}</div>
    </div>
);

const StatementReport = ({ sections, emptyLabel }: { sections: StatementSection[]; emptyLabel: string }) => {
    const hasRows = sections.some((section) => section.rows.length > 0);

    if (!hasRows) {
        return <div className="px-4 py-4 text-sm text-muted-foreground">{emptyLabel}</div>;
    }

    return (
        <div className="divide-y divide-ld">
            {sections.map((section) => (
                <div key={section.title}>
                    <div className="flex items-center justify-between bg-muted/30 px-4 py-2">
                        <div className="text-xs font-semibold uppercase text-muted-foreground">{section.title}</div>
                        <div className="font-mono text-xs font-semibold tabular-nums">{formatMoney(section.total)}</div>
                    </div>
                    <div className="overflow-x-auto">
                        <Table>
                            <TBody>
                                {section.rows.map((row, index) => (
                                    <TRow key={getReportRowKey(section.title, row, index)}>
                                        <TCell className="px-4 py-2 text-sm">{getAccountLabel(row)}</TCell>
                                        <TCell className="px-4 py-2 text-right font-mono text-sm tabular-nums">
                                            {formatMoney(row.amount ?? 0)}
                                        </TCell>
                                    </TRow>
                                ))}
                                {section.rows.length === 0 ? (
                                    <TRow>
                                        <TCell className="px-4 py-2 text-sm text-muted-foreground" colSpan={2}>
                                            No {section.title.toLowerCase()} rows.
                                        </TCell>
                                    </TRow>
                                ) : null}
                                <TRow className="bg-muted/20">
                                    <TCell className="px-4 py-2 text-sm font-semibold">{section.totalLabel}</TCell>
                                    <TCell className="px-4 py-2 text-right font-mono text-sm font-semibold tabular-nums">
                                        {formatMoney(section.total)}
                                    </TCell>
                                </TRow>
                            </TBody>
                        </Table>
                    </div>
                </div>
            ))}
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
