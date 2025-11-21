import styles from './Testimonials.module.css';

const testimonials = [
    {
        id: 1,
        text: "A DivineTickets facilitou muito a organização do nosso retiro. A plataforma é intuitiva e o suporte é excelente!",
        author: "Pr. Carlos Mendes",
        role: "Igreja Batista Central",
        image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80"
    },
    {
        id: 2,
        text: "Encontrei os melhores eventos gospel da minha cidade aqui. A experiência de compra é rápida e segura.",
        author: "Ana Paula Souza",
        role: "Líder de Jovens",
        image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80"
    },
    {
        id: 3,
        text: "Uma ferramenta indispensável para quem organiza eventos cristãos. Recomendo a todos os ministérios.",
        author: "Marcos Oliveira",
        role: "Produtor de Eventos",
        image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80"
    }
];

export default function Testimonials() {
    return (
        <section className={styles.section}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <h2 className={styles.title}>O que dizem sobre nós</h2>
                    <p className={styles.subtitle}>Histórias de quem já viveu a experiência DivineTickets</p>
                </div>

                <div className={styles.grid}>
                    {testimonials.map((item) => (
                        <div key={item.id} className={styles.card}>
                            <div className={styles.quoteIcon}>“</div>
                            <p className={styles.text}>{item.text}</p>

                            <div className={styles.authorInfo}>
                                <img src={item.image} alt={item.author} className={styles.avatar} />
                                <div className={styles.details}>
                                    <h4 className={styles.author}>{item.author}</h4>
                                    <span className={styles.role}>{item.role}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
