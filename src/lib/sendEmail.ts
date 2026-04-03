import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
const LOGO_URL = `${SITE_URL}/logo.png`;

interface SendConfirmationEmailParams {
    to: string;
    participantName: string;
    eventName: string;
    orderNumber: string;
    totalAmount: number;
    paymentMethod: 'pix' | 'card';
    tickets: { code: string; type: string }[];
    pendingFormTicketId?: string | null;
}

export async function sendPaymentConfirmationEmail(params: SendConfirmationEmailParams) {
    const {
        to, participantName, eventName, orderNumber,
        totalAmount, paymentMethod, tickets, pendingFormTicketId,
    } = params;

    const formUrl = pendingFormTicketId ? `${SITE_URL}/form/${pendingFormTicketId}` : null;
    const firstName = participantName.split(' ')[0];

    const formatPrice = (v: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    const ticketsHtml = tickets.map(t => `
        <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151;">${t.type}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#6b7280;font-family:monospace;">${t.code}</td>
        </tr>
    `).join('');

    const ctaSection = formUrl ? `
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:20px 24px;margin:24px 0;text-align:center;">
            <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#9a3412;">Ação necessária</p>
            <p style="margin:0 0 16px;font-size:13px;color:#9a3412;">Você precisa preencher o formulário do evento para confirmar sua participação.</p>
            <a href="${formUrl}" style="display:inline-block;background:#ea580c;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:12px 32px;border-radius:8px;">
                Preencher Formulário →
            </a>
        </div>
    ` : `
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 24px;margin:24px 0;text-align:center;">
            <p style="margin:0;font-size:13px;color:#166534;">✅ Sua inscrição está completa. Até o evento!</p>
        </div>
    `;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td align="center" style="background:#1a2e6c;padding:28px 40px;">
            <img src="${LOGO_URL}" alt="Missão Guadalupe" width="160" style="display:block;" />
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 48px 24px;">
            <h1 style="margin:0 0 8px;font-size:22px;color:#111827;font-weight:700;">Pagamento confirmado! 🎉</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">Olá, <strong>${firstName}</strong>! Seu ingresso para <strong>${eventName}</strong> foi confirmado.</p>

            <!-- Order info -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;margin-bottom:24px;">
              <tr>
                <td style="padding:12px 16px;font-size:13px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Pedido</td>
                <td style="padding:12px 16px;font-size:13px;color:#111827;font-weight:600;text-align:right;border-bottom:1px solid #e5e7eb;">${orderNumber}</td>
              </tr>
              <tr>
                <td style="padding:12px 16px;font-size:13px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Evento</td>
                <td style="padding:12px 16px;font-size:13px;color:#111827;font-weight:600;text-align:right;border-bottom:1px solid #e5e7eb;">${eventName}</td>
              </tr>
              <tr>
                <td style="padding:12px 16px;font-size:13px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Pagamento</td>
                <td style="padding:12px 16px;font-size:13px;color:#111827;font-weight:600;text-align:right;border-bottom:1px solid #e5e7eb;">${paymentMethod === 'pix' ? 'PIX' : 'Cartão de Crédito'}</td>
              </tr>
              <tr>
                <td style="padding:12px 16px;font-size:15px;color:#111827;font-weight:700;">Total</td>
                <td style="padding:12px 16px;font-size:15px;color:#111827;font-weight:700;text-align:right;">${formatPrice(totalAmount)}</td>
              </tr>
            </table>

            <!-- Tickets -->
            <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;">Seus ingressos</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:0;">
              ${ticketsHtml}
            </table>

            ${ctaSection}
          </td>
        </tr>

        <!-- Divider -->
        <tr><td style="padding:0 48px;"><hr style="border:none;border-top:1px solid #eee;margin:0;"/></td></tr>

        <!-- Contact -->
        <tr>
          <td style="padding:20px 48px 28px;">
            <p style="margin:0 0 4px;font-size:13px;color:#666;"><strong>Dúvidas ou problemas?</strong> Entre em contato:</p>
            <p style="margin:0;font-size:14px;color:#1a2e6c;font-weight:600;">Patrícia Ferraz — (17) 99166-5571</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td align="center" style="background:#f4f4f5;padding:20px 48px;">
            <p style="margin:0;font-size:12px;color:#aaa;">Missão Guadalupe · Este e-mail foi gerado automaticamente</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await resend.emails.send({
        from: 'Missão Guadalupe <noreply@ingressos.missaoguadalupe.org>',
        to,
        subject: `✅ Ingresso confirmado — ${eventName}`,
        html,
    });
}
