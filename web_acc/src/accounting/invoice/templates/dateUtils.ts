// Ported from the RN repo's src/utils/dateUtils.tsx.
// The Firebase Timestamp branch has been dropped — only string/Date/null.

const fmt = new Intl.DateTimeFormat('en-US', {
    month: 'short', // "May"
    day: 'numeric', // "28"
    year: 'numeric', // "2025"
});

export function date2string(date: string | Date | null | undefined): string {
    if (!date) return '';

    // Calendar-date semantics: a saved date must render as the exact day the user
    // entered, in every timezone/device. The DB stores date-only fields as UTC
    // midnight (e.g. 2026-09-18T00:00:00Z); parsing that with new Date() and
    // rendering in local time rolls the day back in negative-offset zones
    // (Sep 18 -> Sep 17). Slice the leading YYYY-MM-DD and format those components
    // as-is, so the PDF/email match the app and never shift. Mirrors formatDate().
    if (typeof date === 'string') {
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
        if (m) {
            const [, year, month, day] = m.map(Number);
            return fmt.format(new Date(year, month - 1, day));
        }
        const parsed = new Date(date);
        return Number.isNaN(parsed.getTime()) ? date : fmt.format(parsed);
    }

    return fmt.format(date);
}
