import styles from './Categories.module.css';

const categories = [
    { id: 1, name: 'Shows', icon: '🎤', color: 'from-purple-500 to-indigo-500' },
    { id: 2, name: 'Congressos', icon: '🏛️', color: 'from-blue-500 to-cyan-500' },
    { id: 3, name: 'Workshops', icon: '💡', color: 'from-emerald-500 to-teal-500' },
    { id: 4, name: 'Retiros', icon: 'camp', color: 'from-orange-500 to-amber-500' }, // Custom icon placeholder
    { id: 5, name: 'Infantil', icon: '🎈', color: 'from-pink-500 to-rose-500' },
    { id: 6, name: 'Social', icon: '🤝', color: 'from-red-500 to-pink-500' },
];

export default function Categories() {
    return (
        <section className={styles.section}>
            <div className={styles.header}>
                <h2 className={styles.title}>Explore por Categoria</h2>
                <a href="/categories" className={styles.viewAll}>Ver todas</a>
            </div>

            <div className={styles.grid}>
                {categories.map((category) => (
                    <div key={category.id} className={styles.card}>
                        <div className={`${styles.iconContainer} ${styles[category.color]}`}>
                            <span className={styles.icon}>{category.icon === 'camp' ? '⛺' : category.icon}</span>
                        </div>
                        <span className={styles.name}>{category.name}</span>
                    </div>
                ))}
            </div>
        </section>
    );
}
