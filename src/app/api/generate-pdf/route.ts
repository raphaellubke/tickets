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
const C = {
    headerBg:  [15,  23,  42] as RGB,
    sectionBg: [30,  41,  59] as RGB,
    dark:      [15,  23,  42] as RGB,
    muted:     [107, 114, 128] as RGB,
    sep:       [226, 232, 240] as RGB,
    rowAlt:    [248, 250, 252] as RGB,
    white:     [255, 255, 255] as RGB,
    elaBg:     [253, 242, 248] as RGB,
    elaBd:     [240, 171, 252] as RGB,
    elaTxt:    [162,  28, 175] as RGB,
    eleBg:     [239, 246, 255] as RGB,
    eleBd:     [191, 219, 254] as RGB,
    eleTxt:    [ 29,  78, 216] as RGB,
    amber:     [180,  83,   9] as RGB,
};

// ── Helpers ────────────────────────────────────────────────────────────────
function parseCouple(raw: string): { ela: string; ele: string } | null {
    if (!raw.startsWith('{')) return null;
    try {
        const p = JSON.parse(raw);
        if (p && typeof p === 'object' && ('ela' in p || 'ele' in p))
            return { ela: String(p.ela ?? ''), ele: String(p.ele ?? '') };
    } catch { /* */ }
    return null;
}
function richness(v: string): number {
    const c = parseCouple(v);
    if (c) return (c.ela || c.ele) ? 3 : 1;
    return v.trim() ? 2 : 0;
}
function normalizeLabel(s: string): string {
    return s.replace(/\s*\((ela|ele|homem|mulher)\)\s*$/i, '').trim();
}

// ── Rendered field types ───────────────────────────────────────────────────
interface CoupleRow { kind: 'couple'; label: string; ela: string; ele: string }
interface SingleRow { kind: 'single'; label: string; value: string }
interface Section   { title: string; rows: Array<CoupleRow | SingleRow> }

