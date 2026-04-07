/**
 * Script de verificação: consulta o Mercado Pago para cada payment_provider_id
 * e exibe o status real de cada pagamento cancelado incorretamente.
 *
 * Uso:
 *   MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxx node scripts/check_mp_payments.js
 */

const ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
if (!ACCESS_TOKEN) {
    console.error('Erro: defina a variável MERCADOPAGO_ACCESS_TOKEN');
    process.exit(1);
}

// Pedidos cancelados que tinham um ID de pagamento no MP
// Formato: { orderNumber, participantName, email, mpPaymentId, orderTotal }
const suspects = [
    { orderNumber: 'ORD-1775302797548-UORISLN8K', name: 'Nildo Ferreira Braga',    email: 'braganildo16@gmail.com',       mpId: '152471432625', total: null },
    { orderNumber: null,                           name: 'Ana Lúcia',                email: null,                           mpId: '153208884576', total: null },
    { orderNumber: 'ORD-..PEUSYZ6JN',             name: 'Gisele Cortez',            email: null,                           mpId: '152470834511', total: null },
    { orderNumber: 'ORD-..593ZZA7RI',             name: 'Camila',                   email: null,                           mpId: '152470325217', total: null },
    { orderNumber: 'ORD-..5FRNWLVNT',             name: 'Gisele Cortez (2)',        email: null,                           mpId: '153211970468', total: null },
    { orderNumber: 'ORD-..JEE7VPJL5',             name: 'Giovanna',                 email: null,                           mpId: '152470858951', total: null },
    { orderNumber: 'ORD-..3Y25E9GDN',             name: 'Carla Beatriz',            email: null,                           mpId: '152472347127', total: null },
    { orderNumber: null,                           name: 'Ricardo',                  email: null,                           mpId: '153214053474', total: null },
    { orderNumber: 'ORD-..7TV5U3S0D',             name: 'DAIANE',                   email: null,                           mpId: '153214977322', total: null },
    { orderNumber: null,                           name: 'Sandra',                   email: null,                           mpId: '152476106321', total: null },
    { orderNumber: 'ORD-..OKIMCY2A8',             name: 'Mônica',                   email: null,                           mpId: '152474997405', total: null },
    { orderNumber: 'ORD-..6CG0N86V8',             name: 'Carla Beatriz (2)',        email: null,                           mpId: '152493251523', total: null },
    { orderNumber: null,                           name: 'Rosane',                   email: null,                           mpId: '152547481491', total: null },
    { orderNumber: null,                           name: 'Gisleine',                 email: null,                           mpId: '152633372279', total: null },
    { orderNumber: 'ORD-..RCLGETICJ',             name: 'Ivana',                    email: null,                           mpId: '153375187290', total: null },
];

async function checkPayment(mpId) {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${mpId}`, {
        headers: {
            Authorization: `Bearer ${ACCESS_TOKEN}`,
            'Cache-Control': 'no-cache',
        },
    });
    if (!res.ok) {
        return { error: `HTTP ${res.status}`, raw: await res.text() };
    }
    const data = await res.json();
    return {
        id: data.id,
        status: data.status,           // approved | pending | rejected | cancelled | refunded
        statusDetail: data.status_detail,
        externalRef: data.external_reference,
        amount: data.transaction_amount,
        paidAt: data.date_approved,
        payerEmail: data.payer?.email,
    };
}

async function main() {
    console.log('Consultando Mercado Pago para cada pagamento suspeito...\n');
    console.log('='.repeat(90));

    const approved = [];
    const notApproved = [];

    for (const suspect of suspects) {
        try {
            const result = await checkPayment(suspect.mpId);
            const status = result.status || 'ERROR';
            const marker = status === 'approved' ? '✅ PAGO' : `❌ ${status.toUpperCase()}`;

            console.log(`${marker} | MP ${suspect.mpId} | ${suspect.name}`);
            if (result.error) {
                console.log(`         Erro: ${result.error} — ${result.raw}`);
            } else {
                console.log(`         Status detail: ${result.statusDetail}`);
                console.log(`         external_reference: ${result.externalRef}`);
                console.log(`         Valor: R$ ${result.amount}`);
                console.log(`         Aprovado em: ${result.paidAt}`);
                console.log(`         Pagador (MP): ${result.payerEmail}`);
            }
            console.log();

            if (status === 'approved') {
                approved.push({ ...suspect, mpResult: result });
            } else {
                notApproved.push({ ...suspect, mpResult: result });
            }
        } catch (err) {
            console.log(`ERRO ao consultar MP ${suspect.mpId}: ${err.message}\n`);
        }

        // Rate limit: 1 req/s
        await new Promise(r => setTimeout(r, 500));
    }

    console.log('='.repeat(90));
    console.log(`\nRESUMO: ${approved.length} aprovados no MP | ${notApproved.length} não aprovados\n`);

    if (approved.length > 0) {
        console.log('--- PEDIDOS QUE PRECISAM SER RECUPERADOS ---');
        console.log('Cole os external_reference abaixo no SQL de recuperação:\n');
        for (const a of approved) {
            console.log(`  '${a.mpResult.externalRef}',  -- ${a.name} | MP ${a.mpId} | R$ ${a.mpResult.amount}`);
        }
        console.log();

        console.log('--- SQL DE RECUPERAÇÃO (execute no Supabase SQL Editor) ---\n');
        const refs = approved.map(a => `'${a.mpResult.externalRef}'`).join(',\n    ');
        console.log(`-- 1. Identifica os order IDs a recuperar
SELECT id, order_number, participant_name, participant_email, payment_status
FROM orders
WHERE order_number IN (
    ${refs}
);

-- 2. Marca como pago (rode só após confirmar a query acima)
UPDATE orders
SET
    payment_status = 'paid',
    paid_at        = NOW(),
    updated_at     = NOW()
WHERE order_number IN (
    ${refs}
)
AND payment_status = 'cancelled';

-- 3. Atualiza o registro de pagamento
UPDATE payments p
SET
    status     = 'paid',
    paid_at    = NOW(),
    updated_at = NOW()
FROM orders o
WHERE p.order_id = o.id
  AND o.order_number IN (
    ${refs}
  )
  AND p.status != 'paid';
`);

        console.log('⚠️  ATENÇÃO: após rodar o SQL, os ingressos NÃO são criados automaticamente.');
        console.log('   Você precisa chamar o endpoint de processamento para cada pedido, ou');
        console.log('   criar os tickets manualmente. Veja o arquivo recover_tickets.js para isso.');
    }
}

main().catch(console.error);
