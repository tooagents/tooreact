// Loose DTO shapes the ported invoice templates were originally written
// against (from the React Native repo's src/types/T_*.tsx). Kept permissive
// (all fields optional) so the templates typecheck unchanged. Firebase
// Timestamp is intentionally dropped — dates are Date | string here.

export interface ItemDB {
    item_id?: string;
    item_number?: string;

    item_name?: string;
    item_rate?: number;
    item_unit_of_measure?: string;
    item_sku?: string;
    item_description?: string;

    status?: string;
    is_active?: number;
    is_locked?: number;
    is_deleted?: number;
    created_at?: Date;
    updated_at?: Date;

    item_quantity?: number;  // for InvItem only
    item_note?: string;      // for InvItem only
    item_amount?: number;    // for InvItem only
}

export interface PMDB {
    pm_id?: string;
    pm_name?: string;
    pm_note?: string;

    pay_date?: Date;         // for InvPayment only
    pay_amount?: number;     // for InvPayment only
    pay_reference?: string;  // for InvPayment only

    status?: string;
    is_active?: number;
    is_locked?: number;
    is_deleted?: number;
    created_at?: Date;
    updated_at?: Date;
}

export interface InvDB {
    inv_id?: string;
    user_id?: string;
    be_id?: string;

    inv_number?: string;
    inv_date?: Date | string;
    inv_due_date?: Date | string;

    inv_title?: string;
    inv_template_id?: string;

    client_id?: string;
    client_number?: string;
    client_company_name?: string;
    client_contact_name?: string;
    client_contact_title?: string;
    client_address?: string;
    client_email?: string;
    client_secondphone?: string;
    client_mainphone?: string;
    client_fax?: string;
    client_website?: string;
    client_business_number?: string;
    client_currency?: string;
    client_tax_id?: string;
    client_payment_term?: number;
    client_payment_method?: string;
    client_terms_conditions?: string;
    client_note?: string;

    inv_payment_term?: number;
    inv_payment_requirement?: string;
    inv_reference?: string;
    inv_currency?: string;

    inv_subtotal?: number;
    inv_discount?: number;
    inv_tax_label?: string;
    inv_tax_rate?: number;
    inv_tax_amount?: number;

    inv_shipping?: number;
    inv_handling?: number;
    inv_deposit?: number;
    inv_adjustment?: number;
    inv_other_charges_label?: string;
    inv_other_charges_amount?: number;
    inv_total?: number;

    inv_paid_total?: number;
    inv_balance_due?: number;
    inv_payment_status?: string;

    inv_tnc?: string;
    inv_notes?: string;

    inv_items?: ItemDB[];
    inv_payments?: PMDB[];

    status?: string;
    is_active?: number;
    is_locked?: number;
    is_deleted?: number;
    created_at?: Date;
    updated_at?: Date;
}

export interface BE_DB {
    user_id?: string;

    be_id?: string;
    be_logo?: string;
    be_name?: string;
    be_contact?: string;
    be_contact_title?: string;
    be_address?: string;
    be_email?: string;
    be_phone?: string;
    be_website?: string;
    be_type?: string;

    be_biz_number?: string;
    be_tax_id?: string;
    be_bank_info?: string;
    be_payment_term?: number;

    be_currency?: string;
    be_inv_template_id?: string;
    be_description?: string;
    be_note?: string;

    be_timezone?: string;
    be_date_format?: string;
    be_inv_prefix?: string;
    be_inv_integer?: number;
    be_inv_integer_max?: number;

    status?: string;
    is_active?: number;
    is_locked?: number;
    is_deleted?: number;
    created_at?: Date;
    updated_at?: Date;

    be_show_paid_stamp?: boolean;

    be_plan_id?: string;
    be_plan_name?: string;
}

export interface ClientDB {
    user_id?: string;
    be_id?: string;

    client_id?: string;
    client_number?: string;
    client_business_number?: string;

    client_company_name?: string;
    client_contact_name?: string;
    client_contact_title?: string;
    client_address?: string;
    client_email?: string;
    client_mainphone?: string;
    client_secondphone?: string;
    client_fax?: string;
    client_website?: string;

    client_currency?: string;
    client_tax_id?: string;
    client_payment_term?: number;
    client_payment_method?: string;

    client_template_id?: string;
    client_terms_conditions?: string;
    client_note?: string;

    status?: string;
    is_active?: number;
    is_locked?: number;
    is_deleted?: number;
    created_at?: Date;
    updated_at?: Date;
}
