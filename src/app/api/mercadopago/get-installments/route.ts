import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const bin    = searchParams.get('bin');
    const amount = searchParams.get('amount');

    if (!bin || bin.length < 6 || !amount) {
        return NextResponse.json({ installments: [], paymentMethodId: '', issuerId: '' });
    }

    try {
        const res = await fetch(
            `https://api.mercadopago.com/v1/payment_methods/installments?bin=${bin}&amount=${amount}`,
            { headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` } }
        );

        if (!res.ok) return NextResponse.json({ installments: [], paymentMethodId: '', issuerId: '' });

        const data = await res.json();
        const first = Array.isArray(data) ? data[0] : null;

        return NextResponse.json({
            installments:    first?.payer_costs   ?? [],
            paymentMethodId: first?.id            ?? '',
            issuerId:        String(first?.issuer?.id ?? ''),
        });
    } catch {
        return NextResponse.json({ installments: [], paymentMethodId: '', issuerId: '' });
    }
}
