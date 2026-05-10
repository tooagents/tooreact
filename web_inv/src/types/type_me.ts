export interface InterfaceUser {
    id?: string;
    user_id?: string;
    first_name?: string;
    last_name?: string;
    name?: string;
    avatar?: string;
    email?: string;
    phone?: string;
    position?: string;
    profile_picture?: string;
    facebook?: string;
    twitter?: string;
    github?: string;
    reddit?: string;
    current_biz_id?: string;
    biz_id?: string;
    tenant_id?: string;
    ten_id?: string;
    country?: string;
    state?: string;
    pin?: string;
    zip?: string;
    tax_no?: string;
    created_at?: string;
    updated_at?: string;
    note?: string;
}

export const EMPTY_ME: InterfaceUser = {
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    position: "",
    facebook: "",
    twitter: "",
    github: "",
    reddit: "",
    country: "",
    state: "",
    pin: "",
    zip: "",
    tax_no: "",
    note: "",
};
