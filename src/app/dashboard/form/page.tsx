'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

interface Form {
    id: string;
    title: string;
    description: string | null;
    fields: any;
    status: string;
    created_at: string;
    updated_at: string;
}

export default function FormsPage() {
    const { user } = useAuth();
    const [forms, setForms] = useState<Form[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalResponses: 0,
        activeForms: 0,
        completionRate: 0,
    });
    const supabase = createClient();

    useEffect(() => {
        async function fetchForms() {
            if (!user) return;

            try {
                // Get user's organization
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

                // Fetch forms
                const { data: formsData, error } = await supabase
                    .from('forms')
                    .select('*')
                    .eq('organization_id', memberData.organization_id)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                setForms(formsData || []);

                // Calculate stats
                const activeForms = formsData?.filter(f => f.status === 'active').length || 0;
                setStats({
                    totalResponses: 0, // TODO: Fetch from responses table
                    activeForms,
                    completionRate: 0, // TODO: Calculate from responses
                });
            } catch (error) {
                console.error('Error fetching forms:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchForms();
    }, [user]);

    const getStatusLabel = (status: string) => {
        const statusMap: Record<string, string> = {
            active: 'Ativo',
            draft: 'Rascunho',
            closed: 'Fechado',
        };
        return statusMap[status] || status;
    };

    const getLastUpdated = (updatedAt: string) => {
        const date = new Date(updatedAt);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);

        if (diffHours < 1) return 'Agora mesmo';
        if (diffHours < 24) return `Há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
        if (diffDays < 7) return `Há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
        if (diffDays < 30) return `Há ${Math.floor(diffDays / 7)} semana${Math.floor(diffDays / 7) > 1 ? 's' : ''}`;
        return `Há ${Math.floor(diffDays / 30)} mês${Math.floor(diffDays / 30) > 1 ? 'es' : ''}`;
    };

    const getFieldCount = (fields: any) => {
        if (!fields) return 0;
        if (Array.isArray(fields)) return fields.length;
        if (typeof fields === 'object') return Object.keys(fields).length;
        return 0;
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <p>Carregando formulários...</p>
            </div>
        );
    }

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
                    <span className={styles.statValue}>{stats.totalResponses}</span>
                </div>
                <div className={styles.statItem}>
                    <span className={styles.statLabel}>Formulários Ativos</span>
                    <span className={styles.statValue}>{stats.activeForms}</span>
                </div>
                <div className={styles.statItem}>
                    <span className={styles.statLabel}>Taxa de Conclusão</span>
                    <span className={styles.statValue}>{stats.completionRate}%</span>
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
                                <span>{getFieldCount(form.fields)} campos</span>
                                <span>•</span>
                                <span>Atualizado {getLastUpdated(form.updated_at)}</span>
                            </div>
                        </div>

                        <div className={styles.cardStats}>
                            <div className={styles.cardStat}>
                                <span className={styles.statNumber}>0</span>
                                <span className={styles.statText}>Respostas</span>
                            </div>
                            <div className={styles.cardStat}>
                                <span className={styles.statNumber}>0</span>
                                <span className={styles.statText}>Visualizações</span>
                            </div>
                        </div>

                        <div className={styles.cardFooter}>
                            <span className={`${styles.statusBadge} ${form.status === 'active' ? styles.statusActive :
                                form.status === 'draft' ? styles.statusDraft :
                                    styles.statusClosed
                                }`}>
                                {getStatusLabel(form.status)}
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
