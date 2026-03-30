import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { orderId, amount, payerEmail, payerName, payerCpf } = await request.json();

        const nameParts = (payerName || 'Cliente').trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || firstName;

        const response = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
                'X-Idempotency-Key': `pix-${orderId}-${Date.now()}`,
            },
            body: JSON.stringify({
                transaction_amount: Math.round(parseFloat(amount) * 100) / 100,
                payment_method_id: 'pix',
                payer: {
                    email: payerEmail,
                    first_name: firstName,
                    last_name: lastName,
                    identification: {
                        type: 'CPF',
                        number: (payerCpf || '').replace(/\D/g, ''),
                    },
                },
                external_reference: orderId,
                notification_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/mercadopago/webhook`,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('MP PIX error:', data);
            return NextResponse.json({ error: data.message || 'Erro ao gerar PIX' }, { status: 400 });
        }

        return NextResponse.json({
            paymentId: String(data.id),
            qrCode: data.point_of_interaction?.transaction_data?.qr_code ?? '',
            qrCodeBase64: data.point_of_interaction?.transaction_data?.qr_code_base64 ?? '',
            status: data.status,
        });
    } catch (err: any) {
        console.error('create-pix error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
