import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
    try {
        const { email, orgId, role } = await request.json();

        if (!email || !orgId || !role) {
            return NextResponse.json({ success: false, error: 'email, orgId e role são obrigatórios' }, { status: 400 });
        }

        const origin = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
        const nextPath = `/invite/accept?org=${orgId}&role=${role}&email=${encodeURIComponent(email)}`;
        const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

        const supabase = await createClient();

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo,
                shouldCreateUser: true,
            },
        });

        if (error) {
            console.error('Error sending invite email:', error);
            return NextResponse.json({
                success: false,
                emailSent: false,
                inviteUrl: emailRedirectTo,
                error: error.message,
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            emailSent: true,
            message: `Convite enviado para ${email}`,
        });
    } catch (err: any) {
        console.error('Error in send-invite:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
