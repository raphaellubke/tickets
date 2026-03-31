import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const {
            orderId, orderNumber, amount, token, installments,
            paymentMethodId, issuerId,
            payerEmail, payerCpf, payerName,
        } = await request.json();

        const nameParts = (payerName || 'Cliente').trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || firstName;

        const body: any = {
            transaction_amount: Math.round(parseFloat(amount) * 100) / 100,
            token,
            installments: parseInt(installments) || 1,
            payment_method_id: paymentMethodId,
            payer: {
                email: payerEmail,
                first_name: firstName,
                last_name: lastName,
                identification: {
                    type: 'CPF',
                    number: (payerCpf || '').replace(/\D/g, ''),
                },
            },
            external_reference: orderNumber || orderId,
            notification_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/mercadopago/webhook`,
        };

        if (issuerId) body.issuer_id = parseInt(issuerId);

        const response = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
                'X-Idempotency-Key': `card-${orderId}-${Date.now()}`,
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('MP Card error:', data);
            return NextResponse.json({
                error: translateCardError(data.status_detail) || data.message || 'Pagamento recusado',
                statusDetail: data.status_detail,
            }, { status: 400 });
        }

        return NextResponse.json({
            paymentId: String(data.id),
            status: data.status,
            statusDetail: data.status_detail,
        });
    } catch (err: any) {
        console.error('create-card error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

function translateCardError(detail: string): string {
    const map: Record<string, string> = {
        cc_rejected_insufficient_amount: 'Saldo insuficiente no cartão',
        cc_rejected_bad_filled_card_number: 'Número do cartão incorreto',
        cc_rejected_bad_filled_date: 'Data de validade incorreta',
        cc_rejected_bad_filled_security_code: 'Código de segurança incorreto',
        cc_rejected_blacklist: 'Cartão não autorizado',
        cc_rejected_call_for_authorize: 'Ligue para o banco para autorizar',
        cc_rejected_card_disabled: 'Cartão desabilitado. Contate seu banco',
        cc_rejected_duplicated_payment: 'Pagamento duplicado. Aguarde antes de tentar novamente',
        cc_rejected_high_risk: 'Pagamento recusado por risco. Use outro cartão',
        cc_rejected_max_attempts: 'Limite de tentativas atingido. Use outro cartão',
    };
    return map[detail] || '';
}
