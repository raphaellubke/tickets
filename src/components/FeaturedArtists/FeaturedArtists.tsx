import styles from './FeaturedArtists.module.css';

const artists = [
    {
        id: 1,
        name: 'Gabriela Rocha',
        role: 'Cantora',
        image: 'https://images.unsplash.com/photo-1516575334481-f85287c2c81d?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    },
    {
        id: 2,
        name: 'Pr. Tiago Brunet',
        role: 'Palestrante',
        image: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    },
    {
        id: 3,
        name: 'Isadora Pompeo',
        role: 'Cantora',
        image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    },
    {
        id: 4,
        name: 'Fernandinho',
        role: 'Cantor',
        image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    },
];

export default function FeaturedArtists() {
    return (
        <section className={styles.section}>
            <div className={styles.header}>
                <h2 className={styles.title}>Artistas em Destaque</h2>
                <p className={styles.subtitle}>Conheça as vozes que estão transformando gerações</p>
            </div>

            <div className={styles.grid}>
                {artists.map((artist) => (
                    <div key={artist.id} className={styles.card}>
                        <div className={styles.imageContainer}>
                            <img src={artist.image} alt={artist.name} className={styles.image} />
                            <div className={styles.overlay}>
                                <button className={styles.button}>Ver Eventos</button>
                            </div>
                        </div>
                        <div className={styles.info}>
                            <h3 className={styles.name}>{artist.name}</h3>
                            <span className={styles.role}>{artist.role}</span>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
