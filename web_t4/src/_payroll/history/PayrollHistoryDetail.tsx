import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import BreadcrumbComp from 'src/_layouts/shared/breadcrumb/BreadcrumbComp';
import { historyAPI, PayrollHistoryDetailResponse, PayrollHistoryResponse } from 'src/_payroll/history/payroll-history-api';
import { Badge } from 'src/components/ui/badge';
import { Button } from 'src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/ui/card';
import { Input } from 'src/components/ui/input';
import { Table, TBody, TCell, THead, THeader, TRow } from 'src/components/ui/table';
import CardBox from 'src/components/shared/CardBox';
import LoadingSpinner from 'src/components/shared/LoadingSpinner';
import { formatDate, formatMoney, formatMoneyInteger, toNumber } from 'src/core/format';
import { CornerUpLeft } from 'lucide-react';
import { jsPDF } from 'jspdf';

const BCrumb = [
    { to: '/', title: 'Home' },
    { title: 'Payroll' },
];

const pageSize = 20;

const toTitleCase = (value?: string) =>
    (value ?? '-').replace(/[_-]+/g, ' ').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());

const statusClass = (status?: string) => {
    const normalized = (status ?? '').trim().toLowerCase();
    if (normalized === 'approved' || normalized === 'completed' || normalized === 'finalized') {
        return 'bg-green-100 text-green-700';
    }
    if (normalized === 'draft') return 'bg-transparent border border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-300';
    return 'bg-blue-100 text-blue-700';
};

const toDisplay = (value?: string | number | null) =>
    value === null || value === undefined || value === '' ? '-' : String(value);

const toMoneyDisplay = (value?: unknown) =>
    value === null || value === undefined || value === '' ? '-' : formatMoney(value);

const toDateDisplay = (value?: string | null) => (value ? formatDate(value) : '-');

const getPeriodsPerYear = (frequency?: string | null) => {
    const value = frequency?.toLowerCase?.() ?? '';
    if (value === 'weekly') return 52;
    if (value === 'biweekly') return 26;
    if (value === 'semimonthly') return 24;
    if (value === 'monthly') return 12;
    return null;
};

const parseNumberValue = (value?: string | number | null) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const resolvePayFrequency = (item: PayrollHistoryResponse, summary?: PayrollHistoryResponse | null) => {
    const itemFreq = (item as { pay_frequency?: string | null }).pay_frequency;
    const summaryFreq = summary ? (summary as { pay_frequency?: string | null }).pay_frequency : null;
    return itemFreq ?? summaryFreq ?? null;
};

const resolvePeriodLabel = (item: PayrollHistoryResponse, summary?: PayrollHistoryResponse | null) => {
    const start = item.period_start ?? summary?.period_start;
    const end = item.period_end ?? summary?.period_end;
    if (start && end) return `${formatDate(start)} - ${formatDate(end)}`;
    return '-';
};

const toFileNamePart = (value?: string | null) => {
    const normalized = (value ?? '')
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return normalized || 'employee';
};

