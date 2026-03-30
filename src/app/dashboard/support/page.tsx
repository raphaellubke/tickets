'use client';

import styles from './page.module.css';

const faqs = [
    {
        question: 'Como criar um evento?',
        answer: 'Acesse "Eventos" no menu lateral e clique em "Criar Evento". Preencha as informações, adicione os tipos de ingresso e publique.',
    },
    {
        question: 'Como criar um formulário para os participantes?',
        answer: 'Acesse "Formulários" no menu lateral, clique em "Novo Formulário", adicione os campos desejados e associe ao evento na página do evento.',
    },
    {
        question: 'Como visualizar os participantes de um evento?',
        answer: 'Acesse "Eventos", clique no ícone de visualizar do evento desejado. Na página de detalhes você verá a lista de participantes.',
    },
    {
        question: 'Como emitir PDF dos participantes?',
        answer: 'Na página de detalhes do evento, selecione um ou mais participantes na tabela e clique em "Baixar PDF" ou "Baixar ZIP".',
    },
    {
        question: 'Como enviar e-mail em massa para os participantes?',
        answer: 'Na página de detalhes do evento, selecione os participantes desejados e clique em "Enviar E-mail". Será enviado um lembrete para preenchimento do formulário.',
    },
    {
        question: 'O que é um formulário de casal?',
        answer: 'É um formulário onde cada campo possui dois campos de resposta: um para o "Ele" e outro para a "Ela". Ative essa opção ao criar ou editar um formulário.',
    },
];

export default function SupportPage() {
    return (
        <div className={styles.container}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Suporte</h1>
                    <p className={styles.pageSubtitle}>Dúvidas frequentes e informações de contato</p>
                </div>
            </div>

            {/* Contact */}
            <div className={styles.contactCard}>
                <div className={styles.contactIcon}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                        <polyline points="22,6 12,13 2,6"/>
                    </svg>
                </div>
                <div>
                    <p className={styles.contactLabel}>Precisa de ajuda? Entre em contato</p>
                    <a href="mailto:suporte@tickets.com" className={styles.contactEmail}>
                        suporte@tickets.com
                    </a>
                </div>
            </div>

            {/* FAQ */}
            <div className={styles.faqSection}>
                <h2 className={styles.sectionTitle}>Perguntas Frequentes</h2>
                <div className={styles.faqList}>
                    {faqs.map((faq, i) => (
                        <div key={i} className={styles.faqItem}>
                            <div className={styles.faqQuestion}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                                </svg>
                                {faq.question}
                            </div>
                            <p className={styles.faqAnswer}>{faq.answer}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
