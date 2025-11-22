'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

interface Ticket {
    id: string;
    attendee_name: string;
    attendee_email: string;
    event_id: string;
    ticket_type_id: string;
    status: string;
    price_paid: number;
    created_at: string;
    events: {
        title: string;
    };
    event_ticket_types: {
        name: string;
    };
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

    useEffect(() => {
        async function fetchData() {
            if (!user) return;

            try {
                // Get user's organization
                const { data: memberData } = await supabase
                    .from('organization_members')
                    .select('organization_id')
                    .eq('user_id', user.id)
                    .eq('status', 'active')
                    .single();

                if (!memberData) {
                    setLoading(false);
                    return;
                }

                // Fetch events for filter
                const { data: eventsData } = await supabase
                    .from('events')
                    .select('id, title')
                    .eq('organization_id', memberData.organization_id);

                setEvents(eventsData || []);

                // Fetch tickets with event and ticket type info
                const { data: ticketsData, error } = await supabase
                    .from('tickets')
                    .select(`
                        *,
                        events!inner(title, organization_id),
                        event_ticket_types(name)
                    `)
                    .eq('events.organization_id', memberData.organization_id)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                setTickets(ticketsData || []);
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
            confirmed: 'Pago',
            pending: 'Pendente',
            cancelled: 'Reembolsado',
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
                    ticket.attendee_name?.toLowerCase().includes(search) ||
                    ticket.attendee_email?.toLowerCase().includes(search) ||
                    ticket.id.toLowerCase().includes(search)
                );
            }
            return true;
        });

    // Calculate stats
    const todayTickets = tickets.filter(t => {
        const today = new Date().toDateString();
        const ticketDate = new Date(t.created_at).toDateString();
        return today === ticketDate && t.status === 'confirmed';
    });

    const todayRevenue = todayTickets.reduce((sum, t) => sum + (t.price_paid || 0), 0);
    const totalSold = tickets.filter(t => t.status === 'confirmed').length;
    const avgTicket = totalSold > 0 ? tickets.reduce((sum, t) => sum + (t.price_paid || 0), 0) / totalSold : 0;

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
                            <option key={event.id} value={event.id}>{event.title}</option>
                        ))}
                    </select>
                    <select
                        className={styles.filterSelect}
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                    >
                        <option value="all">Todos os Status</option>
                        <option value="confirmed">Pago</option>
                        <option value="pending">Pendente</option>
                        <option value="cancelled">Reembolsado</option>
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
                        {filteredTickets.map((ticket) => (
                            <tr key={ticket.id}>
                                <td className={styles.orderId}>#{ticket.id.substring(0, 8)}</td>
                                <td>
                                    <div className={styles.customerCell}>
                                        <div className={styles.avatar}>
                                            {ticket.attendee_name?.[0]?.toUpperCase() || 'U'}
                                        </div>
                                        <div className={styles.customerInfo}>
                                            <span className={styles.customerName}>{ticket.attendee_name || 'N/A'}</span>
                                            <span className={styles.customerEmail}>{ticket.attendee_email || 'N/A'}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className={styles.eventCell}>{ticket.events?.title || 'N/A'}</td>
                                <td><span className={styles.ticketType}>{ticket.event_ticket_types?.name || 'N/A'}</span></td>
                                <td className={styles.priceCell}>{formatPrice(ticket.price_paid || 0)}</td>
                                <td>
                                    <span className={`${styles.badge} ${ticket.status === 'confirmed' ? styles.badgeSuccess :
                                        ticket.status === 'pending' ? styles.badgeWarning :
                                            styles.badgeError
                                        }`}>
                                        {getStatusLabel(ticket.status)}
                                    </span>
                                </td>
                                <td className={styles.dateCell}>{formatDate(ticket.created_at)}</td>
                                <td>
                                    <button className={styles.actionBtn}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
