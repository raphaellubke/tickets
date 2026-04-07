/**
 * Script de recuperação: para cada pedido confirmado como pago no MP,
 * chama o webhook interno para criar os ingressos e enviar o email.
 *
 * Pré-requisitos:
 *   1. Rodou check_mp_payments.js e tem os external_reference aprovados
 *   2. Atualizou orders e payments via SQL (payment_status = 'paid')
 *   3. Tem a URL do app rodando (local ou produção)
 *
 * Uso:
 *   BASE_URL=https://seu-app.vercel.app WEBHOOK_SECRET=xxx node scripts/recover_tickets.js
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

// Lista dos order_numbers confirmados como pagos no MP
// Preencha com a saída do check_mp_payments.js
const CONFIRMED_PAID_ORDER_NUMBERS = [
    // ex: 'ORD-1775302797548-UORISLN8K',
];

if (CONFIRMED_PAID_ORDER_NUMBERS.length === 0) {
    console.log('Nenhum pedido informado. Edite CONFIRMED_PAID_ORDER_NUMBERS no arquivo.');
    process.exit(0);
}

async function getOrderId(orderNumber) {
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/orders?order_number=eq.${orderNumber}&select=id,payment_status`,
        {
            headers: {
                apikey: SERVICE_ROLE_KEY,
                Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            },
        }
    );
    const rows = await res.json();
    return rows[0] || null;
}

async function recoverOrder(orderNumber) {
    // 1. Busca o order_id
    const order = await getOrderId(orderNumber);
    if (!order) {
        console.log(`❌ Pedido não encontrado: ${orderNumber}`);
        return;
    }

    if (order.payment_status !== 'paid') {
        console.log(`⚠️  ${orderNumber} ainda está como '${order.payment_status}'. Rode o SQL de atualização primeiro.`);
        return;
    }

    // 2. Chama o webhook interno para processar (cria tickets + form responses + email)
    const res = await fetch(`${BASE_URL}/api/webhooks/payment`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(WEBHOOK_SECRET ? { 'x-webhook-secret': WEBHOOK_SECRET } : {}),
        },
        body: JSON.stringify({
            payment_id: order.id,   // nosso payment UUID — o webhook aceita order_id também
            status: 'paid',
        }),
    });

    const result = await res.json();
    if (res.ok && result.success) {
        console.log(`✅ Recuperado: ${orderNumber} (order_id: ${order.id})`);
    } else {
        console.log(`❌ Falha ao recuperar ${orderNumber}:`, result);
    }
}

async function main() {
    console.log(`Recuperando ${CONFIRMED_PAID_ORDER_NUMBERS.length} pedido(s)...\n`);
    for (const num of CONFIRMED_PAID_ORDER_NUMBERS) {
        await recoverOrder(num);
        await new Promise(r => setTimeout(r, 1000));
    }
    console.log('\nConcluído.');
}

main().catch(console.error);
