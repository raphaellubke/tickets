'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import styles from './Hero.module.css';

interface HeroEvent {
    id: string;
    name: string;
    location: string | null;
    event_date: string;
    image_url: string | null;
    category: string | null;
}

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=2070&auto=format&fit=crop';

export default function Hero() {
    const [events, setEvents] = useState<HeroEvent[]>([]);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        async function fetchEvents() {
            try {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const { data } = await supabase
                    .from('events')
                    .select('id, name, location, event_date, image_url, category')
                    .eq('status', 'published')
                    .gte('event_date', today.toISOString().split('T')[0])
                    .order('event_date', { ascending: true })
                    .limit(3);
                if (data?.length) setEvents(data);
            } catch (err) {
                console.error('Hero fetch error:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchEvents();
    }, []);

    const nextSlide = () => {
        if (isAnimating || events.length <= 1) return;
        setIsAnimating(true);
        setCurrentSlide((prev) => (prev + 1) % events.length);
        setTimeout(() => setIsAnimating(false), 800);
    };

    const prevSlide = () => {
        if (isAnimating || events.length <= 1) return;
        setIsAnimating(true);
        setCurrentSlide((prev) => (prev - 1 + events.length) % events.length);
        setTimeout(() => setIsAnimating(false), 800);
    };

    const goToSlide = (index: number) => {
        if (isAnimating || index === currentSlide) return;
        setIsAnimating(true);
        setCurrentSlide(index);
        setTimeout(() => setIsAnimating(false), 800);
    };

    useEffect(() => {
        if (events.length <= 1) return;
        const interval = setInterval(nextSlide, 6000);
        return () => clearInterval(interval);
    }, [currentSlide, isAnimating, events.length]);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', {
            day: 'numeric', month: 'long', year: 'numeric',
        });
    };

    // Loading state
    if (loading) return null;

    // No events — simple static hero
    if (events.length === 0) {
        return (
            <section className={styles.hero}>
                <div className={styles.mainSlide}>
                    <div
                        className={`${styles.slideBackground} ${styles.activeSlide}`}
                        style={{ backgroundImage: `url(${FALLBACK_IMAGE})` }}
                    />
                    <div className={styles.overlay} />
                    <div className={styles.content}>
                        <div className={styles.mainContent}>
                            <h1 className={styles.title}>Encontre os melhores eventos</h1>
                            <p style={{ color: 'rgba(255,255,255,0.85)', margin: '0 0 1.5rem', fontSize: '1.1rem' }}>
                                Ingressos para eventos, congressos e muito mais.
                            </p>
                            <Link href="/events" className={styles.ctaButton}>
                                Ver Eventos
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                    <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    const current = events[currentSlide];
    const nextIndex = (currentSlide + 1) % events.length;
    const next = events[nextIndex];
    const showPreview = events.length > 1;

    return (
        <section className={styles.hero}>
            <div className={styles.mainSlide}>
                {events.map((event, index) => (
                    <div
                        key={event.id}
                        className={`${styles.slideBackground} ${index === currentSlide ? styles.activeSlide : ''}`}
                        style={{ backgroundImage: `url(${event.image_url || FALLBACK_IMAGE})` }}
                    />
                ))}

                <div className={styles.overlay} />

                <div className={styles.content}>
                    <div className={styles.mainContent}>
                        <h1 className={styles.title}>{current.name}</h1>
                        <div className={styles.details}>
                            {current.location && (
                                <div className={styles.detailItem}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                                    </svg>
                                    <span>{current.location}</span>
                                </div>
                            )}
                            <div className={styles.detailItem}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                                </svg>
                                <span>{formatDate(current.event_date)}</span>
                            </div>
                        </div>
                        <Link href={`/event/${current.id}`} className={styles.ctaButton}>
                            Ver Detalhes
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </Link>
                    </div>

                    {showPreview && (
                        <div className={styles.nextPreview}>
                            <div className={styles.previewLabel}>Próximo</div>
                            <div
                                className={styles.previewCard}
                                onClick={() => goToSlide(nextIndex)}
                                style={{ backgroundImage: `url(${next.image_url || FALLBACK_IMAGE})`, cursor: 'pointer' }}
                            >
                                <div className={styles.previewOverlay} />
                                <div className={styles.previewContent}>
                                    <h3 className={styles.previewTitle}>{next.name}</h3>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {events.length > 1 && (
                <>
                    <div className={styles.controls}>
                        <button className={styles.navButton} onClick={prevSlide} aria-label="Slide anterior">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M15 18l-6-6 6-6" />
                            </svg>
                        </button>
                        <button className={styles.navButton} onClick={nextSlide} aria-label="Próximo slide">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 18l6-6-6-6" />
                            </svg>
                        </button>
                    </div>
                    <div className={styles.indicators}>
                        {events.map((_, index) => (
                            <button
                                key={index}
                                className={`${styles.indicator} ${index === currentSlide ? styles.activeIndicator : ''}`}
                                onClick={() => goToSlide(index)}
                                aria-label={`Ir para slide ${index + 1}`}
                            />
                        ))}
                    </div>
                </>
            )}
        </section>
    );
}
