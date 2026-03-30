import { NextRequest, NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';

function sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim().replace(/\s+/g, '_') || 'participante';
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
    formDetails: Record<string, { status: string; answers?: Array<{ value: string | null; form_fields?: { label: string } | null }> }>;
    orgLogoBase64?: string | null;
}

function buildPDF(payload: PdfPayload): string {
    const { 
        participantName, participantEmail, participantPhone, orderNumber, 
        paymentMethod, totalAmount, eventName, tickets, formDetails, orgLogoBase64 
    } = payload;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const M = 20;
    const PW = 210;
    const CW = PW - M * 2; // 170
    
    // ── Header (Dark Gray) ────────────────────────────────────────────────────────
    doc.setFillColor(17, 24, 39); // gray-900
    doc.rect(0, 0, PW, 30, 'F'); // Reduced height from 45 to 30

    if (orgLogoBase64) {
        try { 
            // Optional logo on top right 
            doc.addImage(orgLogoBase64, 'PNG', PW - M - 20, 5, 20, 20, undefined, 'FAST'); 
        } catch { /* skip bad logo */ }
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(eventName || 'Evento', M, 14);

    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    // Align participant name below event name
    doc.text(participantName || 'Participante', M, 22);

    let y = 42;

    // ── Participant Details Row ───────────────────────────────────────────────────
    doc.setTextColor(107, 114, 128); // gray-500
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('E-MAIL', M, y);
    doc.text('TELEFONE', M + 80, y);

    y += 6;
    doc.setTextColor(17, 24, 39); // gray-900
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    
    const maxEmailW = 70;
    let emailText = participantEmail || '-';
    if (doc.getTextWidth(emailText) > maxEmailW) {
        emailText = emailText.substring(0, 30) + '...';
    }
    doc.text(emailText, M, y);
    doc.text(participantPhone || '-', M + 80, y);

    y += 12;
    doc.setDrawColor(229, 231, 235); // gray-200
    doc.line(M, y, PW - M, y);
    y += 8;

    // ── Forms grouped structurally ──────────────────────────────────────

    for (const ticket of tickets || []) {
        if (y > 240) { doc.addPage(); y = 20; }

        // Answers
        const detail = formDetails[ticket.id];
        if (detail && detail.status === 'completed' && detail.answers?.length) {
            
            // Deduplicate answers by label (pick the one that has a real value if duplicates exist)
            const uniqueAnswersMap = new Map<string, string>();
            
            detail.answers.forEach(ans => {
                const label = ans.form_fields?.label;
                if (!label) return;
                
                let val = ans.value || '';
                try {
                    const parsed = JSON.parse(val);
                    if (parsed && typeof parsed === 'object' && 'ele' in parsed && 'ela' in parsed) {
                        val = `Ele: ${parsed.ele || '-'} / Ela: ${parsed.ela || '-'}`;
                    }
                } catch { /* not JSON */ }
                
                // If this label already exists, only overwrite it if the current value is NOT empty
                // This fixes the issue where an empty duplicate overwrites a filled one, or an empty duplicate is pushed alongside a filled one
                if (!uniqueAnswersMap.has(label)) {
                    uniqueAnswersMap.set(label, val);
                } else {
                    const existingVal = uniqueAnswersMap.get(label);
                    if ((!existingVal || existingVal === '-') && val && val !== '-') {
                        uniqueAnswersMap.set(label, val);
                    }
                }
            });

            const arr = Array.from(uniqueAnswersMap.entries()).map(([q, a]) => ({ q, a: a || '-' }));

            if (arr.length > 0) {
                // Changing to 1-column layout for better readability, since we removed the duplicate empty ones
                for (let i = 0; i < arr.length; i++) {
                    if (y > 265) { doc.addPage(); y = 20; }
                    const item = arr[i];
                    
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(107, 114, 128); // gray-500
                    const qText = doc.splitTextToSize(item.q.toUpperCase(), CW);
                    doc.text(qText, M, y);
                    
                    doc.setFontSize(10);
                    doc.setTextColor(17, 24, 39);
                    const aText = doc.splitTextToSize(item.a, CW);
                    doc.text(aText, M, y + 5 + (qText.length - 1) * 3);
                    
                    const rowH = (qText.length * 3 + aText.length * 4) + 4;
                    y += rowH;
                }
            }
        } else if (detail && detail.status === 'pending') {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(217, 119, 6); // amber-600
            doc.text('⚠ Formulário ainda não preenchido', M, y);
            y += 8;
        }
        
        y += 4;
    }

    // ── Footer ────────────────────────────────────────────────────────────────────
    doc.setDrawColor(229, 231, 235);
    doc.line(M, 282, PW - M, 282);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(156, 163, 175);
    doc.text(`Gerado via sistema de Ingressos — ${new Date().toLocaleDateString('pt-BR')}`, PW / 2, 288, { align: 'center' });

    // Return as base64 data URI string
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
