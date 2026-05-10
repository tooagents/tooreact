type ScheduleFrequency = 'weekly' | 'biweekly' | 'monthly' | 'semimonthly';

const toFrequency = (value?: string | null): ScheduleFrequency | null => {
    const normalized = value?.toLowerCase?.() ?? '';
    if (normalized === 'weekly') return 'weekly';
    if (normalized === 'biweekly') return 'biweekly';
    if (normalized === 'monthly') return 'monthly';
    if (normalized === 'semimonthly') return 'semimonthly';
    return null;
};

const addDays = (date: Date, days: number): Date =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const startOfWeekMonday = (date: Date): Date => {
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    return addDays(date, diff);
};

const endOfWeekFriday = (date: Date): Date => addDays(startOfWeekMonday(date), 4);

const formatShortDate = (date: Date): string =>
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const parseLocalDate = (value?: string | null): Date | null => {
    if (!value) return null;
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
};

const endOfMonth = (year: number, month: number): Date =>
    new Date(year, month + 1, 0);

const clampDayInMonth = (year: number, month: number, day: number): Date => {
    const lastDay = endOfMonth(year, month).getDate();
    const safeDay = Math.min(Math.max(day, 1), lastDay);
    return new Date(year, month, safeDay);
};

const normalizePayOn = (value?: string | null): string =>
    (value ?? '').trim().toLowerCase();

const isEomValue = (value?: string | null): boolean => {
    const normalized = normalizePayOn(value);
    return normalized === 'eom' || normalized === 'last working day' || normalized === 'last_working_day';
};

const weekdayIndex = (value?: string | null): number | null => {
    const normalized = normalizePayOn(value);
    if (normalized === 'monday') return 1;
    if (normalized === 'tuesday') return 2;
    if (normalized === 'wednesday') return 3;
    if (normalized === 'thursday') return 4;
    if (normalized === 'friday') return 5;
    return null;
};

export const getCurrentPeriodRange = (
    frequency?: string | null,
    referenceDate: Date = new Date(),
): { start: Date; end: Date } | null => {
    const normalized = toFrequency(frequency);
    if (!normalized) return null;

    if (normalized === 'weekly') {
        const start = startOfWeekMonday(referenceDate);
        const end = endOfWeekFriday(referenceDate);
        return { start, end };
    }

    if (normalized === 'biweekly') {
        const start = startOfWeekMonday(referenceDate);
        const end = addDays(start, 11);
        return { start, end };
    }

    if (normalized === 'semimonthly') {
        const year = referenceDate.getFullYear();
        const month = referenceDate.getMonth();
        const date = referenceDate.getDate();
        if (date <= 15) {
            return { start: new Date(year, month, 1), end: new Date(year, month, 15) };
        }
        return { start: new Date(year, month, 16), end: new Date(year, month + 1, 0) };
    }

    if (normalized === 'monthly') {
        const year = referenceDate.getFullYear();
        const month = referenceDate.getMonth();
        return { start: new Date(year, month, 1), end: new Date(year, month + 1, 0) };
    }

    return null;
};

export const getCurrentPeriodLabel = (
    frequency?: string | null,
    referenceDate: Date = new Date(),
): string | null => {
    const range = getCurrentPeriodRange(frequency, referenceDate);
    if (!range) return null;
    return `${formatShortDate(range.start)} - ${formatShortDate(range.end)}`;
};

export const getPeriodLabelFromEffective = (
    frequency?: string | null,
    effectiveFrom?: string | null,
): string | null => {
    const effectiveDate = parseLocalDate(effectiveFrom);
    if (!effectiveDate) return null;
    return getCurrentPeriodLabel(frequency, effectiveDate);
};

export const getCurrentPeriodEndLabel = (
    frequency?: string | null,
    referenceDate: Date = new Date(),
): string | null => {
    const range = getCurrentPeriodRange(frequency, referenceDate);
    if (!range) return null;
    return formatShortDate(range.end);
};

export const getPayOnLabelForActivation = (params: {
    frequency?: string | null;
    effectiveFrom?: string | null;
    payon?: string | null;
    semi1?: string | null;
    semi2?: string | null;
}): string | null => {
    const { frequency, effectiveFrom, payon, semi1, semi2 } = params;
    const effectiveDate = parseLocalDate(effectiveFrom);
    if (!effectiveDate) return null;

    const normalized = toFrequency(frequency);
    if (!normalized) return null;

    if (normalized === 'weekly' || normalized === 'biweekly') {
        const dayIndex = weekdayIndex(payon);
        if (!dayIndex) return null;
        const start = startOfWeekMonday(effectiveDate);
        const offsetWeeks = normalized === 'weekly' ? 1 : 2;
        const target = addDays(start, offsetWeeks * 7 + (dayIndex - 1));
        return formatShortDate(target);
    }

    if (normalized === 'monthly') {
        if (isEomValue(payon)) {
            const end = endOfMonth(effectiveDate.getFullYear(), effectiveDate.getMonth());
            return formatShortDate(end);
        }
        const dayNumber = Number.parseInt(String(payon ?? ''), 10);
        if (!Number.isFinite(dayNumber)) return null;
        const nextMonth = new Date(effectiveDate.getFullYear(), effectiveDate.getMonth() + 1, 1);
        const target = clampDayInMonth(nextMonth.getFullYear(), nextMonth.getMonth(), dayNumber);
        return formatShortDate(target);
    }

    if (normalized === 'semimonthly') {
        const period = getCurrentPeriodRange('semimonthly', effectiveDate);
        if (!period) return null;
        const periodEnd = period.end;
        const baseYear = periodEnd.getFullYear();
        const baseMonth = periodEnd.getMonth();

        const values = [semi1, semi2];
        const candidates: Date[] = [];

        values.forEach((value) => {
            if (!value) return;
            if (isEomValue(value)) {
                const end = endOfMonth(baseYear, baseMonth);
                if (end.getTime() >= periodEnd.getTime()) {
                    candidates.push(end);
                }
                return;
            }

            const dayNumber = Number.parseInt(String(value), 10);
            if (!Number.isFinite(dayNumber)) return;
            const currentMonthDate = clampDayInMonth(baseYear, baseMonth, dayNumber);
            if (currentMonthDate.getTime() > periodEnd.getTime()) {
                candidates.push(currentMonthDate);
            } else {
                const nextMonthDate = clampDayInMonth(baseYear, baseMonth + 1, dayNumber);
                candidates.push(nextMonthDate);
            }
        });

        if (!candidates.length) return null;
        candidates.sort((a, b) => a.getTime() - b.getTime());
        return formatShortDate(candidates[0]);
    }

    return null;
};
