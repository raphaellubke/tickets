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
    field_label?: string | null;
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
    const M   = 9;         // tight margins to gain width
    const CW  = PW - M*2; // 192mm
    const COLS = 3;        // 3 fields per row
    const GAP  = 3;        // gap between columns
    const COL_W = (CW - GAP * (COLS - 1)) / COLS; // ~62mm

    const BADGE_W  = 11;   // badge pill width
    const BADGE_H  = 3.5;  // badge pill height
    const BADGE_GAP = 12.5; // badge width + small gap to text start
    const VAL_W    = COL_W - BADGE_GAP - 1; // text width after badge
    const LINE_H   = 3.2;  // line height for values

    let y = 0;

    function guard(need: number) {
        if (y + need > 284) { doc.addPage(); y = 12; }
    }

    function colX(col: number): number { return M + col * (COL_W + GAP); }

    // ── Badge pill ──────────────────────────────────────────────────────────
    function badge(x: number, yy: number, who: 'ela' | 'ele') {
        const lbl = who === 'ela' ? 'ELA' : 'ELE';
        const bg  = who === 'ela' ? C.elaBg  : C.eleBg;
        const bd  = who === 'ela' ? C.elaBd  : C.eleBd;
        const txt = who === 'ela' ? C.elaTxt : C.eleTxt;
        doc.setFillColor(...bg); doc.setDrawColor(...bd); doc.setLineWidth(0.15);
        doc.roundedRect(x, yy, BADGE_W, BADGE_H, 0.8, 0.8, 'FD');
        doc.setTextColor(...txt); doc.setFontSize(5); doc.setFont('helvetica', 'bold');
        doc.text(lbl, x + BADGE_W / 2, yy + 2.5, { align: 'center' });
    }

    // ── Section header ──────────────────────────────────────────────────────
    function sectionHeader(title: string) {
        guard(7);
        doc.setFillColor(...C.sectionBg);
        doc.rect(M, y, CW, 5.5, 'F');
        doc.setTextColor(...C.white);
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        doc.text(title.toUpperCase(), M + 3, y + 3.8);
        y += 5.5;
    }

    // ── Couple fields: 3 per row, label + ELA/ELE stacked ──────────────────
    function couplePairGrid(rows: CoupleRow[]) {
        if (rows.length === 0) return;

        for (let i = 0; i < rows.length; i += COLS) {
            const batch = rows.slice(i, i + COLS);

            // Pre-compute lines for each cell
            doc.setFontSize(6.5);
            const cells = batch.map(r => ({
                row: r,
                elaL: doc.splitTextToSize(r.ela || '—', VAL_W),
                eleL: doc.splitTextToSize(r.ele || '—', VAL_W),
            }));

            const RH = Math.max(...cells.map(c =>
                3.5 + c.elaL.length * LINE_H + 1 + c.eleL.length * LINE_H + 2
            ), 14);
            guard(RH + 2);

            cells.forEach((cell, col) => {
                const x = colX(col);
                // Label
                doc.setTextColor(...C.muted);
                doc.setFontSize(5.5);
                doc.setFont('helvetica', 'bold');
                doc.text(cell.row.label.toUpperCase(), x, y + 3.2);
                let cy = y + 7;
                // ELA
                badge(x, cy - BADGE_H + 0.2, 'ela');
                doc.setTextColor(...C.dark);
                doc.setFontSize(6.5);
                doc.setFont('helvetica', 'normal');
                doc.text(cell.elaL, x + BADGE_GAP, cy);
                cy += cell.elaL.length * LINE_H + 1;
                // ELE
                badge(x, cy - BADGE_H + 0.2, 'ele');
                doc.text(cell.eleL, x + BADGE_GAP, cy);
            });

            y += RH;
            doc.setDrawColor(...C.sep); doc.setLineWidth(0.12);
            doc.line(M, y, PW - M, y);
            y += 2;
        }
    }

    // ── Single fields: 3 per row grid ──────────────────────────────────────
    function singleGrid(singles: SingleRow[]) {
        if (singles.length === 0) return;

        for (let i = 0; i < singles.length; i += COLS) {
            const batch = singles.slice(i, i + COLS);

            doc.setFontSize(6.5);
            const cells = batch.map(f => ({
                f,
                lines: doc.splitTextToSize(f.value || '—', COL_W - 1),
            }));

            const RH = 3 + Math.max(...cells.map(c => c.lines.length)) * LINE_H + 2;
            guard(RH + 2);

            cells.forEach((cell, col) => {
                const x = colX(col);
                doc.setTextColor(...C.muted);
                doc.setFontSize(5.5);
                doc.setFont('helvetica', 'bold');
                doc.text(cell.f.label.toUpperCase(), x, y);
                doc.setTextColor(...C.dark);
                doc.setFontSize(6.5);
                doc.setFont('helvetica', 'normal');
                doc.text(cell.lines, x, y + 3);
            });

            y += RH;
            doc.setDrawColor(...C.sep); doc.setLineWidth(0.12);
            doc.line(M, y, PW - M, y);
            y += 2;
        }
    }

    // ── Render a section's rows grouped by consecutive type ─────────────────
    function renderSection(section: Section) {
        if (section.rows.length === 0) return;
        if (section.title) sectionHeader(section.title);
        y += 2.5;

        type Run = { kind: 'couple'; rows: CoupleRow[] } | { kind: 'single'; rows: SingleRow[] };
        const runs: Run[] = [];
        for (const row of section.rows) {
            const last = runs[runs.length - 1];
            if (!last || last.kind !== row.kind) {
                runs.push({ kind: row.kind, rows: [row] } as Run);
            } else { (last.rows as any[]).push(row); }
        }
        for (const run of runs) {
            if (run.kind === 'couple') couplePairGrid(run.rows as CoupleRow[]);
            else singleGrid(run.rows as SingleRow[]);
        }
        y += 1;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PAGE HEADER — compact 22mm
    // ═══════════════════════════════════════════════════════════════════════
    doc.setFillColor(...C.headerBg);
    doc.rect(0, 0, PW, 22, 'F');
    if (orgLogoBase64) {
        try { doc.addImage(orgLogoBase64, 'PNG', PW - M - 18, 2, 16, 16, undefined, 'FAST'); }
        catch { /* skip */ }
    }
    doc.setTextColor(...C.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(eventName || 'Evento', M, 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text(participantName || '', M, 18);
    y = 29;

    // Compact contact row: email | telefone | order number in one line
    const em = (participantEmail || '—').length > 38 ? participantEmail.substring(0, 37) + '…' : (participantEmail || '—');
    doc.setTextColor(...C.muted); doc.setFontSize(5.5); doc.setFont('helvetica', 'bold');
    doc.text('E-MAIL', M, y);
    doc.text('TELEFONE', M + 110, y);
    y += 3.5;
    doc.setTextColor(...C.dark); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text(em, M, y);
    doc.text(participantPhone || '—', M + 110, y);
    y += 5;
    doc.setDrawColor(...C.sep); doc.setLineWidth(0.25);
    doc.line(M, y, PW - M, y);
    y += 4;

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
            const raw = ans.form_fields?.label || ans.field_label;
            if (!raw) continue;
            const key = normalizeLabel(raw);
            const existing = deduped.get(key);
            if (!existing || richness(ans.value || '') > richness(existing.value || '')) {
                // Ensure form_fields always has a label (synthesize from field_label if needed)
                const syntheticFields: FormFieldMeta = ans.form_fields
                    ? { ...ans.form_fields, label: key }
                    : { label: key, type: 'text' };
                deduped.set(key, { ...ans, form_fields: syntheticFields });
            }
        }

        // Build sections
        const sections: Section[] = [];
        let curSection: Section = { title: '', rows: [] };

        for (const ans of deduped.values()) {
            const field  = ans.form_fields;
            const label  = field?.label || ans.field_label;
            if (!label) continue;
            const type   = field?.type || 'text';
            const rawVal = (ans.value || '').trim();

            if (type === 'section_header') {
                if (curSection.rows.length > 0 || curSection.title) sections.push(curSection);
                curSection = { title: label, rows: [] };
                continue;
            }

            const couple = parseCouple(rawVal);
            if (couple) {
                if (!couple.ela && !couple.ele) continue; // both empty — skip
                const forceSingle = field?.is_couple_field === false;
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
