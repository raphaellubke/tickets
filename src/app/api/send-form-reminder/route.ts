import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
    try {
        const { ticketId, email, name, eventName } = await request.json();

        if (!ticketId || !email) {
            return NextResponse.json({ success: false, error: 'ticketId and email are required' }, { status: 400 });
        }

        const origin = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
        const formUrl = `${origin}/form/${ticketId}`;

        // Use Supabase auth OTP to send a magic link to the participant's email
        // The link redirects to the form page after authentication
        const supabase = await createClient();
        const { error: otpError } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: formUrl,
                shouldCreateUser: false, // Don't create auth account if not exists
            },
        });

        if (otpError) {
            console.error('Error sending OTP:', otpError);
            // OTP failed — return the URL so the organizer can copy it, but flag email as not sent
            return NextResponse.json({
                success: true,
                emailSent: false,
                formUrl,
                message: 'Não foi possível enviar o e-mail. Copie o link e envie manualmente.',
            });
        }

        return NextResponse.json({
            success: true,
            emailSent: true,
            formUrl,
            message: `Form reminder sent to ${email}`,
        });
    } catch (err: any) {
        console.error('Error in send-form-reminder:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
