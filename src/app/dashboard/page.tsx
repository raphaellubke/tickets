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

                // Fetch tickets for stats
                const { data: ticketsData } = await supabase
                    .from('tickets')
                    .select(`
                        *,
                        events!inner(organization_id)
                    `)
                    .eq('events.organization_id', memberData.organization_id)
                    .eq('status', 'confirmed');

                // Calculate stats
                const totalRevenue = ticketsData?.reduce((sum, t) => sum + (t.price_paid || 0), 0) || 0;
                const ticketsSold = ticketsData?.length || 0;

                setStats({
                    totalRevenue,
                    ticketsSold,
                    conversionRate: 3.2, // TODO: Calculate from analytics
                    views: 45200, // TODO: Fetch from analytics
                });

                // Fetch featured events (top selling)
                const { data: eventsData } = await supabase
                    .from('events')
                    .select('*')
                    .eq('organization_id', memberData.organization_id)
                    .eq('status', 'published')
                    .order('created_at', { ascending: false })
                    .limit(3);

                setFeaturedEvents(eventsData || []);

                // Fetch upcoming events
                const { data: upcomingData } = await supabase
                    .from('events')
                    .select('*')
                    .eq('organization_id', memberData.organization_id)
                    .gte('event_date', new Date().toISOString())
                    .order('event_date', { ascending: true })
                    .limit(3);

                setUpcomingEvents(upcomingData || []);

                // Fetch recent sales
                const { data: recentSalesData } = await supabase
                    .from('tickets')
                    .select(`
                        *,
                        events!inner(title, organization_id)
                    `)
                    .eq('events.organization_id', memberData.organization_id)
                    .eq('status', 'confirmed')
                    .order('created_at', { ascending: false })
                    .limit(4);

                setRecentSales(recentSalesData || []);
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
                            {featuredEvents.map((event) => (
                                <div key={event.id} className={styles.featuredItem}>
                                    <div className={styles.featuredInfo}>
                                        <div className={styles.featuredTitle}>{event.title}</div>
                                        <div className={styles.featuredMeta}>{formatDate(event.event_date)}</div>
                                    </div>
                                    <div className={styles.featuredStats}>
                                        <div className={styles.progressLabel}>
                                            <span>0 vendidos</span>
                                            <span>0%</span>
                                        </div>
                                        <div className={styles.progressBar}>
                                            <div
                                                className={styles.progressFill}
                                                style={{ width: '0%' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Revenue Chart Placeholder */}
                    <div className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <h2 className={styles.sectionTitle}>Receita (Últimos 7 dias)</h2>
                        </div>
                        <div className={styles.chartContainer}>
                            <div className={styles.chartBars}>
                                {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                                    <div key={i} className={styles.chartBarGroup}>
                                        <div className={styles.chartBar} style={{ height: `${h}%` }} />
                                        <span className={styles.chartLabel}>{['S', 'T', 'Q', 'Q', 'S', 'S', 'D'][i]}</span>
                                    </div>
                                ))}
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
                            {upcomingEvents.map((event) => {
                                const date = new Date(event.event_date);
                                return (
                                    <div key={event.id} className={styles.upcomingItem}>
                                        <div className={styles.dateBox}>
                                            <span className={styles.dateDay}>{date.getDate()}</span>
                                            <span className={styles.dateMonth}>
                                                {date.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase()}
                                            </span>
                                        </div>
                                        <div className={styles.upcomingInfo}>
                                            <div className={styles.upcomingTitle}>{event.title}</div>
                                            <div className={styles.upcomingMeta}>
                                                <span>🕒 {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                {event.location && <span>📍 {event.location}</span>}
                                            </div>
                                        </div>
                                        <button className={styles.iconBtn}>→</button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Recent Sales */}
                    <div className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <h2 className={styles.sectionTitle}>Vendas Recentes</h2>
                        </div>
                        <div className={styles.salesList}>
                            {recentSales.map((sale) => (
                                <div key={sale.id} className={styles.saleItem}>
                                    <div className={styles.saleAvatar}>
                                        {sale.attendee_name?.[0]?.toUpperCase() || 'U'}
                                    </div>
                                    <div className={styles.saleInfo}>
                                        <div className={styles.saleTitle}>
                                            <span className={styles.saleName}>{sale.attendee_name || 'Cliente'}</span> comprou ingresso para <span className={styles.saleEvent}>{sale.events?.title || 'Evento'}</span>
                                        </div>
                                        <div className={styles.saleTime}>{getTimeAgo(sale.created_at)}</div>
                                    </div>
                                    <div className={styles.saleValue}>+ {formatPrice(sale.price_paid || 0)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
