import type { Invoice } from 'src/accounting/invoice/o_inv-api';
import type { InterfaceBE } from 'src/types/type_be';
import { genInvoiceHTML } from 'src/accounting/invoice/templates';
import { DEFAULT_INV_TNC } from 'src/accounting/invoice/invoiceDefaults';
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

// A4 dimensions in CSS px at 96dpi — the layout width the templates are
// designed against. Used to size the render frame so html2canvas rasterizes
// at the right scale.
const A4_PX_W = 794;
const A4_PX_H = 1123;

// Render the template HTML in an off-screen, isolated iframe and rasterize it
// with html2canvas. Rendering in an iframe (rather than jsPDF's doc.html(),
// which injects into the LIVE page) keeps the app's global CSS out of the
// capture — Tailwind v4 emits oklch() colors, which html2canvas cannot parse
// and which otherwise throw and hang the export. The template output is a
// self-contained document (inline <style>, base64 logo), so the frame shows
// exactly the PDF content, same as the on-screen preview.
async function renderInvoiceCanvas(html: string): Promise<HTMLCanvasElement> {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.position = 'fixed';
    frame.style.left = '-10000px';
    frame.style.top = '0';
    frame.style.width = `${A4_PX_W}px`;
    frame.style.height = `${A4_PX_H}px`;
    frame.style.border = '0';
    frame.style.background = '#ffffff';
    document.body.appendChild(frame);

    try {
        const idoc = frame.contentDocument;
        if (!idoc) throw new Error('Could not create the PDF render frame.');
        idoc.open();
        idoc.write(html);
        idoc.close();

        // Wait for the frame to finish parsing, then for fonts/images to settle.
        await new Promise<void>((resolve) => {
            if (idoc.readyState === 'complete') resolve();
            else frame.addEventListener('load', () => resolve(), { once: true });
        });
        try {
            await (idoc as Document & { fonts?: FontFaceSet }).fonts?.ready;
        } catch {
            /* fonts.ready unsupported — proceed */
        }
        await new Promise((r) => window.setTimeout(r, 60));

        // Grow the frame to the full content height so nothing is clipped.
        const contentH = Math.max(idoc.documentElement.scrollHeight, idoc.body.scrollHeight, A4_PX_H);
        frame.style.height = `${contentH}px`;

        const { default: html2canvas } = await import('html2canvas');
        return await html2canvas(idoc.body, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            width: A4_PX_W,
            height: contentH,
            windowWidth: A4_PX_W,
            windowHeight: contentH,
        });
    } finally {
        frame.remove();
    }
}

// Produce a PDF Blob from the template HTML entirely client-side. The invoice
// is rasterized in an isolated iframe (see renderInvoiceCanvas) and paged onto
// A4. jsPDF and html2canvas are lazy-imported so they stay out of the main
// bundle. A watchdog rejects if rendering stalls, so the UI can never freeze.
export async function generateInvoicePdfBlob(
    inv: Partial<Invoice>,
    biz: Partial<InterfaceBE>,
    templateId: string,
): Promise<Blob> {
    const html = genInvoiceHTML(inv, biz, 'pdf', templateId);

    const canvas = await Promise.race([
        renderInvoiceCanvas(html),
        new Promise<never>((_, reject) =>
            window.setTimeout(() => reject(new Error('PDF rendering timed out.')), 20000),
        ),
    ]);

    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // Fit the rasterized invoice to the page width; slice it across pages by
    // shifting the (single, full-height) image up by one page per addPage.
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    const imgData = canvas.toDataURL('image/jpeg', 0.92);

    // Page count with a tolerance: px→pt scaling and trailing whitespace can
    // leave the image a few points over an exact page multiple, which would
    // otherwise ceil() into a spurious blank final page. TOLERANCE_PT of slack
    // absorbs that without clipping real content.
    const TOLERANCE_PT = 4;
    const pageCount = Math.max(1, Math.ceil((imgH - TOLERANCE_PT) / pageH));
    for (let page = 0; page < pageCount; page += 1) {
        if (page > 0) doc.addPage();
        doc.addImage(imgData, 'JPEG', 0, -page * pageH, imgW, imgH, undefined, 'FAST');
    }

    return doc.output('blob');
}

// Download the invoice as a PDF file. Uses the SAME renderer as the email
// attachment (generateInvoicePdfBlob), so the downloaded file is byte-for-byte
// the document the client receives by email — same template, same layout. This
// is a real file download (no browser print dialog).
export async function downloadInvoicePdf(
    inv: Partial<Invoice>,
    biz: Partial<InterfaceBE>,
    templateId: string,
): Promise<void> {
    const blob = await generateInvoicePdfBlob(inv, biz, templateId);
    const filename = invoicePdfFilename(inv, biz);
    const url = URL.createObjectURL(blob);
    try {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        a.remove();
    } finally {
        // Revoke after a tick so the download has a chance to start.
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
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
    // Terms & payment conditions, same fallback chain as the PDF footer:
    // invoice T&C -> business default -> app default.
    const terms = (inv.inv_tnc && inv.inv_tnc.trim())
        || (biz.be_inv_tnc && String(biz.be_inv_tnc).trim())
        || DEFAULT_INV_TNC;
    const body = [
        contact ? `Dear ${contact},` : 'Dear Client,',
        '',
        `Please find attached invoice ${number}${due ? `, due on ${due}` : ''}.`,
        'If you have any questions, feel free to reach out.',
        '',
        terms,
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
    // Emailing invoices is temporarily disabled — will be restored later.
    // Remove this guard (and re-enable the Email button in Invoice.tsx) to bring it back.
    throw new Error('Emailing invoices is temporarily disabled.');

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
