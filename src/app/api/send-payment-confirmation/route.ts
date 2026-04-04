import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendPaymentConfirmationEmail } from '@/lib/sendEmail';

export async function POST(request: NextRequest) {
    try {
        const { orderId } = await request.json();
        if (!orderId) {
            return NextResponse.json({ error: 'orderId required' }, { status: 400 });
        }

        const supabase = await createClient();

        const { data: order } = await supabase
            .from('orders')
            .select('*, events(name)')
            .eq('id', orderId)
            .single();

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const { data: tickets } = await supabase
            .from('tickets')
            .select('id, ticket_code, event_ticket_types(name)')
            .eq('order_id', orderId);

        const { data: pendingForm } = await supabase
            .from('form_responses')
            .select('ticket_id')
            .in('ticket_id', (tickets || []).map((t: any) => t.id))
            .eq('status', 'pending')
            .limit(1)
            .maybeSingle();

        const { data: paymentData } = await supabase
            .from('payments')
            .select('payment_method')
            .eq('order_id', orderId)
            .maybeSingle();

        await sendPaymentConfirmationEmail({
            to: order.participant_email,
            participantName: order.participant_name || order.participant_email,
            eventName: order.events?.name || 'Evento',
            orderNumber: order.order_number,
            totalAmount: parseFloat(order.total_amount),
            paymentMethod: paymentData?.payment_method === 'credit_card' || paymentData?.payment_method === 'card' ? 'card' : 'pix',
            tickets: (tickets || []).map((t: any) => ({
                code: t.ticket_code,
                type: t.event_ticket_types?.name || 'Ingresso',
            })),
            pendingFormTicketId: pendingForm?.ticket_id || null,
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[send-payment-confirmation]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
