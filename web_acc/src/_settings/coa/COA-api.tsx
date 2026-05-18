import { apiFetch } from 'src/core/apihttp';
import type { ApplyCOAResponse, COAFormState, COARow } from './COA-schema';

async function parseCOAResponse<T>(response: Response, message: string): Promise<T> {
    if (!response.ok) {
        const details = await response.text().catch(() => '');
        throw new Error(`${message}: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`);
    }

    if (response.status === 204) return undefined as T;
    return response.json();
}

const toCOAPayload = (form: COAFormState) => ({
    coa_code: form.coa_code.trim(),
    coa_posting_name: form.coa_posting_name.trim(),
    coa_group_level1: form.coa_group_level1,
    coa_group_level2: form.coa_group_level2.trim() || null,
    coa_group_level3: form.coa_group_level3.trim() || null,
    normal_balance: form.normal_balance,
    is_posting: form.is_posting,
});

export const coaAPI = {
    async getTree(): Promise<COARow[]> {
        const response = await apiFetch('/acc/coa/get_tree');
        return parseCOAResponse<COARow[]>(response, 'Failed to fetch COA');
    },


    async applyTemplate(templateKey: string): Promise<ApplyCOAResponse> {
        const response = await apiFetch(`/acc/coa/templates/${encodeURIComponent(templateKey)}/apply`, { method: 'POST' });
        return parseCOAResponse<ApplyCOAResponse>(response, 'Failed to apply COA template');
    },


    async createCOA(payload: COAFormState): Promise<COARow> {
        const response = await apiFetch('/acc/coa/post_new', {
            method: 'POST',
            body: JSON.stringify(toCOAPayload(payload)),
        });
        return parseCOAResponse<COARow>(response, 'Failed to create COA account');
    },

    async updateCOA(coaId: string, payload: COAFormState): Promise<COARow> {
        const response = await apiFetch(`/acc/coa/${encodeURIComponent(coaId)}`, {
            method: 'PATCH',
            body: JSON.stringify(toCOAPayload(payload)),
        });
        return parseCOAResponse<COARow>(response, 'Failed to update COA account');
    },

    async deleteCOA(coaId: string): Promise<void> {
        const response = await apiFetch(`/acc/coa/${encodeURIComponent(coaId)}`, { method: 'DELETE' });
        await parseCOAResponse<void>(response, 'Failed to archive COA account');
    },
};
