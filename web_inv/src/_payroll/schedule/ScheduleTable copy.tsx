'use client';

import React, { useEffect, useState } from 'react';
import { Switch } from 'src/components/ui/switch';
import { Table, TBody, TCell, THead, THeader, TRow } from 'src/components/ui/table';
import { Input } from 'src/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'src/components/ui/select';
import type { PayrollSchedule } from 'src/types/payroll';

type ScheduleTableProps = {
    data?: PayrollSchedule[];
    onUpdate?: (rowId: string, updates: Partial<PayrollSchedule>) => void;
    onToggleStatus?: (row: PayrollSchedule, nextActive: boolean) => void;
};

const formatStatus = (status?: string) =>
    (status ?? '-').replace(/[_-]+/g, ' ').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());

const WEEKDAY_OPTIONS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
// const MONTH_DAY_OPTIONS = [...Array.from({ length: 31 }, (_, i) => String(i + 1)), 'EOM'];
const MONTH_DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const LAST_WORKING_DAY = 'EOM';

const isWeeklyLike = (frequency?: string) => {
    const value = frequency?.toLowerCase?.() ?? '';
    return value === 'weekly' || value === 'biweekly';
};

const isMonthly = (frequency?: string) => (frequency?.toLowerCase?.() ?? '') === 'monthly';
const isSemiMonthly = (frequency?: string) => (frequency?.toLowerCase?.() ?? '') === 'semimonthly';

type ScheduleRowProps = {
    schedule: PayrollSchedule;
    onUpdate?: (rowId: string, updates: Partial<PayrollSchedule>) => void;
    onToggleStatus?: (row: PayrollSchedule, nextActive: boolean) => void;
};

