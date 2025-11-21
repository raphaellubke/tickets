import styles from './Footer.module.css';
import Link from 'next/link';

export default function Footer() {
    return (
        <footer className={styles.footer}>
            <div className={styles.container}>
                <div className={styles.content}>
                    <div className={styles.brand}>
                        <div className={styles.logo}>
                            <span className={styles.logoIcon}>✨</span>
                            DivineTickets
                        </div>
                        <p className={styles.description}>
                            A sua plataforma confiável para descobrir e comprar ingressos para os melhores eventos gospel e cristãos.
                        </p>
                    </div>

                    <div className={styles.links}>
                        <h3 className={styles.sectionTitle}>Navegação</h3>
                        <ul className={styles.linkList}>
                            <li><Link href="/" className={styles.link}>Início</Link></li>
                            <li><Link href="/events" className={styles.link}>Eventos</Link></li>
                            <li><Link href="/about" className={styles.link}>Sobre Nós</Link></li>
                            <li><Link href="/contact" className={styles.link}>Contato</Link></li>
                        </ul>
                    </div>

                    <div className={styles.links}>
                        <h3 className={styles.sectionTitle}>Ajuda</h3>
                        <ul className={styles.linkList}>
                            <li><Link href="/faq" className={styles.link}>FAQ</Link></li>
                            <li><Link href="/support" className={styles.link}>Suporte</Link></li>
                            <li><Link href="/terms" className={styles.link}>Termos de Uso</Link></li>
                            <li><Link href="/privacy" className={styles.link}>Privacidade</Link></li>
                        </ul>
                    </div>

                    <div className={styles.newsletter}>
                        <h3 className={styles.sectionTitle}>Fique por dentro</h3>
                        <p className={styles.newsletterText}>Receba novidades sobre os próximos eventos.</p>
                        <div className={styles.inputGroup}>
                            <input type="email" placeholder="Seu e-mail" className={styles.input} />
                            <button className={styles.button}>Assinar</button>
                        </div>
                    </div>
                </div>

                <div className={styles.bottom}>
                    <p>&copy; {new Date().getFullYear()} DivineTickets. Todos os direitos reservados.</p>
                    <div className={styles.socials}>
                        {/* Social icons placeholders */}
                        <span className={styles.socialIcon}>Instagram</span>
                        <span className={styles.socialIcon}>Facebook</span>
                        <span className={styles.socialIcon}>Twitter</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
