// Bridges the web invoice/business-entity types onto the loose DTO shapes the
// ported templates expect. Web field names already match the DTO names, so this
// is mostly a spread + cast, plus: guarantee inv_items is an array and coerce
// the item numeric fields (which the web types allow as string | null).

import type { Invoice } from 'src/accounting/invoice/o_inv-api';
import type { InterfaceBE } from 'src/types/type_be';
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

    const oInv = {
        ...inv,
        inv_items,
    } as unknown as InvDB;

    const oBiz = { ...be } as unknown as BE_DB;

    return { oInv, oBiz };
}
