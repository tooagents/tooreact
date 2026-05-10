import { Badge } from 'src/components/ui/badge';
import BreadcrumbComp from 'src/_layouts/shared/breadcrumb/BreadcrumbComp';
import { Button } from 'src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/ui/card';
import { Table, TBody, TCell, THead, THeader, TRow } from 'src/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'src/components/ui/tabs';
import { formatMoney } from 'src/core/format';

const BCrumb = [{ to: '/', title: 'Home' }, { title: 'Reports' }];

const trialBalanceRows = [
    { account: '1000 Cash', debit: 0, credit: 0 },
    { account: '2000 Accounts Payable', debit: 0, credit: 0 },
    { account: '4000 Revenue', debit: 0, credit: 0 },
    { account: '6000 Payroll Expense', debit: 0, credit: 0 },
];

const balanceSheetRows = [
    { section: 'Assets', account: 'Cash', amount: 0 },
    { section: 'Liabilities', account: 'Accounts Payable', amount: 0 },
    { section: 'Equity', account: 'Owner Equity', amount: 0 },
];

const incomeStatementRows = [
    { section: 'Income', account: 'Revenue', amount: 0 },
    { section: 'Expenses', account: 'Payroll Expense', amount: 0 },
    { section: 'Expenses', account: 'Operating Expense', amount: 0 },
];

const Reports = () => {
    const tbDebit = trialBalanceRows.reduce((sum, row) => sum + row.debit, 0);
    const tbCredit = trialBalanceRows.reduce((sum, row) => sum + row.credit, 0);
    const bsTotal = balanceSheetRows.reduce((sum, row) => sum + row.amount, 0);
    const isTotal = incomeStatementRows.reduce((sum, row) => sum + row.amount, 0);

    const headBoxes = (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <Card className="w-[150px] gap-1 p-3 rounded-md shadow-none border-secondary/20 bg-transparent">
                <CardHeader className="p-0 pb-1">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Period</CardTitle>
                </CardHeader>
                <CardContent className="p-0 text-sm font-semibold">Open</CardContent>
            </Card>
            <Card className="w-[150px] gap-1 p-3 rounded-md shadow-none border-secondary/20 bg-transparent">
                <CardHeader className="p-0 pb-1">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Badge className="rounded-full bg-blue-100 text-blue-700">Review</Badge>
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
                                A focused review set for checking the books and closing the period.
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" className="h-9 rounded-full">
                                Refresh
                            </Button>
                            <Button className="h-9 rounded-full">
                                Export
                            </Button>
                        </div>
                    </CardContent>
                </Card>

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
                            <CardHeader className="p-4 flex flex-row items-center justify-between gap-3">
                                <CardTitle className="text-base">Trial Balance</CardTitle>
                                <div className="text-sm text-muted-foreground">
                                    Debits {formatMoney(tbDebit)} / Credits {formatMoney(tbCredit)}
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto border-t border-ld">
                                    <Table>
                                        <THeader>
                                            <TRow>
                                                <THead className="min-w-56 px-2">Account</THead>
                                                <THead className="min-w-28 px-2 text-right">Debit</THead>
                                                <THead className="min-w-28 px-2 text-right">Credit</THead>
                                            </TRow>
                                        </THeader>
                                        <TBody>
                                            {trialBalanceRows.map((row) => (
                                                <TRow key={row.account}>
                                                    <TCell className="text-sm px-2 py-2">{row.account}</TCell>
                                                    <TCell className="text-sm px-2 py-2 text-right tabular-nums">
                                                        {formatMoney(row.debit)}
                                                    </TCell>
                                                    <TCell className="text-sm px-2 py-2 text-right tabular-nums">
                                                        {formatMoney(row.credit)}
                                                    </TCell>
                                                </TRow>
                                            ))}
                                        </TBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="bs" className="mt-4">
                        <Card className="shadow-none border-secondary/20">
                            <CardHeader className="p-4 flex flex-row items-center justify-between gap-3">
                                <CardTitle className="text-base">Balance Sheet</CardTitle>
                                <div className="text-sm text-muted-foreground">Total {formatMoney(bsTotal)}</div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <ReportTable rows={balanceSheetRows} />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="is" className="mt-4">
                        <Card className="shadow-none border-secondary/20">
                            <CardHeader className="p-4 flex flex-row items-center justify-between gap-3">
                                <CardTitle className="text-base">Income Statement</CardTitle>
                                <div className="text-sm text-muted-foreground">Net {formatMoney(isTotal)}</div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <ReportTable rows={incomeStatementRows} />
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

const ReportTable = ({ rows }: { rows: Array<{ section: string; account: string; amount: number }> }) => (
    <div className="overflow-x-auto border-t border-ld">
        <Table>
            <THeader>
                <TRow>
                    <THead className="min-w-36 px-2">Section</THead>
                    <THead className="min-w-56 px-2">Account</THead>
                    <THead className="min-w-28 px-2 text-right">Amount</THead>
                </TRow>
            </THeader>
            <TBody>
                {rows.map((row) => (
                    <TRow key={`${row.section}-${row.account}`}>
                        <TCell className="text-sm px-2 py-2">{row.section}</TCell>
                        <TCell className="text-sm px-2 py-2">{row.account}</TCell>
                        <TCell className="text-sm px-2 py-2 text-right tabular-nums">
                            {formatMoney(row.amount)}
                        </TCell>
                    </TRow>
                ))}
            </TBody>
        </Table>
    </div>
);

const CloseStep = ({ title }: { title: string }) => (
    <div className="rounded-md border border-secondary/20 p-3">
        <div className="text-sm font-medium">{title}</div>
        <div className="mt-1 text-xs text-muted-foreground">Pending</div>
    </div>
);

export default Reports;
