import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('payment_id');

    if (!paymentId) {
        return NextResponse.json({ error: 'payment_id required' }, { status: 400 });
    }

    try {
        const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: {
                'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
                'Cache-Control': 'no-cache',
            },
            cache: 'no-store',
        });

        const data = await response.json();

        return NextResponse.json({
            status: data.status,
            statusDetail: data.status_detail,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