const toPeriodTokenFromDate = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${month}${date.getFullYear()}`;
};

const resolvePaystubFilename = (item: PayrollHistoryResponse, summary?: PayrollHistoryResponse | null) => {
    const name = toFileNamePart(item.full_name);
    const periodToken =
        toPeriodTokenFromDate(
            item.pay_date ??
                item.pay_day ??
                summary?.pay_date ??
                summary?.pay_day ??
                item.period_end ??
                item.period_start,
        ) ??
        String(item.period_key ?? summary?.period_key ?? 'paystub');
    return `paystub-${name}-${periodToken}.pdf`;
};

const getEmployeeKey = (item: PayrollHistoryResponse) =>
    String(item.employee_id ?? item.full_name ?? item.id ?? item.history_id ?? 'employee');

const resolveRateForEntry = (item: PayrollHistoryResponse, summary?: PayrollHistoryResponse | null) => {
    const employmentType = (item.employment_type ?? '').toLowerCase();
    if (employmentType === 'salary') {
        const annual = parseNumberValue(item.annual_salary_snapshot);
        if (annual === null) return null;
        const periods = getPeriodsPerYear(resolvePayFrequency(item, summary));
        return periods ? annual / periods : annual;
    }
    return parseNumberValue(item.hourly_rate_snapshot);
};

type PayrollTotals = {
    gross: number;
    total_deduction: number;
    net: number;
    tax: number;
    cpp: number;
    ei: number;
    bonus: number;
    vacation: number;
    regular_hours: number;
    overtime_hours: number;
    adjustment: number;
};


const createPaystubPdfBlob = (
    entries: PayrollHistoryResponse[],
    summary?: PayrollHistoryResponse | null,
) => {
    const base = entries[0];
    const totals = entries.reduce<PayrollTotals>(
        (acc, item) => {
            acc.gross += toNumber(item.gross);
            acc.total_deduction += toNumber(item.total_deduction);
            acc.net += toNumber(item.net);
            acc.tax += toNumber(item.tax);
            acc.cpp += toNumber(item.cpp);
            acc.ei += toNumber(item.ei);
            acc.bonus += toNumber(item.bonus);
            acc.vacation += toNumber(item.vacation);
            acc.regular_hours += toNumber(item.regular_hours);
            acc.overtime_hours += toNumber(item.overtime_hours);
            acc.adjustment += toNumber(item.adjustment);
            return acc;
        },
        {
            gross: 0,
            total_deduction: 0,
            net: 0,
            tax: 0,
            cpp: 0,
            ei: 0,
            bonus: 0,
            vacation: 0,
            regular_hours: 0,
            overtime_hours: 0,
            adjustment: 0,
        },
    );
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const margin = 40;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - margin * 2;
    const colWidth = contentWidth / 2;
    const left = margin;
    const right = pageWidth - margin;
    let y = 36;
    const lineColor = '#bfbfbf';
    const headerFill = '#e6e6e6';

    const drawLabelValue = (x: number, yPos: number, label: string, value: string) => {
        doc.setFont('helvetica', 'bold');
        doc.text(label, x, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(value, x + 90, yPos);
    };

    const drawHeaderBar = (x: number, yPos: number, width: number, title: string) => {
        doc.setFillColor(headerFill);
        doc.rect(x, yPos, width, 16, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(title, x + 6, yPos + 11);
    };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('16842291 Canada Inc. (O/A) J Fencing Center', pageWidth / 2, y, { align: 'center' });
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('600 Gordon Baker Rd, North York, ON M2H 3B4', pageWidth / 2, y, { align: 'center' });
    y += 16;

    const infoTop = y;
    const infoHeaderHeight = 16;
    const infoRowHeight = 14;
    const infoRows = 4;
    const infoHeight = infoHeaderHeight + infoRowHeight * infoRows;

    doc.setDrawColor(lineColor);
    doc.rect(left, infoTop, contentWidth, infoHeight);
    doc.line(left + colWidth, infoTop, left + colWidth, infoTop + infoHeight);
    drawHeaderBar(left, infoTop, colWidth, 'Employee Information');
    drawHeaderBar(left + colWidth, infoTop, colWidth, 'Pay Information');

    doc.setFontSize(8.5);
    const infoBaseY = infoTop + infoHeaderHeight + 12;
    const leftInfo: Array<[string, string]> = [
        ['Employee Name', base.full_name ?? '-'],
        ['Employee ID', String(base.employee_id ?? '-')],
        ['Address', String((base as { address?: string }).address ?? '-')],
        ['Job Title', String((base as { job_title?: string }).job_title ?? '-')],
    ];
    const rightInfo: Array<[string, string]> = [
        ['Pay Period', resolvePeriodLabel(base, summary)],
        ['Pay Date', toDateDisplay(base.pay_date ?? base.pay_day ?? summary?.pay_date ?? summary?.pay_day)],
        ['Pay Frequency', String((base as { pay_frequency?: string }).pay_frequency ?? '-')],
        ['Department', String((base as { department?: string }).department ?? '-')],
    ];
    leftInfo.forEach(([label, value], index) => {
        const rowY = infoBaseY + index * infoRowHeight;
        drawLabelValue(left + 6, rowY, label, value);
    });
    rightInfo.forEach(([label, value], index) => {
        const rowY = infoBaseY + index * infoRowHeight;
        drawLabelValue(left + colWidth + 6, rowY, label, value);
    });

    y = infoTop + infoHeight + 18;

    const tableHeaderHeight = 16;
    drawHeaderBar(left, y, colWidth, 'EARNINGS');
    drawHeaderBar(left + colWidth, y, colWidth, 'DEDUCTIONS');
    doc.setDrawColor(lineColor);
    doc.rect(left, y, contentWidth, tableHeaderHeight);
    y += tableHeaderHeight;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    const earnCols = [
        { label: 'Description', width: 110, align: 'left' as const },
        { label: 'Hours', width: 32, align: 'right' as const },
        { label: 'Rate', width: 42, align: 'right' as const },
        { label: 'Current', width: 50, align: 'right' as const },
        { label: 'YTD', width: 32, align: 'right' as const },
    ];
    const dedCols = [
        { label: 'Deduction', width: 140, align: 'left' as const },
        { label: 'Current', width: 60, align: 'right' as const },
        { label: 'YTD', width: 66, align: 'right' as const },
    ];

    const writeColumnHeaders = (startX: number, cols: { label: string; width: number; align: 'left' | 'right' }[]) => {
        let xPos = startX;
        cols.forEach((col) => {
            const textX = col.align === 'right' ? xPos + col.width - 2 : xPos + 2;
            doc.text(col.label, textX, y + 12, { align: col.align });
            xPos += col.width;
        });
    };
    writeColumnHeaders(left, earnCols);
    writeColumnHeaders(left + colWidth, dedCols);

    const dataStartY = y + 12 + 12;
    const rowHeight = 12;

    const earningsRows: Array<{
        desc: string;
        hours: string;
        rate: string;
        current: string;
        ytd: string;
        isTotal?: boolean;
    }> = entries.flatMap((entry) => {
        const rate = resolveRateForEntry(entry, summary);
        const rateDisplay = rate === null ? '-' : toMoneyDisplay(rate);
        return [
            {
                desc: 'Regular Pay',
                hours: toDisplay(entry.regular_hours),
                rate: rateDisplay,
                current: '-',
                ytd: '-',
            },
            {
                desc: 'Overtime Pay',
                hours: toDisplay(entry.overtime_hours),
                rate: rateDisplay,
                current: '-',
                ytd: '-',
            },
        ];
    });
    if (totals.bonus) {
        earningsRows.push({
            desc: 'Bonus',
            hours: '',
            rate: '',
            current: toMoneyDisplay(totals.bonus),
            ytd: '-',
        });
    }
    if (totals.vacation) {
        earningsRows.push({
            desc: 'Other',
            hours: '',
            rate: '',
            current: toMoneyDisplay(totals.vacation),
            ytd: '-',
        });
    }
    earningsRows.push({
        desc: 'Total Earnings',
        hours: '',
        rate: '',
        current: toMoneyDisplay(totals.gross),
        ytd: '-',
        isTotal: true,
    });

    const deductionsRows: Array<{
        label: string;
        current: string;
        ytd: string;
        isTotal?: boolean;
    }> = [
        { label: 'Federal Tax', current: toMoneyDisplay(totals.tax), ytd: '-' },
        { label: 'Provincial Tax', current: '-', ytd: '-' },
        { label: 'CPP', current: toMoneyDisplay(totals.cpp), ytd: '-' },
        { label: 'EI', current: toMoneyDisplay(totals.ei), ytd: '-' },
        { label: 'Other', current: '-', ytd: '-' },
        { label: 'Total Deductions', current: toMoneyDisplay(totals.total_deduction), ytd: '-', isTotal: true },
    ];

    const writeEarningRow = (row: typeof earningsRows[number], rowIndex: number) => {
        const rowY = dataStartY + rowIndex * rowHeight;
        doc.setFont('helvetica', row.isTotal ? 'bold' : 'normal');
        let xPos = left;
        const values = [row.desc, row.hours, row.rate, row.current, row.ytd];
        earnCols.forEach((col, idx) => {
            const textX = col.align === 'right' ? xPos + col.width - 2 : xPos + 2;
            doc.text(String(values[idx] ?? ''), textX, rowY, { align: col.align });
            xPos += col.width;
        });
    };

    const writeDeductionRow = (row: typeof deductionsRows[number], rowIndex: number) => {
        const rowY = dataStartY + rowIndex * rowHeight;
        doc.setFont('helvetica', row.isTotal ? 'bold' : 'normal');
        let xPos = left + colWidth;
        const values = [row.label, row.current, row.ytd];
        dedCols.forEach((col, idx) => {
            const textX = col.align === 'right' ? xPos + col.width - 2 : xPos + 2;
            doc.text(String(values[idx] ?? ''), textX, rowY, { align: col.align });
            xPos += col.width;
        });
    };

    doc.setFontSize(8);
    earningsRows.forEach(writeEarningRow);
    deductionsRows.forEach(writeDeductionRow);

    const maxRows = Math.max(earningsRows.length, deductionsRows.length);
    y = dataStartY + maxRows * rowHeight + 10;

    drawHeaderBar(left, y, contentWidth, 'PAY SUMMARY');
    doc.setDrawColor(lineColor);
    doc.rect(left, y, contentWidth, 16);
    y += 28;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const summaryRows: Array<[string, string]> = [
        ['Gross Pay (Current)', toMoneyDisplay(totals.gross)],
        ['Total Deductions (Current)', toMoneyDisplay(totals.total_deduction)],
        ['Net Pay (Current)', toMoneyDisplay(totals.net)],
        ['Net Pay (YTD)', '-'],
    ];
    summaryRows.forEach(([label, value]) => {
        doc.text(label, left + 2, y);
        doc.text(value, right - 2, y, { align: 'right' });
        y += 14;
    });

    return doc.output('blob');
};

const openPaystubPdf = (entries: PayrollHistoryResponse[], summary?: PayrollHistoryResponse | null) => {
    const blob = createPaystubPdfBlob(entries, summary);
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
};

const downloadPaystubPdf = (entries: PayrollHistoryResponse[], summary?: PayrollHistoryResponse | null) => {
    const blob = createPaystubPdfBlob(entries, summary);
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = resolvePaystubFilename(entries[0], summary);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
};

const PayrollHistoryDetail = () => {
    const { id } = useParams();
    const [rows, setRows] = useState<PayrollHistoryResponse[]>([]);
    const [summary, setSummary] = useState<PayrollHistoryResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [pageIndex, setPageIndex] = useState(0);
    const derivedHeaderClass = 'bg-slate-200 text-slate-600';
    const derivedCellClass = 'bg-slate-200';

    useEffect(() => {
        if (!id) return;
        let cancelled = false;

        const fetchDetail = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const data = await historyAPI.getPayrollHistoryDetail(id);
                if (cancelled) return;
                if (Array.isArray(data)) {
                    setRows(data);
                    setSummary(data[0] ?? null);
                } else if (data && typeof data === 'object' && 'entries' in data) {
                    const payload = data as PayrollHistoryDetailResponse;
                    setRows(Array.isArray(payload.entries) ? payload.entries : []);
                    setSummary(payload.summary ?? null);
                } else if (data) {
                    setRows([data as PayrollHistoryResponse]);
                    setSummary(data as PayrollHistoryResponse);
                } else {
                    setRows([]);
                    setSummary(null);
                }
            } catch (err) {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : 'Failed to fetch payroll history detail');
                setRows([]);
                setSummary(null);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        fetchDetail();

        return () => {
            cancelled = true;
        };
    }, [id]);

    const computedSummary = useMemo(() => {
        const totals = rows.reduce<{
            gross: number;
            total_deduction: number;
            net: number;
            count: number;
            excluded: number;
        }>(
            (acc, item) => {
                const isExcluded = Boolean(item.excluded);
                if (isExcluded) {
                    acc.excluded += 1;
                    return acc;
                }
                acc.count += 1;
                acc.gross += toNumber(item.gross);
                acc.total_deduction += toNumber(item.total_deduction);
                acc.net += toNumber(item.net);
                return acc;
            },
            { gross: 0, total_deduction: 0, net: 0, count: 0, excluded: 0 },
        );
        const periodStart = summary?.period_start ?? rows.find((item) => item.period_start)?.period_start;
        const periodEnd = summary?.period_end ?? rows.find((item) => item.period_end)?.period_end;
        const periodKey = summary?.period_key ?? rows.find((item) => item.period_key)?.period_key;
        return {
            totals,
            periodStart,
            periodEnd,
            periodKey,
            employees: totals.count,
        };
    }, [rows, summary]);

    const periodLabel = computedSummary.periodStart && computedSummary.periodEnd
        ? `${formatDate(computedSummary.periodStart)} - ${formatDate(computedSummary.periodEnd)}`
        : '-';

    const filtered = useMemo(() => {
        if (!query.trim()) return rows;
        const needle = query.trim().toLowerCase();
        return rows.filter((item) =>
            Object.values(item).some((val) => String(val ?? '').toLowerCase().includes(needle)),
        );
    }, [rows, query]);

    useEffect(() => {
        setPageIndex(0);
    }, [query, rows.length]);

    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    const pageData = useMemo(
        () => filtered.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize),
        [filtered, pageIndex],
    );
    const canPrev = pageIndex > 0;
    const canNext = pageIndex + 1 < pageCount;

    const employeeGroups = useMemo(() => {
        const map = new Map<string, PayrollHistoryResponse[]>();
        rows.forEach((item) => {
            const key = getEmployeeKey(item);
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(item);
        });
        return map;
    }, [rows]);

    const firstRowIndexByEmployee = useMemo(() => {
        const map = new Map<string, number>();
        rows.forEach((item, index) => {
            const key = getEmployeeKey(item);
            if (!map.has(key)) {
                map.set(key, index);
            }
        });
        return map;
    }, [rows]);

    const employeeCount = toNumber(summary?.employee_count ?? computedSummary.employees);
    const excludedCount = toNumber(summary?.excluded_count ?? computedSummary.totals.excluded);

    const summaryCards = (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="w-[150px] gap-1 p-3 rounded-md shadow-none border-secondary/20 bg-white">
                <CardHeader className="p-0 pb-1">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Employees / Excluded</CardTitle>
                </CardHeader>
                <CardContent className="p-0 text-2xl font-semibold">
                    {employeeCount} / {excludedCount}
                </CardContent>
            </Card>
            <Card className="w-[150px] gap-1 p-3 rounded-md shadow-none border-secondary/20 bg-white">
                <CardHeader className="p-0 pb-1">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Payout</CardTitle>
                </CardHeader>
                <CardContent className="p-0 text-2xl font-semibold">
                    {formatMoneyInteger(summary?.total_net ?? computedSummary.totals.net)}
                </CardContent>
            </Card>
            <Card className="w-[150px] gap-1 p-3 rounded-md shadow-none border-secondary/20 bg-white">
                <CardHeader className="p-0 pb-1">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Gross</CardTitle>
                </CardHeader>
                <CardContent className="p-0 text-2xl font-semibold">
                    {formatMoneyInteger(summary?.total_gross ?? computedSummary.totals.gross)}
                </CardContent>
            </Card>
            <Card className="w-[150px] gap-1 p-3 rounded-md shadow-none border-secondary/20 bg-white">
                <CardHeader className="p-0 pb-1">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Deduction</CardTitle>
                </CardHeader>
                <CardContent className="p-0 text-2xl font-semibold">
                    {formatMoneyInteger(summary?.taxes_and_deductions ?? computedSummary.totals.total_deduction)}
                </CardContent>
            </Card>
        </div>
    );

    return (
        <>
            <BreadcrumbComp
                title="Payroll History"
                items={BCrumb}
                leftContent={
                    <Card className="w-auto gap-1 p-3 rounded-md shadow-none border-secondary/20 bg-lightsecondary/10">
                        <CardHeader className="p-0 pb-1">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Period:
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <p className="text-xs text-muted-foreground">{periodLabel}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Period #: {computedSummary.periodKey ?? summary?.period_key ?? '-'}
                            </p>
                        </CardContent>
                    </Card>
                }
                rightContent={summaryCards}
            />
            <div className="flex gap-6 flex-col">
                <div className="grid grid-cols-1 gap-6">
                    <div>
                        {error && (
                            <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                                Error: {error}
                            </div>
                        )}
                        {isLoading ? (
                            <div className="p-4 flex items-center justify-center gap-2 text-gray-500">
                                <LoadingSpinner size="md" />
                            </div>
                        ) : rows.length === 0 ? (
                            <Card className="shadow-none border-secondary/20">
                                <CardContent className="p-6 text-sm text-muted-foreground">
                                    History record not found.
                                </CardContent>
                            </Card>
                        ) : (
                            <>
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <Button asChild size="icon" variant="outline" aria-label="Back to History">
                                            <Link to="/app/payroll/history">
                                                <CornerUpLeft className="h-4 w-4" />
                                            </Link>
                                        </Button>
                                        <CardHeader className="p-0">
                                            <CardTitle className="text-lg font-semibold">Employee List</CardTitle>
                                        </CardHeader>
                                    </div>
                                </div>

                                    <div>

                                        <div className="overflow-x-auto border rounded-md border-ld">
                                            <Table>
                                                <THeader>
                                                    <TRow>
                                                        <THead className="min-w-48 px-2">Employee</THead>
                                                        <THead className="min-w-24 px-2">Type</THead>
                                                        <THead className="min-w-20 px-2 text-right">Rate</THead>
                                                        <THead className="min-w-20 px-2 text-right">Reg Hrs</THead>
                                                        <THead className="min-w-20 px-2 text-right">OT Hrs</THead>
                                                        <THead className={`min-w-24 px-2 text-right ${derivedHeaderClass}`}>
                                                            Gross
                                                        </THead>
                                                        <THead className="min-w-20 px-2 text-right">CPP</THead>
                                                        <THead className="min-w-20 px-2 text-right">EI</THead>
                                                        <THead className="min-w-20 px-2 text-right">Tax</THead>
                                                        <THead className={`min-w-28 px-2 text-right ${derivedHeaderClass}`}>
                                                            Tot Deduction
                                                        </THead>
                                                        <THead className="min-w-24 px-2 text-right">Adjustment</THead>
                                                        <THead className={`min-w-24 px-2 text-right ${derivedHeaderClass}`}>
                                                            Net
                                                        </THead>
                                                        <THead className="min-w-24 px-2">Status</THead>
                                                        <THead className="min-w-24 px-2 text-right">Paystub</THead>
                                                    </TRow>
                                                </THeader>
                                                <TBody>
                                                    {pageData.map((item, index) => {
                                                        const isExcluded =
                                                            item.excluded === true ||
                                                            item.excluded === 'Yes' ||
                                                            item.excluded === 'true' ||
                                                            item.excluded === 'Excluded';
                                                        const employeeKey = getEmployeeKey(item);
                                                        const isFirstForEmployee =
                                                            firstRowIndexByEmployee.get(employeeKey) === rows.indexOf(item);
                                                        const groupEntries = employeeGroups.get(employeeKey) ?? [item];
                                                        return (
                                                        <TRow
                                                            key={item.id ?? `${item.employee_id}-${item.full_name}-${index}`}
                                                            className={`hover:bg-primary/10 transition-colors ${isExcluded ? 'text-gray-400 line-through' : ''}`}
                                                        >
                                                            <TCell className="text-gray-700 dark:text-white/70 text-sm px-2 py-3">
                                                                {item.full_name ?? '-'}
                                                            </TCell>
                                                            <TCell className="text-gray-700 dark:text-white/70 text-sm px-2 py-3">
                                                                {item.employment_type ?? '-'}
                                                            </TCell>
                                                            <TCell className="text-gray-700 dark:text-white/70 text-sm px-2 py-3 text-right tabular-nums">
                                                                {(() => {
                                                                    const employmentType = (item.employment_type ?? '').toLowerCase();
                                                                    if (employmentType === 'salary') {
                                                                        const annual = parseNumberValue(item.annual_salary_snapshot);
                                                                        if (annual === null) return '-';
                                                                        const periods = getPeriodsPerYear(resolvePayFrequency(item, summary));
                                                                        const perPeriod = periods ? annual / periods : annual;
                                                                        return toMoneyDisplay(perPeriod);
                                                                    }
                                                                    return toMoneyDisplay(item.hourly_rate_snapshot);
                                                                })()}
                                                            </TCell>
                                                            <TCell className="text-gray-700 dark:text-white/70 text-sm px-2 py-3 text-right tabular-nums">
                                                                {toDisplay(item.regular_hours)}
                                                            </TCell>
                                                            <TCell className="text-gray-700 dark:text-white/70 text-sm px-2 py-3 text-right tabular-nums">
                                                                {toDisplay(item.overtime_hours)}
                                                            </TCell>
                                                            <TCell className={`text-gray-700 dark:text-white/70 text-sm px-2 py-3 text-right tabular-nums ${derivedCellClass}`}>
                                                                {formatMoney(item.gross)}
                                                            </TCell>
                                                            <TCell className="text-gray-700 dark:text-white/70 text-sm px-2 py-3 text-right tabular-nums">
                                                                {formatMoney(item.cpp)}
                                                            </TCell>
                                                            <TCell className="text-gray-700 dark:text-white/70 text-sm px-2 py-3 text-right tabular-nums">
                                                                {formatMoney(item.ei)}
                                                            </TCell>
                                                            <TCell className="text-gray-700 dark:text-white/70 text-sm px-2 py-3 text-right tabular-nums">
                                                                {formatMoney(item.tax)}
                                                            </TCell>
                                                            <TCell className={`text-gray-700 dark:text-white/70 text-sm px-2 py-3 text-right tabular-nums ${derivedCellClass}`}>
                                                                {formatMoney(item.total_deduction)}
                                                            </TCell>
                                                            <TCell className="text-gray-700 dark:text-white/70 text-sm px-2 py-3 text-right tabular-nums">
                                                                {formatMoney(item.adjustment)}
                                                            </TCell>
                                                            <TCell className={`text-gray-700 dark:text-white/70 text-sm px-2 py-3 text-right tabular-nums ${derivedCellClass}`}>
                                                                {formatMoney(item.net)}
                                                            </TCell>
                                                            <TCell className="px-2 py-3">
                                                                <Badge className={`px-2 py-1 rounded-full text-xs font-medium ${statusClass(item.status ?? 'finalized')}`}>
                                                                    {toTitleCase(item.status ?? 'finalized')}
                                                                </Badge>
                                                            </TCell>
                                                            <TCell className="px-2 py-3 text-right">
                                                                {isFirstForEmployee ? (
                                                                    <div className="flex justify-end gap-2">
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            onClick={() => {
                                                                                openPaystubPdf(groupEntries, summary);
                                                                            }}
                                                                        >
                                                                            PDF
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="secondary"
                                                                            onClick={() => {
                                                                                downloadPaystubPdf(groupEntries, summary);
                                                                            }}
                                                                        >
                                                                            Download
                                                                        </Button>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-xs text-muted-foreground">-</span>
                                                                )}
                                                            </TCell>
                                                        </TRow>
                                                    );
                                                    })}
                                                </TBody>
                                            </Table>
                                        </div>

                                        <div className="flex flex-col gap-4 p-4">
                                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                                                <div className="flex gap-2 w-full sm:w-auto">
                                                    <Button
                                                        onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                                                        disabled={!canPrev}
                                                        variant="secondary"
                                                        className="flex-1 sm:flex-none text-xs sm:text-sm"
                                                    >
                                                        Previous
                                                    </Button>
                                                    <Button
                                                        onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
                                                        disabled={!canNext}
                                                        className="flex-1 sm:flex-none text-xs sm:text-sm"
                                                    >
                                                        Next
                                                    </Button>
                                                </div>

                                                <div className="text-forest-black dark:text-white/90 font-medium text-xs sm:text-base whitespace-nowrap">
                                                    Page {pageIndex + 1} of {pageCount}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default PayrollHistoryDetail;


