// Bridges the web invoice/business-entity types onto the loose DTO shapes the
// ported templates expect. Web field names already match the DTO names, so this
// is mostly a spread + cast, plus: guarantee inv_items is an array and coerce
// the item numeric fields (which the web types allow as string | null).

import type { Invoice } from 'src/accounting/invoice/o_inv-api';
import type { InterfaceBE } from 'src/types/type_be';
import { DEFAULT_INV_TNC } from 'src/accounting/invoice/invoiceDefaults';
import type { BE_DB, InvDB, ItemDB } from './dto';

const toNum = (v: unknown): number | undefined =>
    v === null || v === undefined || v === '' ? undefined : Number(v);

export function toTemplateInput(
    inv: Partial<Invoice>,
    be: Partial<InterfaceBE>,
): { oInv: InvDB; oBiz: BE_DB } {
    const inv_items: ItemDB[] = (inv.inv_items ?? []).map((it) => ({
        ...it,
        item_quantity: toNum(it.item_quantity),
        item_rate: toNum(it.item_rate),
        item_amount: toNum(it.item_amount),
    })) as ItemDB[];

    // Resolve the effective terms & conditions once, here, so every render path
    // (print / canvas / preview) and every template shows the same footer:
    // per-invoice inv_tnc -> business default be_inv_tnc -> app default.
    const inv_tnc =
        (inv.inv_tnc && inv.inv_tnc.trim()) ||
        (be.be_inv_tnc && String(be.be_inv_tnc).trim()) ||
        DEFAULT_INV_TNC;

    const oInv = {
        ...inv,
        inv_items,
        inv_tnc,
    } as unknown as InvDB;

    const oBiz = { ...be } as unknown as BE_DB;

    return { oInv, oBiz };
}
