'use client';

import Link from 'next/link';
import styles from './SponsoredEvent.module.css';

export default function SponsoredEvent() {
    return (
        <section className={styles.section}>
            <Link href="/event/1" className={styles.cardLink}>
                <div className={styles.card}>
                    <div className={styles.imageContainer}>
                        <img
                            src="https://images.unsplash.com/photo-1544531586-fde5298cdd40?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"
                            alt="Evento de Liderança"
                            className={styles.image}
                        />
                        <div className={styles.overlay}></div>
                    </div>

                    <div className={styles.content}>
                        <div className={styles.header}>
                            <span className={styles.sponsoredBadge}>Patrocinado</span>
                            <span className={styles.category}>Workshop</span>
                        </div>

                        <div className={styles.mainInfo}>
                            <h3 className={styles.organizer}>Dr. Sarah Mitchell apresenta</h3>
                            <h2 className={styles.title}>
                                Liderança Cristã: <br />
                                <span className={styles.highlight}>Construindo o Futuro</span>
                            </h2>
                        </div>

                        <div className={styles.footer}>
                            <div className={styles.details}>
                                <div className={styles.detailItem}>
                                    <span className={styles.icon}>📅</span>
                                    <div>
                                        <span className={styles.label}>Data</span>
                                        <span className={styles.value}>Sáb, 22 Nov</span>
                                    </div>
                                </div>
                                <div className={styles.divider}></div>
                                <div className={styles.detailItem}>
                                    <span className={styles.icon}>🎟️</span>
                                    <div>
                                        <span className={styles.label}>A partir</span>
                                        <span className={styles.value}>R$ 150,00</span>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.ctaButton}>
                                Garantir minha vaga
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
            </Link>
        </section>
    );
}
