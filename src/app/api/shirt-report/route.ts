import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    if (!eventId) {
        return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    }

    // 1. Get all ticket IDs for this event
    const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select('id')
        .eq('event_id', eventId)
        .in('status', ['active', 'used']);

    if (ticketsError) {
        return NextResponse.json({ error: ticketsError.message }, { status: 500 });
    }

    const ticketIds = (ticketsData || []).map((t: any) => t.id);
    if (ticketIds.length === 0) {
        return new NextResponse('Campo,Tamanho,Quantidade\n', {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="camisas-${eventId}.csv"`,
            },
        });
    }

    // 2. Get form responses for those tickets (any status)
    const { data: responsesData, error: responsesError } = await supabase
        .from('form_responses')
        .select('id')
        .in('ticket_id', ticketIds);

    if (responsesError) {
        return NextResponse.json({ error: responsesError.message }, { status: 500 });
    }

    const responseIds = (responsesData || []).map((r: any) => r.id);
    if (responseIds.length === 0) {
        return new NextResponse('Campo,Tamanho,Quantidade\n', {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="camisas-${eventId}.csv"`,
            },
        });
    }

    // 3. Get shirt size answers with field labels
    const { data: answersData, error: answersError } = await supabase
        .from('form_response_answers')
        .select('value, form_fields!inner(label, type)')
        .in('response_id', responseIds)
        .eq('form_fields.type', 'shirt_size')
        .not('value', 'is', null)
        .neq('value', '');

    if (answersError) {
        return NextResponse.json({ error: answersError.message }, { status: 500 });
    }

    // 4. Aggregate counts by (field_label, size)
    // Values can be plain strings ("M") or couple JSON ({"ele":"M","ela":"P"})
    const counts: Record<string, Record<string, number>> = {};
    for (const row of (answersData || []) as any[]) {
        const label: string = row.form_fields?.label || 'Tamanho da Camisa';
        const rawValue: string = row.value || '';
        if (!rawValue) continue;

        // Try to parse couple JSON format
        let sizeEntries: Array<{ subLabel: string; size: string }> = [];
        if (rawValue.startsWith('{')) {
            try {
                const parsed = JSON.parse(rawValue);
                for (const [person, size] of Object.entries(parsed)) {
                    if (size) {
                        const personLabel = person === 'ela' ? `${label} (Ela)` : person === 'ele' ? `${label} (Ele)` : `${label} (${person})`;
                        sizeEntries.push({ subLabel: personLabel, size: String(size) });
                    }
                }
            } catch {
                sizeEntries.push({ subLabel: label, size: rawValue });
            }
        } else {
            sizeEntries.push({ subLabel: label, size: rawValue });
        }

        for (const { subLabel, size } of sizeEntries) {
            if (!counts[subLabel]) counts[subLabel] = {};
            counts[subLabel][size] = (counts[subLabel][size] || 0) + 1;
        }
    }

    // 5. Build CSV
    const SIZE_ORDER = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'];
    const rows: string[] = ['Campo,Tamanho,Quantidade'];

    for (const [fieldLabel, sizeCounts] of Object.entries(counts)) {
        // Sort by SIZE_ORDER first, then alphabetically for unknowns
        const sizes = Object.keys(sizeCounts).sort((a, b) => {
            const ai = SIZE_ORDER.indexOf(a);
            const bi = SIZE_ORDER.indexOf(b);
            if (ai !== -1 && bi !== -1) return ai - bi;
            if (ai !== -1) return -1;
            if (bi !== -1) return 1;
            return a.localeCompare(b);
        });
        for (const size of sizes) {
            const escapedLabel = `"${fieldLabel.replace(/"/g, '""')}"`;
            rows.push(`${escapedLabel},${size},${sizeCounts[size]}`);
        }
    }

    // If no data found
    if (rows.length === 1) {
        rows.push('"Nenhuma resposta encontrada","—","0"');
    }

    const csv = rows.join('\n') + '\n';

    return new NextResponse(csv, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="camisas-${eventId}.csv"`,
        },
    });
}
