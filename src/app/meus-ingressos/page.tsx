'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export default function MeusIngressosPage() {
    const { user, signOut } = useAuth();
    const router = useRouter();
    const supabase = createClient();

    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        async function load() {
            try {
                // Busca pedidos pelo e-mail do usuário
                const { data: orders } = await supabase
                    .from('orders')
                    .select('id, order_number, total_amount, payment_status, payment_method, created_at, events(name, event_date, location)')
                    .eq('participant_email', user!.email!)
                    .order('created_at', { ascending: false });

                if (!orders?.length) { setLoading(false); return; }

                // Busca ingressos de cada pedido
                const orderIds = orders.map((o: any) => o.id);
                const { data: ticketRows } = await supabase
                    .from('tickets')
                    .select('id, ticket_code, status, order_id, event_ticket_types(name)')
                    .in('order_id', orderIds);

                // Busca form_responses para saber se tem formulário pendente
                const ticketIds = (ticketRows || []).map((t: any) => t.id);
                const { data: formResponses } = ticketIds.length
                    ? await supabase
                        .from('form_responses')
                        .select('ticket_id, status')
                        .in('ticket_id', ticketIds)
                    : { data: [] };

                // Agrupa ingressos por pedido
                const enriched = orders.map((order: any) => ({
                    ...order,
                    tickets: (ticketRows || [])
                        .filter((t: any) => t.order_id === order.id)
                        .map((t: any) => ({
                            ...t,
                            formStatus: (formResponses || []).find((f: any) => f.ticket_id === t.id)?.status ?? null,
                        })),
                }));

                setTickets(enriched);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [user]);

    const fmt = (v: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    const paymentLabel: Record<string, string> = {
        pix: 'PIX', card: 'Cartão', credit_card: 'Cartão', boleto: 'Boleto',
    };

    const statusCfg: Record<string, { label: string; bg: string; color: string }> = {
        paid:      { label: 'Pago',      bg: '#dcfce7', color: '#166534' },
        pending:   { label: 'Pendente',  bg: '#fef9c3', color: '#854d0e' },
        cancelled: { label: 'Cancelado', bg: '#fee2e2', color: '#991b1b' },
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
                <p style={{ color: '#6b7280', fontSize: 14 }}>Carregando seus ingressos...</p>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'Inter, sans-serif' }}>
            {/* Header */}
            <header style={{
                background: '#fff', borderBottom: '1px solid #e5e7eb',
                padding: '0 24px', height: 60,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2">
                        <path d="M3 11v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V11a2 2 0 0 0-2-2 2 2 0 0 1 0-4 2 2 0 0 0 2-2V3a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2a2 2 0 0 1 0 4 2 2 0 0 0-2 2z" />
                    </svg>
                    <span style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>Meus Ingressos</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>{user?.email}</span>
                    <button
                        onClick={() => signOut()}
                        style={{
                            fontSize: 13, color: '#6b7280', background: 'none',
                            border: '1px solid #e5e7eb', borderRadius: 8,
                            padding: '6px 12px', cursor: 'pointer',
                        }}
                    >
                        Sair
                    </button>
                </div>
            </header>

            {/* Content */}
            <main style={{ maxWidth: 680, margin: '0 auto', padding: '32px 16px' }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
                    Seus Ingressos
                </h1>
                <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 28 }}>
                    Acompanhe suas compras e preencha os formulários pendentes.
                </p>

                {tickets.length === 0 ? (
                    <div style={{
                        background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16,
                        padding: '48px 24px', textAlign: 'center',
                    }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" style={{ margin: '0 auto 16px' }}>
                            <path d="M3 11v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V11a2 2 0 0 0-2-2 2 2 0 0 1 0-4 2 2 0 0 0 2-2V3a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2a2 2 0 0 1 0 4 2 2 0 0 0-2 2z" />
                        </svg>
                        <p style={{ color: '#9ca3af', fontSize: 15 }}>Nenhum ingresso encontrado para este e-mail.</p>
                        <Link href="/" style={{ display: 'inline-block', marginTop: 16, fontSize: 14, color: '#6366f1', fontWeight: 600 }}>
                            Ver eventos disponíveis
                        </Link>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {tickets.map((order: any) => {
                            const st = statusCfg[order.payment_status] || { label: order.payment_status, bg: '#f3f4f6', color: '#6b7280' };
                            const eventDate = order.events?.event_date
                                ? new Date(order.events.event_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
                                : null;
                            return (
                                <div key={order.id} style={{
                                    background: '#fff', border: '1px solid #e5e7eb',
                                    borderRadius: 16, overflow: 'hidden',
                                    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                                }}>
                                    {/* Order header */}
                                    <div style={{ padding: '18px 20px', borderBottom: '1px solid #f3f4f6' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                                            <div>
                                                <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace', marginBottom: 4 }}>
                                                    #{order.order_number}
                                                </div>
                                                <div style={{ fontSize: 17, fontWeight: 700, color: '#111827' }}>
                                                    {order.events?.name || 'Evento'}
                                                </div>
                                                {eventDate && (
                                                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 3 }}>{eventDate}</div>
                                                )}
                                                {order.events?.location && (
                                                    <div style={{ fontSize: 13, color: '#6b7280' }}>{order.events.location}</div>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                                                <span style={{
                                                    fontSize: 11, fontWeight: 700, padding: '3px 10px',
                                                    borderRadius: 20, background: st.bg, color: st.color,
                                                }}>
                                                    {st.label}
                                                </span>
                                                <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
                                                    {fmt(parseFloat(order.total_amount))}
                                                </span>
                                                {order.payment_method && (
                                                    <span style={{ fontSize: 12, color: '#9ca3af' }}>
                                                        {paymentLabel[order.payment_method] || order.payment_method}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tickets */}
                                    {order.tickets.length > 0 && (
                                        <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            {order.tickets.map((ticket: any) => {
                                                const hasPendingForm = ticket.formStatus === 'pending';
                                                const hasCompletedForm = ticket.formStatus === 'completed';
                                                return (
                                                    <div key={ticket.id} style={{
                                                        display: 'flex', alignItems: 'center',
                                                        justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
                                                        background: '#f9fafb', borderRadius: 10, padding: '12px 14px',
                                                    }}>
                                                        <div>
                                                            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                                                                {ticket.event_ticket_types?.name || 'Ingresso'}
                                                            </div>
                                                            <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace', marginTop: 2 }}>
                                                                {ticket.ticket_code}
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            {hasPendingForm && (
                                                                <Link
                                                                    href={`/form/${ticket.id}`}
                                                                    style={{
                                                                        fontSize: 12, fontWeight: 700,
                                                                        background: '#111827', color: '#fff',
                                                                        padding: '6px 14px', borderRadius: 8,
                                                                        textDecoration: 'none',
                                                                    }}
                                                                >
                                                                    Preencher Ficha
                                                                </Link>
                                                            )}
                                                            {hasCompletedForm && (
                                                                <span style={{
                                                                    fontSize: 11, fontWeight: 700,
                                                                    background: '#dcfce7', color: '#166534',
                                                                    padding: '4px 10px', borderRadius: 20,
                                                                }}>
                                                                    ✓ Ficha enviada
                                                                </span>
                                                            )}
                                                            <span style={{
                                                                fontSize: 11, fontWeight: 600,
                                                                background: ticket.status === 'active' ? '#eff6ff' : '#f3f4f6',
                                                                color: ticket.status === 'active' ? '#1d4ed8' : '#6b7280',
                                                                padding: '4px 10px', borderRadius: 20,
                                                            }}>
                                                                {ticket.status === 'active' ? 'Ativo' : ticket.status}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Contact */}
                <div style={{
                    marginTop: 32, padding: '14px 18px',
                    background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
                    fontSize: 13, color: '#6b7280', textAlign: 'center',
                }}>
                    <strong style={{ color: '#111827' }}>📞 Dúvidas ou problemas?</strong>
                    {' '}Entre em contato com <strong>Patrícia Ferraz</strong>:{' '}
                    <a href="tel:+5517991665571" style={{ color: '#111827', fontWeight: 600 }}>
                        (17) 99166-5571
                    </a>
                </div>
            </main>
        </div>
    );
}
