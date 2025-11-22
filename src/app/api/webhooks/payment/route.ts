import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const supabase = await createClient();

        // Extract payment information from webhook
        const { payment_id, status, provider_payment_id } = body;

        if (!payment_id || !status) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Update payment status
        const { data: payment, error: paymentError } = await supabase
            .from('payments')
            .update({
                status: status,
                payment_provider_id: provider_payment_id || null,
                paid_at: status === 'paid' ? new Date().toISOString() : null,
                updated_at: new Date().toISOString()
            })
            .eq('id', payment_id)
            .select(`
                *,
                orders!inner(*)
            `)
            .single();

        if (paymentError) {
            console.error('Error updating payment:', paymentError);
            return NextResponse.json(
                { error: 'Failed to update payment' },
                { status: 500 }
            );
        }

        // If payment is approved, process the order
        if (status === 'paid' && payment) {
            await processApprovedPayment(payment.orders.id, supabase);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Webhook error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

async function processApprovedPayment(orderId: string, supabase: any) {
    try {
        // 1. Update order status
        await supabase
            .from('orders')
            .update({
                payment_status: 'paid',
                paid_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId);

        // 2. Get order items
        const { data: orderItems } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', orderId);

        if (!orderItems || orderItems.length === 0) {
            console.error('No order items found');
            return;
        }

        // 3. Get order details
        const { data: order } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

        if (!order) {
            console.error('Order not found');
            return;
        }

        // 4. Generate tickets for each order item
        const tickets = [];
        for (const item of orderItems) {
            for (let i = 0; i < item.quantity; i++) {
                // Generate unique ticket code
                const ticketCode = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
                
                const { data: ticket, error: ticketError } = await supabase
                    .from('tickets')
                    .insert({
                        order_id: orderId,
                        event_id: order.event_id,
                        ticket_type_id: item.ticket_type_id,
                        ticket_code: ticketCode,
                        price: item.unit_price,
                        status: 'active',
                        organization_id: order.organization_id
                    })
                    .select()
                    .single();

                if (ticketError) {
                    console.error('Error creating ticket:', ticketError);
                    continue;
                }

                tickets.push(ticket);

                // 5. Create form response if event has form
                if (order.event_id) {
                    const { data: eventData } = await supabase
                        .from('events')
                        .select('form_id, require_form')
                        .eq('id', order.event_id)
                        .single();

                    if (eventData?.form_id) {
                        // Create form_response
                        const { data: formResponse, error: responseError } = await supabase
                            .from('form_responses')
                            .insert({
                                form_id: eventData.form_id,
                                ticket_id: ticket.id,
                                user_id: order.user_id,
                                status: 'pending'
                            })
                            .select()
                            .single();

                        if (!responseError && formResponse) {
                            // Get form fields
                            const { data: formFields } = await supabase
                                .from('form_fields')
                                .select('id')
                                .eq('form_id', eventData.form_id)
                                .order('order_index', { ascending: true });

                            if (formFields && formFields.length > 0) {
                                // Create empty answers for each field
                                const answers = formFields.map((field: any) => ({
                                    response_id: formResponse.id,
                                    field_id: field.id,
                                    value: null
                                }));

                                await supabase
                                    .from('form_response_answers')
                                    .insert(answers);
                            }
                        }
                    }
                }

                // 6. Update ticket type stock (increment quantity_sold)
                // Get current quantity_sold
                const { data: ticketType } = await supabase
                    .from('event_ticket_types')
                    .select('quantity_sold')
                    .eq('id', item.ticket_type_id)
                    .single();

                if (ticketType) {
                    await supabase
                        .from('event_ticket_types')
                        .update({
                            quantity_sold: (ticketType.quantity_sold || 0) + 1
                        })
                        .eq('id', item.ticket_type_id);
                }
            }
        }

        // 7. Update order_items quantity_sold (if needed)
        // This is handled by the increment function above

        console.log(`Processed payment for order ${orderId}: ${tickets.length} tickets created`);
    } catch (error: any) {
        console.error('Error processing approved payment:', error);
        throw error;
    }
}

