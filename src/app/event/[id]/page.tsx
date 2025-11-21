import Header from '@/components/Header/Header';
import styles from './page.module.css';

export default function EventDetails({ params }: { params: { id: string } }) {
    return (
        <main className={styles.main}>
            <Header />

            <div className={styles.hero}>
                <div className={styles.heroOverlay}></div>
                <div className={styles.heroImage} style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=2070&auto=format&fit=crop)' }}></div>
                <div className={styles.heroContent}>
                    <span className={styles.tag}>🔥 Destaque</span>
                    <h1 className={styles.title}>Grande Encontro de Fé e Comunhão</h1>
                    <div className={styles.heroDetails}>
                        <div className={styles.detailItem}>
                            <span className={styles.detailIcon}>📅</span>
                            <span>15 de Novembro, 2025 • 19:00</span>
                        </div>
                        <div className={styles.detailItem}>
                            <span className={styles.detailIcon}>📍</span>
                            <span>Centro de Convenções</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.container}>
                <div className={styles.content}>
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Sobre o Evento</h2>
                        <p className={styles.description}>
                            Junte-se a nós para uma noite inesquecível de louvor, adoração e comunhão.
                            Este evento reunirá igrejas de toda a região para celebrar a fé e a unidade.
                            Teremos participações especiais de bandas e preletores renomados que trarão
                            uma palavra de esperança e renovação para sua vida.
                            <br /><br />
                            Não perca esta oportunidade de estar conectado com pessoas que compartilham
                            da mesma fé e propósito. O evento contará com estrutura completa de alimentação,
                            estacionamento e segurança para você e sua família.
                        </p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Localização</h2>
                        <p className={styles.address}>
                            <strong>Centro de Convenções de Florianópolis</strong><br />
                            Av. Gustavo Richard, 850 - Centro<br />
                            Florianópolis - SC
                        </p>
                    </section>
                </div>

                <aside className={styles.sidebar}>
                    <div className={styles.ticketCard}>
                        <div className={styles.ticketHeader}>
                            <h3 className={styles.ticketTitle}>Ingressos</h3>
                            <span className={styles.ticketSubtitle}>Garanta seu lugar agora</span>
                        </div>

                        <div className={styles.priceRow}>
                            <span className={styles.priceLabel}>Entrada Geral</span>
                            <span className={styles.price}>R$ 50,00</span>
                        </div>

                        <button className={styles.buyButton}>
                            Comprar Ingresso 🎟️
                        </button>
                        <p className={styles.disclaimer}>* Taxas podem ser aplicadas no checkout</p>
                    </div>
                </aside>
            </div>
        </main>
    );
}
