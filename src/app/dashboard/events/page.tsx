'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import DropdownMenu from '@/components/DropdownMenu/DropdownMenu';
import styles from './page.module.css';

interface Event {
    id: string;
    name: string;
    title?: string; // Alias para name para compatibilidade
    description: string | null;
    event_date: string;
    location: string | null;
    status: string;
    image_url: string | null;
    cover_image_url?: string | null; // Alias para image_url
    created_at: string;
}

export default function EventsPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const supabase = createClient();

    const handleDeleteEvent = async (eventId: string, eventName: string) => {
        if (!confirm(`Tem certeza que deseja excluir o evento "${eventName}"? Esta ação não pode ser desfeita.`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('events')
                .delete()
                .eq('id', eventId);

            if (error) throw error;

            setEvents(events.filter(e => e.id !== eventId));
        } catch (error) {
            console.error('Error deleting event:', error);
            alert('Erro ao excluir evento. Tente novamente.');
        }
    };

    const handleDuplicateEvent = async (eventId: string) => {
        try {
            const eventToDuplicate = events.find(e => e.id === eventId);
            if (!eventToDuplicate) return;

            const { data: newEvent, error } = await supabase
                .from('events')
                .insert({
                    name: `${eventToDuplicate.name} (Cópia)`,
                    description: eventToDuplicate.description,
                    event_date: eventToDuplicate.event_date,
                    location: eventToDuplicate.location,
                    status: 'rascunho',
                    organization_id: (await supabase
                        .from('organization_members')
                        .select('organization_id')
                        .eq('user_id', user?.id)
                        .single()).data?.organization_id,
                })
                .select()
                .single();

            if (error) throw error;

            router.push(`/dashboard/events/new?id=${newEvent.id}`);
        } catch (error) {
            console.error('Error duplicating event:', error);
            alert('Erro ao duplicar evento. Tente novamente.');
        }
    };

    useEffect(() => {
        async function fetchEvents() {
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

                // Fetch events
                const { data: eventsData, error } = await supabase
                    .from('events')
                    .select('*')
                    .eq('organization_id', memberData.organization_id)
                    .order('event_date', { ascending: false });

                if (error) throw error;

                setEvents(eventsData || []);
            } catch (error) {
                console.error('Error fetching events:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchEvents();
    }, [user]);

    const getStatusLabel = (status: string) => {
        const statusMap: Record<string, string> = {
            publicado: 'Publicado',
            rascunho: 'Rascunho',
            finalizado: 'Encerrado',
            cancelado: 'Cancelado',
            arquivado: 'Arquivado',
            ativo: 'Ativo',
        };
        return statusMap[status] || status;
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const filteredEvents = events
        .filter(event => {
            if (activeFilter === 'all') return true;
            if (activeFilter === 'published') return event.status === 'publicado';
            if (activeFilter === 'draft') return event.status === 'rascunho';
            if (activeFilter === 'ended') return event.status === 'finalizado';
            return true;
        })
        .filter(event => {
            const eventName = event.name || event.title || '';
            const eventLocation = event.location || '';
            const search = searchTerm.toLowerCase();
            return eventName.toLowerCase().includes(search) ||
                eventLocation.toLowerCase().includes(search);
        });

    if (loading) {
        return (
            <div className={styles.container}>
                <p>Carregando eventos...</p>
            </div>
        );
    }

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
                    <button
                        className={`${styles.tab} ${activeFilter === 'all' ? styles.activeTab : ''}`}
                        onClick={() => setActiveFilter('all')}
                    >
                        Todos
                    </button>
                    <button
                        className={`${styles.tab} ${activeFilter === 'published' ? styles.activeTab : ''}`}
                        onClick={() => setActiveFilter('published')}
                    >
                        Publicados
                    </button>
                    <button
                        className={`${styles.tab} ${activeFilter === 'draft' ? styles.activeTab : ''}`}
                        onClick={() => setActiveFilter('draft')}
                    >
                        Rascunhos
                    </button>
                    <button
                        className={`${styles.tab} ${activeFilter === 'ended' ? styles.activeTab : ''}`}
                        onClick={() => setActiveFilter('ended')}
                    >
                        Encerrados
                    </button>
                </div>
                <div className={styles.searchBox}>
                    <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    <input
                        type="text"
                        placeholder="Buscar eventos..."
                        className={styles.searchInput}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
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
                        {filteredEvents.map((event) => (
                            <tr key={event.id}>
                                <td>
                                    <div className={styles.eventCell}>
                                        <div
                                            className={styles.eventImage}
                                            style={{
                                                backgroundImage: (event.image_url || event.cover_image_url)
                                                    ? `url(${event.image_url || event.cover_image_url})`
                                                    : 'linear-gradient(135deg, #4A90E2 0%, #357ABD 100%)'
                                            }}
                                        />
                                        <div className={styles.eventInfo}>
                                            <div className={styles.eventTitle}>{event.name || event.title || 'Sem título'}</div>
                                            <div className={styles.eventMeta}>
                                                <span>📅 {formatDate(event.event_date)}</span>
                                                {event.location && <span>📍 {event.location}</span>}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <span className={`${styles.badge} ${event.status === 'publicado' ? styles.badgeSuccess :
                                        event.status === 'rascunho' ? styles.badgeWarning :
                                            styles.badgeNeutral
                                        }`}>
                                        {getStatusLabel(event.status)}
                                    </span>
                                </td>
                                <td>
                                    <div className={styles.salesInfo}>
                                        <div className={styles.salesText}>
                                            <span className={styles.salesCount}>0/100</span>
                                            <span className={styles.salesPercent}>0%</span>
                                        </div>
                                        <div className={styles.progressBar}>
                                            <div
                                                className={styles.progressFill}
                                                style={{ width: '0%' }}
                                            />
                                        </div>
                                    </div>
                                </td>
                                <td className={styles.revenueCell}>R$ 0,00</td>
                                <td>
                                    <div className={styles.actions}>
                                        <Link 
                                            href={`/dashboard/events/new?id=${event.id}`}
                                            className={styles.actionBtn} 
                                            title="Editar"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                            </svg>
                                        </Link>
                                        <DropdownMenu
                                            options={[
                                                {
                                                    label: 'Duplicar',
                                                    icon: (
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                        </svg>
                                                    ),
                                                    onClick: () => handleDuplicateEvent(event.id),
                                                },
                                                {
                                                    label: 'Excluir',
                                                    icon: (
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <polyline points="3 6 5 6 21 6" />
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                        </svg>
                                                    ),
                                                    onClick: () => handleDeleteEvent(event.id, event.name || event.title || 'Evento'),
                                                    danger: true,
                                                },
                                            ]}
                                        >
                                            <button className={styles.actionBtn} title="Mais opções">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <circle cx="12" cy="12" r="1" />
                                                    <circle cx="19" cy="12" r="1" />
                                                    <circle cx="5" cy="12" r="1" />
                                                </svg>
                                            </button>
                                        </DropdownMenu>
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
