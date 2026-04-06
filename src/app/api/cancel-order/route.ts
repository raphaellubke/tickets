import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
    // Verify user is authenticated
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, eventId } = body;

    try {
        if (orderId) {
            // Cancel a specific order
            const { error } = await supabaseAdmin
                .from('orders')
                .update({ payment_status: 'cancelled' })
                .eq('id', orderId)
                .eq('payment_status', 'pending'); // only cancel pending orders

            if (error) throw error;
            return NextResponse.json({ success: true, cancelled: 1 });
        }

        if (eventId) {
            // Cancel all expired pending orders for an event (pending > 12 min)
            const { data, error } = await supabaseAdmin.rpc('cancel_expired_orders', {
                p_event_id: eventId,
            });
            if (error) throw error;
            return NextResponse.json({ success: true, cancelled: data ?? 0 });
        }

        return NextResponse.json({ error: 'orderId or eventId required' }, { status: 400 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
