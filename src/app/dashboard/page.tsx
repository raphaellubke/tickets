'use client';

import styles from './page.module.css';

export default function DashboardPage() {
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
                    <button className={styles.primaryBtn}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        Novo Evento
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <div className={styles.statHeader}>
                        <span className={styles.statLabel}>Receita Total</span>
                        <span className={styles.statIcon}>💰</span>
                    </div>
                    <div className={styles.statValue}>R$ 45.231,00</div>
                    <div className={styles.statTrend}>
                        <span className={styles.trendUp}>+20.1%</span>
                        <span className={styles.trendContext}>vs. mês anterior</span>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statHeader}>
                        <span className={styles.statLabel}>Ingressos Vendidos</span>
                        <span className={styles.statIcon}>🎟️</span>
                    </div>
                    <div className={styles.statValue}>1,234</div>
                    <div className={styles.statTrend}>
                        <span className={styles.trendUp}>+12.5%</span>
                        <span className={styles.trendContext}>vs. mês anterior</span>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statHeader}>
                        <span className={styles.statLabel}>Taxa de Conversão</span>
                        <span className={styles.statIcon}>📈</span>
                    </div>
                    <div className={styles.statValue}>3.2%</div>
                    <div className={styles.statTrend}>
                        <span className={styles.trendUp}>+0.4%</span>
                        <span className={styles.trendContext}>vs. mês anterior</span>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statHeader}>
                        <span className={styles.statLabel}>Visualizações</span>
                        <span className={styles.statIcon}>👀</span>
                    </div>
                    <div className={styles.statValue}>45.2k</div>
                    <div className={styles.statTrend}>
                        <span className={styles.trendDown}>-4.3%</span>
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
                            {[
                                { title: 'Conferência Anual 2024', date: '15 Dez, 2024', sold: 450, total: 500, revenue: 'R$ 22.500' },
                                { title: 'Worship Night', date: '20 Dez, 2024', sold: 120, total: 200, revenue: 'R$ 6.000' },
                                { title: 'Retiro de Jovens', date: '10 Jan, 2025', sold: 45, total: 100, revenue: 'R$ 13.500' },
                            ].map((event, i) => (
                                <div key={i} className={styles.featuredItem}>
                                    <div className={styles.featuredInfo}>
                                        <div className={styles.featuredTitle}>{event.title}</div>
                                        <div className={styles.featuredMeta}>{event.date} • {event.revenue}</div>
                                    </div>
                                    <div className={styles.featuredStats}>
                                        <div className={styles.progressLabel}>
                                            <span>{event.sold} vendidos</span>
                                            <span>{Math.round((event.sold / event.total) * 100)}%</span>
                                        </div>
                                        <div className={styles.progressBar}>
                                            <div
                                                className={styles.progressFill}
                                                style={{ width: `${(event.sold / event.total) * 100}%` }}
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
                            {[
                                { day: '15', month: 'DEZ', title: 'Conferência Anual', time: '19:00', location: 'Templo Principal' },
                                { day: '20', month: 'DEZ', title: 'Worship Night', time: '20:00', location: 'Auditório B' },
                                { day: '24', month: 'DEZ', title: 'Culto de Natal', time: '18:00', location: 'Templo Principal' },
                            ].map((event, i) => (
                                <div key={i} className={styles.upcomingItem}>
                                    <div className={styles.dateBox}>
                                        <span className={styles.dateDay}>{event.day}</span>
                                        <span className={styles.dateMonth}>{event.month}</span>
                                    </div>
                                    <div className={styles.upcomingInfo}>
                                        <div className={styles.upcomingTitle}>{event.title}</div>
                                        <div className={styles.upcomingMeta}>
                                            <span>🕒 {event.time}</span>
                                            <span>📍 {event.location}</span>
                                        </div>
                                    </div>
                                    <button className={styles.iconBtn}>→</button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recent Sales */}
                    <div className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <h2 className={styles.sectionTitle}>Vendas Recentes</h2>
                        </div>
                        <div className={styles.salesList}>
                            {[
                                { name: 'Ana Silva', event: 'Conferência 2024', time: '2 min atrás', value: '+ R$ 50,00' },
                                { name: 'Carlos Santos', event: 'Worship Night', time: '15 min atrás', value: '+ R$ 30,00' },
                                { name: 'Beatriz Costa', event: 'Retiro', time: '1 hora atrás', value: '+ R$ 300,00' },
                                { name: 'João Oliveira', event: 'Conferência 2024', time: '2 horas atrás', value: '+ R$ 50,00' },
                            ].map((sale, i) => (
                                <div key={i} className={styles.saleItem}>
                                    <div className={styles.saleAvatar}>{sale.name[0]}</div>
                                    <div className={styles.saleInfo}>
                                        <div className={styles.saleTitle}>
                                            <span className={styles.saleName}>{sale.name}</span> comprou ingresso para <span className={styles.saleEvent}>{sale.event}</span>
                                        </div>
                                        <div className={styles.saleTime}>{sale.time}</div>
                                    </div>
                                    <div className={styles.saleValue}>{sale.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
