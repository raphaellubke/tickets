'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import DropdownMenu from '@/components/DropdownMenu/DropdownMenu';
import styles from './page.module.css';

interface Ticket {
    id: string;
    ticket_code?: string;
    order_id?: string;
    event_id: string;
    ticket_type_id?: string;
    status: string;
    created_at: string;
    // Legacy fields
    customer_name?: string;
    customer_email?: string;
    type?: string;
    // Related data
    events?: {
        name: string;
    } | null;
    event_ticket_types?: {
        name: string;
    } | null;
    orders?: {
        participant_name: string;
        participant_email: string;
        order_number: string;
    } | null;
}

export default function TicketsPage() {
    const { user } = useAuth();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEvent, setSelectedEvent] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [events, setEvents] = useState<any[]>([]);
    const supabase = createClient();

    // Function to update tickets state (needed for dropdown)
    const updateTicketStatus = (ticketId: string, newStatus: string) => {
        setTickets(tickets.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));
    };

    useEffect(() => {
        async function fetchData() {
            if (!user) return;

            try {
                // Get user's organization
                const { data: members } = await supabase
                    .from('organization_members')
                    .select('organization_id')
                    .eq('user_id', user.id)
                    .limit(1);
                const memberData = members?.[0];

                if (!memberData) {
                    setLoading(false);
                    return;
                }

                // Fetch events for filter
                const { data: eventsData } = await supabase
                    .from('events')
                    .select('id, name')
                    .eq('organization_id', memberData.organization_id);

                setEvents(eventsData || []);

                // Fetch tickets with event, ticket type, and order info
                // Only tickets from events of the user's organization
                // First get events from organization
                const { data: orgEvents } = await supabase
                    .from('events')
                    .select('id')
                    .eq('organization_id', memberData.organization_id);

                if (!orgEvents || orgEvents.length === 0) {
                    setTickets([]);
                    setLoading(false);
                    return;
                }

                const eventIds = orgEvents.map(e => e.id);

                // Fetch tickets from those events
                // Try to fetch with joins first, fallback to separate queries
                let ticketsData: any[] = [];
                let ticketsError: any = null;

                // First, try to fetch with joins (if tables exist)
                let ticketsWithJoins: any[] = [];
                let joinError: any = null;

                try {
                    const result = await supabase
                        .from('tickets')
                        .select(`
                            *,
                            events:event_id(name),
                            event_ticket_types:ticket_type_id(name),
                            orders:order_id(participant_name, participant_email, order_number, event_id, user_id)
                        `)
                        .in('event_id', eventIds)
                        .order('created_at', { ascending: false });

                    ticketsWithJoins = result.data || [];
                    joinError = result.error;
                } catch (err) {
                    console.log('Join query failed, using fallback:', err);
                    joinError = err;
                }

                if (!joinError && ticketsWithJoins && ticketsWithJoins.length > 0) {
                    // Successfully fetched with joins
                    ticketsData = ticketsWithJoins.map((ticket: any) => ({
                        ...ticket,
                        events: ticket.events ? { name: ticket.events.name || ticket.events.title } : null,
                        event_ticket_types: ticket.event_ticket_types || null,
                        orders: ticket.orders || null
                    }));
                } else {
                    // Fallback: fetch tickets separately
                    const { data: ticketsOnly, error: ticketsOnlyError } = await supabase
                        .from('tickets')
                        .select('*')
                        .in('event_id', eventIds)
                        .order('created_at', { ascending: false });

                    if (ticketsOnlyError) {
                        console.error('Error fetching tickets:', ticketsOnlyError);
                        ticketsError = ticketsOnlyError;
                    } else {
                        ticketsData = ticketsOnly || [];
                    }
                }

                if (ticketsError) {
                    console.error('Error fetching tickets:', ticketsError);
                    setTickets([]);
                    setLoading(false);
                    return;
                }

                if (!ticketsData || ticketsData.length === 0) {
                    setTickets([]);
                    setLoading(false);
                    return;
                }

                // If we didn't get joins, fetch related data separately
                const ticketsWithDetails = await Promise.all(
                    ticketsData.map(async (ticket) => {
                        // If already has joined data, return as is
                        if (ticket.events || ticket.event_ticket_types || ticket.orders) {
                            return ticket;
                        }

                        // Fetch event
                        let event = null;
                        if (ticket.event_id) {
                            try {
                                const { data: eventData } = await supabase
                                    .from('events')
                                    .select('name')
                                    .eq('id', ticket.event_id)
                                    .single();
                                event = eventData;
                            } catch (err) {
                                console.error('Error fetching event for ticket:', ticket.id, err);
                            }
                        }

                        // Fetch ticket type
                        let ticketType = null;
                        if (ticket.ticket_type_id) {
                            try {
                                const { data: typeData } = await supabase
                                    .from('event_ticket_types')
                                    .select('name')
                                    .eq('id', ticket.ticket_type_id)
                                    .single();
                                ticketType = typeData;
                            } catch (err) {
                                console.error('Error fetching ticket type for ticket:', ticket.id, err);
                            }
                        }

                        // Fetch order if exists
                        let order = null;
                        if (ticket.order_id) {
                            try {
                                const { data: orderData } = await supabase
                                    .from('orders')
                                    .select('participant_name, participant_email, order_number, event_id, user_id')
                                    .eq('id', ticket.order_id)
                                    .single();
                                order = orderData;
                            } catch (err) {
                                console.error('Error fetching order for ticket:', ticket.id, err);
                            }
                        }

                        // Handle legacy structure (customer_name, customer_email, type)
                        if (!order && (ticket.customer_name || ticket.customer_email)) {
                            order = {
                                participant_name: ticket.customer_name || 'N/A',
                                participant_email: ticket.customer_email || 'N/A',
                                order_number: `#${ticket.id.substring(0, 8)}`
                            };
                        }

                        if (!ticketType && ticket.type) {
                            ticketType = { name: ticket.type };
                        }

                        return {
                            ...ticket,
                            events: event ? { name: event.name } : null,
                            event_ticket_types: ticketType || null,
                            orders: order
                        };
                    })
                );

                setTickets(ticketsWithDetails);
            } catch (error) {
                console.error('Error fetching tickets:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [user]);

    const getStatusLabel = (status: string) => {
        const statusMap: Record<string, string> = {
            active: 'Ativo',
            used: 'Utilizado',
            cancelled: 'Cancelado',
            refunded: 'Reembolsado',
            // Legacy statuses
            pending: 'Pendente',
            paid: 'Pago',
        };
        return statusMap[status] || status;
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).replace(',', ' •');
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(price);
    };

    const filteredTickets = tickets
        .filter(ticket => {
            if (selectedEvent !== 'all' && ticket.event_id !== selectedEvent) return false;
            if (selectedStatus !== 'all' && ticket.status !== selectedStatus) return false;
            if (searchTerm) {
                const search = searchTerm.toLowerCase();
                return (
                    ticket.orders?.participant_name?.toLowerCase().includes(search) ||
                    ticket.orders?.participant_email?.toLowerCase().includes(search) ||
                    ticket.orders?.order_number?.toLowerCase().includes(search) ||
                    ticket.customer_name?.toLowerCase().includes(search) ||
                    ticket.customer_email?.toLowerCase().includes(search) ||
                    ticket.ticket_code?.toLowerCase().includes(search) ||
                    ticket.id.toLowerCase().includes(search)
                );
            }
            return true;
        });

    // Calculate stats
    const todayTickets = tickets.filter(t => {
        const today = new Date().toDateString();
        const ticketDate = new Date(t.created_at).toDateString();
        return today === ticketDate && (t.status === 'active' || t.status === 'used' || t.status === 'paid');
    });

    const todayRevenue = 0; // price not stored on ticket; use reports for revenue
    const totalSold = tickets.filter(t => t.status === 'active' || t.status === 'used' || t.status === 'paid').length;
    const avgTicket = 0; // price not stored on ticket; use reports for revenue

    if (loading) {
        return (
            <div className={styles.container}>
                <p>Carregando tickets...</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Tickets</h1>
                    <p className={styles.pageSubtitle}>Gerencie as vendas e inscrições dos seus eventos</p>
                </div>
                <div className={styles.headerActions}>
                    <button className={styles.secondaryBtn}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                        Exportar
                    </button>
                    <button className={styles.primaryBtn}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        Venda Manual
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className={styles.statsRow}>
                <div className={styles.statItem}>
                    <span className={styles.statLabel}>Vendas Hoje</span>
                    <span className={styles.statValue}>{formatPrice(todayRevenue)}</span>
                    <span className={styles.statTrend}>+{todayTickets.length}</span>
                </div>
                <div className={styles.statItem}>
                    <span className={styles.statLabel}>Tickets Vendidos</span>
                    <span className={styles.statValue}>{totalSold}</span>
                    <span className={styles.statTrend}>Total</span>
                </div>
                <div className={styles.statItem}>
                    <span className={styles.statLabel}>Ticket Médio</span>
                    <span className={styles.statValue}>{formatPrice(avgTicket)}</span>
                    <span className={styles.statTrendNeutral}>Média</span>
                </div>
            </div>

            {/* Filters Bar */}
            <div className={styles.filtersBar}>
                <div className={styles.searchBox}>
                    <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    <input
                        type="text"
                        placeholder="Buscar por pedido, nome ou email..."
                        className={styles.searchInput}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className={styles.filters}>
                    <select
                        className={styles.filterSelect}
                        value={selectedEvent}
                        onChange={(e) => setSelectedEvent(e.target.value)}
                    >
                        <option value="all">Todos os Eventos</option>
                        {events.map(event => (
                            <option key={event.id} value={event.id}>{event.name || event.title}</option>
                        ))}
                    </select>
                    <select
                        className={styles.filterSelect}
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                    >
                        <option value="all">Todos os Status</option>
                        <option value="active">Ativo</option>
                        <option value="used">Utilizado</option>
                        <option value="cancelled">Cancelado</option>
                        <option value="refunded">Reembolsado</option>
                    </select>
                </div>
            </div>

            {/* Tickets Table */}
            <div className={styles.tableContainer}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Pedido</th>
                            <th>Cliente</th>
                            <th>Evento</th>
                            <th>Tipo</th>
                            <th>Valor</th>
                            <th>Status</th>
                            <th>Data</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTickets.length === 0 ? (
                            <tr>
                                <td colSpan={8} className={styles.emptyState}>
                                    <p>Nenhum ticket encontrado</p>
                                </td>
                            </tr>
                        ) : (
                            filteredTickets.map((ticket) => (
                                <tr key={ticket.id}>
                                    <td className={styles.orderId}>
                                        {ticket.orders?.order_number || 
                                         (ticket.order_id ? `#${ticket.order_id.substring(0, 8)}` : `#${ticket.id.substring(0, 8)}`)}
                                    </td>
                                    <td>
                                        <div className={styles.customerCell}>
                                            <div className={styles.avatar}>
                                                {(ticket.orders?.participant_name || ticket.customer_name)?.[0]?.toUpperCase() || 'U'}
                                            </div>
                                            <div className={styles.customerInfo}>
                                                <span className={styles.customerName}>
                                                    {ticket.orders?.participant_name || ticket.customer_name || 'N/A'}
                                                </span>
                                                <span className={styles.customerEmail}>
                                                    {ticket.orders?.participant_email || ticket.customer_email || 'N/A'}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className={styles.eventCell}>
                                        {ticket.events?.name || 
                                         (ticket.event_id ? 'Carregando...' : 'N/A')}
                                    </td>
                                    <td>
                                        <span className={styles.ticketType}>
                                            {ticket.event_ticket_types?.name || ticket.type || 'N/A'}
                                        </span>
                                    </td>
                                    <td className={styles.priceCell}>
                                        —
                                    </td>
                                    <td>
                                        <span className={`${styles.badge} ${
                                            ticket.status === 'active' || ticket.status === 'paid' ? styles.badgeSuccess :
                                            ticket.status === 'used' ? styles.badgeInfo :
                                            ticket.status === 'cancelled' || ticket.status === 'refunded' ? styles.badgeError :
                                            styles.badgeWarning
                                        }`}>
                                            {getStatusLabel(ticket.status)}
                                        </span>
                                    </td>
                                    <td className={styles.dateCell}>{formatDate(ticket.created_at)}</td>
                                    <td>
                                        <DropdownMenu
                                            options={[
                                                {
                                                    label: 'Ver Detalhes',
                                                    icon: (
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                            <circle cx="12" cy="12" r="3" />
                                                        </svg>
                                                    ),
                                                    onClick: () => window.open(`/event/${ticket.event_id}`, '_blank'),
                                                },
                                                {
                                                    label: 'Baixar PDF',
                                                    icon: (
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                            <polyline points="7 10 12 15 17 10" />
                                                            <line x1="12" y1="15" x2="12" y2="3" />
                                                        </svg>
                                                    ),
                                                    onClick: () => {
                                                        // TODO: Implement PDF download
                                                        alert('Funcionalidade de download em desenvolvimento');
                                                    },
                                                },
                                                {
                                                    label: 'Invalidar',
                                                    icon: (
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <circle cx="12" cy="12" r="10" />
                                                            <line x1="15" y1="9" x2="9" y2="15" />
                                                            <line x1="9" y1="9" x2="15" y2="15" />
                                                        </svg>
                                                    ),
                                                    onClick: async () => {
                                                        const ticketIdentifier = ticket.ticket_code || ticket.id.substring(0, 8);
                                                        if (!confirm(`Tem certeza que deseja invalidar o ingresso ${ticketIdentifier}?`)) {
                                                            return;
                                                        }
                                                        try {
                                                            const { error } = await supabase
                                                                .from('tickets')
                                                                .update({ status: 'cancelled' })
                                                                .eq('id', ticket.id);
                                                            if (error) throw error;
                                                            updateTicketStatus(ticket.id, 'cancelled');
                                                        } catch (error) {
                                                            console.error('Error invalidating ticket:', error);
                                                            alert('Erro ao invalidar ingresso. Tente novamente.');
                                                        }
                                                    },
                                                    danger: true,
                                                },
                                            ]}
                                        >
                                            <button className={styles.actionBtn}>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>
                                            </button>
                                        </DropdownMenu>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
