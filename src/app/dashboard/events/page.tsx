'use client';

import Link from 'next/link';
import styles from './page.module.css';

export default function EventsPage() {
    const events = [
        {
            id: 1,
            title: 'Conferência Anual 2024',
            date: '15 Dez, 2024',
            location: 'Templo Principal',
            status: 'published',
            sold: 450,
            total: 500,
            revenue: 'R$ 22.500,00',
            image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=100&q=80'
        },
        {
            id: 2,
            title: 'Worship Night',
            date: '20 Dez, 2024',
            location: 'Auditório B',
            status: 'published',
            sold: 120,
            total: 200,
            revenue: 'R$ 6.000,00',
            image: 'https://images.unsplash.com/photo-1459749411177-0473ef7161a9?auto=format&fit=crop&w=100&q=80'
        },
        {
            id: 3,
            title: 'Retiro de Jovens',
            date: '10 Jan, 2025',
            location: 'Sítio Recanto',
            status: 'draft',
            sold: 0,
            total: 100,
            revenue: 'R$ 0,00',
            image: 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=100&q=80'
        },
        {
            id: 4,
            title: 'Culto de Natal',
            date: '24 Dez, 2024',
            location: 'Templo Principal',
            status: 'published',
            sold: 280,
            total: 800,
            revenue: 'Gratuito',
            image: 'https://images.unsplash.com/photo-1512389142860-9c449e58a543?auto=format&fit=crop&w=100&q=80'
        },
        {
            id: 5,
            title: 'Workshop de Música',
            date: '05 Fev, 2025',
            location: 'Sala de Música',
            status: 'ended',
            sold: 50,
            total: 50,
            revenue: 'R$ 2.500,00',
            image: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?auto=format&fit=crop&w=100&q=80'
        }
    ];

    return (
        <div className={styles.container}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Eventos</h1>
                    <p className={styles.pageSubtitle}>Gerencie todos os seus eventos em um só lugar</p>
                </div>
                <Link href="/dashboard/events/new" className={styles.primaryBtn}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    Criar Evento
                </Link>
            </div>

            {/* Filters */}
            <div className={styles.filtersBar}>
                <div className={styles.tabs}>
                    <button className={`${styles.tab} ${styles.activeTab}`}>Todos</button>
                    <button className={styles.tab}>Publicados</button>
                    <button className={styles.tab}>Rascunhos</button>
                    <button className={styles.tab}>Encerrados</button>
                </div>
                <div className={styles.searchBox}>
                    <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    <input type="text" placeholder="Buscar eventos..." className={styles.searchInput} />
                </div>
            </div>

            {/* Events Table */}
            <div className={styles.tableContainer}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th style={{ width: '40%' }}>Evento</th>
                            <th>Status</th>
                            <th>Vendas</th>
                            <th>Receita</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {events.map((event) => (
                            <tr key={event.id}>
                                <td>
                                    <div className={styles.eventCell}>
                                        <div className={styles.eventImage} style={{ backgroundImage: `url(${event.image})` }} />
                                        <div className={styles.eventInfo}>
                                            <div className={styles.eventTitle}>{event.title}</div>
                                            <div className={styles.eventMeta}>
                                                <span>📅 {event.date}</span>
                                                <span>📍 {event.location}</span>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <span className={`${styles.badge} ${event.status === 'published' ? styles.badgeSuccess :
                                            event.status === 'draft' ? styles.badgeWarning :
                                                styles.badgeNeutral
                                        }`}>
                                        {event.status === 'published' ? 'Publicado' :
                                            event.status === 'draft' ? 'Rascunho' : 'Encerrado'}
                                    </span>
                                </td>
                                <td>
                                    <div className={styles.salesInfo}>
                                        <div className={styles.salesText}>
                                            <span className={styles.salesCount}>{event.sold}/{event.total}</span>
                                            <span className={styles.salesPercent}>{Math.round((event.sold / event.total) * 100)}%</span>
                                        </div>
                                        <div className={styles.progressBar}>
                                            <div
                                                className={styles.progressFill}
                                                style={{ width: `${(event.sold / event.total) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </td>
                                <td className={styles.revenueCell}>{event.revenue}</td>
                                <td>
                                    <div className={styles.actions}>
                                        <button className={styles.actionBtn} title="Editar">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                        </button>
                                        <button className={styles.actionBtn} title="Gerenciar">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                                        </button>
                                        <button className={styles.actionBtn} title="Mais opções">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
