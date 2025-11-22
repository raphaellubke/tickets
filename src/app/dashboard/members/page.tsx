'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import InviteMemberModal from '@/components/InviteMemberModal/InviteMemberModal';
import styles from './page.module.css';

interface Member {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    joined_at: string | null;
    user_id: string | null;
}

export default function MembersPage() {
    const { user } = useAuth();
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const supabase = createClient();

    useEffect(() => {
        async function fetchMembers() {
            if (!user) return;

            try {
                // First, get the user's organization
                const { data: memberData } = await supabase
                    .from('organization_members')
                    .select('organization_id')
                    .eq('user_id', user.id)
                    .eq('status', 'active')
                    .single();

                if (!memberData) {
                    setLoading(false);
                    return;
                }

                // Then fetch all members of that organization
                const { data: allMembers, error } = await supabase
                    .from('organization_members')
                    .select('*')
                    .eq('organization_id', memberData.organization_id)
                    .order('created_at', { ascending: true });

                if (error) throw error;

                setMembers(allMembers || []);
            } catch (error) {
                console.error('Error fetching members:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchMembers();
    }, [user]);

    const getRoleLabel = (role: string) => {
        const roleMap: Record<string, string> = {
            owner: 'Proprietário',
            admin: 'Administrador',
            organizer: 'Organizador',
            moderator: 'Moderador',
            member: 'Membro',
        };
        return roleMap[role] || role;
    };

    const getStatusLabel = (status: string) => {
        const statusMap: Record<string, string> = {
            active: 'Ativo',
            pending: 'Pendente',
            suspended: 'Suspenso',
        };
        return statusMap[status] || status;
    };

    const getLastActive = (joinedAt: string | null) => {
        if (!joinedAt) return 'Convite enviado';

        const date = new Date(joinedAt);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);

        if (diffHours < 1) return 'Agora mesmo';
        if (diffHours < 24) return `Há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
        if (diffDays < 7) return `Há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
        return date.toLocaleDateString('pt-BR');
    };

    const filteredMembers = members.filter(member =>
        member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const roleCounts = members.reduce((acc, member) => {
        acc[member.role] = (acc[member.role] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    if (loading) {
        return (
            <div className={styles.container}>
                <p>Carregando membros...</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Membros</h1>
                    <p className={styles.pageSubtitle}>Gerencie quem tem acesso à sua organização</p>
                </div>
                <button 
                    className={styles.primaryBtn}
                    onClick={() => setIsInviteModalOpen(true)}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>
                    Convidar Membro
                </button>
            </div>

            <div className={styles.contentGrid}>
                {/* Members List */}
                <div className={styles.mainColumn}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2 className={styles.cardTitle}>Equipe ({members.length})</h2>
                            <div className={styles.searchBox}>
                                <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                                <input
                                    type="text"
                                    placeholder="Buscar membros..."
                                    className={styles.searchInput}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className={styles.membersList}>
                            {filteredMembers.map((member) => (
                                <div key={member.id} className={styles.memberRow}>
                                    <div className={styles.memberInfo}>
                                        <div className={styles.avatar}>
                                            {member.name[0]?.toUpperCase() || 'U'}
                                        </div>
                                        <div className={styles.details}>
                                            <span className={styles.name}>{member.name}</span>
                                            <span className={styles.email}>{member.email}</span>
                                        </div>
                                    </div>

                                    <div className={styles.roleCell}>
                                        <span className={styles.roleBadge}>{getRoleLabel(member.role)}</span>
                                    </div>

                                    <div className={styles.statusCell}>
                                        <span className={`${styles.statusDot} ${member.status === 'active' ? styles.active : styles.pending}`}></span>
                                        <span className={styles.statusText}>
                                            {getStatusLabel(member.status)}
                                        </span>
                                    </div>

                                    <div className={styles.activityCell}>
                                        {getLastActive(member.joined_at)}
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
                                    <span className={styles.roleCount}>{roleCounts.owner || 0}</span>
                                </div>
                                <p className={styles.roleDesc}>Acesso total a todas as configurações e faturamento.</p>
                            </div>
                            <div className={styles.roleItem}>
                                <div className={styles.roleHeader}>
                                    <span className={styles.roleName}>Administrador</span>
                                    <span className={styles.roleCount}>{roleCounts.admin || 0}</span>
                                </div>
                                <p className={styles.roleDesc}>Pode gerenciar eventos, membros e integrações.</p>
                            </div>
                            <div className={styles.roleItem}>
                                <div className={styles.roleHeader}>
                                    <span className={styles.roleName}>Organizador</span>
                                    <span className={styles.roleCount}>{roleCounts.organizer || 0}</span>
                                </div>
                                <p className={styles.roleDesc}>Pode criar e editar eventos e formulários.</p>
                            </div>
                            <div className={styles.roleItem}>
                                <div className={styles.roleHeader}>
                                    <span className={styles.roleName}>Membro</span>
                                    <span className={styles.roleCount}>{roleCounts.member || 0}</span>
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

            <InviteMemberModal
                isOpen={isInviteModalOpen}
                onClose={() => setIsInviteModalOpen(false)}
                onSuccess={() => {
                    setIsInviteModalOpen(false);
                    // Reload members
                    window.location.reload();
                }}
            />
        </div>
    );
}
