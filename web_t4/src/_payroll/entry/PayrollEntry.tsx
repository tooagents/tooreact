import { useCallback, useEffect, useMemo, useState } from 'react';
import BreadcrumbComp from 'src/_layouts/shared/breadcrumb/BreadcrumbComp';
import { PayrollEntryTable, PayrollEntryRow } from 'src/_payroll/entry/components/PayrollEntryTable';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/ui/card';
import { Button } from 'src/components/ui/button';
import LoadingSpinner from 'src/components/shared/LoadingSpinner';
import { PayrollEntryResponse } from 'src/_payroll/entry/payroll-entry-api';
import { scheduleAPI } from 'src/_payroll/schedule/schedule-api';
import { entryAPI } from 'src/_payroll/entry/payroll-entry-api';
import { useClientStore } from 'src/store/client-store';
import { PayrollSchedule } from 'src/types/payroll';
import { Link, useNavigate } from 'react-router';
import { formatDate, formatMoney, formatMoneyInteger, toNumber } from 'src/core/format';
import { historyAPI } from 'src/_payroll/history/payroll-history-api';
import EmployeePickerModal from 'src/_payroll/entry/components/EmployeePickerModal';
import { Employee } from 'src/types/employee';

const BCrumb = [
    { to: '/', title: 'Home', },
    { title: 'Payroll', },
];

const parseLocalDate = (value?: string | null): Date | null => {
    if (!value) return null;
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
};

const getPeriodsPerYear = (frequency?: string | null): number | null => {
    const value = frequency?.toLowerCase?.() ?? '';
    if (value === 'weekly') return 52;
    if (value === 'biweekly') return 26;
    if (value === 'semimonthly') return 24;
    if (value === 'monthly') return 12;
    return null;
};

const formatIsoDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const addDays = (date: Date, days: number): Date =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const startOfWeekMonday = (date: Date): Date => {
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    return addDays(date, diff);
};

const endOfWeekFriday = (date: Date): Date => addDays(startOfWeekMonday(date), 4);

const buildPeriod = (schedule: PayrollSchedule | null) => {
    if (!schedule?.effective_from) return null;
    const effective = parseLocalDate(schedule.effective_from);
    if (!effective) return null;

    const frequency = schedule.frequency?.toLowerCase?.() ?? '';

    if (frequency === 'weekly') {
        const start = startOfWeekMonday(effective);
        const end = endOfWeekFriday(effective);
        return { start_date: formatIsoDate(start), end_date: formatIsoDate(end) };
    }

    if (frequency === 'biweekly') {
        const start = startOfWeekMonday(effective);
        const end = addDays(start, 11);
        return { start_date: formatIsoDate(start), end_date: formatIsoDate(end) };
    }

    if (frequency === 'semimonthly') {
        const year = effective.getFullYear();
        const month = effective.getMonth();
        const date = effective.getDate();
        if (date <= 15) {
            const start = new Date(year, month, 1);
            const end = new Date(year, month, 15);
            return { start_date: formatIsoDate(start), end_date: formatIsoDate(end) };
        }
        const start = new Date(year, month, 16);
        const end = new Date(year, month + 1, 0);
        return { start_date: formatIsoDate(start), end_date: formatIsoDate(end) };
    }

    if (frequency === 'monthly') {
        const start = new Date(effective.getFullYear(), effective.getMonth(), 1);
        const end = new Date(effective.getFullYear(), effective.getMonth() + 1, 0);
        return { start_date: formatIsoDate(start), end_date: formatIsoDate(end) };
    }

    return null;
};

const getPayOnLabel = (schedule: PayrollSchedule | null) => {
    if (!schedule) return '-';
    const frequency = schedule.frequency?.toLowerCase?.() ?? '';
    if (frequency === 'semimonthly') {
        const first = schedule.semi1 ?? '-';
        const second = schedule.semi2 ?? '-';
        return `${first} & ${second}`;
    }
    return schedule.payon ?? '-';
};


