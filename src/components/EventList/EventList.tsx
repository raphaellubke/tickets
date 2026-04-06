'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import EventCard from '../EventCard/EventCard';
import styles from './EventList.module.css';
import Link from 'next/link';

interface Event {
    id: string;
    name: string;
    image_url: string | null;
    category: string | null;
    location: string | null;
    event_date: string;
    event_time: string;
    minPrice?: number;
    isCouple?: boolean;
}

export default function EventList() {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        async function fetchEvents() {
            try {
                // Fetch upcoming events (public events only)
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const { data: eventsData, error } = await supabase
                    .from('events')
                    .select(`
                        id,
                        name,
                        image_url,
                        category,
                        location,
                        event_date,
                        event_time,
                        status
                    `)
                    .in('status', ['published'])
                    .gte('event_date', today.toISOString().split('T')[0])
                    .order('event_date', { ascending: true })
                    .order('event_time', { ascending: true })
                    .limit(4);

                if (error) {
                    console.error('Error fetching events:', error);
                    setLoading(false);
                    return;
                }

                // Get minimum price for each event from ticket types
                const eventsWithPrices = await Promise.all((eventsData || []).map(async (event) => {
                    const { data: ticketTypes } = await supabase
                        .from('event_ticket_types')
                        .select('price, is_couple')
                        .eq('event_id', event.id)
                        .eq('is_active', true)
                        .order('price', { ascending: true })
                        .limit(1);

                    const minPrice = ticketTypes && ticketTypes.length > 0
                        ? parseFloat(ticketTypes[0].price?.toString() || '0')
                        : 0;

                    const isCouple = ticketTypes && ticketTypes.length > 0
                        ? (ticketTypes[0].is_couple ?? false)
                        : false;

                    return {
                        ...event,
                        minPrice,
                        isCouple,
                    };
                }));

                setEvents(eventsWithPrices);
            } catch (error) {
                console.error('Error fetching events:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchEvents();
    }, []);

    const formatDate = (dateString: string, timeString: string) => {
        const [y, m, d] = dateString.split('T')[0].split('-').map(Number);
        const date = new Date(y, m - 1, d);
        const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        
        const dayName = days[date.getDay()];
        const day = date.getDate();
        const month = months[date.getMonth()];
        
        return {
            date: `${dayName}, ${day} ${month}`,
            time: timeString || '00:00'
        };
    };

    const formatPrice = (price: number) => {
        if (price === 0) return 'Gratuito';
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(price);
    };

    const getCategoryLabel = (category: string | null) => {
        const categoryMap: Record<string, string> = {
            'culto': 'Culto',
            'workshop': 'Workshop',
            'show': 'Show',
            'retiro': 'Retiro',
            'conferencia': 'Conferência',
            'outro': 'Evento'
        };
        return categoryMap[category?.toLowerCase() || ''] || category || 'Evento';
    };

    if (loading) {
        return (
            <section className={styles.section}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Próximos Eventos</h2>
                    <Link href="/events" className={styles.viewAll}>
                        Ver todos →
                    </Link>
                </div>
                <div className={styles.grid}>
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} style={{ 
                            height: '400px', 
                            background: '#f3f4f6', 
                            borderRadius: '12px',
                            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                        }} />
                    ))}
                </div>
            </section>
        );
    }

    return (
        <section className={styles.section}>
            <div className={styles.header}>
                <h2 className={styles.title}>Próximos Eventos</h2>
                <Link href="/events" className={styles.viewAll}>
                    Ver todos →
                </Link>
            </div>

            <div className={styles.grid}>
                {events.length > 0 ? (
                    events.map(event => {
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
                                isCouple={event.isCouple}
                            />
                        );
                    })
                ) : (
                    <div style={{ 
                        gridColumn: '1 / -1', 
                        textAlign: 'center', 
                        padding: '3rem',
                        color: '#6b7280'
                    }}>
                        <p>Nenhum evento próximo disponível</p>
                    </div>
                )}
            </div>
        </section>
    );
}
