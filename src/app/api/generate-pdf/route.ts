import { NextRequest, NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';

function sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim().replace(/\s+/g, '_') || 'participante';
}

interface FormFieldMeta {
    label: string;
    type?: string;
    order_index?: number;
    is_couple_field?: boolean | null;
}

interface FormAnswer {
    value: string | null;
    form_fields?: FormFieldMeta | null;
}

interface PdfPayload {
    participantName: string;
    participantEmail: string;
    participantPhone: string;
    orderNumber: string;
    paymentMethod: string;
    totalAmount: number;
    paidAt: string | null;
    eventName: string;
    tickets: Array<{ id: string; ticket_code?: string; event_ticket_types?: { name: string } | null }>;
    formDetails: Record<string, { status: string; answers?: FormAnswer[] }>;
    orgLogoBase64?: string | null;
}

type RGB = [number, number, number];

// ── Design tokens ──────────────────────────────────────────────────────────
const T = {
    // Colors
    headerBg:   [15,  23,  42] as RGB,   // slate-900
    sectionBg:  [30,  41,  59] as RGB,   // slate-800
    dark:       [15,  23,  42] as RGB,   // text primary
    muted:      [100, 116, 139] as RGB,  // slate-500
    separator:  [226, 232, 240] as RGB,  // slate-200
    white:      [255, 255, 255] as RGB,
    elaBg:      [253, 242, 248] as RGB,  // fuchsia-50
    elaBorder:  [240, 171, 252] as RGB,  // fuchsia-300
    elaText:    [162,  28, 175] as RGB,  // fuchsia-700
    eleBg:      [239, 246, 255] as RGB,  // blue-50
    eleBorder:  [191, 219, 254] as RGB,  // blue-200
    eleText:    [ 29,  78, 216] as RGB,  // blue-700
    amber:      [180,  83,   9] as RGB,

    // Typography (pt)
    headingSize:  18,
    subheadSize:  11,
    metaLabelSz:   7.5,
    metaValueSz:   11,
    sectionLabelSz: 8,
    fieldLabelSz:   7,
    fieldValueSz:  9.5,
    badgeSz:        6.5,

    // Spacing (mm) — compact to fit on fewer pages
    marginX:    14,
    marginTop:  14,
    sectionH:    7.5, // section header bar height
    fieldLabelH: 3.5, // height of field label line
    badgeH:      4.5, // badge pill height
    badgeValGap: 3.5, // gap between bottom of badge and start of value
    lineH:       4.2, // text line height
    fieldGap:    5,   // vertical gap after separator
    sectionGap:  3,   // space after section header before first field
};

// ── Helpers ────────────────────────────────────────────────────────────────
function parseCouple(raw: string): { ela: string; ele: string } | null {
    if (!raw.startsWith('{')) return null;
    try {
        const p = JSON.parse(raw);
        if (p && typeof p === 'object' && ('ela' in p || 'ele' in p)) {
            return { ela: String(p.ela ?? ''), ele: String(p.ele ?? '') };
        }
    } catch { /* */ }
    return null;
}

function richness(v: string): number {
    const c = parseCouple(v);
    if (c) return (c.ela || c.ele) ? 3 : 1;
    return v.trim() ? 2 : 0;
}

function normalizeLabel(label: string): string {
    return label.replace(/\s*\((ela|ele|homem|mulher)\)\s*$/i, '').trim();
}

