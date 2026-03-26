'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

interface Ticket {
    id: string;
    ticket_code: string;
    order_id: string;
    event_id: string;
    ticket_type_id: string;
    status: string;
    price: number;
    created_at: string;
    events: {
        name: string;
        event_date: string;
        location: string;
    } | null;
    event_ticket_types: {
        name: string;
    } | null;
    orders: {
        order_number: string;
    } | null;
}

export default function ProfilePage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const supabase = createClient();
    
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [ticketsLoading, setTicketsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/');
            return;
        }

        if (user) {
            loadUserData();
            loadTickets();
        }
    }, [user, authLoading, router]);

    async function loadUserData() {
        if (!user) return;

        try {
            setLoading(true);
            const { data: { user: userData } } = await supabase.auth.getUser();
            
            if (userData) {
                setEmail(userData.email || '');
                setFullName(userData.user_metadata?.full_name || '');
                setPhone(userData.user_metadata?.phone || '');
            }
        } catch (err) {
            console.error('Error loading user data:', err);
            setError('Erro ao carregar dados do usuário');
        } finally {
            setLoading(false);
        }
    }

    async function loadTickets() {
        if (!user) return;

        try {
            setTicketsLoading(true);
            
            // Buscar pedidos do usuário
            const { data: ordersData, error: ordersError } = await supabase
                .from('orders')
                .select('id')
                .eq('user_id', user.id);

            if (ordersError) {
                console.error('Error fetching orders:', ordersError);
                setTickets([]);
                setTicketsLoading(false);
                return;
            }

            if (!ordersData || ordersData.length === 0) {
                setTickets([]);
                setTicketsLoading(false);
                return;
            }

            const orderIds = ordersData.map(o => o.id);

            // Buscar tickets dos pedidos
            const { data: ticketsData, error: ticketsError } = await supabase
                .from('tickets')
                .select('*')
                .in('order_id', orderIds)
                .order('created_at', { ascending: false });

            if (ticketsError) {
                console.error('Error fetching tickets:', ticketsError);
                setTickets([]);
                setTicketsLoading(false);
                return;
            }

            if (!ticketsData || ticketsData.length === 0) {
                setTickets([]);
                setTicketsLoading(false);
                return;
            }

            // Buscar dados relacionados
            const ticketsWithDetails = await Promise.all(
                ticketsData.map(async (ticket) => {
                    let event = null;
                    try {
                        const { data: eventData } = await supabase
                            .from('events')
                            .select('name, event_date, location')
                            .eq('id', ticket.event_id)
                            .single();
                        event = eventData;
                    } catch (err) {
                        console.error(`Error fetching event for ticket ${ticket.id}:`, err);
                    }

                    let ticketType = null;
                    if (ticket.ticket_type_id) {
                        try {
                            const { data: ticketTypeData } = await supabase
                                .from('event_ticket_types')
                                .select('name')
                                .eq('id', ticket.ticket_type_id)
                                .single();
                            ticketType = ticketTypeData;
                        } catch (err) {
                            console.error(`Error fetching ticket type for ticket ${ticket.id}:`, err);
                        }
                    }

                    let order = null;
                    if (ticket.order_id) {
                        try {
                            const { data: orderData } = await supabase
                                .from('orders')
                                .select('order_number')
                                .eq('id', ticket.order_id)
                                .single();
                            order = orderData;
                        } catch (err) {
                            console.error(`Error fetching order for ticket ${ticket.id}:`, err);
                        }
                    }

                    return {
                        ...ticket,
                        events: event,
                        event_ticket_types: ticketType,
                        orders: order,
                    };
                })
            );

            setTickets(ticketsWithDetails);
        } catch (err) {
            console.error('Error loading tickets:', err);
        } finally {
            setTicketsLoading(false);
        }
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        if (!user) return;

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const { error } = await supabase.auth.updateUser({
                data: {
                    full_name: fullName,
                    phone: phone,
                },
            });

            if (error) {
                setError(error.message);
            } else {
                setSuccess('Dados atualizados com sucesso!');
                setTimeout(() => setSuccess(null), 3000);
            }
        } catch (err) {
            setError('Erro ao atualizar dados');
        } finally {
            setSaving(false);
        }
    }

    const getStatusLabel = (status: string) => {
        const statusMap: Record<string, string> = {
            active: 'Ativo',
            used: 'Utilizado',
            cancelled: 'Cancelado',
            refunded: 'Reembolsado',
        };
        return statusMap[status] || status;
    };

    const getStatusClass = (status: string) => {
        const statusMap: Record<string, string> = {
            active: styles.statusActive,
            used: styles.statusUsed,
            cancelled: styles.statusCancelled,
            refunded: styles.statusRefunded,
        };
        return statusMap[status] || styles.statusDefault;
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(price);
    };

    if (authLoading || loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>Carregando...</div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Meu Perfil</h1>
                    <p className={styles.subtitle}>Gerencie suas informações e visualize seus ingressos</p>
                </div>

                <div className={styles.sections}>
                    {/* Seção de Dados Pessoais */}
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Dados Pessoais</h2>
                        <form onSubmit={handleSave} className={styles.form}>
                            {error && <div className={styles.error}>{error}</div>}
                            {success && <div className={styles.success}>{success}</div>}

                            <div className={styles.formGroup}>
                                <label htmlFor="fullName" className={styles.label}>Nome Completo</label>
                                <input
                                    id="fullName"
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className={styles.input}
                                    placeholder="Seu nome completo"
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="email" className={styles.label}>Email</label>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    disabled
                                    className={`${styles.input} ${styles.inputDisabled}`}
                                />
                                <p className={styles.helpText}>O email não pode ser alterado</p>
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="phone" className={styles.label}>Telefone</label>
                                <input
                                    id="phone"
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className={styles.input}
                                    placeholder="(00) 00000-0000"
                                />
                            </div>

                            <button type="submit" className={styles.saveButton} disabled={saving}>
                                {saving ? 'Salvando...' : 'Salvar Alterações'}
                            </button>
                        </form>
                    </section>

                    {/* Seção de Ingressos */}
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Meus Ingressos</h2>
                        
                        {ticketsLoading ? (
                            <div className={styles.loading}>Carregando ingressos...</div>
                        ) : tickets.length === 0 ? (
                            <div className={styles.emptyState}>
                                <p>Você ainda não possui ingressos comprados.</p>
                                <Link href="/" className={styles.browseButton}>
                                    Explorar Eventos
                                </Link>
                            </div>
                        ) : (
                            <div className={styles.ticketsList}>
                                {tickets.map((ticket) => (
                                    <div key={ticket.id} className={styles.ticketCard}>
                                        <div className={styles.ticketHeader}>
                                            <div>
                                                <h3 className={styles.ticketEventName}>
                                                    {ticket.events?.name || 'Evento não encontrado'}
                                                </h3>
                                                <p className={styles.ticketType}>
                                                    {ticket.event_ticket_types?.name || 'Tipo não especificado'}
                                                </p>
                                            </div>
                                            <span className={`${styles.statusBadge} ${getStatusClass(ticket.status)}`}>
                                                {getStatusLabel(ticket.status)}
                                            </span>
                                        </div>
                                        
                                        <div className={styles.ticketDetails}>
                                            <div className={styles.ticketDetail}>
                                                <span className={styles.detailLabel}>Código:</span>
                                                <span className={styles.detailValue}>{ticket.ticket_code}</span>
                                            </div>
                                            {ticket.orders?.order_number && (
                                                <div className={styles.ticketDetail}>
                                                    <span className={styles.detailLabel}>Pedido:</span>
                                                    <span className={styles.detailValue}>{ticket.orders.order_number}</span>
                                                </div>
                                            )}
                                            {ticket.events?.event_date && (
                                                <div className={styles.ticketDetail}>
                                                    <span className={styles.detailLabel}>Data do Evento:</span>
                                                    <span className={styles.detailValue}>
                                                        {formatDate(ticket.events.event_date)}
                                                    </span>
                                                </div>
                                            )}
                                            {ticket.events?.location && (
                                                <div className={styles.ticketDetail}>
                                                    <span className={styles.detailLabel}>Local:</span>
                                                    <span className={styles.detailValue}>{ticket.events.location}</span>
                                                </div>
                                            )}
                                            <div className={styles.ticketDetail}>
                                                <span className={styles.detailLabel}>Valor:</span>
                                                <span className={styles.detailValue}>{formatPrice(ticket.price)}</span>
                                            </div>
                                        </div>

                                        <div className={styles.ticketFooter}>
                                            <Link 
                                                href={`/event/${ticket.event_id}`}
                                                className={styles.viewEventButton}
                                            >
                                                Ver Evento
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}


