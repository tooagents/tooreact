'use client';

import { useEffect, useState } from 'react';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { Label } from 'src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'src/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from 'src/components/ui/dialog';

import { scheduleAPI } from 'src/accounting/schedule/schedule-api';
import { PayrollSchedule } from 'src/types/payroll';
import LoadingSpinner from 'src/components/shared/LoadingSpinner';
import { getPayOnLabelForActivation, getPeriodLabelFromEffective } from './schedule-period';

const WEEKDAY_OPTIONS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const MONTH_DAY_OPTIONS = [...Array.from({ length: 31 }, (_, i) => String(i + 1)), 'EOM'];
const LAST_WORKING_DAY = 'Last working day';

const STATUS_OPTIONS = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
];

interface ScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: () => void;
    initialData?: PayrollSchedule | null;
}

const ScheduleModal = ({ isOpen, onClose, onComplete, initialData }: ScheduleModalProps) => {
    const [frequency, setFrequency] = useState('');
    const [period, setPeriod] = useState('');
    const [payon, setPayon] = useState('');
    const [semiFirst, setSemiFirst] = useState('');
    const [semiSecond, setSemiSecond] = useState('');
    const [effectiveFrom, setEffectiveFrom] = useState('');
    const [status, setStatus] = useState<'active' | 'inactive'>('inactive');
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isWeeklyLike = (value?: string) => {
        const normalized = value?.toLowerCase?.() ?? '';
        return normalized === 'weekly' || normalized === 'biweekly';
    };

    const isMonthly = (value?: string) => (value?.toLowerCase?.() ?? '') === 'monthly';
    const isSemiMonthly = (value?: string) => (value?.toLowerCase?.() ?? '') === 'semimonthly';

    const resetForm = () => {
        setFrequency('');
        setPeriod('');
        setPayon('');
        setSemiFirst('');
        setSemiSecond('');
        setEffectiveFrom('');
        setStatus('inactive');
        setNote('');
        setError(null);
    };

    useEffect(() => {
        if (!isOpen) return;
        if (initialData) {
            setFrequency(initialData.frequency ?? '');
            setPeriod(initialData.period ?? '');
            setPayon(initialData.payon ?? '');
            setSemiFirst(initialData.semi1 ?? '');
            setSemiSecond(initialData.semi2 ?? '');
            setEffectiveFrom(initialData.effective_from ?? '');
            setStatus(initialData.status ?? 'inactive');
            setNote(initialData.note ?? '');
            setError(null);
            return;
        }
        resetForm();
    }, [initialData, isOpen]);

    const handleSubmit = async () => {
        const schedule = initialData;
        if (!schedule?.id) {
            setError('No schedule selected');
            return;
        }

        if (!effectiveFrom.trim()) {
            setError('Effective from date is required');
            return;
        }

        if (isSemiMonthly(frequency) && (!semiFirst.trim() || !semiSecond.trim())) {
            setError('Both semi-monthly dates are required');
            return;
        }

        if (!isSemiMonthly(frequency) && !payon.trim()) {
            setError('Pay on is required');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const shouldComputeActive = status === 'active';
            const computedPeriod = shouldComputeActive
                ? getPeriodLabelFromEffective(frequency, effectiveFrom)
                : null;
            const computedPayOn = shouldComputeActive
                ? getPayOnLabelForActivation({
                      frequency,
                      effectiveFrom,
                      payon,
                      semi1: semiFirst,
                      semi2: semiSecond,
                  })
                : null;

            const payload: PayrollSchedule = {
                ...schedule,
                frequency,
                period: computedPeriod ?? period,
                effective_from: effectiveFrom,
                status,
                note: note.trim(),
                payon: computedPayOn ?? payon,
                semi1: semiFirst,
                semi2: semiSecond,
            };

            await scheduleAPI.editSchedule(payload);
            onComplete();
            handleClose();
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : 'Failed to update payroll schedule';
            setError(errorMessage);
            console.error('Error saving payroll schedule:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Update Payroll Schedule</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="flex flex-col gap-2">
                        <Label>Frequency</Label>
                        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                            {frequency || '-'}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label>Period</Label>
                        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                            {period || '-'}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 lg:col-span-2">
                        <Label htmlFor="payon">Pay On *</Label>
                        {isWeeklyLike(frequency) && (
                            <Select value={payon} onValueChange={setPayon}>
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
                        )}

                        {isMonthly(frequency) && (
                            <Select value={payon} onValueChange={setPayon}>
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
                        )}

                        {isSemiMonthly(frequency) && (
                            <div className="flex gap-2">
                                <Select value={semiFirst} onValueChange={setSemiFirst}>
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
                                <Select value={semiSecond} onValueChange={setSemiSecond}>
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
                        )}

                        {!isWeeklyLike(frequency) && !isMonthly(frequency) && !isSemiMonthly(frequency) && (
                            <Input
                                id="payon"
                                value={payon}
                                onChange={(e) => setPayon(e.target.value)}
                                placeholder="Enter pay on"
                            />
                        )}
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="effectiveFrom">Effective From *</Label>
                        <Input
                            id="effectiveFrom"
                            type="date"
                            value={effectiveFrom}
                            onChange={(e) => setEffectiveFrom(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="status">Status *</Label>
                        <Select value={status} onValueChange={(value) => setStatus(value as 'active' | 'inactive')}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-2 lg:col-span-2">
                        <Label htmlFor="note">Note</Label>
                        <Input
                            id="note"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Add note"
                        />
                    </div>
                </div>

                {error && (
                    <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
                        {error}
                    </div>
                )}
                {loading && (
                    <div className="rounded-md border border-border bg-muted/40 p-3">
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                            <LoadingSpinner size="md" />
                        </div>
                    </div>
                )}

                <DialogFooter className="flex gap-2">
                    <Button variant="outline" onClick={handleClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ScheduleModal;
