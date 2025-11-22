'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './Hero.module.css';

const slides = [
    {
        id: 1,
        tag: 'DESTAQUE',
        tagColor: '#fbbf24',
        title: 'Grande Encontro de Fé e Comunhão',
        location: 'Centro de Convenções',
        date: '15 de Novembro, 2025',
        image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=2070&auto=format&fit=crop'
    },
    {
        id: 2,
        tag: 'NOVO',
        tagColor: '#3b82f6',
        title: 'Festival de Louvor e Adoração',
        location: 'Arena Central',
        date: '22 de Novembro, 2025',
        image: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?q=80&w=2070&auto=format&fit=crop'
    },
    {
        id: 3,
        tag: 'IMPERDÍVEL',
        tagColor: '#ec4899',
        title: 'Conferência de Jovens 2025',
        location: 'Estádio Municipal',
        date: '5 de Dezembro, 2025',
        image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=2070&auto=format&fit=crop'
    }
];

export default function Hero() {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);

    const nextSlide = () => {
        if (isAnimating) return;
        setIsAnimating(true);
        setCurrentSlide((prev) => (prev + 1) % slides.length);
        setTimeout(() => setIsAnimating(false), 800);
    };

    const prevSlide = () => {
        if (isAnimating) return;
        setIsAnimating(true);
        setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
        setTimeout(() => setIsAnimating(false), 800);
    };

    const goToSlide = (index: number) => {
        if (isAnimating || index === currentSlide) return;
        setIsAnimating(true);
        setCurrentSlide(index);
        setTimeout(() => setIsAnimating(false), 800);
    };

    useEffect(() => {
        const interval = setInterval(nextSlide, 6000);
        return () => clearInterval(interval);
    }, [currentSlide, isAnimating]);

    const current = slides[currentSlide];
    const nextIndex = (currentSlide + 1) % slides.length;
    const next = slides[nextIndex];

    return (
        <section className={styles.hero}>
            {/* Main Slide */}
            <div className={styles.mainSlide}>
                {slides.map((slide, index) => (
                    <div
                        key={slide.id}
                        className={`${styles.slideBackground} ${index === currentSlide ? styles.activeSlide : ''}`}
                        style={{ backgroundImage: `url(${slide.image})` }}
                    />
                ))}

                <div className={styles.overlay} />

                <div className={styles.content}>
                    <div className={styles.mainContent}>
                        <span className={styles.tag} style={{ backgroundColor: current.tagColor }}>
                            {current.tag}
                        </span>
                        <h1 className={styles.title}>{current.title}</h1>
                        <div className={styles.details}>
                            <div className={styles.detailItem}>
                                <span className={styles.icon}>📍</span>
                                <span>{current.location}</span>
                            </div>
                            <div className={styles.detailItem}>
                                <span className={styles.icon}>📅</span>
                                <span>{current.date}</span>
                            </div>
                        </div>
                        <Link href={`/event/${current.id}`} className={styles.ctaButton}>
                            Ver Detalhes
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </Link>
                    </div>

                    {/* Next Slide Preview */}
                    <div className={styles.nextPreview}>
                        <div className={styles.previewLabel}>Próximo</div>
                        <Link href={`/event/${next.id}`} className={styles.previewCardLink}>
                            <div
                                className={styles.previewCard}
                                onClick={(e) => {
                                    e.preventDefault();
                                    goToSlide(nextIndex);
                                }}
                                style={{ backgroundImage: `url(${next.image})` }}
                            >
                                <div className={styles.previewOverlay} />
                                <div className={styles.previewContent}>
                                    <span className={styles.previewTag} style={{ backgroundColor: next.tagColor }}>
                                        {next.tag}
                                    </span>
                                    <h3 className={styles.previewTitle}>{next.title}</h3>
                                </div>
                            </div>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <div className={styles.controls}>
                <button
                    className={styles.navButton}
                    onClick={prevSlide}
                    aria-label="Slide anterior"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M15 18l-6-6 6-6" />
                    </svg>
                </button>
                <button
                    className={styles.navButton}
                    onClick={nextSlide}
                    aria-label="Próximo slide"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 18l6-6-6-6" />
                    </svg>
                </button>
            </div>

            {/* Indicators */}
            <div className={styles.indicators}>
                {slides.map((_, index) => (
                    <button
                        key={index}
                        className={`${styles.indicator} ${index === currentSlide ? styles.activeIndicator : ''}`}
                        onClick={() => goToSlide(index)}
                        aria-label={`Ir para slide ${index + 1}`}
                    />
                ))}
            </div>
        </section>
    );
}
