import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function escapeCell(value: string | null | undefined): string {
    const str = (value ?? '').toString();
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const fieldIds = searchParams.get('fields'); // comma-separated field IDs, or 'all'

    if (!eventId) {
        return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    }

    // 1. Get event name
    const { data: event } = await supabase
        .from('events')
        .select('name')
        .eq('id', eventId)
        .maybeSingle();

    // 2. Get all active/used tickets with participant info via orders
    const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .select(`
            id, ticket_code, status,
            event_ticket_types(name),
            orders!inner(
                order_number,
                participant_name,
                participant_email,
                participant_phone,
                payment_method,
                payment_status,
                total_amount
            )
        `)
        .eq('event_id', eventId)
        .in('status', ['active', 'used']);

    if (ticketsError) {
        return NextResponse.json({ error: ticketsError.message }, { status: 500 });
    }

    if (!tickets || tickets.length === 0) {
        return new NextResponse('Sem participantes ainda\n', {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="respostas-${eventId}.csv"`,
            },
        });
    }

    const ticketIds = tickets.map((t: any) => t.id);

    // 3. Get form responses
    const { data: responses } = await supabase
        .from('form_responses')
        .select('id, ticket_id, status')
        .in('ticket_id', ticketIds);

    const responseByTicket: Record<string, { id: string; status: string }> = {};
    for (const r of responses || []) {
        responseByTicket[r.ticket_id] = { id: r.id, status: r.status };
    }

    const responseIds = (responses || []).map((r: any) => r.id);

    // 4. Get form fields to determine headers
    // Find the form linked to any of these tickets
    let selectedFields: Array<{ id: string; label: string; order_index: number }> = [];

    if (responseIds.length > 0) {
        // Get one response to find the form_id
        const { data: oneResponse } = await supabase
            .from('form_responses')
            .select('form_id')
            .in('id', responseIds)
            .limit(1)
            .maybeSingle();

        if (oneResponse?.form_id) {
            let query = supabase
                .from('form_fields')
                .select('id, label, order_index, type')
                .eq('form_id', oneResponse.form_id)
                .neq('type', 'section_header')
                .neq('type', 'clause')
                .order('order_index', { ascending: true });

            if (fieldIds && fieldIds !== 'all') {
                query = query.in('id', fieldIds.split(','));
            }

            const { data: fields } = await query;
            selectedFields = fields || [];
        }
    }

    // 5. Get answers for selected fields
    let answersByResponse: Record<string, Record<string, string>> = {};

    if (responseIds.length > 0 && selectedFields.length > 0) {
        let answersQuery = supabase
            .from('form_response_answers')
            .select('response_id, field_id, value, form_fields(label)')
            .in('response_id', responseIds);

        if (fieldIds && fieldIds !== 'all') {
            answersQuery = answersQuery.in('field_id', fieldIds.split(','));
        }

        const { data: answers } = await answersQuery;

        for (const ans of answers || []) {
            if (!answersByResponse[ans.response_id]) answersByResponse[ans.response_id] = {};
            answersByResponse[ans.response_id][ans.field_id] = ans.value || '';
        }
    }

    // 6. Build CSV
    const paymentLabel: Record<string, string> = {
        pix: 'PIX', card: 'Cartão', credit_card: 'Cartão', debit_card: 'Débito',
    };

    const baseHeaders = ['Nº Pedido', 'Nome', 'E-mail', 'Telefone', 'Tipo de Ingresso', 'Código Ingresso', 'Pagamento', 'Status Form'];
    const fieldHeaders = selectedFields.map(f => f.label);
    const allHeaders = [...baseHeaders, ...fieldHeaders];

    const rows: string[] = [allHeaders.map(escapeCell).join(',')];

    for (const ticket of tickets as any[]) {
        const order = ticket.orders;
        const response = responseByTicket[ticket.id];
        const answers = response ? answersByResponse[response.id] || {} : {};

        const baseValues = [
            order?.order_number || '',
            order?.participant_name || '',
            order?.participant_email || '',
            order?.participant_phone || '',
            ticket.event_ticket_types?.name || '',
            ticket.ticket_code || '',
            paymentLabel[order?.payment_method] || order?.payment_method || '',
            !response ? 'Sem formulário' : response.status === 'completed' ? 'Preenchido' : 'Pendente',
        ];

        const fieldValues = selectedFields.map(f => {
            const raw = answers[f.id] || '';
            // Try to parse couple JSON
            if (raw.startsWith('{')) {
                try {
                    const p = JSON.parse(raw);
                    if (p && typeof p === 'object') {
                        const parts = [];
                        if (p.ela) parts.push(`Ela: ${p.ela}`);
                        if (p.ele) parts.push(`Ele: ${p.ele}`);
                        return parts.join(' | ');
                    }
                } catch {}
            }
            return raw;
        });

        rows.push([...baseValues, ...fieldValues].map(escapeCell).join(','));
    }

    const csv = rows.join('\n') + '\n';
    const eventName = event?.name || eventId;
    const safeName = eventName.replace(/[^a-zA-Z0-9À-ÿ\s]/g, '').trim().replace(/\s+/g, '-');

    return new NextResponse(csv, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="respostas-${safeName}.csv"`,
        },
    });
}
