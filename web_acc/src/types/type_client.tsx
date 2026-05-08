type Nullable<T> = T | null;

export interface ClientDB {
    user_id?: Nullable<string>;
    be_id?: Nullable<string>;

    client_id?: Nullable<string>;
    client_number?: Nullable<string>;
    client_business_number?: Nullable<string>;

    client_company_name?: Nullable<string>;
    client_contact_name?: Nullable<string>;
    client_contact_title?: Nullable<string>;
    client_address?: Nullable<string>;
    client_email?: Nullable<string>;
    client_mainphone?: Nullable<string>;
    client_secondphone?: Nullable<string>;
    client_fax?: Nullable<string>;
    client_website?: Nullable<string>;

    client_currency?: Nullable<string>;
    client_tax_id?: Nullable<string>;
    client_payment_term?: Nullable<number>;
    client_payment_method?: Nullable<string>;
    client_template_id?: Nullable<string>;
    client_terms_conditions?: Nullable<string>;
    client_note?: Nullable<string>;
    client_status?: Nullable<string>;

    status?: Nullable<string>;
    is_active?: Nullable<number | boolean>;
    is_locked?: Nullable<number | boolean>;
    is_deleted?: Nullable<number | boolean>;
    created_at?: Nullable<string | Date>;
    updated_at?: Nullable<string | Date>;

    // Compatibility fields still used in existing UI and transitional payloads.
    id?: Nullable<string>;
    name?: Nullable<string>;
    business_number?: Nullable<string>;
    payroll_account_number?: Nullable<string>;
    province?: Nullable<string>;
    country?: Nullable<string>;
    street_address?: Nullable<string>;
    city?: Nullable<string>;
    postal_code?: Nullable<string>;
    phone?: Nullable<string>;
    email?: Nullable<string>;
    wsib_number?: Nullable<string>;
    eht_account?: Nullable<string>;
    remittance_frequency?: Nullable<string>;
    tax_year_end?: Nullable<string>;
    legal_name?: Nullable<string>;
    operating_name?: Nullable<string>;
    business_type?: Nullable<string>;
    incorporation_date?: Nullable<string>;
    employee_count?: Nullable<number>;
    type?: Nullable<string>;
}

export function getClientId(client: ClientDB): string {
    return client.client_id ?? client.id ?? "";
}

export function getClientDisplayName(client: ClientDB): string {
    return client.client_company_name ?? client.name ?? "";
}
