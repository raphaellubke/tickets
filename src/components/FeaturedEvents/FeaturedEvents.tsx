'use client';

import Link from 'next/link';
import styles from './FeaturedEvents.module.css';

export default function FeaturedEvents() {
    const events = [
        {
            id: 1,
            title: 'Conferência Anual 2024',
            subtitle: 'Transformando Vidas',
            date: '15',
            month: 'DEZ',
            location: 'Arena Divine',
            price: '80,00',
            image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
            category: 'Conferência'
        },
        {
            id: 2,
            title: 'Noite de Adoração',
            subtitle: 'Experiência Única',
            date: '22',
            month: 'DEZ',
            location: 'Centro de Convenções',
            price: '45,00',
            image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
            category: 'Worship'
        },
        {
            id: 3,
            title: 'Retiro de Jovens',
            subtitle: 'Renovação Espiritual',
            date: '28',
            month: 'DEZ',
            location: 'Sítio Esperança',
            price: '120,00',
            image: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
            category: 'Retiro'
        },
    ];

    return (
        <section className={styles.section}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <span className={styles.badge}>✨ Destaques</span>
                    <h2 className={styles.title}>Eventos Imperdíveis</h2>
                </div>

                <div className={styles.grid}>
                    {events.map((event) => (
                        <Link key={event.id} href={`/event/${event.id}`} className={styles.cardLink}>
                            <div className={styles.card}>
                                <div className={styles.imageContainer}>
                                    <img
                                        src={event.image}
                                        alt={event.title}
                                        className={styles.image}
                                    />
                                    <div className={styles.overlay} />
                                </div>

                                <div className={styles.topContent}>
                                    <span className={styles.categoryTag}>{event.category}</span>
                                    <div className={styles.dateBadge}>
                                        <span className={styles.day}>{event.date}</span>
                                        <span className={styles.month}>{event.month}</span>
                                    </div>
                                </div>

                                <div className={styles.content}>
                                    <div className={styles.mainInfo}>
                                        <span className={styles.subtitle}>{event.subtitle}</span>
                                        <h3 className={styles.eventTitle}>{event.title}</h3>
                                        <div className={styles.locationRow}>
                                            <span className={styles.locationIcon}>📍</span>
                                            <span className={styles.location}>{event.location}</span>
                                        </div>
                                    </div>

                                    <div className={styles.footer}>
                                        <div className={styles.priceBlock}>
                                            <span className={styles.priceLabel}>A partir de</span>
                                            <span className={styles.price}>R$ {event.price}</span>
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
                    ))}
                </div>
            </div>
        </section>
    );
}
