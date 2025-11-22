'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import DropdownMenu from '@/components/DropdownMenu/DropdownMenu';
import FormPreviewModal from '@/components/FormPreviewModal/FormPreviewModal';
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
    const router = useRouter();
    const [forms, setForms] = useState<Form[]>([]);
    const [loading, setLoading] = useState(true);
    const [previewFormId, setPreviewFormId] = useState<string | null>(null);
    const [previewFormTitle, setPreviewFormTitle] = useState<string>('');
    const [stats, setStats] = useState({
        totalResponses: 0,
        activeForms: 0,
        completionRate: 0,
    });
    const supabase = createClient();

    const handleDeleteForm = async (formId: string, formTitle: string) => {
        if (!confirm(`Tem certeza que deseja excluir o formulário "${formTitle}"? Esta ação não pode ser desfeita.`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('forms')
                .delete()
                .eq('id', formId);

            if (error) throw error;

            setForms(forms.filter(f => f.id !== formId));
        } catch (error) {
            console.error('Error deleting form:', error);
            alert('Erro ao excluir formulário. Tente novamente.');
        }
    };

    const handleDuplicateForm = async (formId: string) => {
        try {
            const formToDuplicate = forms.find(f => f.id === formId);
            if (!formToDuplicate) return;

            const { data: newForm, error } = await supabase
                .from('forms')
                .insert({
                    title: `${formToDuplicate.title} (Cópia)`,
                    description: formToDuplicate.description,
                    status: 'draft',
                    organization_id: (await supabase
                        .from('organization_members')
                        .select('organization_id')
                        .eq('user_id', user?.id)
                        .single()).data?.organization_id,
                })
                .select()
                .single();

            if (error) throw error;

            // Duplicate form fields
            const { data: fieldsData } = await supabase
                .from('form_fields')
                .select('*')
                .eq('form_id', formId);

            if (fieldsData && fieldsData.length > 0) {
                const newFields = fieldsData.map(field => ({
                    form_id: newForm.id,
                    label: field.label,
                    type: field.type,
                    required: field.required,
                    options: field.options,
                    order_index: field.order_index,
                }));

                await supabase
                    .from('form_fields')
                    .insert(newFields);
            }

            router.push(`/dashboard/form/new?id=${newForm.id}`);
        } catch (error) {
            console.error('Error duplicating form:', error);
            alert('Erro ao duplicar formulário. Tente novamente.');
        }
    };

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
                <Link href="/dashboard/form/new" className={styles.primaryBtn}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    Novo Formulário
                </Link>
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
                            <DropdownMenu
                                options={[
                                    {
                                        label: 'Editar',
                                        icon: (
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                            </svg>
                                        ),
                                        onClick: () => router.push(`/dashboard/form/new?id=${form.id}`),
                                    },
                                    {
                                        label: 'Preview',
                                        icon: (
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                <circle cx="12" cy="12" r="3" />
                                            </svg>
                                        ),
                                        onClick: () => {
                                            setPreviewFormId(form.id);
                                            setPreviewFormTitle(form.title);
                                        },
                                    },
                                    {
                                        label: 'Duplicar',
                                        icon: (
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                            </svg>
                                        ),
                                        onClick: () => handleDuplicateForm(form.id),
                                    },
                                    {
                                        label: 'Excluir',
                                        icon: (
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polyline points="3 6 5 6 21 6" />
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                            </svg>
                                        ),
                                        onClick: () => handleDeleteForm(form.id, form.title),
                                        danger: true,
                                    },
                                ]}
                            >
                                <button className={styles.moreBtn}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>
                                </button>
                            </DropdownMenu>
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
                            <Link href={`/dashboard/form/new?id=${form.id}`} className={styles.actionLink}>
                                Editar →
                            </Link>
                        </div>
                    </div>
                ))}

                {/* Create New Card Placeholder */}
                <Link href="/dashboard/form/new" className={styles.createCard}>
                    <div className={styles.createIcon}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    </div>
                    <span className={styles.createText}>Criar Novo Formulário</span>
                </Link>
            </div>

            {/* Preview Modal */}
            {previewFormId && (
                <FormPreviewModal
                    isOpen={!!previewFormId}
                    onClose={() => {
                        setPreviewFormId(null);
                        setPreviewFormTitle('');
                    }}
                    formId={previewFormId}
                    formTitle={previewFormTitle}
                />
            )}
        </div>
    );
}
