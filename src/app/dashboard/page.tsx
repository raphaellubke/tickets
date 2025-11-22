'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

export default function DashboardPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        ticketsSold: 0,
        conversionRate: 0,
        views: 0,
    });
    const [featuredEvents, setFeaturedEvents] = useState<any[]>([]);
    const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
    const [recentSales, setRecentSales] = useState<any[]>([]);
    const [revenueChartData, setRevenueChartData] = useState<number[]>([]);
    const supabase = createClient();

    useEffect(() => {
        async function fetchDashboardData() {
            if (!user) return;

            try {
                // Get user's organization
                const { data: memberData } = await supabase
                    .from('organization_members')
                    .select('organization_id')
                    .eq('user_id', user.id)
                    .single();

                if (!memberData) {
                    setLoading(false);
                    return;
                }

                // Fetch orders for revenue calculation
                const { data: ordersData } = await supabase
                    .from('orders')
                    .select('total_amount, payment_status, created_at, paid_at')
                    .eq('organization_id', memberData.organization_id)
                    .eq('payment_status', 'paid');

                // Calculate total revenue from paid orders
                const totalRevenue = ordersData?.reduce((sum, order) => {
                    return sum + (parseFloat(order.total_amount?.toString() || '0') || 0);
                }, 0) || 0;

                // Fetch tickets sold
                const { data: ticketsData } = await supabase
                    .from('tickets')
                    .select('id, status, created_at')
                    .eq('organization_id', memberData.organization_id)
                    .in('status', ['active', 'used']);

                const ticketsSold = ticketsData?.length || 0;

                // Calculate conversion rate (simplified: tickets sold / total views estimate)
                // For now, using a basic calculation
                const conversionRate = ticketsSold > 0 ? ((ticketsSold / (ticketsSold * 30)) * 100).toFixed(1) : '0.0';

                // Calculate total views from events
                const { data: eventsViews } = await supabase
                    .from('events')
                    .select('views')
                    .eq('organization_id', memberData.organization_id);

                const views = eventsViews?.reduce((sum, event) => sum + (event.views || 0), 0) || 0;

                setStats({
                    totalRevenue,
                    ticketsSold,
                    conversionRate: parseFloat(conversionRate),
                    views: Math.round(views),
                });

                // Fetch featured events (top selling - events with most tickets sold)
                const { data: eventsData } = await supabase
                    .from('events')
                    .select('*')
                    .eq('organization_id', memberData.organization_id)
                    .in('status', ['publicado', 'ativo'])
                    .order('created_at', { ascending: false })
                    .limit(3);

                // Get ticket counts for each event
                const processedEvents = await Promise.all((eventsData || []).map(async (event) => {
                    const { count, error } = await supabase
                        .from('tickets')
                        .select('*', { count: 'exact', head: true })
                        .eq('event_id', event.id)
                        .in('status', ['active', 'used']);

                    if (error) {
                        console.error('Error counting tickets:', error);
                    }

                    return {
                        ...event,
                        ticketsSold: count ?? 0,
                    };
                }));

                setFeaturedEvents(processedEvents);

                // Fetch upcoming events
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const { data: upcomingData } = await supabase
                    .from('events')
                    .select('*')
                    .eq('organization_id', memberData.organization_id)
                    .gte('event_date', today.toISOString().split('T')[0])
                    .order('event_date', { ascending: true })
                    .order('event_time', { ascending: true })
                    .limit(5);

                setUpcomingEvents(upcomingData || []);

                // Fetch recent sales from orders
                const { data: recentSalesData } = await supabase
                    .from('orders')
                    .select(`
                        *,
                        events!inner(name, organization_id)
                    `)
                    .eq('events.organization_id', memberData.organization_id)
                    .eq('payment_status', 'paid')
                    .order('paid_at', { ascending: false, nullsFirst: false })
                    .limit(5);

                setRecentSales(recentSalesData || []);

                // Calculate revenue for last 7 days
                const last7Days = [];
                const todayForChart = new Date();
                for (let i = 6; i >= 0; i--) {
                    const date = new Date(todayForChart);
                    date.setDate(date.getDate() - i);
                    date.setHours(0, 0, 0, 0);
                    const nextDay = new Date(date);
                    nextDay.setDate(nextDay.getDate() + 1);

                    const dayRevenue = ordersData?.filter(order => {
                        const orderDate = new Date(order.paid_at || order.created_at);
                        return orderDate >= date && orderDate < nextDay;
                    }).reduce((sum, order) => {
                        return sum + (parseFloat(order.total_amount?.toString() || '0') || 0);
                    }, 0) || 0;

                    last7Days.push(dayRevenue);
                }

                // Normalize chart data (0-100 scale)
                const maxRevenue = Math.max(...last7Days, 1);
                const normalizedData = last7Days.map(revenue => (revenue / maxRevenue) * 100);
                setRevenueChartData(normalizedData);
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchDashboardData();
    }, [user]);

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(price);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const getTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMins / 60);

        if (diffMins < 1) return 'Agora mesmo';
        if (diffMins < 60) return `${diffMins} min atrás`;
        if (diffHours < 24) return `${diffHours} hora${diffHours > 1 ? 's' : ''} atrás`;
        return formatDate(dateString);
    };

    const formatCompactNumber = (num: number) => {
        if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
        return num.toString();
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <p>Carregando dashboard...</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Visão Geral</h1>
                    <p className={styles.pageSubtitle}>Acompanhe o desempenho dos seus eventos</p>
                </div>
                <div className={styles.headerActions}>
                    <div className={styles.dateRange}>
                        <span className={styles.dateText}>Últimos 30 dias</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                    </div>
                    <Link href="/dashboard/events/new" className={styles.primaryBtn}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        Novo Evento
                    </Link>
                </div>
            </div>

            {/* Stats Grid */}
            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <div className={styles.statHeader}>
                        <span className={styles.statLabel}>Receita Total</span>
                        <span className={styles.statIcon}>💰</span>
                    </div>
                    <div className={styles.statValue}>{formatPrice(stats.totalRevenue)}</div>
                    <div className={styles.statTrend}>
                        <span className={styles.trendUp}>Total</span>
                        <span className={styles.trendContext}>de vendas confirmadas</span>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statHeader}>
                        <span className={styles.statLabel}>Ingressos Vendidos</span>
                        <span className={styles.statIcon}>🎟️</span>
                    </div>
                    <div className={styles.statValue}>{formatCompactNumber(stats.ticketsSold)}</div>
                    <div className={styles.statTrend}>
                        <span className={styles.trendUp}>Total</span>
                        <span className={styles.trendContext}>tickets confirmados</span>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statHeader}>
                        <span className={styles.statLabel}>Taxa de Conversão</span>
                        <span className={styles.statIcon}>📈</span>
                    </div>
                    <div className={styles.statValue}>{stats.conversionRate}%</div>
                    <div className={styles.statTrend}>
                        <span className={styles.trendUp}>Estimado</span>
                        <span className={styles.trendContext}>vs. mês anterior</span>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statHeader}>
                        <span className={styles.statLabel}>Visualizações</span>
                        <span className={styles.statIcon}>👀</span>
                    </div>
                    <div className={styles.statValue}>{formatCompactNumber(stats.views)}</div>
                    <div className={styles.statTrend}>
                        <span className={styles.trendDown}>Estimado</span>
                        <span className={styles.trendContext}>vs. mês anterior</span>
                    </div>
                </div>
            </div>

            <div className={styles.mainGrid}>
                {/* Left Column */}
                <div className={styles.column}>
                    {/* Featured Events */}
                    <div className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <h2 className={styles.sectionTitle}>Eventos em Destaque</h2>
                            <button className={styles.actionLink}>Ver Todos</button>
                        </div>
                        <div className={styles.featuredList}>
                            {featuredEvents.length > 0 ? (
                                featuredEvents.map((event) => {
                                    // Get ticket count for this event
                                    const ticketsCount = event.ticketsSold || 0;
                                    const totalCapacity = event.capacity || 100; // Default capacity
                                    const percentage = totalCapacity > 0 ? (ticketsCount / totalCapacity) * 100 : 0;
                                    
                                    return (
                                        <div key={event.id} className={styles.featuredItem}>
                                            <div className={styles.featuredInfo}>
                                                <div className={styles.featuredTitle}>{event.name || event.title}</div>
                                                <div className={styles.featuredMeta}>
                                                    {event.event_date ? formatDate(event.event_date) : 'Data não definida'}
                                                </div>
                                            </div>
                                            <div className={styles.featuredStats}>
                                                <div className={styles.progressLabel}>
                                                    <span>{ticketsCount} vendidos</span>
                                                    <span>{percentage.toFixed(0)}%</span>
                                                </div>
                                                <div className={styles.progressBar}>
                                                    <div
                                                        className={styles.progressFill}
                                                        style={{ width: `${Math.min(percentage, 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className={styles.emptyState}>
                                    <p>Nenhum evento em destaque</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Revenue Chart Placeholder */}
                    <div className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <h2 className={styles.sectionTitle}>Receita (Últimos 7 dias)</h2>
                        </div>
                        <div className={styles.chartContainer}>
                            <div className={styles.chartBars}>
                                {revenueChartData.length > 0 ? (
                                    revenueChartData.map((h, i) => (
                                        <div key={i} className={styles.chartBarGroup}>
                                            <div className={styles.chartBar} style={{ height: `${Math.max(h, 5)}%` }} />
                                            <span className={styles.chartLabel}>{['S', 'T', 'Q', 'Q', 'S', 'S', 'D'][i]}</span>
                                        </div>
                                    ))
                                ) : (
                                    [0, 0, 0, 0, 0, 0, 0].map((h, i) => (
                                        <div key={i} className={styles.chartBarGroup}>
                                            <div className={styles.chartBar} style={{ height: '5%' }} />
                                            <span className={styles.chartLabel}>{['S', 'T', 'Q', 'Q', 'S', 'S', 'D'][i]}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className={styles.column}>
                    {/* Upcoming Events */}
                    <div className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <h2 className={styles.sectionTitle}>Próximos Eventos</h2>
                            <button className={styles.actionLink}>Agenda</button>
                        </div>
                        <div className={styles.upcomingList}>
                            {upcomingEvents.length > 0 ? (
                                upcomingEvents.map((event) => {
                                    const date = new Date(event.event_date);
                                    const time = event.event_time ? event.event_time : '00:00';
                                    return (
                                        <Link key={event.id} href={`/dashboard/events/new?id=${event.id}`} className={styles.upcomingItem}>
                                            <div className={styles.dateBox}>
                                                <span className={styles.dateDay}>{date.getDate()}</span>
                                                <span className={styles.dateMonth}>
                                                    {date.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase()}
                                                </span>
                                            </div>
                                            <div className={styles.upcomingInfo}>
                                                <div className={styles.upcomingTitle}>{event.name || event.title}</div>
                                                <div className={styles.upcomingMeta}>
                                                    <span>🕒 {time}</span>
                                                    {event.location && <span>📍 {event.location}</span>}
                                                </div>
                                            </div>
                                            <button className={styles.iconBtn}>→</button>
                                        </Link>
                                    );
                                })
                            ) : (
                                <div className={styles.emptyState}>
                                    <p>Nenhum evento próximo</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recent Sales */}
                    <div className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <h2 className={styles.sectionTitle}>Vendas Recentes</h2>
                        </div>
                        <div className={styles.salesList}>
                            {recentSales.length > 0 ? (
                                recentSales.map((sale) => (
                                    <div key={sale.id} className={styles.saleItem}>
                                        <div className={styles.saleAvatar}>
                                            {sale.participant_name?.[0]?.toUpperCase() || sale.participant_email?.[0]?.toUpperCase() || 'U'}
                                        </div>
                                        <div className={styles.saleInfo}>
                                            <div className={styles.saleTitle}>
                                                <span className={styles.saleName}>{sale.participant_name || 'Cliente'}</span> comprou {sale.quantity || 1} ingresso{sale.quantity > 1 ? 's' : ''} para <span className={styles.saleEvent}>{sale.events?.name || sale.events?.title || 'Evento'}</span>
                                            </div>
                                            <div className={styles.saleTime}>{getTimeAgo(sale.paid_at || sale.created_at)}</div>
                                        </div>
                                        <div className={styles.saleValue}>+ {formatPrice(parseFloat(sale.total_amount?.toString() || '0'))}</div>
                                    </div>
                                ))
                            ) : (
                                <div className={styles.emptyState}>
                                    <p>Nenhuma venda recente</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
