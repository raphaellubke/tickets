import styles from './WhyBuyWithUs.module.css';

export default function WhyBuyWithUs() {
    const benefits = [
        {
            id: 1,
            icon: '🔒',
            title: 'Checkout Seguro',
            description: 'Pagamento rápido e protegido',
        },
        {
            id: 2,
            icon: '💳',
            title: 'Confirmação Instantânea',
            description: 'Opções de reembolso garantidas',
        },
        {
            id: 3,
            icon: '🎫',
            title: 'Vendedor Oficial',
            description: 'Usado por mais de 10 mil pessoas',
        },
        {
            id: 4,
            icon: '💬',
            title: 'Atendimento 24/7',
            description: 'Suporte confiável pós-venda',
        },
    ];

    return (
        <section className={styles.section}>
            <div className={styles.container}>
                <h2 className={styles.title}>Por que comprar com DivineTickets?</h2>

                <div className={styles.grid}>
                    {benefits.map((benefit) => (
                        <div key={benefit.id} className={styles.card}>
                            <div className={styles.iconWrapper}>
                                <span className={styles.icon}>{benefit.icon}</span>
                            </div>
                            <h3 className={styles.cardTitle}>{benefit.title}</h3>
                            <p className={styles.description}>{benefit.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
