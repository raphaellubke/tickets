'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import Link from 'next/link';
import styles from './page.module.css';

function CheckoutSuccessPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const supabase = createClient();
    const { user } = useAuth();

    const orderId = searchParams.get('order_id');

    const [order, setOrder] = useState<any>(null);
    const [tickets, setTickets] = useState<any[]>([]);
    const [pendingForms, setPendingForms] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasPendingForms, setHasPendingForms] = useState(false);

    useEffect(() => {
        async function loadOrderData() {
            if (!orderId) {
                setError('ID do pedido não encontrado');
                setLoading(false);
                return;
            }

            try {
                // Load order
                const { data: orderData, error: orderError } = await supabase
                    .from('orders')
                    .select(`
                        *,
                        events(name, title, event_date, location)
                    `)
                    .eq('id', orderId)
                    .single();

                if (orderError || !orderData) {
                    setError('Pedido não encontrado');
                    setLoading(false);
                    return;
                }

                setOrder(orderData);

                // Load tickets
                const { data: ticketsData } = await supabase
                    .from('tickets')
                    .select(`*, event_ticket_types(name)`)
                    .eq('order_id', orderId)
                    .order('created_at', { ascending: true });

                const ticketsList = ticketsData || [];
                setTickets(ticketsList);

                // Check for pending forms
                let pendingFormsList: any[] = [];
                if (ticketsList.length > 0) {
                    const ticketIds = ticketsList.map(t => t.id);
                    const { data: formResponses } = await supabase
                        .from('form_responses')
                        .select('id, ticket_id, status')
                        .in('ticket_id', ticketIds)
                        .eq('status', 'pending');

                    if (formResponses && formResponses.length > 0) {
                        pendingFormsList = formResponses;
                        setPendingForms(formResponses);
                        setHasPendingForms(true);
                    }
                }
            } catch (err: any) {
                console.error('Error loading order data:', err);
                setError(err.message || 'Erro ao carregar dados do pedido');
            } finally {
                setLoading(false);
            }
        }

        loadOrderData();
    }, [orderId]);

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(price);
    };

    if (loading) {
        return (
            <main className={styles.main}>
                <Header />
                <div className={styles.loadingContainer}>
                    <div className={styles.spinner}></div>
                    <p>Carregando...</p>
                </div>
                <Footer />
            </main>
        );
    }

    if (error || !order) {
        return (
            <main className={styles.main}>
                <Header />
                <div className={styles.errorContainer}>
                    <h2>Erro</h2>
                    <p>{error || 'Pedido não encontrado'}</p>
                    <Link href="/" className={styles.backButton}>
                        Voltar ao início
                    </Link>
                </div>
                <Footer />
            </main>
        );
    }

    return (
        <main className={styles.main}>
            <Header />

            <div className={styles.container}>
                <div className={styles.successCard}>
                    <div className={styles.successIcon}>
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                            <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                    </div>

                    <h1 className={styles.title}>Compra realizada com sucesso!</h1>
                    <p className={styles.subtitle}>
                        Seu pedido foi processado e seus ingressos foram gerados.
                    </p>

                    <div className={styles.orderInfo}>
                        <div className={styles.infoRow}>
                            <span className={styles.infoLabel}>Número do Pedido:</span>
                            <span className={styles.infoValue}>{order.order_number}</span>
                        </div>
                        <div className={styles.infoRow}>
                            <span className={styles.infoLabel}>Valor Total:</span>
                            <span className={styles.infoValue}>{formatPrice(parseFloat(order.total_amount?.toString() || '0'))}</span>
                        </div>
                        {order.events && (
                            <div className={styles.infoRow}>
                                <span className={styles.infoLabel}>Evento:</span>
                                <span className={styles.infoValue}>{order.events.name || order.events.title}</span>
                            </div>
                        )}
                    </div>

                    {tickets.length > 0 && (
                        <div className={styles.ticketsSection}>
                            <h2 className={styles.ticketsTitle}>Seus Ingressos</h2>
                            <div className={styles.ticketsList}>
                                {tickets.map((ticket) => {
                                    const hasPendingForm = pendingForms.some(f => f.ticket_id === ticket.id);
                                    return (
                                        <div key={ticket.id} className={styles.ticketCard}>
                                            <div className={styles.ticketHeader}>
                                                <div>
                                                    <div className={styles.ticketCode}>{ticket.ticket_code}</div>
                                                    <div className={styles.ticketType}>
                                                        {ticket.event_ticket_types?.name || 'Ingresso'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={styles.ticketStatus}>
                                                <span className={styles.statusBadge}>Ativo</span>
                                                {hasPendingForm && (
                                                    <Link 
                                                        href={`/form/${ticket.id}`}
                                                        className={styles.formLink}
                                                    >
                                                        Preencher Formulário
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {pendingForms.length > 0 && (
                        <div className={styles.formsAlert}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="16" x2="12" y2="12"/>
                                <line x1="12" y1="8" x2="12.01" y2="8"/>
                            </svg>
                            <div>
                                <strong>Formulários Pendentes</strong>
                                <p>Você tem {pendingForms.length} formulário{pendingForms.length > 1 ? 's' : ''} para preencher. Clique nos links acima para preencher.</p>
                            </div>
                        </div>
                    )}

                    {tickets.length > 0 && (
                        pendingForms.length > 0 ? (
                            <div style={{
                                background: '#fff7ed', border: '1px solid #fed7aa',
                                borderRadius: 10, padding: '1rem 1.25rem', margin: '1.5rem 0', textAlign: 'center'
                            }}>
                                <p style={{ margin: '0 0 12px', fontSize: 13, color: '#9a3412', lineHeight: 1.5, fontWeight: 600 }}>
                                    Você precisa preencher o formulário do evento!
                                </p>
                                <Link
                                    href={`/form/${pendingForms[0].ticket_id}`}
                                    style={{
                                        display: 'inline-block', background: '#ea580c', color: 'white',
                                        padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                                        textDecoration: 'none'
                                    }}
                                >
                                    Preencher formulário agora →
                                </Link>
                            </div>
                        ) : (
                            <div style={{
                                background: '#f0fdf4', border: '1px solid #bbf7d0',
                                borderRadius: 10, padding: '1rem 1.25rem', margin: '1.5rem 0', textAlign: 'center'
                            }}>
                                <p style={{ margin: 0, fontSize: 13, color: '#166534', lineHeight: 1.5 }}>
                                    ✅ Formulário já preenchido. Tudo certo!
                                </p>
                            </div>
                        )
                    )}

                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        background: '#f9fafb', border: '1px solid #e5e7eb',
                        borderRadius: 12, padding: '1rem 1.25rem', margin: '1.5rem 0',
                    }}>
                        <span style={{ fontSize: 22, flexShrink: 0 }}>📞</span>
                        <div>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111827' }}>Dúvidas ou problemas?</p>
                            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>
                                Entre em contato com <strong>Patrícia Ferraz</strong>:{' '}
                                <a href="tel:+5517991665571" style={{ color: '#111827', fontWeight: 600 }}>(17) 99166-5571</a>
                            </p>
                        </div>
                    </div>

                    <div className={styles.actions}>
                        <Link href="/" className={styles.primaryButton}>
                            Voltar ao Início
                        </Link>
                        <Link href="/meus-ingressos" className={styles.secondaryButton}>
                            Ver Meus Ingressos
                        </Link>
                    </div>

                    <div className={styles.disclaimer}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="16" x2="12" y2="12"/>
                            <line x1="12" y1="8" x2="12.01" y2="8"/>
                        </svg>
                        Um e-mail de confirmação foi enviado para {order.participant_email}
                    </div>
                </div>
            </div>

            <Footer />
        </main>
    );
}

export default function CheckoutSuccessPage() {
    return (
        <Suspense fallback={
            <main className={styles.main}>
                <Header />
                <div className={styles.loadingContainer}>
                    <div className={styles.spinner}></div>
                    <p>Carregando...</p>
                </div>
                <Footer />
            </main>
        }>
            <CheckoutSuccessPageContent />
        </Suspense>
    );
}

