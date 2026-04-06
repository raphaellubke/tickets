import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
    // Verify user is authenticated
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    if (!eventId) {
        return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    }

    try {
        const { data, error } = await supabaseAdmin
            .from('ticket_reservations')
            .select('session_id, quantity')
            .eq('event_id', eventId)
            .gt('expires_at', new Date().toISOString());

        if (error) throw error;

        const rows = data || [];
        const sessions = new Set(rows.map((r: any) => r.session_id)).size;
        const quantity = rows.reduce((sum: number, r: any) => sum + (r.quantity || 0), 0);

        return NextResponse.json({ sessions, quantity });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
