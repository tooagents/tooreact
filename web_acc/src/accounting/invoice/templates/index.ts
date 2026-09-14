// Public contract for the ported invoice-template engine.
// Framework-agnostic: takes the web Invoice + business-entity payloads and
// returns a self-contained HTML string for a given template + render mode.

import type { Invoice } from 'src/accounting/invoice/o_inv-api';
import type { InterfaceBE } from 'src/types/type_be';
import { genHTML } from './genHTML';
import { toTemplateInput } from './adapter';

export type TemplateMode = 'pdf' | 'view' | 'picker';

// t1..t18 in numeric order.
export const TEMPLATE_IDS: string[] = Array.from(
    { length: 18 },
    (_, i) => `t${i + 1}`,
);

export function genInvoiceHTML(
    inv: Partial<Invoice>,
    be: Partial<InterfaceBE>,
    mode: TemplateMode,
    templateId: string,
): string {
    const { oInv, oBiz } = toTemplateInput(inv, be);
    return genHTML(oInv, oBiz, mode, templateId);
}