const ScheduleRow = ({ schedule, onUpdate, onToggleStatus }: ScheduleRowProps) => {
    const [payOnValue, setPayOnValue] = useState(schedule.payon ?? '');
    const [noteValue, setNoteValue] = useState(schedule.note ?? '');
    const [effectiveFromValue, setEffectiveFromValue] = useState(schedule.effective_from ?? '');
    const [semiFirst, setSemiFirst] = useState('');
    const [semiSecond, setSemiSecond] = useState('');
    const isActive = schedule.status === 'active';

    useEffect(() => {
        setPayOnValue(schedule.payon ?? '');
        setNoteValue(schedule.note ?? '');
        setEffectiveFromValue(schedule.effective_from ?? '');
        if (isSemiMonthly(schedule.frequency)) {
            setSemiFirst(schedule.semi1 ?? '');
            setSemiSecond(schedule.semi2 ?? '');
        }
    }, [schedule]);

    const handleUpdate = (updates: Partial<PayrollSchedule>) => {
        if (!schedule.id) return;
        onUpdate?.(schedule.id, updates);
    };

    const renderPayOnEditor = () => {
        if (isWeeklyLike(schedule.frequency)) {
            return (
                <Select
                    value={payOnValue}
                    disabled={isActive}
                    onValueChange={(value) => {
                        setPayOnValue(value);
                        handleUpdate({ payon: value });
                    }}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent>
                        {WEEKDAY_OPTIONS.map((day) => (
                            <SelectItem key={day} value={day}>
                                {day}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            );
        }

        if (isMonthly(schedule.frequency)) {
            return (
                <Select
                    value={payOnValue}
                    disabled={isActive}
                    onValueChange={(value) => {
                        setPayOnValue(value);
                        handleUpdate({ payon: value });
                    }}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                        <SelectContent>
                            {MONTH_DAY_OPTIONS.map((day) => (
                                <SelectItem key={day} value={day}>
                                    {day}
                                </SelectItem>
                            ))}
                        <SelectItem value={LAST_WORKING_DAY}>{LAST_WORKING_DAY}</SelectItem>
                    </SelectContent>
                </Select>
            );
        }

        if (isSemiMonthly(schedule.frequency)) {
            return (
                <div className="flex gap-2">
                    <Select
                        value={semiFirst}
                        disabled={isActive}
                        onValueChange={(value) => {
                            setSemiFirst(value);
                            handleUpdate({ semi1: value });
                        }}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="1st date" />
                        </SelectTrigger>
                        <SelectContent>
                            {MONTH_DAY_OPTIONS.map((day) => (
                                <SelectItem key={`first-${day}`} value={day}>
                                    {day}
                                </SelectItem>
                            ))}
                            <SelectItem value={LAST_WORKING_DAY}>{LAST_WORKING_DAY}</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select
                        value={semiSecond}
                        disabled={isActive}
                        onValueChange={(value) => {
                            setSemiSecond(value);
                            handleUpdate({ semi2: value });
                        }}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="2nd date" />
                        </SelectTrigger>
                        <SelectContent>
                            {MONTH_DAY_OPTIONS.map((day) => (
                                <SelectItem key={`second-${day}`} value={day}>
                                    {day}
                                </SelectItem>
                            ))}
                            <SelectItem value={LAST_WORKING_DAY}>{LAST_WORKING_DAY}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            );
        }

        return (
            <Input
                value={payOnValue}
                onChange={(e) => setPayOnValue(e.target.value)}
                onBlur={() => handleUpdate({ payon: payOnValue })}
                placeholder="Enter pay on"
                disabled={isActive}
            />
        );
    };

    return (
        <TRow className={schedule.status === 'active' ? 'font-semibold' : undefined}>
            <TCell className="text-gray-700 dark:text-white/70 text-sm px-4 py-3">
                {schedule.frequency}
            </TCell>
            <TCell className="text-gray-700 dark:text-white/70 text-sm px-4 py-3">
                {schedule.period ?? '-'}
            </TCell>
            <TCell className="text-gray-700 dark:text-white/70 text-sm px-4 py-3 min-w-40">
                {renderPayOnEditor()}
            </TCell>
            <TCell className="text-gray-700 dark:text-white/70 text-sm px-4 py-3">
                <Input
                    type="date"
                    value={effectiveFromValue}
                    onChange={(e) => setEffectiveFromValue(e.target.value)}
                    onBlur={() => handleUpdate({ effective_from: effectiveFromValue })}
                    disabled={isActive}
                />
            </TCell>
            <TCell className="text-gray-700 dark:text-white/70 text-sm px-4 py-3">
                <div className="flex items-center gap-2">
                    <Switch
                        checked={schedule.status === 'active'}
                        onCheckedChange={(checked) => onToggleStatus?.(schedule, checked)}
                        disabled={!schedule.id}
                        aria-label={`Toggle active status for ${schedule.frequency} schedule`}
                    />
                    <span className="text-xs text-muted-foreground">{formatStatus(schedule.status)}</span>
                </div>
            </TCell>
            <TCell className="text-gray-700 dark:text-white/70 text-sm px-4 py-3 min-w-48">
                <Input
                    value={noteValue}
                    onChange={(e) => setNoteValue(e.target.value)}
                    onBlur={() => handleUpdate({ note: noteValue })}
                    placeholder="Add note"
                />
            </TCell>
        </TRow>
    );
};

export const ScheduleTable = ({ data = [], onUpdate, onToggleStatus }: ScheduleTableProps) => {
    if (data.length === 0) {
        return <p className="text-center py-8 text-gray-500">No data available.</p>;
    }

    return (
        <div className="overflow-x-auto border rounded-md border-ld">
            <Table>
                <THeader>
                    <TRow>
                <THead className="min-w-32 px-4">Frequency</THead>
                <THead className="min-w-36 px-4">Period</THead>
                <THead className="min-w-32 px-4">Pay On</THead>
                <THead className="min-w-32 px-4">Effective From</THead>
                        <THead className="min-w-32 px-4">Status</THead>
                        <THead className="min-w-32 px-4">Note</THead>
                    </TRow>
                </THeader>
                <TBody>
                    {data.map((schedule) => (
                        <ScheduleRow
                            key={schedule.id ?? `${schedule.frequency}-${schedule.payon ?? 'payon'}`}
                            schedule={schedule}
                            onUpdate={onUpdate}
                            onToggleStatus={onToggleStatus}
                        />
                    ))}
                </TBody>
            </Table>
        </div>
    );
};
