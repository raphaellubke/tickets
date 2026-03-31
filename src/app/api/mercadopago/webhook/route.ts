import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// MercadoPago sends a GET request first to verify the endpoint
export async function GET() {
    return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // MP notification format: { type: 'payment', action: 'payment.updated', data: { id: '...' } }
        if (body.type !== 'payment' || !body.data?.id) {
            // Not a payment notification — acknowledge and ignore
            return NextResponse.json({ ok: true });
        }

        const mpPaymentId = String(body.data.id);

        // Fetch full payment details from MP API
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
            headers: {
                'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
                'Cache-Control': 'no-cache',
            },
        });

        if (!mpRes.ok) {
            console.error('Failed to fetch payment from MP:', await mpRes.text());
            return NextResponse.json({ error: 'Failed to fetch payment' }, { status: 500 });
        }

        const payment = await mpRes.json();

        // Only process approved payments
        if (payment.status !== 'approved') {
            return NextResponse.json({ ok: true, status: payment.status });
        }

        const externalRef = payment.external_reference;
        if (!externalRef) {
            console.error('No external_reference in MP payment:', mpPaymentId);
            return NextResponse.json({ ok: true });
        }

        const supabase = await createClient();

        // external_reference is the order_number (e.g. ORD-...) — resolve to UUID
        const { data: orderRow } = await supabase
            .from('orders')
            .select('id')
            .eq('order_number', externalRef)
            .maybeSingle();

        const orderId = orderRow?.id;
        if (!orderId) {
            console.error('Order not found for external_reference:', externalRef);
            return NextResponse.json({ ok: true });
        }

        // Update payment record
        await supabase
            .from('payments')
            .update({
                status: 'paid',
                payment_provider_id: mpPaymentId,
                paid_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('order_id', orderId)
            .eq('status', 'pending');

        // Process the order (idempotent — skips if already processed)
        await processApprovedPayment(orderId, supabase);

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        console.error('MP webhook error:', err);
        // Always return 200 to prevent MP from retrying indefinitely
        return NextResponse.json({ ok: true });
    }
}

async function processApprovedPayment(orderId: string, supabase: any) {
    // Idempotency: only process if still pending
    const { data: updatedOrders } = await supabase
        .from('orders')
        .update({
            payment_status: 'paid',
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('payment_status', 'pending')
        .select('id');

    if (!updatedOrders || updatedOrders.length === 0) {
        console.log('Order already processed, skipping:', orderId);
        return;
    }

    const { data: orderItems } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

    if (!orderItems || orderItems.length === 0) return;

    const { data: order } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

    if (!order) return;

    // Get event form_id once (shared across tickets)
    let formId: string | null = null;
    if (order.event_id) {
        const { data: eventData } = await supabase
            .from('events')
            .select('form_id')
            .eq('id', order.event_id)
            .maybeSingle();
        formId = eventData?.form_id ?? null;
    }

    let formFields: any[] = [];
    if (formId) {
        const { data: ff } = await supabase
            .from('form_fields')
            .select('id')
            .eq('form_id', formId)
            .order('order_index', { ascending: true });
        formFields = ff || [];
    }

    for (const item of orderItems) {
        for (let i = 0; i < item.quantity; i++) {
            const ticketCode = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

            const { data: ticket, error: ticketError } = await supabase
                .from('tickets')
                .insert({
                    order_id: orderId,
                    event_id: order.event_id,
                    ticket_type_id: item.ticket_type_id,
                    ticket_code: ticketCode,
                    status: 'active',
                    organization_id: order.organization_id,
                })
                .select()
                .single();

            if (ticketError) {
                console.error('Error creating ticket:', ticketError);
                continue;
            }

            // Atomic capacity check
            const { data: incremented } = await supabase.rpc('increment_quantity_sold', {
                p_ticket_type_id: item.ticket_type_id,
            });
            if (!incremented) {
                await supabase.from('tickets').delete().eq('id', ticket.id);
                console.warn('Oversell prevented (webhook) for type:', item.ticket_type_id);
                continue;
            }

            if (formId && formFields.length > 0) {
                const { data: formResponse } = await supabase
                    .from('form_responses')
                    .insert({
                        form_id: formId,
                        ticket_id: ticket.id,
                        user_id: order.user_id,
                        status: 'pending',
                    })
                    .select()
                    .single();

                if (formResponse) {
                    const answers = formFields.map((field: any) => ({
                        response_id: formResponse.id,
                        field_id: field.id,
                        value: null,
                    }));
                    await supabase.from('form_response_answers').insert(answers);
                }
            }

        }
    }

    console.log(`MP webhook processed order ${orderId}`);
}
