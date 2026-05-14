import type { TxRow } from 'src/accounting/inbox/inbox-api';

export type JournalEntryLine = {
    id?: string;
    line_type?: string | null;
    amount?: number | string | null;
    account_id?: string | null;
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
        linear-gradient(to right, rgba(225, 71, 71, 0.34) 0, rgba(225, 71, 71, 0.34) 1px, transparent 1px, transparent 4px, rgba(225, 71, 71, 0.34) 4px, rgba(225, 71, 71, 0.34) 5px, transparent 5px, transparent 100%),
        linear-gradient(to right, rgba(225, 71, 71, 0.34) 0, rgba(225, 71, 71, 0.34) 1px, transparent 1px, transparent 4px, rgba(225, 71, 71, 0.34) 4px, rgba(225, 71, 71, 0.34) 5px, transparent 5px, transparent 100%),
        linear-gradient(to right, rgba(225, 71, 71, 0.26) 0, rgba(225, 71, 71, 0.26) 1px, transparent 1px, transparent 100%),
        repeating-linear-gradient(to right, transparent 0, transparent 95px, rgba(47, 126, 214, 0.26) 95px, rgba(47, 126, 214, 0.26) 96px),
        repeating-linear-gradient(to bottom, transparent 0, transparent 29px, rgba(47, 126, 214, 0.22) 29px, rgba(47, 126, 214, 0.22) 30px)
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

export const getTransactionJournalId = (row: TxRow | undefined): string | null => {
    if (!row) return null;

    const journalId =
        row.journal_id ??
        row.journal_entry_id ??
        row.journalEntryId ??
        row.je_id ??
        row.jeId;

    const value = String(journalId ?? '').trim();
    return value || null;
};

export const getEmbeddedJournalEntry = (row: TxRow | undefined): JournalEntryPreview | null => {
    if (!row) return null;

    const apiEntry = row.journal_entry ?? row.journalEntry ?? row.je;
    return isJournalEntryPreview(apiEntry) ? apiEntry : null;
};
