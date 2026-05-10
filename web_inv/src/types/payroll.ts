export interface PayrollSchedule {
    id: string;
    frequency: string;
    period?: string;
    payon?: string;
    semi1?: string;
    semi2?: string;
    note?: string;
    anchor_date?: string | null;
    pay_date_offset_days?: number | string | null;
    effective_from: string;
    status: 'active' | 'inactive';
}

export interface PayrollPeriod {
    id?: string;
    period_key?: string | number;
    start_date?: string;
    end_date?: string;
    pay_date?: string | null;
    status?: 'open' | 'closed' | 'draft' | 'pending' | string;
    created_at?: string;
    updated_at?: string;
    [key: string]: unknown;
}
