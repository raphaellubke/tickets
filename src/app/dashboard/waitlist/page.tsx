'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

interface WaitlistEntry {
    id: string;
    event_id: string;
    name: string;
    email: string;
    phone: string | null;
    position: number;
    status: string;
    created_at: string;
    events?: { name: string };
}

interface Event {
    id: string;
    name: string;
}

export default function WaitlistPage() {
    const { user } = useAuth();
    const supabase = createClient();
    const [entries, setEntries] = useState<WaitlistEntry[]>([]);
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterEvent, setFilterEvent] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (user) fetchData();
    }, [user]);

    async function fetchData() {
        try {
            const { data: memberData } = await supabase
                .from('organization_members')
                .select('organization_id')
                .eq('user_id', user!.id)
                .limit(1);

            const orgId = memberData?.[0]?.organization_id;
            if (!orgId) { setLoading(false); return; }

            // Fetch waitlist entries
            const { data: waitlistData, error } = await supabase
                .from('waitlist_entries')
                .select('*, events(name)')
                .eq('organization_id', orgId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setEntries(waitlistData || []);

            // Fetch events for filter
            const { data: eventsData } = await supabase
                .from('events')
                .select('id, name')
                .eq('organization_id', orgId)
                .order('event_date', { ascending: false });

            setEvents(eventsData || []);
        } catch (err) {
            console.error('Error fetching waitlist:', err);
        } finally {
            setLoading(false);
        }
    }

    async function updateStatus(id: string, status: string) {
        const { error } = await supabase
            .from('waitlist_entries')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (!error) {
            setEntries(prev => prev.map(e => e.id === id ? { ...e, status } : e));
        }
    }

    async function deleteEntry(id: string) {
        if (!confirm('Remover esta entrada da lista de espera?')) return;
        const { error } = await supabase
            .from('waitlist_entries')
            .delete()
            .eq('id', id);

        if (!error) {
            setEntries(prev => prev.filter(e => e.id !== id));
        }
    }

    const filtered = entries.filter(e => {
        if (filterEvent && e.event_id !== filterEvent) return false;
        if (filterStatus && e.status !== filterStatus) return false;
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            return e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q);
        }
        return true;
    });

    const statusLabel: Record<string, string> = {
        waiting: 'Aguardando',
        notified: 'Notificado',
        converted: 'Convertido',
        expired: 'Expirado',
    };

    const statusClass: Record<string, string> = {
        waiting: styles.statusWaiting,
        notified: styles.statusNotified,
        converted: styles.statusConverted,
        expired: styles.statusExpired,
    };

    const counts = {
        total: entries.length,
        waiting: entries.filter(e => e.status === 'waiting').length,
        notified: entries.filter(e => e.status === 'notified').length,
    };

    if (loading) {
        return <div className={styles.container}><p>Carregando lista de espera...</p></div>;
    }

    return (
        <div className={styles.container}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Lista de Espera</h1>
                    <p className={styles.pageSubtitle}>Gerencie as pessoas aguardando ingressos</p>
                </div>
            </div>

            {/* Stats */}
            <div className={styles.statsRow}>
                <div className={styles.statCard}>
                    <p className={styles.statLabel}>Total na lista</p>
                    <p className={styles.statValue}>{counts.total}</p>
                </div>
                <div className={styles.statCard}>
                    <p className={styles.statLabel}>Aguardando</p>
                    <p className={styles.statValue}>{counts.waiting}</p>
                </div>
                <div className={styles.statCard}>
                    <p className={styles.statLabel}>Notificados</p>
                    <p className={styles.statValue}>{counts.notified}</p>
                </div>
            </div>

            {/* Table */}
            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>Entradas ({filtered.length})</h2>
                    <div className={styles.filterRow}>
                        <div className={styles.searchBox}>
                            <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                            <input
                                type="text"
                                className={styles.searchInput}
                                placeholder="Buscar..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <select
                            className={styles.select}
                            value={filterEvent}
                            onChange={(e) => setFilterEvent(e.target.value)}
                        >
                            <option value="">Todos os eventos</option>
                            {events.map(ev => (
                                <option key={ev.id} value={ev.id}>{ev.name}</option>
                            ))}
                        </select>
                        <select
                            className={styles.select}
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="">Todos os status</option>
                            <option value="waiting">Aguardando</option>
                            <option value="notified">Notificado</option>
                            <option value="converted">Convertido</option>
                            <option value="expired">Expirado</option>
                        </select>
                    </div>
                </div>

                {filtered.length === 0 ? (
                    <div className={styles.emptyState}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                        <p>Nenhuma entrada encontrada</p>
                        <p style={{ color: '#d1d5db' }}>
                            Quando ingressos esgotarem e lista de espera estiver ativa, as entradas aparecerão aqui.
                        </p>
                    </div>
                ) : (
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Nome / E-mail</th>
                                <th>Evento</th>
                                <th>Telefone</th>
                                <th>Status</th>
                                <th>Data</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((entry) => (
                                <tr key={entry.id}>
                                    <td>
                                        <span className={styles.positionBadge}>{entry.position}</span>
                                    </td>
                                    <td>
                                        <div className={styles.nameBold}>{entry.name}</div>
                                        <div className={styles.emailText}>{entry.email}</div>
                                    </td>
                                    <td>{entry.events?.name || '—'}</td>
                                    <td>{entry.phone || '—'}</td>
                                    <td>
                                        <span className={`${styles.statusBadge} ${statusClass[entry.status] || styles.statusWaiting}`}>
                                            {statusLabel[entry.status] || entry.status}
                                        </span>
                                    </td>
                                    <td>{new Date(entry.created_at).toLocaleDateString('pt-BR')}</td>
                                    <td>
                                        {entry.status === 'waiting' && (
                                            <button
                                                className={styles.actionBtn}
                                                onClick={() => updateStatus(entry.id, 'notified')}
                                                title="Marcar como notificado"
                                            >
                                                Notificar
                                            </button>
                                        )}
                                        {entry.status === 'notified' && (
                                            <button
                                                className={styles.actionBtn}
                                                onClick={() => updateStatus(entry.id, 'converted')}
                                                title="Marcar como convertido"
                                            >
                                                Convertido
                                            </button>
                                        )}
                                        <button
                                            className={styles.deleteBtn}
                                            onClick={() => deleteEntry(entry.id)}
                                        >
                                            Remover
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
