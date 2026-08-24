const cadMoneyFormatter = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});


const cadMoneyInteger = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});


export const toNumber = (value: unknown, fallback = 0): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
    if (typeof value === 'string') {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }
    return fallback;
};

export const formatMoney = (value: unknown): string => {
    const amount = toNumber(value);
    return cadMoneyFormatter.format(amount);
};


export const formatMoneyInteger = (value: unknown): string => {
    const amount = toNumber(value);
    return cadMoneyInteger.format(amount);
};

export const formatDate = (value?: string): string => {
    if (!value) return '';
    // Treat a leading YYYY-MM-DD as a calendar date, ignoring any trailing time/zone.
    // The DB stores date-only fields as UTC midnight (e.g. 2024-08-06T00:00:00Z); parsing
    // that with new Date() and rendering in local time rolls the day back in negative-offset
    // timezones. Slicing the calendar portion keeps the displayed day tz-agnostic.
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (dateMatch) {
        const [, year, month, day] = dateMatch.map(Number);
        const local = new Date(year, month - 1, day);
        return local.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
