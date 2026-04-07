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
            // Find pending orders older than 12 min but newer than 4 hours
            const cutoffOld = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
            const cutoffNew = new Date(Date.now() - 12 * 60 * 1000).toISOString();

            const { data: candidates } = await supabaseAdmin
                .from('orders')
                .select('id')
                .eq('event_id', eventId)
                .eq('payment_status', 'pending')
                .lt('created_at', cutoffNew)
                .gt('created_at', cutoffOld);

            if (!candidates || candidates.length === 0) {
                return NextResponse.json({ success: true, cancelled: 0 });
            }

            const candidateIds = candidates.map((o: any) => o.id);

            // Safety: exclude any order that has a paid payment record
            // (webhook may have been delayed — don't cancel a real payment)
            const { data: paidPayments } = await supabaseAdmin
                .from('payments')
                .select('order_id')
                .in('order_id', candidateIds)
                .eq('status', 'paid');

            const paidOrderIds = new Set((paidPayments || []).map((p: any) => p.order_id));
            const safeToCancel = candidateIds.filter((id: string) => !paidOrderIds.has(id));

            if (safeToCancel.length === 0) {
                return NextResponse.json({ success: true, cancelled: 0 });
            }

            const { error } = await supabaseAdmin
                .from('orders')
                .update({ payment_status: 'cancelled' })
                .in('id', safeToCancel);

            if (error) throw error;
            return NextResponse.json({ success: true, cancelled: safeToCancel.length });
        }

        return NextResponse.json({ error: 'orderId or eventId required' }, { status: 400 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
