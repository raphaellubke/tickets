import styles from './Footer.module.css';

export default function Footer() {
    return (
        <footer className={styles.footer}>
            <div className={styles.container}>
                <div className={styles.bottom}>
                    <div className={styles.logo}>
                        <span>✝️</span>
                        Missão Guadalupe
                    </div>
                    <p className={styles.copy}>
                        &copy; {new Date().getFullYear()} Missão Guadalupe. Todos os direitos reservados.
                    </p>
                </div>
            </div>
        </footer>
    );
}
