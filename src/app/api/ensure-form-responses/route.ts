import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// Creates form_responses for tickets that don't have one yet,
// for cases where a form was linked to the event after tickets were purchased.
export async function POST(request: NextRequest) {
    try {
        const { orderId } = await request.json();
        if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });

        const admin = createAdminClient();

        // Get order + event form_id
        const { data: order } = await admin
            .from('orders')
            .select('id, event_id, user_id')
            .eq('id', orderId)
            .single();

        if (!order) return NextResponse.json({ created: 0 });

        const { data: eventData } = await admin
            .from('events')
            .select('form_id')
            .eq('id', order.event_id)
            .maybeSingle();

        if (!eventData?.form_id) return NextResponse.json({ created: 0 });

        // Get tickets for this order
        const { data: tickets } = await admin
            .from('tickets')
            .select('id')
            .eq('order_id', orderId);

        if (!tickets?.length) return NextResponse.json({ created: 0 });

        // Get existing form_responses
        const { data: existing } = await admin
            .from('form_responses')
            .select('ticket_id')
            .in('ticket_id', tickets.map(t => t.id));

        const existingTicketIds = new Set((existing || []).map(r => r.ticket_id));

        // Get form fields for empty answer rows
        const { data: formFields } = await admin
            .from('form_fields')
            .select('id')
            .eq('form_id', eventData.form_id)
            .order('order_index', { ascending: true });

        let created = 0;
        for (const ticket of tickets) {
            if (existingTicketIds.has(ticket.id)) continue;

            const { data: formResponse } = await admin
                .from('form_responses')
                .insert({ form_id: eventData.form_id, ticket_id: ticket.id, user_id: order.user_id, status: 'pending' })
                .select('id')
                .single();

            if (formResponse && formFields?.length) {
                await admin.from('form_response_answers').insert(
                    formFields.map(f => ({ response_id: formResponse.id, field_id: f.id, value: null }))
                );
            }
            created++;
        }

        return NextResponse.json({ created });
    } catch (err: any) {
        console.error('[ensure-form-responses]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
