import EventCard from '../EventCard/EventCard';
import styles from './EventList.module.css';
import Link from 'next/link';

// Mock data based on reference image
const EVENTS = [
    {
        id: 1,
        image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=2069&auto=format&fit=crop',
        tag: 'Culto',
        title: 'Culto de Celebração e Gratidão',
        location: 'Igreja Central - Florianópolis, SC',
        date: 'Ter, 10 Dez',
        time: '19:00',
        price: 'R$ 20,00'
    },
    {
        id: 2,
        image: 'https://images.unsplash.com/photo-1514525253440-b393452e8d26?q=80&w=1974&auto=format&fit=crop',
        tag: 'Workshop',
        title: 'Workshop de Música Gospel',
        location: 'Auditório Principal - Florianópolis, SC',
        date: 'Sáb, 14 Dez',
        time: '14:00',
        price: 'R$ 80,00'
    },
    {
        id: 3,
        image: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?q=80&w=2070&auto=format&fit=crop',
        tag: 'Solidário',
        title: 'Jantar Beneficente da Comunidade',
        location: 'Salão de Eventos - Florianópolis, SC',
        date: 'Sex, 20 Dez',
        time: '19:30',
        price: 'R$ 45,00'
    },
    {
        id: 4,
        image: 'https://images.unsplash.com/photo-1472653431158-6364773b2a56?q=80&w=2069&auto=format&fit=crop',
        tag: 'Acampamento',
        title: 'Acampamento de Natal para Crianças',
        location: 'Parque Campestre',
        date: 'Dom, 22 Dez',
        time: '08:00',
        price: 'R$ 120,00'
    }
];

export default function EventList() {
    return (
        <section className={styles.section}>
            <div className={styles.header}>
                <h2 className={styles.title}>Próximos Eventos</h2>
                <Link href="/events" className={styles.viewAll}>
                    Ver todos →
                </Link>
            </div>

            <div className={styles.grid}>
                {EVENTS.map(event => (
                    <EventCard key={event.id} {...event} />
                ))}
            </div>
        </section>
    );
}
