'use client';

import styles from './page.module.css';

export default function FormsPage() {
    const forms = [
        {
            id: 1,
            title: 'Inscrição de Voluntários',
            responses: 45,
            status: 'active',
            lastUpdated: 'Há 2 dias',
            fields: 8,
            views: 120
        },
        {
            id: 2,
            title: 'Pesquisa de Satisfação - Culto',
            responses: 128,
            status: 'active',
            lastUpdated: 'Há 5 horas',
            fields: 5,
            views: 340
        },
        {
            id: 3,
            title: 'Cadastro Escola Bíblica',
            responses: 12,
            status: 'draft',
            lastUpdated: 'Há 1 semana',
            fields: 12,
            views: 0
        },
        {
            id: 4,
            title: 'Feedback Retiro 2024',
            responses: 89,
            status: 'closed',
            lastUpdated: 'Há 1 mês',
            fields: 6,
            views: 200
        }
    ];

    return (
        <div className={styles.container}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Formulários</h1>
                    <p className={styles.pageSubtitle}>Crie e gerencie formulários de inscrição personalizados</p>
                </div>
                <button className={styles.primaryBtn}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    Novo Formulário
                </button>
            </div>

            {/* Stats Overview */}
            <div className={styles.statsRow}>
                <div className={styles.statItem}>
                    <span className={styles.statLabel}>Total de Respostas</span>
                    <span className={styles.statValue}>274</span>
                </div>
                <div className={styles.statItem}>
                    <span className={styles.statLabel}>Formulários Ativos</span>
                    <span className={styles.statValue}>2</span>
                </div>
                <div className={styles.statItem}>
                    <span className={styles.statLabel}>Taxa de Conclusão</span>
                    <span className={styles.statValue}>68%</span>
                </div>
            </div>

            {/* Forms Grid */}
            <div className={styles.formsGrid}>
                {forms.map((form) => (
                    <div key={form.id} className={styles.formCard}>
                        <div className={styles.cardHeader}>
                            <div className={styles.iconBox}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                            </div>
                            <button className={styles.moreBtn}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>
                            </button>
                        </div>

                        <div className={styles.cardContent}>
                            <h3 className={styles.formTitle}>{form.title}</h3>
                            <div className={styles.formMeta}>
                                <span>{form.fields} campos</span>
                                <span>•</span>
                                <span>Atualizado {form.lastUpdated}</span>
                            </div>
                        </div>

                        <div className={styles.cardStats}>
                            <div className={styles.cardStat}>
                                <span className={styles.statNumber}>{form.responses}</span>
                                <span className={styles.statText}>Respostas</span>
                            </div>
                            <div className={styles.cardStat}>
                                <span className={styles.statNumber}>{form.views}</span>
                                <span className={styles.statText}>Visualizações</span>
                            </div>
                        </div>

                        <div className={styles.cardFooter}>
                            <span className={`${styles.statusBadge} ${form.status === 'active' ? styles.statusActive :
                                    form.status === 'draft' ? styles.statusDraft :
                                        styles.statusClosed
                                }`}>
                                {form.status === 'active' ? 'Ativo' :
                                    form.status === 'draft' ? 'Rascunho' : 'Fechado'}
                            </span>
                            <button className={styles.actionLink}>Ver Respostas →</button>
                        </div>
                    </div>
                ))}

                {/* Create New Card Placeholder */}
                <button className={styles.createCard}>
                    <div className={styles.createIcon}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    </div>
                    <span className={styles.createText}>Criar Novo Formulário</span>
                </button>
            </div>
        </div>
    );
}
