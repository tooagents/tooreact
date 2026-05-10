import { create } from 'zustand';
import { periodAPI } from 'src/accounting/ledger/components/period-api';
import { PayrollPeriod } from 'src/types/payroll';

type PayrollStoreState = {
    periods: PayrollPeriod[];
    activePeriodId: string | null;
    loading: boolean;
    error: string | null;
    fetchPeriods: () => Promise<void>;
    createPeriod: (data: Partial<PayrollPeriod>) => Promise<PayrollPeriod>;
    setActivePeriodById: (id: string | null) => void;
    clear: () => void;
};

const selectDefaultActivePeriodId = (periods: PayrollPeriod[]): string | null => {
    const open = periods.find((period) => period.status === 'open' && period.id);
    if (open?.id) return open.id;
    const first = periods.find((period) => period.id);
    return first?.id ?? null;
};

export const usePayrollStore = create<PayrollStoreState>((set, get) => ({
    periods: [],
    activePeriodId: null,
    loading: false,
    error: null,
    fetchPeriods: async () => {
        set({ loading: true, error: null });
        try {
            const periods = await periodAPI.listPayrollPeriods({ skip: 0, limit: 500 });
            const currentActive = get().activePeriodId;
            const hasCurrentActive = Boolean(currentActive && periods.some((period) => period.id === currentActive));
            set({
                periods,
                activePeriodId: hasCurrentActive ? currentActive : selectDefaultActivePeriodId(periods),
                loading: false,
            });
        } catch (err) {
            set({
                loading: false,
                error: err instanceof Error ? err.message : 'Failed to fetch payroll periods',
                periods: [],
                activePeriodId: null,
            });
        }
    },
    createPeriod: async (data) => {
        set({ loading: true, error: null });
        try {
            const created = await periodAPI.createPayrollPeriod(data);
            const nextPeriods = [created, ...get().periods];
            set({
                periods: nextPeriods,
                activePeriodId: created.id ?? get().activePeriodId,
                loading: false,
            });
            return created;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to create payroll period';
            set({ loading: false, error: message });
            throw err;
        }
    },
    setActivePeriodById: (id) => set({ activePeriodId: id }),
    clear: () => set({ periods: [], activePeriodId: null, loading: false, error: null }),
}));
