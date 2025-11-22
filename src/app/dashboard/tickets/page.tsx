'use client';

import styles from './page.module.css';

export default function TicketsPage() {
    const tickets = [
        {
            id: '#ORD-7829',
            customer: {
                name: 'Ana Silva',
                email: 'ana.silva@email.com',
                avatar: 'A'
            },
            event: 'Conferência Anual 2024',
            type: 'VIP Pass',
            price: 'R$ 150,00',
            status: 'paid',
            date: '15 Dez, 2024 • 14:30'
        },
        {
            id: '#ORD-7830',
            customer: {
                name: 'Carlos Santos',
                email: 'carlos.s@email.com',
                avatar: 'C'
            },
            event: 'Worship Night',
            type: 'Geral',
            price: 'R$ 30,00',
            status: 'paid',
            date: '15 Dez, 2024 • 15:45'
        },
        {
            id: '#ORD-7831',
            customer: {
                name: 'Beatriz Costa',
                email: 'bia.costa@email.com',
                avatar: 'B'
            },
            event: 'Retiro de Jovens',
            type: 'Lote 1',
            price: 'R$ 300,00',
            status: 'pending',
            date: '15 Dez, 2024 • 16:00'
        },
        {
            id: '#ORD-7832',
            customer: {
                name: 'João Oliveira',
                email: 'joao.o@email.com',
                avatar: 'J'
            },
            event: 'Conferência Anual 2024',
            type: 'VIP Pass',
            price: 'R$ 150,00',
            status: 'refunded',
            date: '14 Dez, 2024 • 09:15'
        },
        {
            id: '#ORD-7833',
            customer: {
                name: 'Mariana Lima',
                email: 'mari.lima@email.com',
                avatar: 'M'
            },
            event: 'Culto de Natal',
            type: 'Gratuito',
            price: 'R$ 0,00',
            status: 'paid',
            date: '14 Dez, 2024 • 11:20'
        }
    ];

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
                    <span className={styles.statValue}>R$ 1.250,00</span>
                    <span className={styles.statTrend}>+12%</span>
                </div>
                <div className={styles.statItem}>
                    <span className={styles.statLabel}>Tickets Vendidos</span>
                    <span className={styles.statValue}>45</span>
                    <span className={styles.statTrend}>+5%</span>
                </div>
                <div className={styles.statItem}>
                    <span className={styles.statLabel}>Ticket Médio</span>
                    <span className={styles.statValue}>R$ 27,00</span>
                    <span className={styles.statTrendNeutral}>0%</span>
                </div>
            </div>

            {/* Filters Bar */}
            <div className={styles.filtersBar}>
                <div className={styles.searchBox}>
                    <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    <input type="text" placeholder="Buscar por pedido, nome ou email..." className={styles.searchInput} />
                </div>
                <div className={styles.filters}>
                    <select className={styles.filterSelect}>
                        <option>Todos os Eventos</option>
                        <option>Conferência Anual</option>
                        <option>Worship Night</option>
                    </select>
                    <select className={styles.filterSelect}>
                        <option>Status</option>
                        <option>Pago</option>
                        <option>Pendente</option>
                        <option>Reembolsado</option>
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
                        {tickets.map((ticket) => (
                            <tr key={ticket.id}>
                                <td className={styles.orderId}>{ticket.id}</td>
                                <td>
                                    <div className={styles.customerCell}>
                                        <div className={styles.avatar}>{ticket.customer.avatar}</div>
                                        <div className={styles.customerInfo}>
                                            <span className={styles.customerName}>{ticket.customer.name}</span>
                                            <span className={styles.customerEmail}>{ticket.customer.email}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className={styles.eventCell}>{ticket.event}</td>
                                <td><span className={styles.ticketType}>{ticket.type}</span></td>
                                <td className={styles.priceCell}>{ticket.price}</td>
                                <td>
                                    <span className={`${styles.badge} ${ticket.status === 'paid' ? styles.badgeSuccess :
                                            ticket.status === 'pending' ? styles.badgeWarning :
                                                styles.badgeError
                                        }`}>
                                        {ticket.status === 'paid' ? 'Pago' :
                                            ticket.status === 'pending' ? 'Pendente' : 'Reembolsado'}
                                    </span>
                                </td>
                                <td className={styles.dateCell}>{ticket.date}</td>
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
