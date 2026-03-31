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

// ── Color palette ──────────────────────────────────────────────────────────
const C = {
    dark:     [17,  24,  39]  as [number,number,number],
    gray500:  [107, 114, 128] as [number,number,number],
    gray200:  [229, 231, 235] as [number,number,number],
    gray100:  [243, 244, 246] as [number,number,number],
    white:    [255, 255, 255] as [number,number,number],
    elaText:  [162,  28, 175] as [number,number,number], // fuchsia-700
    elaBg:    [253, 242, 248] as [number,number,number], // fuchsia-50
    elaBorder:[240, 171, 252] as [number,number,number], // fuchsia-300
    eleText:  [ 29,  78, 216] as [number,number,number], // blue-700
    eleBg:    [239, 246, 255] as [number,number,number], // blue-50
    eleBorder:[191, 219, 254] as [number,number,number], // blue-200
    sectionBg:[30,  41,  59]  as [number,number,number], // slate-800
    amber:    [180, 83,   9]  as [number,number,number],
};

function buildPDF(payload: PdfPayload): string {
    const { participantName, participantEmail, participantPhone,
            eventName, tickets, formDetails, orgLogoBase64 } = payload;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const PW = 210;
    const M  = 14;   // left/right margin
    const CW = PW - M * 2;   // 182mm content width

    // ── Header ──────────────────────────────────────────────────────────────
    doc.setFillColor(...C.dark);
    doc.rect(0, 0, PW, 28, 'F');

    if (orgLogoBase64) {
        try { doc.addImage(orgLogoBase64, 'PNG', PW - M - 22, 4, 20, 20, undefined, 'FAST'); }
        catch { /* skip */ }
    }

    doc.setTextColor(...C.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(eventName || 'Evento', M, 13);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(participantName || 'Participante', M, 22);

    let y = 38;

    // ── Contact row ─────────────────────────────────────────────────────────
    doc.setTextColor(...C.gray500);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text('E-MAIL', M, y);
    doc.text('TELEFONE', M + 95, y);
    y += 5;
    doc.setTextColor(...C.dark);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const emailTxt = (participantEmail || '-').length > 38
        ? (participantEmail || '-').substring(0, 37) + '…'
        : (participantEmail || '-');
    doc.text(emailTxt, M, y);
    doc.text(participantPhone || '-', M + 95, y);
    y += 8;
    doc.setDrawColor(...C.gray200);
    doc.line(M, y, PW - M, y);
    y += 7;

    // ── Form answers ────────────────────────────────────────────────────────
    const COL_GAP   = 4;
    const COL_W     = (CW - COL_GAP) / 2;   // ~89mm each column
    const LABEL_H   = 4.5;
    const LINE_H    = 5;
    const ROW_PAD   = 5;

    function checkPage(needed: number) {
        if (y + needed > 282) { doc.addPage(); y = 16; }
    }

    function drawSectionHeader(title: string) {
        checkPage(10);
        doc.setFillColor(...C.sectionBg);
        doc.rect(M, y, CW, 8, 'F');
        doc.setTextColor(...C.white);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(title.toUpperCase(), M + 4, y + 5.5);
        y += 11;
    }

    function drawPersonBadge(x: number, yy: number, person: 'ela' | 'ele') {
        const label  = person === 'ela' ? 'ELA' : 'ELE';
        const bg     = person === 'ela' ? C.elaBg    : C.eleBg;
        const border = person === 'ela' ? C.elaBorder: C.eleBorder;
        const text   = person === 'ela' ? C.elaText  : C.eleText;
        doc.setFillColor(...bg);
        doc.setDrawColor(...border);
        doc.roundedRect(x, yy - 3.5, 14, 5, 1.5, 1.5, 'FD');
        doc.setTextColor(...text);
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        doc.text(label, x + 7, yy + 0.2, { align: 'center' });
    }

    function drawSingleField(label: string, value: string) {
        const valLines = doc.splitTextToSize(value || '-', CW - 2);
        const rowH = LABEL_H + valLines.length * LINE_H + ROW_PAD;
        checkPage(rowH);

        doc.setTextColor(...C.gray500);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.text(label.toUpperCase(), M, y);

        doc.setTextColor(...C.dark);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(valLines, M, y + LABEL_H + 1);

        y += rowH;
        doc.setDrawColor(...C.gray200);
        doc.line(M, y - ROW_PAD + 1, PW - M, y - ROW_PAD + 1);
    }

    function drawCoupleField(label: string, elaVal: string, eleVal: string) {
        const elaLines = doc.splitTextToSize(elaVal || '-', COL_W - 4);
        const eleLines = doc.splitTextToSize(eleVal || '-', COL_W - 4);
        const maxLines = Math.max(elaLines.length, eleLines.length);
        const rowH = 6 + LABEL_H + maxLines * LINE_H + ROW_PAD;
        checkPage(rowH);

        // Field label spanning full width
        doc.setTextColor(...C.gray500);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.text(label.toUpperCase(), M, y);
        y += LABEL_H + 1;

        const xEla = M;
        const xEle = M + COL_W + COL_GAP;

        // ELA column
        drawPersonBadge(xEla, y, 'ela');
        doc.setTextColor(...C.dark);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(elaLines, xEla, y + 3);

        // ELE column
        drawPersonBadge(xEle, y, 'ele');
        doc.text(eleLines, xEle, y + 3);

        y += maxLines * LINE_H + 5;
        doc.setDrawColor(...C.gray200);
        doc.line(M, y, PW - M, y);
        y += ROW_PAD - 2;
    }

    for (const ticket of tickets || []) {
        const detail = formDetails[ticket.id];
        if (!detail) continue;

        if (detail.status === 'pending') {
            checkPage(10);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(...C.amber);
            doc.text('Formulário ainda não preenchido', M, y);
            y += 8;
            continue;
        }

        if (!detail.answers?.length) continue;

        // Sort by order_index
        const sorted = [...detail.answers].sort(
            (a, b) => (a.form_fields?.order_index ?? 0) - (b.form_fields?.order_index ?? 0)
        );

        // ── Helpers ───────────────────────────────────────────────────────

        // Parse a raw value: returns { elaVal, eleVal, isJson }
        function parseVal(raw: string) {
            if (raw.startsWith('{')) {
                try {
                    const p = JSON.parse(raw);
                    if (p && typeof p === 'object' && ('ela' in p || 'ele' in p)) {
                        return { elaVal: String(p.ela ?? ''), eleVal: String(p.ele ?? ''), isJson: true };
                    }
                } catch { /* */ }
            }
            return { elaVal: '', eleVal: '', isJson: false };
        }

        // Richness score: non-empty JSON with values > plain text > empty JSON > empty
        function richness(v: string): number {
            if (!v) return 0;
            const { elaVal, eleVal, isJson } = parseVal(v);
            if (isJson) return (elaVal || eleVal) ? 3 : 1; // JSON with values > empty JSON
            return v.trim() ? 2 : 0;
        }

        // Normalize legacy label suffixes: (Ela), (Ele), (Homem), (Mulher)
        function normLabel(label: string) {
            return label.replace(/\s*\((ela|ele|homem|mulher)\)\s*$/i, '').trim();
        }

        // ── Deduplicate by normalised label ──────────────────────────────
        const deduped = new Map<string, FormAnswer>();
        for (const ans of sorted) {
            const label = ans.form_fields?.label;
            if (!label) continue;
            const key = normLabel(label);
            const existing = deduped.get(key);
            if (!existing || richness(ans.value || '') > richness(existing.value || '')) {
                deduped.set(key, {
                    ...ans,
                    form_fields: ans.form_fields ? { ...ans.form_fields, label: key } : ans.form_fields,
                });
            }
        }

        // ── Render ────────────────────────────────────────────────────────
        for (const ans of deduped.values()) {
            const field = ans.form_fields;
            if (!field?.label) continue;

            const label  = field.label;
            const type   = field.type || 'text';
            const rawVal = (ans.value || '').trim();

            // Section header
            if (type === 'section_header') {
                if (y > 16) y += 2;
                drawSectionHeader(label);
                continue;
            }

            // Parse JSON couple values
            const { elaVal, eleVal, isJson } = parseVal(rawVal);

            // Determine rendering mode
            // is_couple_field: true → ELA|ELE columns
            //                  false → single field
            //                  null/undefined → detect by JSON content
            const forceCouple = field.is_couple_field === true;
            const forceSingle = field.is_couple_field === false;

            let renderAsCouple = false;
            let displayVal = rawVal;

            if (isJson) {
                const bothEmpty = !elaVal && !eleVal;
                if (bothEmpty) {
                    // Truly empty — skip this field entirely
                    continue;
                }
                if (forceSingle) {
                    // Single field that stored couple JSON — show smartly
                    if (elaVal === eleVal) {
                        // Same value → show once
                        displayVal = elaVal || eleVal;
                    } else if (elaVal && eleVal) {
                        // Different → show "Ela: X  /  Ele: Y"
                        displayVal = `Ela: ${elaVal}  /  Ele: ${eleVal}`;
                    } else {
                        displayVal = elaVal || eleVal;
                    }
                } else if (forceCouple || (!forceSingle)) {
                    renderAsCouple = true;
                }
            } else {
                // Plain text value
                if (!rawVal) continue; // skip empty
            }

            if (renderAsCouple) {
                drawCoupleField(label, elaVal, eleVal);
            } else {
                drawSingleField(label, displayVal || '-');
            }
        }
    }

    // ── Footer ──────────────────────────────────────────────────────────────
    doc.setDrawColor(...C.gray200);
    doc.line(M, 285, PW - M, 285);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.gray500);
    doc.text(
        `Gerado via sistema de Ingressos — ${new Date().toLocaleDateString('pt-BR')}`,
        PW / 2, 290, { align: 'center' }
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
