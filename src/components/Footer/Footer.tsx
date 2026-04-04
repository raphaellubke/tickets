import Image from 'next/image';
import styles from './Footer.module.css';

export default function Footer() {
    return (
        <footer className={styles.footer}>
            <div className={styles.container}>
                <div className={styles.bottom}>
                    <div className={styles.logo}>
                        <Image
                            src="/logo.png"
                            alt="Missão Guadalupe"
                            height={32}
                            width={120}
                            style={{ objectFit: 'contain', height: '32px', width: 'auto' }}
                        />
                    </div>
                    <p className={styles.copy}>
                        &copy; {new Date().getFullYear()} Missão Guadalupe. Todos os direitos reservados.
                    </p>
                </div>
            </div>
        </footer>
    );
}
