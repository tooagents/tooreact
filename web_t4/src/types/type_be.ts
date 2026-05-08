type Nullable<T> = T | null;

export interface InterfaceBE {
    id: string;

    // Current BE payload fields
    be_type?: Nullable<string>;
    be_name?: Nullable<string>;
    be_logo?: Nullable<string>;
    be_contact?: Nullable<string>;
    be_contact_title?: Nullable<string>;
    be_address?: Nullable<string>;
    be_email?: Nullable<string>;
    be_phone?: Nullable<string>;
    be_website?: Nullable<string>;
    be_biz_number?: Nullable<string>;
    be_tax_id?: Nullable<string>;
    be_bank_info?: Nullable<string>;
    be_payment_term?: Nullable<number>;
    be_currency?: Nullable<string>;
    be_inv_template_id?: Nullable<string>;
    be_description?: Nullable<string>;
    be_note?: Nullable<string>;
    be_timezone?: Nullable<string>;
    be_date_format?: Nullable<string>;
    be_inv_prefix?: Nullable<string>;
    be_inv_integer?: Nullable<number>;
    be_inv_integer_max?: Nullable<number>;
    be_show_paid_stamp?: Nullable<boolean>;
    be_plan_id?: Nullable<string>;
    be_plan_name?: Nullable<string>;
    be_plan251_expired?: Nullable<string>;
    be_plan252_expired?: Nullable<string>;
    be_plan253_expired?: Nullable<string>;
    be_plan254_expired?: Nullable<string>;
    be_plan255_expired?: Nullable<string>;
    be_plan256_expired?: Nullable<string>;
    be_plan257_expired?: Nullable<string>;
    be_plan258_expired?: Nullable<string>;
    be_plan259_expired?: Nullable<string>;
    be_number?: Nullable<string>;

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

    stripe_customer_id?: Nullable<string>;
    stripe_subscription_id?: Nullable<string>;
    stripe_price_id?: Nullable<string>;
    stripe_status?: Nullable<string>;
    stripe_current_period_end?: Nullable<string>;
    stripe_cancel_at_period_end?: Nullable<boolean>;
    stripe_cancel_at?: Nullable<string>;
    stripe_plan_key?: Nullable<string>;
    stripe_interval?: Nullable<string>;
    stripe_latest_event_id?: Nullable<string>;

    ten_id?: Nullable<string>;
    biz_id?: Nullable<string>;
    usr_id?: Nullable<string>;
    cli_id?: Nullable<string>;
    usr_type?: Nullable<string>;
    created_by?: Nullable<string>;
    created_at?: Nullable<string>;

    b_int?: Nullable<number>;
    b_str?: Nullable<string>;
    b_decimal?: Nullable<number>;
    b_date?: Nullable<string>;
    b_bool?: Nullable<boolean>;
    b_json?: Nullable<Record<string, unknown>>;
    is_deleted?: Nullable<boolean>;
    is_flag?: Nullable<boolean>;
    locale?: Nullable<string>;
    status?: Nullable<string>;
    type?: Nullable<string>;
    description?: Nullable<string>;
    extra?: Nullable<Record<string, unknown>>;

    // Compatibility aliases still used by existing UI code
    name?: Nullable<string>;
    business_number?: Nullable<string>;
}

export const EMPTY_BE: InterfaceBE = {
    id: "",
    name: "",
    be_name: "",
};

export function dateOnly(value?: string | null): string {
    return value ? value.slice(0, 10) : "";
}
