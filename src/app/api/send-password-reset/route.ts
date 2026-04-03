import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');

export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json();
        if (!email) return NextResponse.json({ error: 'Email obrigatório' }, { status: 400 });

        const admin = createAdminClient();

        // Generate the recovery link server-side — no SMTP needed
        const { data, error } = await admin.auth.admin.generateLink({
            type: 'recovery',
            email,
            options: {
                redirectTo: `${SITE_URL}/auth/callback?next=/nova-senha`,
            },
        });

        if (error || !data?.properties?.action_link) {
            // User not found — don't reveal that, just return success silently
            return NextResponse.json({ success: true });
        }

        const resetLink = data.properties.action_link;

        await resend.emails.send({
            from: 'Missão Guadalupe <noreply@ingressos.missaoguadalupe.org>',
            to: email,
            subject: 'Redefinição de senha — Missão Guadalupe',
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td align="center" style="background:#1a2e6c;padding:28px 40px;">
            <img src="${SITE_URL}/logo.png" alt="Missão Guadalupe" width="140" style="display:block;"/>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 48px 32px;">
            <h1 style="margin:0 0 12px;font-size:20px;color:#111827;font-weight:700;">Redefinir sua senha</h1>
            <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
              Recebemos uma solicitação para redefinir a senha da sua conta.<br/>
              Clique no botão abaixo para criar uma nova senha:
            </p>
            <div style="text-align:center;margin:28px 0;">
              <a href="${resetLink}"
                style="display:inline-block;background:#1a2e6c;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:8px;">
                Redefinir senha →
              </a>
            </div>
            <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;line-height:1.5;">
              Este link expira em 1 hora. Se você não solicitou a redefinição, ignore este e-mail.
            </p>
          </td>
        </tr>
        <tr>
          <td align="center" style="background:#f4f4f5;padding:20px 48px;">
            <p style="margin:0;font-size:12px;color:#aaa;">Missão Guadalupe · Este e-mail foi gerado automaticamente</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[send-password-reset]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