// ── PDF Builder ────────────────────────────────────────────────────────────
function buildPDF(payload: PdfPayload): string {
    const { participantName, participantEmail, participantPhone,
            eventName, tickets, formDetails, orgLogoBase64 } = payload;

    const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const PW   = 210;
    const M    = T.marginX;
    const CW   = PW - M * 2;           // 182 mm
    const COL  = (CW - 5) / 2;         // ~88.5 mm per couple column
    const CGAP = 5;

    let y = 0;

    // ── Page guard ──────────────────────────────────────────────────────────
    function ensureSpace(needed: number) {
        if (y + needed > 282) { doc.addPage(); y = T.marginTop; }
    }

    // ── Badge pill ──────────────────────────────────────────────────────────
    function badge(x: number, yy: number, who: 'ela' | 'ele') {
        const lbl    = who === 'ela' ? 'ELA' : 'ELE';
        const bg     = who === 'ela' ? T.elaBg    : T.eleBg;
        const border = who === 'ela' ? T.elaBorder: T.eleBorder;
        const color  = who === 'ela' ? T.elaText  : T.eleText;
        const w = 14, h = T.badgeH;
        doc.setFillColor(...bg);
        doc.setDrawColor(...border);
        doc.setLineWidth(0.25);
        doc.roundedRect(x, yy, w, h, 1.5, 1.5, 'FD');
        doc.setTextColor(...color);
        doc.setFontSize(T.badgeSz);
        doc.setFont('helvetica', 'bold');
        doc.text(lbl, x + w / 2, yy + 3.5, { align: 'center' });
    }

    // ── Section header ──────────────────────────────────────────────────────
    function sectionHeader(title: string) {
        ensureSpace(T.sectionH + T.sectionGap + 14);
        doc.setFillColor(...T.sectionBg);
        doc.rect(M, y, CW, T.sectionH, 'F');
        doc.setTextColor(...T.white);
        doc.setFontSize(T.sectionLabelSz);
        doc.setFont('helvetica', 'bold');
        doc.text(title.toUpperCase(), M + 5, y + 6);
        y += T.sectionH + T.sectionGap;
    }

    // ── Single field ────────────────────────────────────────────────────────
    function singleField(label: string, value: string) {
        const lines = doc.splitTextToSize(value, CW);
        const needed = T.fieldLabelH + 1 + lines.length * T.lineH + T.fieldGap;
        ensureSpace(needed);

        // Label
        doc.setTextColor(...T.muted);
        doc.setFontSize(T.fieldLabelSz);
        doc.setFont('helvetica', 'bold');
        doc.text(label.toUpperCase(), M, y);
        y += T.fieldLabelH + 1;

        // Value
        doc.setTextColor(...T.dark);
        doc.setFontSize(T.fieldValueSz);
        doc.setFont('helvetica', 'normal');
        doc.text(lines, M, y);
        y += lines.length * T.lineH + 2;

        // Separator
        doc.setDrawColor(...T.separator);
        doc.setLineWidth(0.2);
        doc.line(M, y, PW - M, y);
        y += T.fieldGap - 2;
    }

    // ── Couple field ────────────────────────────────────────────────────────
    function coupleField(label: string, elaVal: string, eleVal: string) {
        const elaLines = doc.splitTextToSize(elaVal || '—', COL - 2);
        const eleLines = doc.splitTextToSize(eleVal || '—', COL - 2);
        const maxLines = Math.max(elaLines.length, eleLines.length);
        // box height: top pad(1.5) + badge(badgeH) + badge-val gap + value lines + bottom pad(2)
        const PAD_TOP = 1.5;
        const PAD_BOT = 2.5;
        const boxH = PAD_TOP + T.badgeH + T.badgeValGap + maxLines * T.lineH + PAD_BOT;
        const needed = T.fieldLabelH + 1 + boxH + T.fieldGap;
        ensureSpace(needed);

        // Field label (full width)
        doc.setTextColor(...T.muted);
        doc.setFontSize(T.fieldLabelSz);
        doc.setFont('helvetica', 'bold');
        doc.text(label.toUpperCase(), M, y);
        y += T.fieldLabelH + 1;

        const xEla = M;
        const xEle = M + COL + CGAP;

        // Column backgrounds
        doc.setFillColor(...T.elaBg);
        doc.setDrawColor(...T.elaBorder);
        doc.setLineWidth(0.15);
        doc.roundedRect(xEla, y, COL, boxH, 2, 2, 'FD');

        doc.setFillColor(...T.eleBg);
        doc.setDrawColor(...T.eleBorder);
        doc.roundedRect(xEle, y, COL, boxH, 2, 2, 'FD');

        // Badges (top-left inside each box)
        badge(xEla + 3, y + PAD_TOP, 'ela');
        badge(xEle + 3, y + PAD_TOP, 'ele');

        // Values — placed after badge + gap
        const valY = y + PAD_TOP + T.badgeH + T.badgeValGap;
        doc.setTextColor(...T.dark);
        doc.setFontSize(T.fieldValueSz);
        doc.setFont('helvetica', 'normal');
        doc.text(elaLines, xEla + 4, valY);
        doc.text(eleLines, xEle + 4, valY);
        y += boxH + 2;

        // Separator
        doc.setDrawColor(...T.separator);
        doc.setLineWidth(0.2);
        doc.line(M, y, PW - M, y);
        y += T.fieldGap - 2;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // HEADER
    // ═══════════════════════════════════════════════════════════════════════
    doc.setFillColor(...T.headerBg);
    doc.rect(0, 0, PW, 30, 'F');

    if (orgLogoBase64) {
        try { doc.addImage(orgLogoBase64, 'PNG', PW - M - 22, 4, 20, 20, undefined, 'FAST'); }
        catch { /* skip bad logo */ }
    }

    doc.setTextColor(...T.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(T.headingSize);
    doc.text(eventName || 'Evento', M, 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(T.subheadSize);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(participantName || 'Participante', M, 23);

    y = 40;

    // ── Contact row ─────────────────────────────────────────────────────────
    // Labels
    doc.setTextColor(...T.muted);
    doc.setFontSize(T.metaLabelSz);
    doc.setFont('helvetica', 'bold');
    doc.text('E-MAIL', M, y);
    doc.text('TELEFONE', M + 100, y);
    y += 5;

    // Values
    doc.setTextColor(...T.dark);
    doc.setFontSize(T.metaValueSz);
    doc.setFont('helvetica', 'bold');
    const emailDisplay = (participantEmail || '—').length > 40
        ? (participantEmail || '—').substring(0, 39) + '…'
        : (participantEmail || '—');
    doc.text(emailDisplay, M, y);
    doc.text(participantPhone || '—', M + 100, y);
    y += 9;

    // Separator
    doc.setDrawColor(...T.separator);
    doc.setLineWidth(0.4);
    doc.line(M, y, PW - M, y);
    y += 8;

    // ═══════════════════════════════════════════════════════════════════════
    // FORM ANSWERS
    // ═══════════════════════════════════════════════════════════════════════
    for (const ticket of tickets || []) {
        const detail = formDetails[ticket.id];
        if (!detail) continue;

        if (detail.status === 'pending') {
            ensureSpace(12);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(...T.amber);
            doc.text('Formulário ainda não preenchido', M, y);
            y += 10;
            continue;
        }

        if (!detail.answers?.length) continue;

        // Sort
        const sorted = [...detail.answers].sort(
            (a, b) => (a.form_fields?.order_index ?? 0) - (b.form_fields?.order_index ?? 0)
        );

        // Deduplicate by normalised label, keep richest value
        const deduped = new Map<string, FormAnswer>();
        for (const ans of sorted) {
            const raw = ans.form_fields?.label;
            if (!raw) continue;
            const key = normalizeLabel(raw);
            const existing = deduped.get(key);
            if (!existing || richness(ans.value || '') > richness(existing.value || '')) {
                deduped.set(key, {
                    ...ans,
                    form_fields: ans.form_fields ? { ...ans.form_fields, label: key } : ans.form_fields,
                });
            }
        }

        for (const ans of deduped.values()) {
            const field = ans.form_fields;
            if (!field?.label) continue;

            const label  = field.label;
            const type   = field.type || 'text';
            const rawVal = (ans.value || '').trim();

            // Section header
            if (type === 'section_header') {
                if (y > T.marginTop + 10) y += 2;
                sectionHeader(label);
                continue;
            }

            // Parse couple JSON
            const couple = parseCouple(rawVal);

            if (couple) {
                const bothEmpty = !couple.ela && !couple.ele;
                if (bothEmpty) continue; // skip truly empty fields

                const forceSingle = field.is_couple_field === false;

                if (forceSingle) {
                    // Shared couple field — show smartest single value
                    let display: string;
                    if (couple.ela === couple.ele) {
                        display = couple.ela || couple.ele;
                    } else if (couple.ela && couple.ele) {
                        display = `Ela: ${couple.ela}  /  Ele: ${couple.ele}`;
                    } else {
                        display = couple.ela || couple.ele;
                    }
                    if (display) singleField(label, display);
                } else {
                    coupleField(label, couple.ela, couple.ele);
                }
            } else {
                // Plain text
                if (!rawVal) continue;
                singleField(label, rawVal);
            }
        }
    }

    // ── Footer ──────────────────────────────────────────────────────────────
    const footerY = 289;
    doc.setDrawColor(...T.separator);
    doc.setLineWidth(0.3);
    doc.line(M, footerY - 4, PW - M, footerY - 4);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...T.muted);
    doc.text(
        `Gerado em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`,
        PW / 2, footerY, { align: 'center' }
    );

    return doc.output('datauristring');
}

export async function POST(request: NextRequest) {
    try {
        const payload = (await request.json()) as PdfPayload;
        const dataUri = buildPDF(payload);
        const filename = sanitizeFilename(payload.participantName) + '.pdf';
        return NextResponse.json({ pdf: dataUri, filename });
    } catch (err) {
        console.error('[generate-pdf]', err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : String(err) },
            { status: 500 },
        );
    }
}
