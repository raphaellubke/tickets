'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

interface FormField {
    id: string;
    label: string;
    type: string;
    required: boolean;
    options: string[];
    orderIndex: number;
}

interface FormData {
    name: string;
    description: string;
    status: string;
    isCouple: boolean;
}

export default function NewFormPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();
    const supabase = createClient();

    const formId = searchParams.get('id');
    const isEditMode = !!formId;

    const [formData, setFormData] = useState<FormData>({
        name: '',
        description: '',
        status: 'draft',
        isCouple: false,
    });

    const [fields, setFields] = useState<FormField[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingData, setLoadingData] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load form data when in edit mode
    useEffect(() => {
        if (isEditMode && formId && user) {
            loadFormData();
        }
    }, [isEditMode, formId, user]);

    const loadFormData = async () => {
        if (!formId || !user) return;

        setLoadingData(true);
        try {
            // Get user's organization
            const { data: members0 } = await supabase
                .from('organization_members')
                .select('organization_id')
                .eq('user_id', user.id)
                .limit(1);
            const memberData = members0?.[0];

            if (!memberData) {
                setError('Organização não encontrada');
                setLoadingData(false);
                return;
            }

            // Load form
            const { data: form, error: formError } = await supabase
                .from('forms')
                .select('*')
                .eq('id', formId)
                .eq('organization_id', memberData.organization_id)
                .single();

            if (formError || !form) {
                setError('Formulário não encontrado');
                setLoadingData(false);
                return;
            }

            // Populate form data
            setFormData({
                name: form.title || form.name || '',
                description: form.description || '',
                status: form.status || 'draft',
                isCouple: form.is_couple || false,
            });

            // Load form fields
            const { data: formFields, error: fieldsError } = await supabase
                .from('form_fields')
                .select('*')
                .eq('form_id', formId)
                .order('order_index', { ascending: true });

            if (!fieldsError && formFields) {
                const loadedFields: FormField[] = formFields.map(field => ({
                    id: field.id,
                    label: field.label,
                    type: field.type,
                    required: field.required || false,
                    options: field.options && Array.isArray(field.options) ? field.options : 
                             (typeof field.options === 'string' ? JSON.parse(field.options) : []),
                    orderIndex: field.order_index || 0
                }));
                setFields(loadedFields);
            }
        } catch (err: any) {
            console.error('Error loading form:', err);
            setError('Erro ao carregar formulário');
        } finally {
            setLoadingData(false);
        }
    };

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const addField = () => {
        const newField: FormField = {
            id: `temp-${Date.now()}`,
            label: '',
            type: 'text',
            required: false,
            options: [],
            orderIndex: fields.length
        };
        setFields([...fields, newField]);
    };

    const removeField = (fieldId: string) => {
        setFields(fields.filter(f => f.id !== fieldId));
    };

    const updateField = (fieldId: string, field: Partial<FormField>) => {
        setFields(fields.map(f => 
            f.id === fieldId ? { ...f, ...field } : f
        ));
    };

    const addOption = (fieldId: string) => {
        setFields(fields.map(f => 
            f.id === fieldId ? { ...f, options: [...f.options, ''] } : f
        ));
    };

    const removeOption = (fieldId: string, optionIndex: number) => {
        setFields(fields.map(f => 
            f.id === fieldId ? { ...f, options: f.options.filter((_, i) => i !== optionIndex) } : f
        ));
    };

    const updateOption = (fieldId: string, optionIndex: number, value: string) => {
        setFields(fields.map(f => 
            f.id === fieldId ? {
                ...f,
                options: f.options.map((opt, i) => i === optionIndex ? value : opt)
            } : f
        ));
    };

    const moveField = (fieldId: string, direction: 'up' | 'down') => {
        const index = fields.findIndex(f => f.id === fieldId);
        if (index === -1) return;

        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= fields.length) return;

        const newFields = [...fields];
        [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
        
        // Update order indices
        newFields.forEach((f, i) => {
            f.orderIndex = i;
        });
        
        setFields(newFields);
    };

    const validateForm = (): boolean => {
        if (!formData.name.trim()) {
            setError('O nome do formulário é obrigatório');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!validateForm()) return;
        if (!user) {
            setError('Você precisa estar autenticado');
            return;
        }

        setLoading(true);

        try {
            // Get user's organization
            const { data: members1 } = await supabase
                .from('organization_members')
                .select('organization_id')
                .eq('user_id', user.id)
                .limit(1);
            const memberData = members1?.[0];

            if (!memberData) {
                throw new Error('Organização não encontrada');
            }

            // Prepare form data
            const formDataToSave: any = {
                name: formData.name,
                description: formData.description || null,
                status: formData.status || 'draft',
                organization_id: memberData.organization_id,
                user_id: user.id,
                created_by: user.id,
                is_active: formData.status === 'active',
                is_couple: formData.isCouple || false,
            };

            let currentFormId = formId;

            if (isEditMode && formId) {
                // Update existing form
                const { data: updatedForm, error: updateError } = await supabase
                    .from('forms')
                    .update(formDataToSave)
                    .eq('id', formId)
                    .eq('organization_id', memberData.organization_id)
                    .select()
                    .single();

                if (updateError) {
                    console.error('Update error:', updateError);
                    throw new Error('Erro ao atualizar formulário');
                }

                currentFormId = updatedForm.id;
            } else {
                // Create new form
                const { data: newForm, error: insertError } = await supabase
                    .from('forms')
                    .insert([formDataToSave])
                    .select()
                    .single();

                if (insertError) {
                    console.error('Insert error:', insertError);
                    throw new Error('Erro ao criar formulário');
                }

                currentFormId = newForm.id;
            }

            // Handle form fields
            if (isEditMode && formId) {
                // Get existing fields
                const { data: existingFields } = await supabase
                    .from('form_fields')
                    .select('id')
                    .eq('form_id', formId);

                const existingFieldIds = new Set((existingFields || []).map(f => f.id));
                const currentFieldIds = fields
                    .filter(f => !f.id.startsWith('temp-'))
                    .map(f => f.id);

                // Delete removed fields
                const fieldsToDelete = Array.from(existingFieldIds).filter(id => !currentFieldIds.includes(id));
                if (fieldsToDelete.length > 0) {
                    await supabase
                        .from('form_fields')
                        .delete()
                        .in('id', fieldsToDelete);
                }
            }

            // Process form fields
            for (const field of fields) {
                if (!field.label.trim()) continue; // Skip empty fields

                if (field.id.startsWith('temp-')) {
                    // New field - create it
                    const { error: fieldError } = await supabase
                        .from('form_fields')
                        .insert([{
                            form_id: currentFormId,
                            label: field.label,
                            type: field.type,
                            required: field.required,
                            options: field.options.length > 0 ? field.options : null,
                            order_index: field.orderIndex
                        }]);

                    if (fieldError) {
                        console.error('Error creating field:', fieldError);
                    }
                } else {
                    // Existing field - update it
                    const { error: updateError } = await supabase
                        .from('form_fields')
                        .update({
                            label: field.label,
                            type: field.type,
                            required: field.required,
                            options: field.options.length > 0 ? field.options : null,
                            order_index: field.orderIndex
                        })
                        .eq('id', field.id);

                    if (updateError) {
                        console.error('Error updating field:', updateError);
                    }
                }
            }

            // Redirect to forms list
            router.push('/dashboard/form');
        } catch (err: any) {
            console.error(`Error ${isEditMode ? 'updating' : 'creating'} form:`, err);
            setError(err.message || `Erro ao ${isEditMode ? 'atualizar' : 'criar'} formulário`);
        } finally {
            setLoading(false);
        }
    };

    if (loadingData) {
        return (
            <div className={styles.container}>
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <p>Carregando dados do formulário...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <button
                    onClick={() => router.back()}
                    className={styles.backBtn}
                    type="button"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Voltar
                </button>
                <div>
                    <h1 className={styles.title}>
                        {isEditMode ? 'Editar Formulário' : 'Criar Novo Formulário'}
                    </h1>
                    <p className={styles.subtitle}>
                        {isEditMode ? 'Atualize as informações do seu formulário' : 'Crie um formulário personalizado para coletar informações dos participantes'}
                    </p>
                </div>
            </div>

            {error && (
                <div className={styles.errorAlert}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {error}
                </div>
            )}

            <form className={styles.form} onSubmit={handleSubmit}>
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>Informações Básicas</h2>

                    <div className={styles.formGroup}>
                        <label htmlFor="name" className={styles.label}>
                            Nome do Formulário *
                        </label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            className={styles.input}
                            placeholder="Ex: Formulário de Inscrição"
                            required
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="description" className={styles.label}>
                            Descrição
                        </label>
                        <textarea
                            id="description"
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            className={styles.textarea}
                            rows={3}
                            placeholder="Descreva o propósito deste formulário..."
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="status" className={styles.label}>
                            Status
                        </label>
                        <select
                            id="status"
                            name="status"
                            value={formData.status}
                            onChange={handleInputChange}
                            className={styles.select}
                        >
                            <option value="draft">Rascunho</option>
                            <option value="active">Ativo</option>
                        </select>
                    </div>

                    <div className={styles.formGroup}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={formData.isCouple}
                                onChange={(e) => setFormData(prev => ({ ...prev, isCouple: e.target.checked }))}
                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '0.875rem', color: '#374151' }}>
                                Formulário de casal (campos Ele / Ela)
                            </span>
                        </label>
                    </div>
                </div>

                {/* Fields Section */}
                <div className={styles.section}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h2 className={styles.sectionTitle}>Campos do Formulário</h2>
                        <button
                            type="button"
                            onClick={addField}
                            style={{
                                padding: '0.5rem 1rem',
                                background: 'linear-gradient(135deg, #4A90E2 0%, #357ABD 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            + Adicionar Campo
                        </button>
                    </div>

                    {fields.length === 0 ? (
                        <div style={{
                            padding: '2rem',
                            textAlign: 'center',
                            background: '#f9fafb',
                            borderRadius: '8px',
                            color: '#6b7280'
                        }}>
                            <p>Nenhum campo adicionado</p>
                            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                                Adicione campos para coletar informações dos participantes
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {fields.map((field, index) => (
                                <div
                                    key={field.id}
                                    style={{
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '8px',
                                        padding: '1.5rem',
                                        background: '#ffffff'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                                <div>
                                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', color: '#374151' }}>
                                                        Label do Campo *
                                                    </label>
                                                    <input
                                                        type="text"
                                                        placeholder="Ex: Nome Completo"
                                                        value={field.label}
                                                        onChange={(e) => updateField(field.id, { label: e.target.value })}
                                                        style={{
                                                            width: '100%',
                                                            padding: '0.5rem',
                                                            border: '1px solid #d1d5db',
                                                            borderRadius: '4px',
                                                            fontSize: '0.875rem',
                                                            color: '#111827'
                                                        }}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', color: '#374151' }}>
                                                        Tipo de Campo *
                                                    </label>
                                                    <select
                                                        value={field.type}
                                                        onChange={(e) => updateField(field.id, { type: e.target.value, options: e.target.value === 'select' || e.target.value === 'radio' ? field.options : [] })}
                                                        style={{
                                                            width: '100%',
                                                            padding: '0.5rem',
                                                            border: '1px solid #d1d5db',
                                                            borderRadius: '4px',
                                                            fontSize: '0.875rem',
                                                            color: '#111827',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <option value="text">Texto</option>
                                                        <option value="email">Email</option>
                                                        <option value="number">Número</option>
                                                        <option value="date">Data</option>
                                                        <option value="tel">Telefone</option>
                                                        <option value="textarea">Texto Longo</option>
                                                        <option value="select">Seleção (Select)</option>
                                                        <option value="radio">Seleção (Radio)</option>
                                                        <option value="checkbox">Checkbox</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {(field.type === 'select' || field.type === 'radio') && (
                                                <div style={{ marginBottom: '1rem' }}>
                                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', color: '#374151' }}>
                                                        Opções
                                                    </label>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                        {field.options.map((option, optIndex) => (
                                                            <div key={optIndex} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                                <input
                                                                    type="text"
                                                                    placeholder="Ex: Opção 1"
                                                                    value={option}
                                                                    onChange={(e) => updateOption(field.id, optIndex, e.target.value)}
                                                                    style={{
                                                                        flex: 1,
                                                                        padding: '0.5rem',
                                                                        border: '1px solid #d1d5db',
                                                                        borderRadius: '4px',
                                                                        fontSize: '0.875rem',
                                                                        color: '#111827'
                                                                    }}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeOption(field.id, optIndex)}
                                                                    style={{
                                                                        padding: '0.5rem',
                                                                        background: '#ef4444',
                                                                        color: 'white',
                                                                        border: 'none',
                                                                        borderRadius: '4px',
                                                                        cursor: 'pointer',
                                                                        fontSize: '0.75rem'
                                                                    }}
                                                                >
                                                                    Remover
                                                                </button>
                                                            </div>
                                                        ))}
                                                        <button
                                                            type="button"
                                                            onClick={() => addOption(field.id)}
                                                            style={{
                                                                padding: '0.5rem',
                                                                background: '#4A90E2',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                cursor: 'pointer',
                                                                fontSize: '0.75rem',
                                                                alignSelf: 'flex-start'
                                                            }}
                                                        >
                                                            + Adicionar Opção
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={field.required}
                                                        onChange={(e) => updateField(field.id, { required: e.target.checked })}
                                                        style={{ cursor: 'pointer' }}
                                                    />
                                                    <span style={{ fontSize: '0.875rem', color: '#374151' }}>Campo obrigatório</span>
                                                </label>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => moveField(field.id, 'up')}
                                                        disabled={index === 0}
                                                        style={{
                                                            padding: '0.25rem 0.5rem',
                                                            background: index === 0 ? '#d1d5db' : '#4A90E2',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                            cursor: index === 0 ? 'not-allowed' : 'pointer',
                                                            fontSize: '0.75rem',
                                                            opacity: index === 0 ? 0.5 : 1
                                                        }}
                                                    >
                                                        ↑
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => moveField(field.id, 'down')}
                                                        disabled={index === fields.length - 1}
                                                        style={{
                                                            padding: '0.25rem 0.5rem',
                                                            background: index === fields.length - 1 ? '#d1d5db' : '#4A90E2',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                            cursor: index === fields.length - 1 ? 'not-allowed' : 'pointer',
                                                            fontSize: '0.75rem',
                                                            opacity: index === fields.length - 1 ? 0.5 : 1
                                                        }}
                                                    >
                                                        ↓
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeField(field.id)}
                                                        style={{
                                                            padding: '0.25rem 0.5rem',
                                                            background: '#ef4444',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            fontSize: '0.75rem'
                                                        }}
                                                    >
                                                        Remover
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className={styles.actions}>
                    <button
                        type="submit"
                        className={styles.submitBtn}
                        disabled={loading}
                    >
                        {loading ? (isEditMode ? 'Atualizando...' : 'Salvando...') : (isEditMode ? 'Atualizar Formulário' : 'Salvar Formulário')}
                    </button>
                </div>
            </form>
        </div>
    );
}

