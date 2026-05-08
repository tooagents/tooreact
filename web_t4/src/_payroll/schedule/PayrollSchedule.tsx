import { useMemo, useState, useEffect } from 'react';
import BreadcrumbComp from 'src/_layouts/shared/breadcrumb/BreadcrumbComp';
import { ScheduleTable } from './ScheduleTable';
import { scheduleAPI } from './schedule-api';
import { PayrollSchedule } from 'src/types/payroll';
import LoadingSpinner from 'src/components/shared/LoadingSpinner';
import ScheduleModal from './ScheduleModal';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from 'src/components/ui/dialog';
import { Button } from 'src/components/ui/button';

const BCrumb = [
    {        to: '/',        title: 'Home',    },
    {        title: 'Payroll Schedules',    },
];

const PayrollScheduleEntrance = () => {
    const [schedules, setSchedules] = useState<PayrollSchedule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalMessage, setModalMessage] = useState('');
    const [modalVariant, setModalVariant] = useState<'confirm' | 'info'>('info');
    const [pendingAction, setPendingAction] = useState<null | (() => void)>(null);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editSchedule, setEditSchedule] = useState<PayrollSchedule | null>(null);

    useEffect(() => {
        fetchSchedules();
    }, []);

    const fetchSchedules = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const data = await scheduleAPI.listPayrollSchedules({ skip: 0, limit: 100 });
            setSchedules(data);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch payroll schedules';
            setError(errorMessage);
            console.error('Error fetching payroll schedules:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const openInfoModal = (title: string, message: string) => {
        setModalTitle(title);
        setModalMessage(message);
        setModalVariant('info');
        setPendingAction(null);
        setModalOpen(true);
    };

    const openConfirmModal = (title: string, message: string, onConfirm: () => void) => {
        setModalTitle(title);
        setModalMessage(message);
        setModalVariant('confirm');
        setPendingAction(() => onConfirm);
        setModalOpen(true);
    };

    const openEditModal = (schedule: PayrollSchedule) => {
        setEditSchedule({ ...schedule, status: 'active' });
        setEditModalOpen(true);
    };

    const closeEditModal = () => {
        setEditModalOpen(false);
        setEditSchedule(null);
    };

    const performStatusUpdate = async (schedule: PayrollSchedule, nextStatus: 'active' | 'inactive') => {
        await scheduleAPI.editSchedule({ ...schedule, status: nextStatus });
        await fetchSchedules();
    };

    const handleToggleScheduleStatus = async (schedule: PayrollSchedule, nextActive: boolean) => {
        if (!schedule.id) return;
        try {
            const nextStatus = nextActive ? 'active' : 'inactive';
            if (schedule.status === nextStatus) return;
            const activeSchedules = schedules.filter(
                (item) => item.id !== schedule.id && item.status === 'active'
            );
            if (nextActive && activeSchedules.length > 0) {
                openInfoModal(
                    'Activation Not Allowed',
                    'This schedule cannot be activated because another schedule is already active. Please deactivate the current active schedule first.'
                );
                return;
            }

            if (nextActive && schedule.status === 'inactive') {
                openEditModal(schedule);
                return;
            }

            if (!nextActive && schedule.status === 'active') {
                openConfirmModal(
                    'Deactivate Schedule?',
                    'Deactivating this schedule will invalidate any in-progress payroll data. Do you want to continue?',
                    () => {
                        performStatusUpdate(schedule, nextStatus).catch((err) => {
                            const errorMessage =
                                err instanceof Error ? err.message : 'Failed to update payroll schedule';
                            setError(errorMessage);
                            console.error('Error updating payroll schedule:', err);
                        });
                    }
                );
                return;
            }
            await performStatusUpdate(schedule, nextStatus);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to update payroll schedule';
            setError(errorMessage);
            console.error('Error updating payroll schedule:', err);
        }
    };

    const handleInlineUpdate = async (scheduleId: string, updates: Partial<PayrollSchedule>) => {
        const current = schedules.find((item) => item.id === scheduleId);
        if (!current) return;
        try {
            setError(null);
            await scheduleAPI.editSchedule({ ...current, ...updates });
            await fetchSchedules();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to update payroll schedule';
            setError(errorMessage);
            console.error('Error updating payroll schedule:', err);
        }
    };

    const sortedSchedules = useMemo(() => {
        const order = ['biweekly', 'monthly', 'weekly', 'semimonthly'];
        const orderIndex = new Map(order.map((value, index) => [value, index]));
        return [...schedules].sort((a, b) => {
            const aKey = a.frequency?.toLowerCase?.() ?? '';
            const bKey = b.frequency?.toLowerCase?.() ?? '';
            const aIndex = orderIndex.has(aKey) ? orderIndex.get(aKey)! : Number.MAX_SAFE_INTEGER;
            const bIndex = orderIndex.has(bKey) ? orderIndex.get(bKey)! : Number.MAX_SAFE_INTEGER;
            if (aIndex !== bIndex) return aIndex - bIndex;
            return aKey.localeCompare(bKey);
        });
    }, [schedules]);

    return (
        <>
            <BreadcrumbComp title="Payroll Schedules" items={BCrumb} />
            <div className="flex gap-6 flex-col">
                {/* Table and Header */}

                    {error && (
                        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded mb-4">
                            Error: {error}
                        </div>
                    )}

                    {isLoading ? (
                        <div className="p-4 flex items-center justify-center gap-2 text-gray-500">
                            <LoadingSpinner size="md" />
                        </div>
                    ) : schedules.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                            No payroll schedules found.
                        </div>
                    ) : (
                        <ScheduleTable
                            data={sortedSchedules}
                            onUpdate={handleInlineUpdate}
                            onToggleStatus={handleToggleScheduleStatus}
                        />
                    )}
            </div>

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{modalTitle}</DialogTitle>
                        <DialogDescription>{modalMessage}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-2">
                        {modalVariant === 'confirm' ? (
                            <>
                                <Button variant="outline" onClick={() => setModalOpen(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={() => {
                                        setModalOpen(false);
                                        pendingAction?.();
                                    }}
                                >
                                    Continue
                                </Button>
                            </>
                        ) : (
                            <Button onClick={() => setModalOpen(false)}>OK</Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ScheduleModal
                isOpen={editModalOpen}
                onClose={closeEditModal}
                onComplete={fetchSchedules}
                initialData={editSchedule}
            />
        </>
    );
};

export default PayrollScheduleEntrance;