const Payroll = () => {
    const activeBizId = useClientStore((state) => state.activeBE?.active_zbid ?? null);
    return (<PayrollContent activeBizId={activeBizId} />);
};


const PayrollContent = ({ activeBizId }: { activeBizId: string | null }) => {
    const [activeSchedule, setActiveSchedule] = useState<PayrollSchedule | null>(null);
    const [entries, setEntries] = useState<PayrollEntryResponse[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [isEmployeePickerOpen, setIsEmployeePickerOpen] = useState(false);
    const [isAddingEmployees, setIsAddingEmployees] = useState(false);
    const navigate = useNavigate();
    const logPayrollEntry = (message: string, payload?: Record<string, unknown>) => {
        const ts = new Date().toISOString();
        if (payload) {
            console.log(`[PayrollEntry][${ts}] ${message}`, payload);
            return;
        }
        console.log(`[PayrollEntry][${ts}] ${message}`);
    };

    const fetchScheduleAndEntries = useCallback(async () => {
        logPayrollEntry('fetchScheduleAndEntries:start', { activeBizId });
        if (!activeBizId) {
            setActiveSchedule(null);
            setEntries([]);
            setIsLoading(false);
            logPayrollEntry('fetchScheduleAndEntries:skip_no_activeBizId');
            return;
        }

        try {
            setIsLoading(true);
            setError(null);
            const [schedules, entryData] = await Promise.all([
                scheduleAPI.listPayrollSchedules({ skip: 0, limit: 200 }),
                entryAPI.listPayrollEntries({ skip: 0, limit: 500 }),
            ]);
            const active = schedules.find((schedule) => schedule.status === 'active') ?? null;
            logPayrollEntry('fetchScheduleAndEntries:resolved', {
                scheduleCount: schedules.length,
                entryCount: entryData.length,
                hasActiveSchedule: Boolean(active),
                activeScheduleId: active?.id ?? null,
            });
            setActiveSchedule(active);
            setEntries(active ? entryData : []);
            if (!active) {
                logPayrollEntry('no_active_schedule_ui_will_show', {
                    reason: 'no schedule with status=active',
                    scheduleCount: schedules.length,
                    entryCountIgnoredBecauseNoActive: entryData.length,
                });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch payroll data');
            setActiveSchedule(null);
            setEntries([]);
            logPayrollEntry('fetchScheduleAndEntries:error', {
                error: err instanceof Error ? err.message : String(err),
            });
        } finally {
            setIsLoading(false);
            logPayrollEntry('fetchScheduleAndEntries:end');
        }
    }, [activeBizId]);

    useEffect(() => {
        fetchScheduleAndEntries();
    }, [fetchScheduleAndEntries]);

    useEffect(() => {
        if (isLoading || activeSchedule) return;
        logPayrollEntry('no_active_schedule_ui_rendered', {
            activeBizId,
            hasError: Boolean(error),
            error: error ?? null,
            entriesLength: entries.length,
        });
    }, [activeBizId, activeSchedule, entries.length, error, isLoading]);

    const totals = useMemo(() => {
        return entries.reduce(
            (acc, entry) => {
                if (entry.excluded) {
                    acc.excluded += 1;
                    return acc;
                }
                acc.count += 1;
                acc.gross += toNumber(entry.gross);
                acc.net += toNumber(entry.net);
                if (entry.status === 'draft') acc.draft += 1;
                return acc;
            },
            { count: 0, gross: 0, net: 0, excluded: 0, draft: 0 },
        );
    }, [entries]);

    const activePeriod = useMemo(() => {
        const entryWithPeriod = entries.find((entry) => {
            const candidate = entry as PayrollEntryResponse & {
                period_start?: string;
                period_end?: string;
                start_date?: string;
                end_date?: string;
                periodStart?: string;
                periodEnd?: string;
            };
            return Boolean(
                candidate.period_start ||
                    candidate.period_end ||
                    candidate.start_date ||
                    candidate.end_date ||
                    candidate.periodStart ||
                    candidate.periodEnd,
            );
        }) as
            | (PayrollEntryResponse & {
                  period_start?: string;
                  period_end?: string;
                  start_date?: string;
                  end_date?: string;
                  periodStart?: string;
                  periodEnd?: string;
              })
            | undefined;

        const entryStart =
            entryWithPeriod?.period_start ??
            entryWithPeriod?.start_date ??
            entryWithPeriod?.periodStart ??
            null;
        const entryEnd =
            entryWithPeriod?.period_end ??
            entryWithPeriod?.end_date ??
            entryWithPeriod?.periodEnd ??
            null;

        if (entryStart && entryEnd) {
            return { start_date: entryStart, end_date: entryEnd };
        }

        return buildPeriod(activeSchedule);
    }, [activeSchedule, entries]);
    const payOnLabel = useMemo(() => getPayOnLabel(activeSchedule), [activeSchedule]);

    const renderMoney = (value: unknown) =>
        value === null || value === undefined || value === '' ? '-' : formatMoney(value);

    const toEditable = (value: unknown) =>
        value === null || value === undefined || value === '' ? '' : String(value);

    const parseNullableNumber = (value: string): number | null => {
        if (!value.trim()) return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    };

    const parseNumberValue = (value: unknown): number | null => {
        if (value === null || value === undefined || value === '') return null;
        if (typeof value === 'number') return Number.isFinite(value) ? value : null;
        if (typeof value === 'string') {
            if (!value.trim()) return null;
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
    };

    const normalizeEntryForSave = (
        entry: PayrollEntryResponse,
        overrides?: Partial<PayrollEntryResponse>,
    ): PayrollEntryResponse => {
        const normalized: PayrollEntryResponse = { ...entry, ...overrides };
        const normalizeNum = (value: unknown): number | string | null => {
            if (value === null || value === undefined) return null;
            if (typeof value === 'number') return Number.isFinite(value) ? value : null;
            if (typeof value === 'string') {
                if (!value.trim()) return null;
                const parsed = Number(value);
                return Number.isFinite(parsed) ? parsed : value;
            }
            return value as number | string | null;
        };

        normalized.regular_hours = normalizeNum(normalized.regular_hours) as
            | number
            | string
            | null;
        normalized.overtime_hours = normalizeNum(normalized.overtime_hours) as
            | number
            | string
            | null;
        normalized.adjustment = normalizeNum(normalized.adjustment) as
            | number
            | string
            | null;
        normalized.adjustment = normalizeNum(normalized.adjustment) as
            | number
            | string
            | null;
        normalized.hourly_rate_snapshot = normalizeNum(normalized.hourly_rate_snapshot) as
            | number
            | string
            | null;
        normalized.annual_salary_snapshot = normalizeNum(normalized.annual_salary_snapshot) as
            | number
            | string
            | null;

        return normalized;
    };

    const tableData = useMemo<PayrollEntryRow[]>(() =>
            entries.map((entry, index) => {
                const employmentType = (entry.employment_type ?? '').toLowerCase();
                let rateDisplay = '';
                if (employmentType === 'salary') {
                    const annual = parseNumberValue(entry.annual_salary_snapshot);
                    if (annual !== null) {
                        const periods = getPeriodsPerYear(activeSchedule?.frequency);
                        const perPeriod = periods ? annual / periods : annual;
                        rateDisplay = toEditable(perPeriod);
                    } else {
                        rateDisplay = '';
                    }
                } else {
                    rateDisplay = toEditable(entry.hourly_rate_snapshot ?? entry.annual_salary_snapshot);
                }

                return {
                    row_index: index,
                    employee: entry.full_name ?? entry.employee?.full_name ?? '-',
                    employment_type: entry.employment_type ?? '-',
                    rate: rateDisplay,
                    regular_hours: toEditable(entry.regular_hours),
                    overtime_hours: toEditable(entry.overtime_hours),
                    gross: renderMoney(entry.gross),
                    cpp: renderMoney(entry.cpp),
                    ei: renderMoney(entry.ei),
                    tax: renderMoney(entry.tax),
                    total_deduction: renderMoney(entry.total_deduction),
                    adjustment: toEditable(entry.adjustment ?? entry.adjustment),
                    net: renderMoney(entry.net),
                    status: entry.status ?? 'draft',
                    excluded: entry.excluded ? 'Yes' : 'No',
                };
            }),
        [entries, activeSchedule?.frequency],
    );

    const handleEdit = (_row: PayrollEntryRow) => {
        // Intentionally left as a placeholder until entry edit flow is wired.
    };

    const handleDelete = (row: PayrollEntryRow) => {
        setEntries((prev) => prev.filter((_, index) => index !== row.row_index));
    };

    const handleExclude = async (row: PayrollEntryRow) => {
        const entry = entries[row.row_index];
        const nextExcluded = !Boolean(entry?.excluded);

        setEntries((prev) =>
            prev.map((item, index) =>
                index === row.row_index ? { ...item, excluded: nextExcluded } : item,
            ),
        );

        if (!entry?.id) return;

        try {
            setError(null);
            const payload = normalizeEntryForSave(entry, { excluded: nextExcluded });
            const updated = await entryAPI.updatePayrollEntry(payload);
            setEntries((prev) =>
                prev.map((item, index) =>
                    index === row.row_index ? { ...item, ...updated } : item,
                ),
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update payroll entry');
            setEntries((prev) =>
                prev.map((item, index) =>
                    index === row.row_index ? { ...item, excluded: Boolean(entry.excluded) } : item,
                ),
            );
        }
    };

    const handleUpdate = (
        rowIndex: number,
        field: 'rate' | 'regular_hours' | 'overtime_hours' | 'adjustment',
        value: string,
    ) => {
        setEntries((prev) =>
            prev.map((entry, index) => {
                if (index !== rowIndex) return entry;
                if (field === 'rate') {
                    const employmentType = (entry.employment_type ?? '').toLowerCase();
                    if (employmentType === 'salary') {
                        return entry;
                    }
                    return { ...entry, hourly_rate_snapshot: value === '' ? null : value };
                }
                return { ...entry, [field]: value === '' ? null : value };
            }),
        );
    };

    const handleCommit = async (
        rowIndex: number,
        field: 'rate' | 'regular_hours' | 'overtime_hours' | 'adjustment',
        value: string,
    ) => {
        const entry = entries[rowIndex];
        if (!entry?.id) return;
        const parsed = parseNullableNumber(value);
        if (value.trim() && parsed === null) {
            setError('Please enter a valid number.');
            return;
        }
        try {
            setError(null);
            const rateUpdates =
                field === 'rate'
                    ? ((
                          (entry.employment_type ?? '').toLowerCase() === 'salary'
                              ? {}
                              : { hourly_rate_snapshot: parsed }
                      ) as Partial<PayrollEntryResponse>)
                    : { [field]: parsed };
            const payload = normalizeEntryForSave(entry, rateUpdates);
            const updated = await entryAPI.updatePayrollEntry(payload);
            setEntries((prev) =>
                prev.map((item, index) =>
                    index === rowIndex ? { ...item, ...updated } : item,
                ),
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update payroll entry');
        }
    };

    const resolveHistoryId = (payload: unknown): string | null => {
        if (!payload) return null;
        if (Array.isArray(payload)) {
            const first = payload.find((item) => typeof item === 'object' && item !== null && 'period_key' in item) as
                | { period_key?: string }
                | undefined;
            return first?.period_key ?? null;
        }
        if (typeof payload === 'object') {
            const obj = payload as { period_key?: string };
            return obj.period_key ?? null;
        }
        return null;
    };

    const handleAdd = () => {
        setIsEmployeePickerOpen(true);
    };

    const handleAddEmployees = async (selectedEmployees: Employee[]) => {
        const activeEmployees = selectedEmployees.filter((employee) => !employee.is_deleted);
        if (!activeEmployees.length) return;
        try {
            setIsAddingEmployees(true);
            setError(null);
            await entryAPI.addEmployeesToPayroll(activeEmployees.map((employee) => employee.id));
            await fetchScheduleAndEntries();
            setIsEmployeePickerOpen(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add employees to payroll');
        } finally {
            setIsAddingEmployees(false);
        }
    };

    const handleFinalizePayroll = async () => {
        try {
            setIsFinalizing(true);
            setError(null);
            const result = await entryAPI.finalizePayroll();
            await fetchScheduleAndEntries();
            const periodKey = resolveHistoryId(result);
            if (!periodKey) {
                setError('Payroll finalized, but no history record was returned.');
                return;
            }
            navigate(`/app/payroll/history/${periodKey}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to finalize payroll');
        } finally {
            setIsFinalizing(false);
        }
    };

    const placeholderCards = (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="w-[150px] gap-1 p-3 rounded-md shadow-none border-secondary/20 bg-transparent">
                <CardHeader className="p-0 pb-1">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Entries</CardTitle>
                </CardHeader>
                <CardContent className="p-0 text-2xl font-semibold">{totals.count}</CardContent>
            </Card>
            <Card className="w-[150px] gap-1 p-3 rounded-md shadow-none border-secondary/20 bg-transparent">
                <CardHeader className="p-0 pb-1">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Gross</CardTitle>
                </CardHeader>
                <CardContent className="p-0 text-xl ">{formatMoneyInteger(totals.gross)}</CardContent>
            </Card>
            <Card className="w-[150px] gap-1 p-3 rounded-md shadow-none border-secondary/20 bg-transparent">
                <CardHeader className="p-0 pb-1">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Net</CardTitle>
                </CardHeader>
                <CardContent className="p-0 text-xl ">{formatMoneyInteger(totals.net)}</CardContent>
            </Card>
            <Card className="w-[150px] gap-1 p-3 rounded-md shadow-none border-secondary/20 bg-transparent">
                <CardHeader className="p-0 pb-1">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Draft / Excluded</CardTitle>
                </CardHeader>
                <CardContent className="p-0 text-xl">{totals.draft} / {totals.excluded}</CardContent>
            </Card>
        </div>
    );

    return (
        <>
            <BreadcrumbComp
                title="Payroll Entries"
                items={BCrumb}
                leftContent={activeSchedule ? (
                    <Card className="w-auto gap-1 p-3 rounded-md shadow-none border-secondary/20 bg-lightsecondary/10">
                        <CardHeader className="p-0 pb-1">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Active Period:
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <p className="text-xs text-muted-foreground">
                                {activePeriod
                                    ? `${formatDate(activePeriod.start_date)} - ${formatDate(activePeriod.end_date)}`
                                    : '-'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Pay On: {payOnLabel}
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="w-auto gap-1 p-3 rounded-md border-secondary/20 bg-lightsecondary/0 shadow-none">
                        <CardContent className="p-0 text-xs text-muted-foreground">
                            No active schedule
                        </CardContent>
                    </Card>
                )}
                rightContent={placeholderCards}
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
                        ) : !activeSchedule ? (
                            <Card className="shadow-none border-secondary/20">
                                <CardContent className="p-6 flex flex-col items-start gap-3">
                                    <p className="text-sm text-muted-foreground">
                                        No active schedule. Activate one from Payroll Schedules to run payroll and load payroll entries.
                                    </p>
                                    <Button asChild>
                                        <Link to="/app/payroll/schedule">Go to Payroll Schedules</Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : (
                            <PayrollEntryTable
                                data={tableData}
                                onExclude={handleExclude}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onUpdate={handleUpdate}
                                onCommit={handleCommit}
                                onAdd={handleAdd}
                                onFinalize={isFinalizing ? undefined : handleFinalizePayroll}
                                isFinalizing={isFinalizing}
                            />
                        )}
                    </div>
                </div>
            </div>
            <EmployeePickerModal
                isOpen={isEmployeePickerOpen}
                onClose={() => setIsEmployeePickerOpen(false)}
                onAdd={handleAddEmployees}
                isSubmitting={isAddingEmployees}
            />
        </>
    );
};

export default Payroll;


