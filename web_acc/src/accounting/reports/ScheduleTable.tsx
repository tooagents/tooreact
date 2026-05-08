'use client';

import React from 'react';
import { Badge } from 'src/components/ui/badge';
import { Table, TBody, TCell, THead, THeader, TRow } from 'src/components/ui/table';
import type { PayrollSchedule } from 'src/types/payroll';
import { Switch } from 'src/components/ui/switch';
import { getCurrentPeriodEndLabel, getCurrentPeriodLabel } from './schedule-period';

type ScheduleTableProps = {
    data?: PayrollSchedule[];
    onUpdate?: (rowId: string, updates: Partial<PayrollSchedule>) => void;
    onToggleStatus?: (row: PayrollSchedule, nextActive: boolean) => void;
};

type ScheduleRowProps = {
    schedule: PayrollSchedule;
    onUpdate?: (rowId: string, updates: Partial<PayrollSchedule>) => void;
    onToggleStatus?: (row: PayrollSchedule, nextActive: boolean) => void;
};


const statusClass = (status?: PayrollSchedule['status']) => {
    if (status === 'active') return 'bg-green-100 text-green-700';
    return 'bg-gray-200 text-gray-700 dark:text-gray-300';
};

const formatStatus = (status?: string) => (status ?? '-').replace(/[_-]+/g, ' ').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());

const ScheduleRow = ({ schedule, onUpdate, onToggleStatus }: ScheduleRowProps) => {
    const isActive = schedule.status === 'active';
    const periodLabel =
        schedule.status === 'active'
            ? schedule.period ?? '-'
            : getCurrentPeriodLabel(schedule.frequency) ?? '-';
    const payOnLabel =
        schedule.status === 'active'
            ? schedule.payon ?? '-'
            : getCurrentPeriodEndLabel(schedule.frequency) ?? '-';

    const handleUpdate = (updates: Partial<PayrollSchedule>) => {
        if (!schedule.id) return;
        onUpdate?.(schedule.id, updates);
    };

    return (
        <TRow className={schedule.status === 'active' ? 'font-semibold' : undefined}>
            <TCell className="text-gray-700 dark:text-white/70 text-sm px-4 py-3">
                {schedule.frequency}
            </TCell>
            <TCell className="text-gray-700 dark:text-white/70 text-sm px-4 py-3">
                {periodLabel}
            </TCell>
            <TCell className="text-gray-700 dark:text-white/70 text-sm px-4 py-3 min-w-40">
                {payOnLabel}
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
        </TRow>
    );
};


export const ScheduleTable = ({ data = [], onUpdate, onToggleStatus }: ScheduleTableProps) => {
    if (data.length === 0) { return <p className="text-center py-8 text-gray-500">No data available.</p>; }

    return (
        <div className="overflow-x-auto border rounded-md border-ld">
            <Table>
                <THeader>
                    <TRow>
                        <THead className="min-w-32 px-4">Frequency</THead>
                        <THead className="min-w-36 px-4">Current Period</THead>
                        <THead className="min-w-32 px-4">Pay On</THead>
                        <THead className="min-w-32 px-4">Status</THead>
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
