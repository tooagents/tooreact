import { useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import BreadcrumbComp from 'src/_layouts/shared/breadcrumb/BreadcrumbComp';
import CardBox from 'src/components/shared/CardBox';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { notifyToast } from 'src/core/toast';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from 'src/components/ui/dialog';

type IntegrationOption = {
    key: string;
    name: string;
    subtitle: string;
    icon: string;
    accent: string;
    summary: string;
};

const integrationOptions: IntegrationOption[] = [
    {
        key: 'growthzone',
        name: 'GrowthZone',
        subtitle: 'Member + CRM data',
        icon: 'solar:users-group-rounded-linear',
        accent: 'from-[#0f8a6a] to-[#6ad7b1]',
        summary: 'Sync member, event, and billing records with your CRM workflows.',
    },
    {
        key: 'sap',
        name: 'SAP',
        subtitle: 'Enterprise ERP sync',
        icon: 'simple-icons:sap',
        accent: 'from-[#0f4da8] to-[#4fa3ff]',
        summary: 'Keep GL accounts, cost centers, and payroll exports aligned with SAP.',
    },
    {
        key: 'hyperion',
        name: 'Hyperion',
        subtitle: 'Planning + reporting',
        icon: 'simple-icons:oracle',
        accent: 'from-[#b22e2e] to-[#ff7d7d]',
        summary: 'Map payroll data into Hyperion for forecasting and variance analysis.',
    },
    {
        key: 'quickbooks',
        name: 'QuickBooks',
        subtitle: 'Accounting automation',
        icon: 'simple-icons:intuit',
        accent: 'from-[#2e7d32] to-[#77e88d]',
        summary: 'Send payroll journals, vendor payments, and tax summaries to QuickBooks.',
    },
    {
        key: 'salesforce',
        name: 'Salesforce',
        subtitle: 'Sales + service data',
        icon: 'simple-icons:salesforce',
        accent: 'from-[#006bd6] to-[#78c8ff]',
        summary: 'Unify payroll and customer insights with Salesforce dashboards.',
    },
    {
        key: 'netsuite',
        name: 'NetSuite',
        subtitle: 'Financial ERP sync',
        icon: 'simple-icons:oracle',
        accent: 'from-[#2d3a8c] to-[#8aa6ff]',
        summary: 'Automate payroll journals and reconcile costs inside NetSuite.',
    },
    {
        key: 'workday',
        name: 'Workday',
        subtitle: 'HR + finance operations',
        icon: 'simple-icons:workday',
        accent: 'from-[#f36f21] to-[#ffb47a]',
        summary: 'Connect payroll and HR data for unified workforce reporting.',
    },
    {
        key: 'adp',
        name: 'ADP',
        subtitle: 'Payroll platform sync',
        icon: 'simple-icons:adp',
        accent: 'from-[#e31937] to-[#ff8f9a]',
        summary: 'Coordinate payroll summaries and tax files across systems.',
    },
    {
        key: 'sage-intacct',
        name: 'Sage Intacct',
        subtitle: 'Financial reporting',
        icon: 'simple-icons:sage',
        accent: 'from-[#29b257] to-[#86f2a8]',
        summary: 'Keep GL postings and departmental allocations aligned in Sage Intacct.',
    },
    {
        key: 'servicenow',
        name: 'ServiceNow',
        subtitle: 'Service workflows',
        icon: 'simple-icons:servicenow',
        accent: 'from-[#38d430] to-[#98ff7a]',
        summary: 'Automate service requests and approvals tied to payroll operations.',
    },
    {
        key: 'paypal',
        name: 'PayPal',
        subtitle: 'Payments and payouts',
        icon: 'simple-icons:paypal',
        accent: 'from-[#003087] to-[#4e9bff]',
        summary: 'Coordinate reimbursements and payouts alongside payroll runs.',
    },
    {
        key: 'stripe',
        name: 'Stripe',
        subtitle: 'Payment processing',
        icon: 'simple-icons:stripe',
        accent: 'from-[#635bff] to-[#a9a3ff]',
        summary: 'Sync payment data and fees for reconciliation and reporting.',
    },
];

const breadcrumbItems = [
    { to: '/app', title: 'Home' },
    { title: 'Support' },
    { title: 'Integration' },
];

const Integration = () => {
    const [selected, setSelected] = useState<IntegrationOption | null>(null);
    const [refreshSkip, setRefreshSkip] = useState('0');
    const [refreshTop, setRefreshTop] = useState('100');
    const [refreshLoading, setRefreshLoading] = useState(false);
    const [refreshStatus, setRefreshStatus] = useState<string | null>(null);
    const [refreshOpen, setRefreshOpen] = useState(false);

    const [rangeStart, setRangeStart] = useState('');
    const [rangeEnd, setRangeEnd] = useState('');
    const [rangeCreatedBy, setRangeCreatedBy] = useState('');
    const [rangeLoading, setRangeLoading] = useState(false);
    const [rangeStatus, setRangeStatus] = useState<string | null>(null);
    const [invoiceNumbers, setInvoiceNumbers] = useState<string[]>([]);
    const [rangeOpen, setRangeOpen] = useState(false);

    const handleRefreshInvoices = () => {
        const skipValue = refreshSkip.trim();
        const topValue = refreshTop.trim();

        if (!skipValue || !topValue) {
            notifyToast({
                message: 'Please enter both a skip and top value to continue.',
                variant: 'error',
            });
            return;
        }

        setRefreshLoading(true);
        setRefreshStatus(null);

        const params = new URLSearchParams({
            skip: skipValue,
            top: topValue,
        });
        const noticeMessage = 'Refresh started. Updates can take up to 10 minutes to appear.';
        setRefreshStatus(noticeMessage);
        notifyToast({
            message: noticeMessage,
            variant: 'success',
        });
        setRefreshLoading(false);

        void fetch(`https://growthzone.fastapicloud.dev/refresh_open?${params.toString()}`)
            .then((response) => {
                if (response.status === 409) {
                    const duplicateMessage =
                        'Looks like a refresh is already running. No action is needed from you.';
                    setRefreshStatus(duplicateMessage);
                    notifyToast({
                        message: duplicateMessage,
                        variant: 'success',
                    });
                    return;
                }
                if (!response.ok) {
                    throw new Error(`Refresh failed with status ${response.status}`);
                }
            })
            .catch((error) => {
                console.error(error);
                const gentleMessage =
                    'We could not start the refresh right now. If you already submitted one, it may still be processing.';
                setRefreshStatus(gentleMessage);
                notifyToast({
                    message: gentleMessage,
                    variant: 'error',
                });
            });
    };

    const handleMyInvoices = async () => {
        const startValue = rangeStart.trim();
        const endValue = rangeEnd.trim();
        const createdByValue = rangeCreatedBy.trim();

        if (!startValue || !endValue || !createdByValue) {
            notifyToast({
                message: 'Please enter a start, end, and created by value to continue.',
                variant: 'error',
            });
            return;
        }

        setRangeLoading(true);
        setRangeStatus(null);
        setInvoiceNumbers([]);
        try {
            const params = new URLSearchParams({
                start: startValue,
                end: endValue,
                created_by: createdByValue,
            });
            const response = await fetch(
                `https://growthzone.fastapicloud.dev/refresh_open_range?${params.toString()}`
            );
            if (response.status === 409) {
                const duplicateMessage =
                    'That range was already requested. We will keep using the existing results.';
                setRangeStatus(duplicateMessage);
                notifyToast({
                    message: duplicateMessage,
                    variant: 'success',
                });
                return;
            }
            if (!response.ok) {
                const contentType = response.headers.get('content-type') ?? '';
                let errorDetail = '';
                if (contentType.includes('application/json')) {
                    const jsonBody = await response.json().catch(() => null);
                    errorDetail =
                        typeof jsonBody?.detail === 'string'
                            ? jsonBody.detail
                            : JSON.stringify(jsonBody ?? {});
                } else {
                    errorDetail = await response.text().catch(() => '');
                }
                const normalizedDetail = errorDetail.trim();
                const message = normalizedDetail
                    ? `Fetch failed with status ${response.status}: ${normalizedDetail}`
                    : `Fetch failed with status ${response.status}`;
                throw new Error(message);
            }
            const data = await response.json();
            const numbers = Array.isArray(data?.invoice_numbers)
                ? data.invoice_numbers.map((value: unknown) => String(value))
                : [];
            setInvoiceNumbers(numbers);
            setRangeStatus(
                `Requested ${data?.requested ?? 0}, found ${data?.found ?? 0}, ingested ${data?.ingested ?? 0}, failed ${data?.failed ?? 0}.`
            );
        } catch (error) {
            console.error(error);
            const message =
                error instanceof Error
                    ? error.message
                    : 'Fetch failed with an unknown error.';
            setRangeStatus(message);
            notifyToast({
                message,
                variant: 'error',
            });
        } finally {
            setRangeLoading(false);
        }
    };

    const supportMessage = useMemo(() => {
        if (!selected) {
            return 'Select an integration to view the recommended onboarding and support approach.';
        }
        return `Interested in ${selected.name}? Our integration specialists will guide requirements, mapping, and validation.`;
    }, [selected]);

    return (
        <div className="flex flex-col gap-6">
            

            <CardBox className="p-6 overflow-hidden relative border-none bg-[radial-gradient(circle_at_top_left,rgba(242,133,0,0.18),transparent_55%),radial-gradient(circle_at_top_right,rgba(242,133,0,0.16),transparent_48%)]">
                <div className="flex flex-col gap-3">
                    <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                        Integration Services
                    </span>
                    <h2 className="text-2xl font-semibold text-sidebar-foreground">
                        Connect payroll data to your core business systems.
                    </h2>
                    <p className="text-sm text-muted-foreground max-w-2xl">
                        Choose an integration below and we will tailor onboarding, data mapping, and validation with your team.
                    </p>
                </div>
            </CardBox>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {integrationOptions.map((option) => {
                    const isSelected = selected?.key === option.key;
                    const isGrowthZone = option.key === 'growthzone';
                    return (
                        <CardBox
                            key={option.key}
                            className={`p-5 transition-all duration-200 border-ld cursor-pointer group ${isSelected ? 'ring-2 ring-primary/60 shadow-sm' : 'hover:-translate-y-0.5'
                                }`}
                            onClick={() => setSelected(option)}
                        >
                            <div className="flex items-start gap-4">
                                <div
                                    className={`h-12 w-12 rounded-xl bg-gradient-to-br ${option.accent} flex items-center justify-center text-white shadow-md`}
                                >
                                    <Icon icon={option.icon} height={22} width={22} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-sidebar-foreground">{option.name}</h3>
                                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                        {option.subtitle}
                                    </p>
                                </div>
                            </div>
                            <p className="mt-4 text-sm text-muted-foreground">{option.summary}</p>
                            {!isGrowthZone && (
                                <div className="mt-5 flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">Request onboarding support</span>
                                    <Button
                                        size="sm"
                                        variant={isSelected ? 'default' : 'outline'}
                                        className="group-hover:translate-x-0.5 transition-transform"
                                    >
                                        {isSelected ? 'Selected' : 'Contact support'}
                                    </Button>
                                </div>
                            )}

                            {isGrowthZone && (
                                <div className="mt-5 flex items-center justify-end gap-2">
                                    {/* <Button
                                        size="sm"
                                        className="whitespace-nowrap"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setRefreshOpen(true);
                                        }}
                                    >
                                        Refresh Invoices
                                    </Button> */}
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="whitespace-nowrap"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setRangeOpen(true);
                                        }}
                                    >
                                        My Invoices
                                    </Button>
                                </div>
                            )}
                        </CardBox>
                    );
                })}
            </div>

            <CardBox className="p-5 border-none bg-lightsecondary">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h4 className="text-base font-semibold text-sidebar-foreground">Support guidance</h4>
                        <p className="text-sm text-muted-foreground">{supportMessage}</p>
                    </div>
                    <Button className="whitespace-nowrap">Request support assistance</Button>
                </div>
            </CardBox>

            <Dialog open={refreshOpen} onOpenChange={setRefreshOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Refresh GrowthZone Invoices</DialogTitle>
                        <DialogDescription>
                            Provide the paging values to refresh open invoices.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 gap-4">
                        <Input
                            type="number"
                            min={0}
                            value={refreshSkip}
                            onChange={(event) => setRefreshSkip(event.target.value)}
                            placeholder="Skip"
                        />
                        <Input
                            type="number"
                            min={1}
                            value={refreshTop}
                            onChange={(event) => setRefreshTop(event.target.value)}
                            placeholder="Top"
                        />
                        {refreshStatus && (
                            <p className="text-xs text-muted-foreground">{refreshStatus}</p>
                        )}
                    </div>
                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setRefreshOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleRefreshInvoices}
                            disabled={refreshLoading}
                        >
                            {refreshLoading ? 'Refreshing...' : 'Run Refresh'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={rangeOpen} onOpenChange={setRangeOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>GrowthZone My Invoices</DialogTitle>
                        <DialogDescription>
                            Enter the invoice range and creator to retrieve invoice numbers.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 gap-4">
                        <Input
                            value={rangeStart}
                            onChange={(event) => setRangeStart(event.target.value)}
                            placeholder="Start invoice number"
                        />
                        <Input
                            value={rangeEnd}
                            onChange={(event) => setRangeEnd(event.target.value)}
                            placeholder="End invoice number"
                        />
                        <Input
                            value={rangeCreatedBy}
                            onChange={(event) => setRangeCreatedBy(event.target.value)}
                            placeholder="Created by"
                        />
                        {rangeStatus && (
                            <p className="text-xs text-muted-foreground">{rangeStatus}</p>
                        )}
                        {invoiceNumbers.length > 0 && (
                            <div className="rounded-md bg-lightsecondary p-3">
                                <p className="text-xs font-semibold text-sidebar-foreground">Invoice numbers</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {invoiceNumbers.map((number) => (
                                        <span
                                            key={number}
                                            className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-sidebar-foreground shadow-sm"
                                        >
                                            {number}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setRangeOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleMyInvoices}
                            disabled={rangeLoading}
                        >
                            {rangeLoading ? 'Loading...' : 'Fetch Invoices'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Integration;