// ── PDF Builder ────────────────────────────────────────────────────────────
function buildPDF(payload: PdfPayload): string {
    const { participantName, participantEmail, participantPhone,
            eventName, tickets, formDetails, orgLogoBase64 } = payload;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const PW  = 210;
    const M   = 13;       // left/right margin
    const CW  = PW - M*2; // 184mm

    // (column width constants unused after layout refactor)

    let y = 0;

    function guard(need: number) {
        if (y + need > 282) { doc.addPage(); y = 14; }
    }

    // ── Badge pill ──────────────────────────────────────────────────────────
    function badge(x: number, yy: number, who: 'ela' | 'ele') {
        const label  = who === 'ela' ? 'ELA' : 'ELE';
        const bg     = who === 'ela' ? C.elaBg  : C.eleBg;
        const bd     = who === 'ela' ? C.elaBd  : C.eleBd;
        const txt    = who === 'ela' ? C.elaTxt : C.eleTxt;
        doc.setFillColor(...bg);
        doc.setDrawColor(...bd);
        doc.setLineWidth(0.2);
        doc.roundedRect(x, yy, 13, 4.5, 1.2, 1.2, 'FD');
        doc.setTextColor(...txt);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.text(label, x + 6.5, yy + 3.2, { align: 'center' });
    }

    // ── Section header ──────────────────────────────────────────────────────
    function sectionHeader(title: string) {
        guard(8);
        doc.setFillColor(...C.sectionBg);
        doc.rect(M, y, CW, 7, 'F');
        doc.setTextColor(...C.white);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.text(title.toUpperCase(), M + 4, y + 4.8);
        y += 7;
    }

    // ── Couple fields: 2 per row, label + ELA/ELE stacked ──────────────────
    function couplePairGrid(rows: CoupleRow[]) {
        if (rows.length === 0) return;
        const COL_W = (CW - 4) / 2; // ~90mm per column
        const BADGE_W = 14;          // badge + gap before text
        const VAL_W   = COL_W - BADGE_W - 1;

        for (let i = 0; i < rows.length; i += 2) {
            const r1 = rows[i];
            const r2 = rows[i + 1] ?? null;

            doc.setFontSize(7);
            const elaL1 = doc.splitTextToSize(r1.ela || '—', VAL_W);
            const eleL1 = doc.splitTextToSize(r1.ele || '—', VAL_W);
            const elaL2 = r2 ? doc.splitTextToSize(r2.ela || '—', VAL_W) : [];
            const eleL2 = r2 ? doc.splitTextToSize(r2.ele || '—', VAL_W) : [];

            const lineH = 3.6;
            const h1 = 4 + elaL1.length * lineH + 1.5 + eleL1.length * lineH + 2;
            const h2 = r2 ? (4 + elaL2.length * lineH + 1.5 + eleL2.length * lineH + 2) : h1;
            const RH = Math.max(h1, h2, 16);
            guard(RH + 2);

            function renderCell(x: number, row: CoupleRow, elaLines: string[], eleLines: string[]) {
                // Label
                doc.setTextColor(...C.muted);
                doc.setFontSize(6);
                doc.setFont('helvetica', 'bold');
                doc.text(row.label.toUpperCase(), x, y + 3.5);

                let cy = y + 7.5;

                // ELA
                badge(x, cy - 3.5, 'ela');
                doc.setTextColor(...C.dark);
                doc.setFontSize(7);
                doc.setFont('helvetica', 'normal');
                doc.text(elaLines, x + BADGE_W, cy);
                cy += elaLines.length * lineH + 1.5;

                // ELE
                badge(x, cy - 3.5, 'ele');
                doc.text(eleLines, x + BADGE_W, cy);
            }

            renderCell(M, r1, elaL1, eleL1);
            if (r2) renderCell(M + COL_W + 4, r2, elaL2, eleL2);

            y += RH;
            doc.setDrawColor(...C.sep);
            doc.setLineWidth(0.15);
            doc.line(M, y, PW - M, y);
            y += 2.5;
        }
    }

    // ── Single fields: 2 per row grid ──────────────────────────────────────
    function singleGrid(singles: SingleRow[]) {
        if (singles.length === 0) return;
        const COL_W = (CW - 4) / 2;
        for (let i = 0; i < singles.length; i += 2) {
            const f1 = singles[i];
            const f2 = singles[i + 1] ?? null;
            const l1 = doc.splitTextToSize(f1.value || '—', COL_W - 2);
            const l2 = f2 ? doc.splitTextToSize(f2.value || '—', COL_W - 2) : [];
            const RH = 3.5 + Math.max(l1.length, l2.length || 0) * 3.8 + 2.5;
            guard(RH + 3);

            const x1 = M;
            const x2 = M + COL_W + 4;

            // Field 1
            doc.setTextColor(...C.muted);
            doc.setFontSize(6);
            doc.setFont('helvetica', 'bold');
            doc.text(f1.label.toUpperCase(), x1, y);
            doc.setTextColor(...C.dark);
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'normal');
            doc.text(l1, x1, y + 3.5);

            // Field 2
            if (f2) {
                doc.setTextColor(...C.muted);
                doc.setFontSize(6);
                doc.setFont('helvetica', 'bold');
                doc.text(f2.label.toUpperCase(), x2, y);
                doc.setTextColor(...C.dark);
                doc.setFontSize(7.5);
                doc.setFont('helvetica', 'normal');
                doc.text(l2, x2, y + 3.5);
            }

            y += RH;
            doc.setDrawColor(...C.sep);
            doc.setLineWidth(0.15);
            doc.line(M, y, PW - M, y);
            y += 2.5;
        }
    }

    // ── Render a section's rows grouped by consecutive type ─────────────────
    function renderSection(section: Section) {
        if (section.rows.length === 0) return;
        if (section.title) sectionHeader(section.title);
        y += 3;

        // Group consecutive rows of same kind
        type Run = { kind: 'couple'; rows: CoupleRow[] } | { kind: 'single'; rows: SingleRow[] };
        const runs: Run[] = [];
        for (const row of section.rows) {
            const last = runs[runs.length - 1];
            if (!last || last.kind !== row.kind) {
                runs.push({ kind: row.kind, rows: [row] } as Run);
            } else {
                (last.rows as any[]).push(row);
            }
        }

        for (const run of runs) {
            if (run.kind === 'couple') {
                couplePairGrid(run.rows as CoupleRow[]);
            } else {
                singleGrid(run.rows as SingleRow[]);
            }
        }
        y += 1;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PAGE HEADER
    // ═══════════════════════════════════════════════════════════════════════
    doc.setFillColor(...C.headerBg);
    doc.rect(0, 0, PW, 28, 'F');
    if (orgLogoBase64) {
        try { doc.addImage(orgLogoBase64, 'PNG', PW - M - 22, 4, 20, 20, undefined, 'FAST'); }
        catch { /* skip */ }
    }
    doc.setTextColor(...C.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(eventName || 'Evento', M, 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text(participantName || '', M, 22);
    y = 36;

    // Contact row
    doc.setTextColor(...C.muted);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('E-MAIL', M, y);
    doc.text('TELEFONE', M + 100, y);
    y += 4.5;
    doc.setTextColor(...C.dark);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    const em = (participantEmail || '—').length > 42 ? participantEmail.substring(0, 41) + '…' : (participantEmail || '—');
    doc.text(em, M, y);
    doc.text(participantPhone || '—', M + 100, y);
    y += 7;
    doc.setDrawColor(...C.sep);
    doc.setLineWidth(0.3);
    doc.line(M, y, PW - M, y);
    y += 6;

    // ═══════════════════════════════════════════════════════════════════════
    // FORM ANSWERS
    // ═══════════════════════════════════════════════════════════════════════
    for (const ticket of tickets || []) {
        const detail = formDetails[ticket.id];
        if (!detail) continue;

        if (detail.status === 'pending') {
            guard(10);
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(...C.amber);
            doc.text('Formulário ainda não preenchido', M, y);
            y += 8;
            continue;
        }
        if (!detail.answers?.length) continue;

        // Sort
        const sorted = [...detail.answers].sort(
            (a, b) => (a.form_fields?.order_index ?? 0) - (b.form_fields?.order_index ?? 0)
        );

        // Deduplicate by normalised label
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

        // Build sections
        const sections: Section[] = [];
        let curSection: Section = { title: '', rows: [] };

        for (const ans of deduped.values()) {
            const field  = ans.form_fields;
            if (!field?.label) continue;
            const label  = field.label;
            const type   = field.type || 'text';
            const rawVal = (ans.value || '').trim();

            if (type === 'section_header') {
                if (curSection.rows.length > 0 || curSection.title) sections.push(curSection);
                curSection = { title: label, rows: [] };
                continue;
            }

            const couple = parseCouple(rawVal);
            if (couple) {
                if (!couple.ela && !couple.ele) continue; // both empty — skip
                const forceSingle = field.is_couple_field === false;
                if (forceSingle) {
                    const display = couple.ela === couple.ele
                        ? (couple.ela || couple.ele)
                        : (couple.ela && couple.ele ? `Ela: ${couple.ela}  /  Ele: ${couple.ele}` : couple.ela || couple.ele);
                    if (display) curSection.rows.push({ kind: 'single', label, value: display });
                } else {
                    curSection.rows.push({ kind: 'couple', label, ela: couple.ela, ele: couple.ele });
                }
            } else {
                if (!rawVal) continue;
                curSection.rows.push({ kind: 'single', label, value: rawVal });
            }
        }
        if (curSection.rows.length > 0 || curSection.title) sections.push(curSection);

        // Render all sections
        for (const section of sections) renderSection(section);
    }

    // Footer
    const FY = 289;
    doc.setDrawColor(...C.sep);
    doc.setLineWidth(0.25);
    doc.line(M, FY - 3, PW - M, FY - 3);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.muted);
    doc.text(
        `Gerado em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`,
        PW / 2, FY, { align: 'center' }
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
