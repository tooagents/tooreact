'use client';

import React from 'react';
import { Badge } from 'src/components/ui/badge';
import { Table, TBody, TCell, THead, THeader, TRow } from 'src/components/ui/table';
import type { PayrollSchedule } from 'src/types/payroll';

type ScheduleTableProps = {
    data?: PayrollSchedule[];
};

const statusClass = (status?: PayrollSchedule['status']) => {
    if (status === 'active') return 'bg-green-100 text-green-700';
    return 'bg-gray-200 text-gray-700 dark:text-gray-300';
};

const formatStatus = (status?: string) =>
    (status ?? '-').replace(/[_-]+/g, ' ').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());

export const ScheduleTable = ({ data = [] }: ScheduleTableProps) => {
    if (data.length === 0) {
        return <p className="text-center py-8 text-gray-500">No data available.</p>;
    }

    return (
        <div className="overflow-x-auto border rounded-md border-ld">
            <Table>
                <THeader>
                    <TRow>
                        <THead className="min-w-32 px-4">Frequency</THead>
                        <THead className="min-w-32 px-4">Anchor Date</THead>
                        <THead className="min-w-32 px-4">Pay Offset</THead>
                        <THead className="min-w-32 px-4">Effective From</THead>
                        <THead className="min-w-32 px-4">Status</THead>
                    </TRow>
                </THeader>
                <TBody>
                    {data.map((schedule) => (
                        <TRow key={schedule.id ?? `${schedule.frequency}-${schedule.anchor_date}`}>
                            <TCell className="text-gray-700 dark:text-white/70 text-sm px-4 py-3">
                                {schedule.frequency}
                            </TCell>
                            <TCell className="text-gray-700 dark:text-white/70 text-sm px-4 py-3">
                                {schedule.anchor_date}
                            </TCell>
                            <TCell className="text-gray-700 dark:text-white/70 text-sm px-4 py-3">
                                {schedule.pay_date_offset_days}
                            </TCell>
                            <TCell className="text-gray-700 dark:text-white/70 text-sm px-4 py-3">
                                {schedule.effective_from}
                            </TCell>
                            <TCell className="px-4 py-3">
                                <Badge className={`px-2 py-1 rounded-full text-xs font-medium ${statusClass(schedule.status)}`}>
                                    {formatStatus(schedule.status)}
                                </Badge>
                            </TCell>
                        </TRow>
                    ))}
                </TBody>
            </Table>
        </div>
    );
};
