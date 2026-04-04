'use client';

import Link from 'next/link';
import styles from './EventCard.module.css';

interface EventCardProps {
    id: string | number;
    image: string;
    tag: string;
    title: string;
    location: string;
    date: string;
    time?: string;
    price: string;
}

export default function EventCard({ id, image, tag, title, location, date, price }: EventCardProps) {
    return (
        <Link href={`/event/${id}`} className={styles.cardLink}>
            <article className={styles.card}>
                <div className={styles.imageContainer}>
                    <img src={image} alt={title} className={styles.image} />
                    <span className={styles.tag}>{tag}</span>
                    <button className={styles.likeButton} onClick={(e) => e.preventDefault()}>
                        ♡
                    </button>
                </div>
                <div className={styles.content}>
                    <h3 className={styles.title}>{title}</h3>
                    <p className={styles.location}>{location}</p>
                    <div className={styles.footer}>
                        <div className={styles.dateTime}>
                            <span className={styles.date}>{date}</span>
                        </div>
                        <div className={styles.priceContainer}>
                            <span className={styles.price}>{price}</span>
                            <span className={styles.perPerson}>por pessoa</span>
                        </div>
                    </div>
                </div>
            </article>
        </Link>
    );
}