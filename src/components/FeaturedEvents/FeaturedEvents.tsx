'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import styles from './FeaturedEvents.module.css';

interface Event {
    id: string;
    name: string;
    image_url: string | null;
    category: string | null;
    location: string | null;
    event_date: string;
    minPrice?: number;
}

export default function FeaturedEvents() {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        async function fetchEvents() {
            try {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const { data: eventsData, error } = await supabase
                    .from('events')
                    .select('id, name, image_url, category, location, event_date')
                    .eq('status', 'published')
                    .gte('event_date', today.toISOString().split('T')[0])
                    .order('event_date', { ascending: true })
                    .limit(3);

                if (error || !eventsData?.length) {
                    setLoading(false);
                    return;
                }

                const eventsWithPrices = await Promise.all(eventsData.map(async (event) => {
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
                console.error('Error fetching featured events:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchEvents();
    }, []);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString + 'T00:00:00');
        const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
        return {
            day: String(date.getDate()).padStart(2, '0'),
            month: months[date.getMonth()],
        };
    };

    const formatPrice = (price: number) => {
        if (price === 0) return 'Gratuito';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
    };

    const getCategoryLabel = (category: string | null) => {
        const map: Record<string, string> = {
            culto: 'Culto', workshop: 'Workshop', show: 'Show',
            retiro: 'Retiro', conferencia: 'Conferência', outro: 'Evento',
        };
        return map[category?.toLowerCase() || ''] || category || 'Evento';
    };

    const defaultImage = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80';

    if (loading || events.length === 0) return null;

    return (
        <section className={styles.section}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Eventos em Destaque</h2>
                    <Link href="/events" className={styles.viewAll}>
                        Ver todos →
                    </Link>
                </div>

                <div className={styles.grid}>
                    {events.map((event) => {
                        const { day, month } = formatDate(event.event_date);
                        return (
                            <Link key={event.id} href={`/event/${event.id}`} className={styles.cardLink}>
                                <div className={styles.card}>
                                    <div className={styles.imageContainer}>
                                        <img
                                            src={event.image_url || defaultImage}
                                            alt={event.name}
                                            className={styles.image}
                                        />
                                        <div className={styles.overlay} />
                                    </div>

                                    <div className={styles.topContent}>
                                        <span className={styles.categoryTag}>{getCategoryLabel(event.category)}</span>
                                        <div className={styles.dateBadge}>
                                            <span className={styles.day}>{day}</span>
                                            <span className={styles.month}>{month}</span>
                                        </div>
                                    </div>

                                    <div className={styles.content}>
                                        <div className={styles.mainInfo}>
                                            <h3 className={styles.eventTitle}>{event.name}</h3>
                                            <div className={styles.locationRow}>
                                                <span className={styles.locationIcon}>📍</span>
                                                <span className={styles.location}>{event.location || 'Local a definir'}</span>
                                            </div>
                                        </div>

                                        <div className={styles.footer}>
                                            <div className={styles.priceBlock}>
                                                <span className={styles.priceLabel}>A partir de</span>
                                                <span className={styles.price}>{formatPrice(event.minPrice || 0)}</span>
                                            </div>
                                            <button className={styles.actionBtn} onClick={(e) => e.preventDefault()}>
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
