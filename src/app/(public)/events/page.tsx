'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import EventCard from '@/components/EventCard/EventCard';
import styles from './page.module.css';

interface Event {
    id: string;
    name: string;
    image_url: string | null;
    category: string | null;
    location: string | null;
    event_date: string;
    event_time: string;
    minPrice?: number;
}

const CATEGORIES = [
    { value: '', label: 'Todos' },
    { value: 'culto', label: 'Culto' },
    { value: 'workshop', label: 'Workshop' },
    { value: 'show', label: 'Show' },
    { value: 'retiro', label: 'Retiro' },
    { value: 'conferencia', label: 'Conferência' },
    { value: 'outro', label: 'Outro' },
];

export default function EventsPage() {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('');
    const supabase = createClient();

    useEffect(() => {
        async function fetchEvents() {
            try {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                let query = supabase
                    .from('events')
                    .select('id, name, image_url, category, location, event_date, event_time')
                    .eq('status', 'published')
                    .gte('event_date', today.toISOString().split('T')[0])
                    .order('event_date', { ascending: true });

                if (category) {
                    query = query.eq('category', category);
                }

                const { data: eventsData, error } = await query;

                if (error) {
                    console.error('Error fetching events:', error);
                    setLoading(false);
                    return;
                }

                const eventsWithPrices = await Promise.all((eventsData || []).map(async (event) => {
                    const { data: ticketTypes } = await supabase
                        .from('event_ticket_types')
                        .select('price')
                        .eq('event_id', event.id)
                        .eq('is_active', true)
                        .order('price', { ascending: true })
                        .limit(1);

                    return {
                        ...event,
                        minPrice: ticketTypes?.[0]?.price ? parseFloat(ticketTypes[0].price.toString()) : 0,
                    };
                }));

                setEvents(eventsWithPrices);
            } catch (err) {
                console.error('Error fetching events:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchEvents();
    }, [category]);

    const formatDate = (dateString: string, timeString: string) => {
        const date = new Date(dateString + 'T00:00:00');
        const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return {
            date: `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`,
            time: timeString || '00:00',
        };
    };

    const formatPrice = (price: number) => {
        if (price === 0) return 'Gratuito';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
    };

    const getCategoryLabel = (cat: string | null) => {
        const map: Record<string, string> = {
            culto: 'Culto', workshop: 'Workshop', show: 'Show',
            retiro: 'Retiro', conferencia: 'Conferência', outro: 'Evento',
        };
        return map[cat?.toLowerCase() || ''] || cat || 'Evento';
    };

    const filtered = events.filter(e =>
        !search || e.name.toLowerCase().includes(search.toLowerCase()) || (e.location || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <main className={styles.main}>
            <div className={styles.hero}>
                <h1 className={styles.heroTitle}>Próximos Eventos</h1>
                <p className={styles.heroSubtitle}>Encontre e compre ingressos para os melhores eventos</p>
            </div>

            <div className={styles.container}>
                <div className={styles.filters}>
                    <div className={styles.searchWrapper}>
                        <svg className={styles.searchIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Buscar eventos..."
                            className={styles.searchInput}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    <div className={styles.categoryTabs}>
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat.value}
                                className={`${styles.categoryTab} ${category === cat.value ? styles.activeTab : ''}`}
                                onClick={() => setCategory(cat.value)}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className={styles.grid}>
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className={styles.skeleton} />
                        ))}
                    </div>
                ) : filtered.length > 0 ? (
                    <>
                        <p className={styles.resultsCount}>{filtered.length} evento{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}</p>
                        <div className={styles.grid}>
                            {filtered.map(event => {
                                const { date, time } = formatDate(event.event_date, event.event_time);
                                return (
                                    <EventCard
                                        key={event.id}
                                        id={event.id}
                                        image={event.image_url || 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=2069&auto=format&fit=crop'}
                                        tag={getCategoryLabel(event.category)}
                                        title={event.name}
                                        location={event.location || 'Local a definir'}
                                        date={date}
                                        time={time}
                                        price={formatPrice(event.minPrice || 0)}
                                    />
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <div className={styles.empty}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <p>Nenhum evento encontrado</p>
                        {(search || category) && (
                            <button className={styles.clearBtn} onClick={() => { setSearch(''); setCategory(''); }}>
                                Limpar filtros
                            </button>
                        )}
                    </div>
                )}
            </div>
        </main>
    );
}
