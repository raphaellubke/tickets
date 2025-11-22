'use client';

import styles from './page.module.css';

export default function OrganizationPage() {
    return (
        <div className={styles.container}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Configurações da Organização</h1>
                    <p className={styles.pageSubtitle}>Gerencie as informações e preferências da sua organização</p>
                </div>
                <button className={styles.primaryBtn}>
                    Salvar Alterações
                </button>
            </div>

            <div className={styles.tabs}>
                <button className={`${styles.tab} ${styles.activeTab}`}>Perfil</button>
                <button className={styles.tab}>Cobrança</button>
                <button className={styles.tab}>Notificações</button>
                <button className={styles.tab}>Integrações</button>
            </div>

            <div className={styles.contentGrid}>
                {/* Main Settings Column */}
                <div className={styles.mainColumn}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2 className={styles.cardTitle}>Perfil da Organização</h2>
                            <p className={styles.cardDescription}>Informações visíveis publicamente sobre sua organização.</p>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Logo</label>
                            <div className={styles.logoUpload}>
                                <div className={styles.logoPreview}>D</div>
                                <div className={styles.uploadActions}>
                                    <button className={styles.secondaryBtn}>Alterar logo</button>
                                    <button className={styles.textBtn}>Remover</button>
                                    <p className={styles.uploadHint}>JPG, GIF ou PNG. Max 1MB.</p>
                                </div>
                            </div>
                        </div>

                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Nome da Organização</label>
                                <input type="text" className={styles.input} defaultValue="DivineTickets" />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Slug (URL)</label>
                                <div className={styles.inputGroup}>
                                    <span className={styles.inputPrefix}>eventos.com/</span>
                                    <input type="text" className={styles.input} defaultValue="divinetickets" />
                                </div>
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Descrição</label>
                            <textarea className={styles.textarea} rows={4} defaultValue="Organização de eventos cristãos focada em conferências e workshops." />
                            <p className={styles.hint}>Breve descrição que aparecerá na sua página pública.</p>
                        </div>
                    </div>

                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2 className={styles.cardTitle}>Informações de Contato</h2>
                            <p className={styles.cardDescription}>Como os participantes podem entrar em contato com você.</p>
                        </div>

                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Email de Suporte</label>
                                <input type="email" className={styles.input} defaultValue="suporte@divinetickets.com" />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Telefone / WhatsApp</label>
                                <input type="tel" className={styles.input} defaultValue="(11) 99999-9999" />
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Website</label>
                            <input type="url" className={styles.input} defaultValue="https://divinetickets.com" />
                        </div>
                    </div>
                </div>

                {/* Sidebar Settings Column */}
                <div className={styles.sideColumn}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2 className={styles.cardTitle}>Visibilidade</h2>
                        </div>
                        <div className={styles.toggleGroup}>
                            <div className={styles.toggleRow}>
                                <div className={styles.toggleInfo}>
                                    <span className={styles.toggleLabel}>Página Pública</span>
                                    <span className={styles.toggleDesc}>Tornar a página da organização visível para todos</span>
                                </div>
                                <label className={styles.switch}>
                                    <input type="checkbox" defaultChecked />
                                    <span className={styles.slider}></span>
                                </label>
                            </div>
                            <div className={styles.toggleRow}>
                                <div className={styles.toggleInfo}>
                                    <span className={styles.toggleLabel}>Listar em Buscas</span>
                                    <span className={styles.toggleDesc}>Permitir que motores de busca indexem sua página</span>
                                </div>
                                <label className={styles.switch}>
                                    <input type="checkbox" defaultChecked />
                                    <span className={styles.slider}></span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2 className={styles.cardTitle}>Zona de Perigo</h2>
                        </div>
                        <div className={styles.dangerZone}>
                            <p className={styles.dangerText}>Ações irreversíveis para sua organização.</p>
                            <button className={styles.dangerBtn}>Deletar Organização</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
