import type { Invoice } from 'src/accounting/invoice/o_inv-api';
import type { InterfaceBE } from 'src/types/type_be';
import { genInvoiceHTML } from 'src/accounting/invoice/templates';
import { formatDate } from 'src/core/format';
import { apiFetch } from 'src/core/apihttp';

// A user-friendly file name: "<Business>_<INV-123>_<2026-09-13>.pdf".
export function invoicePdfFilename(inv: Partial<Invoice>, biz: Partial<InterfaceBE>): string {
    const safe = (s: unknown) => String(s ?? '').replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '');
    const parts = [biz.be_name, inv.inv_number || 'draft', String(inv.inv_date ?? '').slice(0, 10)]
        .map(safe)
        .filter(Boolean);
    return `${parts.join('_') || 'invoice'}.pdf`;
}

// Render the invoice into a hidden iframe and invoke the browser's print
// dialog scoped to that document. Choosing "Save as PDF" yields a file
// pixel-identical to the on-screen preview because it is the SAME HTML the
// preview uses (mode 'pdf' = scale 1.0). No extra libraries, high fidelity.
export function printInvoicePdf(inv: Partial<Invoice>, biz: Partial<InterfaceBE>, templateId: string): void {
    const html = genInvoiceHTML(inv, biz, 'pdf', templateId);

    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    document.body.appendChild(frame);

    const cleanup = () => {
        // Delay removal so the print job can read the document first.
        window.setTimeout(() => frame.remove(), 1000);
    };

    frame.onload = () => {
        const win = frame.contentWindow;
        if (!win) {
            cleanup();
            return;
        }
        win.addEventListener('afterprint', cleanup, { once: true });
        try {
            win.focus();
            win.print();
        } catch {
            cleanup();
        }
    };

    const doc = frame.contentWindow?.document;
    if (!doc) {
        frame.remove();
        return;
    }
    doc.open();
    doc.write(html);
    doc.close();
}

// Produce a PDF Blob from the template HTML entirely client-side (jsPDF + the
// bundled html2canvas). Lower fidelity than the browser print engine for exotic
// CSS, but it yields an actual file we can attach/share/download. jsPDF and
// html2canvas are lazy-imported so they stay out of the main bundle.
export async function generateInvoicePdfBlob(
    inv: Partial<Invoice>,
    biz: Partial<InterfaceBE>,
    templateId: string,
): Promise<Blob> {
    const html = genInvoiceHTML(inv, biz, 'pdf', templateId);
    const { jsPDF } = await import('jspdf');

    // A4 in points (72dpi). windowWidth is the CSS px the html is laid out at
    // (A4 width at 96dpi ≈ 794px) so html2canvas rasterizes at the right scale.
    const PT_PER_PAGE_W = 595.28;
    const MARGIN = 24;
    const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });

    await doc.html(html, {
        x: MARGIN,
        y: MARGIN,
        width: PT_PER_PAGE_W - MARGIN * 2,
        windowWidth: 794,
        autoPaging: 'text',
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    });

    return doc.output('blob');
}

// Convert a Blob to a bare base64 string (no "data:...;base64," prefix) for
// JSON transport to the backend.
async function blobToBase64(blob: Blob): Promise<string> {
    const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
    const comma = dataUrl.indexOf(',');
    return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

// Recipient, subject and body for the invoice email. Mirrors the RN emailPDF copy.
export function buildInvoiceEmailFields(inv: Partial<Invoice>, biz: Partial<InterfaceBE>) {
    const to = String((inv as { client_email?: string }).client_email ?? '').trim();
    const number = inv.inv_number || 'your invoice';
    const due = inv.inv_due_date ? formatDate(String(inv.inv_due_date)) : '';
    const contact = String((inv as { client_contact_name?: string }).client_contact_name ?? '').trim();
    const subject = `Invoice ${number}${biz.be_name ? ` from ${biz.be_name}` : ''}`;
    const body = [
        contact ? `Dear ${contact},` : 'Dear Client,',
        '',
        `Please find attached invoice ${number}${due ? `, due on ${due}` : ''}.`,
        'If you have any questions, feel free to reach out.',
        '',
        'Thank you for your business.',
        '',
        biz.be_contact || '',
        biz.be_name || '',
        biz.be_email || '',
        biz.be_phone || '',
    ]
        .filter((line, i, arr) => !(line === '' && arr[i - 1] === '')) // collapse blank runs
        .join('\n');
    return { to, subject, body };
}

// Email the invoice: render the PDF client-side (so the attachment matches the
// preview) and POST it to the backend, which sends it via Brevo with the PDF
// attached. Returns the recipient address on success.
export async function emailInvoice(
    inv: Partial<Invoice>,
    biz: Partial<InterfaceBE>,
    templateId: string,
): Promise<{ to: string }> {
    const blob = await generateInvoicePdfBlob(inv, biz, templateId);
    const pdf_base64 = await blobToBase64(blob);
    const filename = invoicePdfFilename(inv, biz);
    const { to, subject, body } = buildInvoiceEmailFields(inv, biz);

    const res = await apiFetch('/inv/email_invoice', {
        method: 'POST',
        body: JSON.stringify({
            inv_id: inv.inv_id,
            pdf_base64,
            filename,
            to: to || undefined,
            subject,
            body,
            reply_to: biz.be_email || undefined,
            sender_name: biz.be_name || undefined,
        }),
    });

    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Failed to send invoice email: ${res.status}${detail ? ` - ${detail}` : ''}`);
    }
    const data = (await res.json().catch(() => ({}))) as { to?: string };
    return { to: data.to || to };
}
