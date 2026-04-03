import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const admin = createAdminClient();

        // Find pending invite by email
        const { data: pending } = await admin
            .from('organization_members')
            .select('id, organization_id, role')
            .eq('email', user.email!)
            .is('user_id', null)
            .limit(1);

        if (!pending?.[0]) {
            // Check if already linked
            const { data: existing } = await admin
                .from('organization_members')
                .select('id, organization_id, role')
                .eq('user_id', user.id)
                .limit(1);

            if (existing?.[0]) {
                return NextResponse.json({ member: existing[0] });
            }

            return NextResponse.json({ member: null });
        }

        // Accept invite using admin client (bypasses RLS)
        await admin
            .from('organization_members')
            .update({
                user_id: user.id,
                status: 'active',
                joined_at: new Date().toISOString(),
            })
            .eq('id', pending[0].id);

        return NextResponse.json({ member: pending[0] });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
