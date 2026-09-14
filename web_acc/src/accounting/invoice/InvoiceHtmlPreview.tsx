import { useMemo } from 'react';
import type { Invoice } from 'src/accounting/invoice/o_inv-api';
import type { InterfaceBE } from 'src/types/type_be';
import { genInvoiceHTML, type TemplateMode } from 'src/accounting/invoice/templates';

type InvoiceHtmlPreviewProps = {
    invoice: Partial<Invoice>;
    biz: Partial<InterfaceBE>;
    templateId: string;
    // 'view' = editor preview (scaled 0.5), 'picker' = thumbnail (0.25),
    // 'pdf' = full size (1.0). Mirrors the RN template previewMode.
    mode?: TemplateMode;
    className?: string;
    title?: string;
};

// Renders an invoice template's HTML in a sandboxed iframe. The template output
// is a self-contained HTML document (inline <style>, base64 logo), so an iframe
// with srcDoc isolates its CSS from the app and shows exactly what the PDF will
// contain — same generator, only the mode's transform: scale() differs.
const InvoiceHtmlPreview = ({
    invoice,
    biz,
    templateId,
    mode = 'view',
    className,
    title = 'Invoice preview',
}: InvoiceHtmlPreviewProps) => {
    const html = useMemo(
        () => genInvoiceHTML(invoice, biz, mode, templateId),
        [invoice, biz, mode, templateId],
    );

    return (
        <iframe
            title={title}
            srcDoc={html}
            // No scripts in templates; sandbox with nothing enabled = render-only.
            sandbox=""
            loading="lazy"
            className={className ?? 'h-full w-full border-0 bg-white'}
        />
    );
};

export default InvoiceHtmlPreview;
