'use client';

import styles from './page.module.css';

export default function MembersPage() {
    const members = [
        {
            id: 1,
            name: 'Admin User',
            email: 'admin@divine.com',
            role: 'Proprietário',
            status: 'active',
            avatar: 'A',
            lastActive: 'Agora mesmo'
        },
        {
            id: 2,
            name: 'Sarah Costa',
            email: 'sarah.costa@divine.com',
            role: 'Administrador',
            status: 'active',
            avatar: 'S',
            lastActive: 'Há 2 horas'
        },
        {
            id: 3,
            name: 'Pedro Santos',
            email: 'pedro.s@divine.com',
            role: 'Editor',
            status: 'invited',
            avatar: 'P',
            lastActive: 'Convite enviado'
        },
        {
            id: 4,
            name: 'Lucas Oliveira',
            email: 'lucas.o@divine.com',
            role: 'Visualizador',
            status: 'active',
            avatar: 'L',
            lastActive: 'Há 1 dia'
        }
    ];

    return (
        <div className={styles.container}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Membros</h1>
                    <p className={styles.pageSubtitle}>Gerencie quem tem acesso à sua organização</p>
                </div>
                <button className={styles.primaryBtn}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>
                    Convidar Membro
                </button>
            </div>

            <div className={styles.contentGrid}>
                {/* Members List */}
                <div className={styles.mainColumn}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2 className={styles.cardTitle}>Equipe (4)</h2>
                            <div className={styles.searchBox}>
                                <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                                <input type="text" placeholder="Buscar membros..." className={styles.searchInput} />
                            </div>
                        </div>

                        <div className={styles.membersList}>
                            {members.map((member) => (
                                <div key={member.id} className={styles.memberRow}>
                                    <div className={styles.memberInfo}>
                                        <div className={styles.avatar}>{member.avatar}</div>
                                        <div className={styles.details}>
                                            <span className={styles.name}>{member.name}</span>
                                            <span className={styles.email}>{member.email}</span>
                                        </div>
                                    </div>

                                    <div className={styles.roleCell}>
                                        <span className={styles.roleBadge}>{member.role}</span>
                                    </div>

                                    <div className={styles.statusCell}>
                                        <span className={`${styles.statusDot} ${member.status === 'active' ? styles.active : styles.pending}`}></span>
                                        <span className={styles.statusText}>
                                            {member.status === 'active' ? 'Ativo' : 'Pendente'}
                                        </span>
                                    </div>

                                    <div className={styles.activityCell}>
                                        {member.lastActive}
                                    </div>

                                    <div className={styles.actionsCell}>
                                        <button className={styles.actionBtn}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Roles Info */}
                <div className={styles.sideColumn}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2 className={styles.cardTitle}>Permissões</h2>
                        </div>
                        <div className={styles.rolesList}>
                            <div className={styles.roleItem}>
                                <div className={styles.roleHeader}>
                                    <span className={styles.roleName}>Proprietário</span>
                                    <span className={styles.roleCount}>1</span>
                                </div>
                                <p className={styles.roleDesc}>Acesso total a todas as configurações e faturamento.</p>
                            </div>
                            <div className={styles.roleItem}>
                                <div className={styles.roleHeader}>
                                    <span className={styles.roleName}>Administrador</span>
                                    <span className={styles.roleCount}>1</span>
                                </div>
                                <p className={styles.roleDesc}>Pode gerenciar eventos, membros e integrações.</p>
                            </div>
                            <div className={styles.roleItem}>
                                <div className={styles.roleHeader}>
                                    <span className={styles.roleName}>Editor</span>
                                    <span className={styles.roleCount}>1</span>
                                </div>
                                <p className={styles.roleDesc}>Pode criar e editar eventos e formulários.</p>
                            </div>
                            <div className={styles.roleItem}>
                                <div className={styles.roleHeader}>
                                    <span className={styles.roleName}>Visualizador</span>
                                    <span className={styles.roleCount}>1</span>
                                </div>
                                <p className={styles.roleDesc}>Apenas visualização de dados e relatórios.</p>
                            </div>
                        </div>
                    </div>

                    <div className={styles.inviteCard}>
                        <h3 className={styles.inviteTitle}>Convide sua equipe</h3>
                        <p className={styles.inviteText}>Trabalhe melhor em equipe. Adicione membros para ajudar na gestão dos eventos.</p>
                        <button className={styles.secondaryBtn}>Copiar Link de Convite</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
