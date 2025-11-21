import Link from 'next/link';
import styles from './Header.module.css';

export default function Header() {
    return (
        <header className={styles.header}>
            <div className={styles.container}>
                <Link href="/" className={styles.logo}>
                    <span className={styles.logoIcon}>⛪</span>
                    <span className={styles.logoText}>DivineTickets</span>
                </Link>

                <div className={styles.locationSelector}>
                    <span className={styles.locationIcon}>📍</span>
                    <select className={styles.locationSelect}>
                        <option>Todos os estados</option>
                        <option>São Paulo</option>
                        <option>Rio de Janeiro</option>
                    </select>
                </div>

                <div className={styles.searchContainer}>
                    <input
                        type="text"
                        placeholder="Busque um evento, igreja, local..."
                        className={styles.searchInput}
                    />
                    <button className={styles.searchButton}>
                        🔍
                    </button>
                </div>

                <div className={styles.actions}>
                    <Link href="/create-event" className={styles.createEvent}>
                        <span className={styles.createIcon}>+</span>
                        Crie seu evento
                    </Link>
                    <Link href="/login" className={styles.loginButton}>
                        Entrar ou cadastrar
                    </Link>
                </div>
            </div>
        </header>
    );
}
