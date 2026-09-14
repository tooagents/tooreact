// Ported from the RN repo's src/utils/dateUtils.tsx.
// The Firebase Timestamp branch has been dropped — only string/Date/null.

export function date2string(date: string | Date | null | undefined): string {
    if (!date) return '';

    const jsDate = typeof date === 'string' ? new Date(date) : date;

    return new Intl.DateTimeFormat('en-US', {
        month: 'short', // "May"
        day: 'numeric', // "28"
        year: 'numeric', // "2025"
    }).format(jsDate);
}
