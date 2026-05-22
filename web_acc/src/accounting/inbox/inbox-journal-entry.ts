export type JournalEntryLine = {
    id?: string;
    line_type?: string | null;
    amount?: number | string | null;
    account_id?: string | null;
    coa_code?: string | null;
    coa_name?: string | null;
    account_code?: string | null;
    account_name?: string | null;
    account_label?: string | null;
    [key: string]: unknown;
};

export type JournalEntryPreview = {
    id: string;
    memo?: string | null;
    confidence?: number | string | null;
    rationale?: string | null;
    lines?: JournalEntryLine[];
    status?: string | null;
    [key: string]: unknown;
};

export const ledgerPaperStyle = {
    backgroundColor: '#f8f1de',
    backgroundImage: `
        linear-gradient(to right, rgba(225, 71, 71, 0.34) 0, rgba(225, 71, 71, 0.34) 1px, transparent 1px, transparent 4px, rgba(225, 71, 71, 0.34) 2px, rgba(225, 71, 71, 0.34) 5px, transparent 5px, transparent 100%),
        linear-gradient(to right, rgba(225, 71, 71, 0.34) 0, rgba(225, 71, 71, 0.34) 1px, transparent 1px, transparent 4px, rgba(225, 71, 71, 0.34) 2px, rgba(225, 71, 71, 0.34) 5px, transparent 5px, transparent 100%),
        linear-gradient(to right, rgba(225, 71, 71, 0.26) 0, rgba(225, 71, 71, 0.26) 1px, transparent 1px, transparent 100%),
        repeating-linear-gradient(to right, transparent 0, transparent 95px, rgba(7, 26, 14, 0.05) 2px, rgba(47, 126, 214, 0.1) 96px),
        repeating-linear-gradient(to bottom, transparent 0, transparent 29px, rgba(7, 26, 14, 0.05) 2px, rgba(47, 126, 214, 0.1) 30px)
    `,
    backgroundSize: '100% 100%, 100% 100%, 100% 100%, 100% 100%, 100% 100%',
    backgroundPosition: '23% 0, 56% 0, 48% 0, 0 0, 0 0',
} as const;

export const getConfidence = (entry: JournalEntryPreview) => {
    const value = Number(entry.confidence);
    return Number.isFinite(value) ? value.toFixed(2) : '-';
};

export const isJournalEntryPreview = (value: unknown): value is JournalEntryPreview =>
    value !== null && typeof value === 'object' && 'id' in value;

export const unwrapJournalEntryResponse = (value: unknown): JournalEntryPreview => {
    if (isJournalEntryPreview(value)) return value;

    if (value !== null && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        const nested = record.journal_entry ?? record.journalEntry ?? record.entry ?? record.data;
        if (isJournalEntryPreview(nested)) return nested;
    }

    throw new Error('Journal entry response did not include an entry.');
};

export const formatJournalLineAccount = (line: JournalEntryLine) => {
    const accountCode = String(line.coa_code ?? line.account_code ?? '').trim();
    const accountName = String(line.coa_name ?? line.account_name ?? '').trim();
    const accountLabel = String(line.account_label ?? '').trim();
    const accountId = String(line.account_id ?? '').trim();

    if (accountCode && accountName) return `${accountCode} ${accountName}`;
    if (accountCode) return accountCode;
    if (accountName) return accountName;
    return accountLabel || accountId || '-';
};
