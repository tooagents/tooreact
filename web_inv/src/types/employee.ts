export interface Employee {
    id: string;
    first_name?: string;
    last_name?: string;
    sin?: string;
    date_of_birth?: string | null;
    address?: string | null;
    email?: string | null;
    phone: string | null;
    position: string | null;
    province?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    employment_type?: 'hourly' | 'salary' | null;
    hourly_rate?: number | string | null;
    annual_salary?: number | string | null;
    regular_hours?: number | string | null;
    federal_claim_amount?: number | string | null;
    ontario_claim_amount?: number | string | null;
    cpp_exempt?: boolean | null;
    ei_exempt?: boolean | null;
    is_deleted?: boolean | null;
}
