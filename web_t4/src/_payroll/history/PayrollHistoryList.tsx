import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import BreadcrumbComp from 'src/_layouts/shared/breadcrumb/BreadcrumbComp';
import { historyAPI, PayrollHistoryResponse } from 'src/_payroll/history/payroll-history-api';
import { Badge } from 'src/components/ui/badge';
import { Button } from 'src/components/ui/button';
import { Card, CardContent } from 'src/components/ui/card';
import { Table, TBody, TCell, THead, THeader, TRow } from 'src/components/ui/table';
import LoadingSpinner from 'src/components/shared/LoadingSpinner';
import { formatDate, formatMoney, toNumber } from 'src/core/format';

const BCrumb = [
    { to: '/', title: 'Home' },
    { title: 'Payroll' },
];

const getHistoryGroupKey = (item: PayrollHistoryResponse, index: number) =>
    String(
        item.history_id ??
            item.period_key ??
            item.id ??
            `${item.pay_date ?? item.pay_day ?? 'no-day'}-${item.period_start ?? 'no-start'}-${index}`,
    );

const isExcludedRow = (item: PayrollHistoryResponse) =>
    item.excluded === true ||
    item.excluded === 'Yes' ||
    item.excluded === 'true' ||
    item.excluded === 'Excluded';

const PayrollHistoryList = () => {
    const [history, setHistory] = useState<PayrollHistoryResponse[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pageIndex, setPageIndex] = useState(0);
    const navigate = useNavigate();
    // const derivedHeaderClass = 'bg-slate-200 text-slate-600';
    // const derivedCellClass = 'bg-slate-200';

    const derivedHeaderClass = 'bg-transparent';
    const derivedCellClass = 'bg-transparent';


    useEffect(() => {
        let cancelled = false;

        const fetchHistory = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const list = await historyAPI.listPayrollHistory({ skip: 0, limit: 500 });
                if (cancelled) return;
                setHistory(list);
            } catch (err) {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : 'Failed to fetch payroll history');
                setHistory([]);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        fetchHistory();

        return () => {
            cancelled = true;
        };
    }, []);

    const normalizedHistory = useMemo(() => {
        const groups = new Map<string, PayrollHistoryResponse[]>();
        history.forEach((item, index) => {
            const key = getHistoryGroupKey(item, index);
            const existing = groups.get(key);
            if (existing) {
                existing.push(item);
                return;
            }
            groups.set(key, [item]);
        });

        return Array.from(groups.values()).map((rows) => {
            const representative =
                rows.find((row) => row.employee_id === null || row.employee_id === undefined) ??
                rows[0];
            const nonExcludedRows = rows.filter((row) => !isExcludedRow(row));

            const sumGross = nonExcludedRows.reduce((acc, row) => acc + toNumber(row.gross), 0);
            const sumDeduction = nonExcludedRows.reduce(
                (acc, row) => acc + toNumber(row.total_deduction),
                0,
            );
            const sumNet = nonExcludedRows.reduce((acc, row) => acc + toNumber(row.net), 0);

            const uniqueEmployeeIds = new Set(
                nonExcludedRows
                    .map((row) => row.employee_id ?? null)
                    .filter((id): id is string => typeof id === 'string' && Boolean(id.trim())),
            );
            const excludedCountComputed = rows.filter((row) => isExcludedRow(row)).length;

            return {
                ...representative,
                total_gross:
                    sumGross !== 0
                        ? sumGross
                        : toNumber(representative.total_gross ?? representative.gross),
                taxes_and_deductions:
                    sumDeduction !== 0
                        ? sumDeduction
                        : toNumber(
                              representative.taxes_and_deductions ??
                                  representative.total_deduction,
                          ),
                total_net:
                    sumNet !== 0
                        ? sumNet
                        : toNumber(representative.total_net ?? representative.net),
                employee_count:
                    uniqueEmployeeIds.size > 0
                        ? uniqueEmployeeIds.size
                        : toNumber(representative.employee_count),
                excluded_count:
                    excludedCountComputed > 0
                        ? excludedCountComputed
                        : toNumber(representative.excluded_count),
            } as PayrollHistoryResponse;
        });
    }, [history]);

    useEffect(() => {
        setPageIndex(0);
    }, [normalizedHistory.length]);

    const pageSize = 20;
    const pageCount = Math.max(1, Math.ceil(normalizedHistory.length / pageSize));
    const pageData = useMemo(
        () => normalizedHistory.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize),
        [normalizedHistory, pageIndex],
    );
    const canPrev = pageIndex > 0;
    const canNext = pageIndex + 1 < pageCount;

    const toTitleCase = (value?: string) =>
        (value ?? '-').replace(/[_-]+/g, ' ').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());

    const statusClass = (status?: string) => {
        const normalized = (status ?? '').trim().toLowerCase();
        if (normalized === 'approved' || normalized === 'completed' || normalized === 'finalized') {
            return 'bg-green-100 text-green-700';
        }
        if (normalized === 'draft') {
            return 'bg-transparent border border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-300';
        }
        return 'bg-blue-100 text-blue-700';
    };

    const resolveHistoryId = (item: PayrollHistoryResponse): string | null => {
        const candidate =
            item.id ??
            (item as { history_id?: string | number }).history_id ??
            (item as { period_key?: string | number }).period_key;
        if (typeof candidate === 'string' && candidate.trim()) return candidate;
        if (typeof candidate === 'number' && Number.isFinite(candidate)) return String(candidate);
        return null;
    };


    return (
        <>
            <BreadcrumbComp title="Payroll History" items={BCrumb} />
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
                        ) : normalizedHistory.length === 0 ? (
                            <Card className="shadow-none border-secondary/20">
                                <CardContent className="p-6 text-sm text-muted-foreground">
                                    No payroll history found.
                                </CardContent>
                            </Card>
                        ) : (
                            <div>
                                <div className="overflow-x-auto border rounded-md border-ld">
                                    <Table>
                                        <THeader>
                                            <TRow>
                                                <THead className="min-w-28 px-2">Pay Date</THead>
                                                <THead className="min-w-28 px-2">Period #</THead>
                                                <THead className="min-w-40 px-2">Period</THead>
                                                <THead className="min-w-28 px-2 text-right">Employees / Excluded</THead>
                                                <THead className={`min-w-28 px-2 text-right ${derivedHeaderClass}`}>
                                                    Total Gross
                                                </THead>
                                                <THead className={`min-w-32 px-2 text-right ${derivedHeaderClass}`}>
                                                    Taxes & Deduction
                                                </THead>
                                                <THead className={`min-w-28 px-2 text-right ${derivedHeaderClass}`}>
                                                    Total Net
                                                </THead>
                                                <THead className="min-w-24 px-2">Status</THead>
                                                <THead className="min-w-24 px-2 text-right">Action</THead>
                                            </TRow>
                                        </THeader>
                                        <TBody>
                                            {pageData.map((item, index) => {
                                                const periodLabel = item.period_start && item.period_end
                                                    ? `${formatDate(item.period_start)} - ${formatDate(item.period_end)}`
                                                    : '-';
                                                const viewId = resolveHistoryId(item);
                                                const canView = Boolean(viewId);
                                                return (
                                                    <TRow
                                                        key={item.id ?? `${item.employee_id}-${item.full_name}-${index}`}
                                                        className={`hover:bg-primary/10 transition-colors ${canView ? 'cursor-pointer' : ''}`}
                                                        onClick={canView ? () => navigate(`/app/payroll/history/${viewId}`) : undefined}
                                                    >
                                                        <TCell className="text-gray-700 dark:text-white/70 text-sm px-2 py-3">
                                                            {item.pay_date ?? item.pay_day
                                                                ? formatDate((item.pay_date ?? item.pay_day) as string)
                                                                : '-'}
                                                        </TCell>
                                                        <TCell className="text-gray-700 dark:text-white/70 text-sm px-2 py-3">
                                                            {item.period_key ?? '-'}
                                                        </TCell>
                                                        <TCell className="text-gray-700 dark:text-white/70 text-sm px-2 py-3">
                                                            {periodLabel}
                                                        </TCell>
                                                        <TCell className="text-gray-700 dark:text-white/70 text-sm px-2 py-3 text-right tabular-nums">
                                                            {item.employee_count ?? '-'} / {item.excluded_count ?? 0}
                                                        </TCell>
                                                        <TCell className={`text-gray-700 dark:text-white/70 text-sm px-2 py-3 text-right tabular-nums ${derivedCellClass}`}>
                                                            {formatMoney(item.total_gross)}
                                                        </TCell>
                                                        <TCell className={`text-gray-700 dark:text-white/70 text-sm px-2 py-3 text-right tabular-nums ${derivedCellClass}`}>
                                                            {formatMoney(item.taxes_and_deductions)}
                                                        </TCell>
                                                        <TCell className={`text-gray-700 dark:text-white/70 text-sm px-2 py-3 text-right tabular-nums ${derivedCellClass}`}>
                                                            {formatMoney(item.total_net)}
                                                        </TCell>
                                                        <TCell className="px-2 py-3">
                                                            <Badge className={`px-2 py-1 rounded-full text-xs font-medium ${statusClass(item.status ?? 'finalized')}`}>
                                                                {toTitleCase(item.status ?? 'finalized')}
                                                            </Badge>
                                                        </TCell>
                                                        <TCell className="px-2 py-3 text-right">
                                                            {canView ? (
                                                                <Button asChild size="sm" variant="outline">
                                                                    <Link to={`/app/payroll/history/${viewId}`}>View</Link>
                                                                </Button>
                                                            ) : (
                                                                <span className="text-xs text-gray-400">N/A</span>
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
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default PayrollHistoryList;

