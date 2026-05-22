export type COATemplate = {
    key: string;
    name: string;
    label: string;
    description: string;
};


export type NormalBalance = 'Debit' | 'Credit';
export type COAGroupLevel1 = string;

export type COARow = {
    id?: string | null;
    parent_id?: string | null;
    coa_code?: string | null;
    coa_name?: string | null;
    coa_status?: string | null;
    coa_level?: number | null;

    normal_balance?: string | null;
    is_posting?: boolean | null;
    is_deleted?: boolean | null;
    is_readonly?: boolean | null;
    children?: COARow[] | null;
    [key: string]: unknown;
};

export type COAFormState = {
    coa_code: string;
    coa_status?: string;
    coa_name: string;
    coa_level?: number | null;
    
    normal_balance: NormalBalance;
    is_posting: boolean;
    is_deleted?: boolean;
    is_readonly?: boolean;
};


export type ApplyCoaResponse = {
    created: number;
    existing: number;
};

export type ApplyCOAResponse = ApplyCoaResponse;


export type AgentChatResponse = Record<string, unknown>;
    
export type AgentChatPayload = {
    message: string;
};

export type StreamCallback = (event: string, data: Record<string, unknown>) => void;
