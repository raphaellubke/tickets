'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import styles from './page.module.css';

interface FormField {
    id: string;
    label: string;
    type: string;
    required: boolean;
    options: string[];
    order_index: number;
}

interface FormResponse {
    id: string;
    form_id: string;
    ticket_id: string;
    status: string;
}

interface FormData {
    id: string;
    name: string;
    description: string | null;
    isCouple: boolean;
}

export default function FormResponsePage({ params }: { params: Promise<{ ticket_id: string }> }) {
    const { ticket_id } = use(params);
    const router = useRouter();
    const supabase = createClient();
    
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState<FormData | null>(null);
    const [formFields, setFormFields] = useState<FormField[]>([]);
    const [formResponse, setFormResponse] = useState<FormResponse | null>(null);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [isCouple, setIsCouple] = useState(false);
    const [coupleAnswers, setCoupleAnswers] = useState<Record<string, { ele: string; ela: string }>>({});
    const [ticket, setTicket] = useState<any>(null);

    useEffect(() => {
        async function loadFormData() {
            if (!ticket_id) {
                setError('ID do ticket inválido');
                setLoading(false);
                return;
            }

            try {
                // Load ticket
                const { data: ticketData, error: ticketError } = await supabase
                    .from('tickets')
                    .select('*')
                    .eq('id', ticket_id)
                    .maybeSingle();

                if (ticketError || !ticketData) {
                    setError('Ticket não encontrado');
                    setLoading(false);
                    return;
                }

                setTicket(ticketData);

                // Load form response
                const { data: responseData, error: responseError } = await supabase
                    .from('form_responses')
                    .select('*')
                    .eq('ticket_id', ticket_id)
                    .maybeSingle();

                if (responseError || !responseData) {
                    setError('Formulário não encontrado para este ticket');
                    setLoading(false);
                    return;
                }

                setFormResponse(responseData);

                // Load form
                const { data: form, error: formError } = await supabase
                    .from('forms')
                    .select('*')
                    .eq('id', responseData.form_id)
                    .maybeSingle();

                if (formError || !form) {
                    setError('Formulário não encontrado');
                    setLoading(false);
                    return;
                }

                setFormData({
                    id: form.id,
                    name: form.name,
                    description: form.description,
                    isCouple: form.is_couple || false,
                });
                setIsCouple(form.is_couple || false);

                // Load form fields
                const { data: fields, error: fieldsError } = await supabase
                    .from('form_fields')
                    .select('*')
                    .eq('form_id', form.id)
                    .order('order_index', { ascending: true });

                if (fieldsError) {
                    console.error('Error loading form fields:', fieldsError);
                    setError('Erro ao carregar campos do formulário');
                    setLoading(false);
                    return;
                }

                setFormFields(fields || []);

                // Load existing answers
                const { data: existingAnswers, error: answersError } = await supabase
                    .from('form_response_answers')
                    .select('*')
                    .eq('response_id', responseData.id);

                if (!answersError && existingAnswers) {
                    const answersMap: Record<string, string> = {};
                    const coupleMap: Record<string, { ele: string; ela: string }> = {};
                    existingAnswers.forEach(answer => {
                        if (form.is_couple) {
                            try {
                                const parsed = JSON.parse(answer.value || '');
                                if (parsed && typeof parsed === 'object' && 'ele' in parsed) {
                                    coupleMap[answer.field_id] = parsed;
                                    return;
                                }
                            } catch {}
                        }
                        answersMap[answer.field_id] = answer.value || '';
                    });
                    setAnswers(answersMap);
                    if (form.is_couple) setCoupleAnswers(coupleMap);
                }
            } catch (err: any) {
                console.error('Error loading form data:', err);
                setError(err.message || 'Erro ao carregar formulário');
            } finally {
                setLoading(false);
            }
        }

        loadFormData();
    }, [ticket_id]);

    const handleFieldChange = (fieldId: string, value: string) => {
        setAnswers(prev => ({
            ...prev,
            [fieldId]: value
        }));
    };

    const formatPhone = (value: string) => {
        const numbers = value.replace(/\D/g, '');
        if (numbers.length <= 10) {
            return numbers
                .replace(/(\d{2})(\d)/, '($1) $2')
                .replace(/(\d{4})(\d)/, '$1-$2');
        } else {
            return numbers
                .replace(/(\d{2})(\d)/, '($1) $2')
                .replace(/(\d{5})(\d)/, '$1-$2')
                .substring(0, 15);
        }
    };

    const handlePhoneChange = (fieldId: string, value: string) => {
        const formatted = formatPhone(value);
        handleFieldChange(fieldId, formatted);
    };

    const handleCoupleFieldChange = (fieldId: string, person: 'ele' | 'ela', value: string) => {
        setCoupleAnswers(prev => ({
            ...prev,
            [fieldId]: { ...(prev[fieldId] || { ele: '', ela: '' }), [person]: value }
        }));
    };

    const validateForm = () => {
        for (const field of formFields) {
            if (field.required) {
                if (isCouple) {
                    const ca = coupleAnswers[field.id];
                    if (!ca?.ele?.trim() || !ca?.ela?.trim()) {
                        setError(`O campo "${field.label}" é obrigatório para Ele e Ela`);
                        return false;
                    }
                } else if (!answers[field.id]?.trim()) {
                    setError(`O campo "${field.label}" é obrigatório`);
                    return false;
                }
            }
        }
        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!validateForm()) {
            return;
        }

        if (!formResponse) {
            setError('Resposta do formulário não encontrada');
            return;
        }

        setSubmitting(true);

        try {
            // Update or insert answers
            const answerUpdates = formFields.map(field => ({
                response_id: formResponse.id,
                field_id: field.id,
                value: isCouple
                    ? JSON.stringify(coupleAnswers[field.id] || { ele: '', ela: '' })
                    : (answers[field.id] || null),
            }));

            // Delete existing answers first
            await supabase
                .from('form_response_answers')
                .delete()
                .eq('response_id', formResponse.id);

            // Insert new answers
            const { error: insertError } = await supabase
                .from('form_response_answers')
                .insert(answerUpdates);

            if (insertError) {
                console.error('Error saving answers:', insertError);
                setError('Erro ao salvar respostas');
                setSubmitting(false);
                return;
            }

            // Update form response status
            const { error: updateError } = await supabase
                .from('form_responses')
                .update({ status: 'completed' })
                .eq('id', formResponse.id);

            if (updateError) {
                console.error('Error updating response status:', updateError);
                setError('Erro ao atualizar status do formulário');
                setSubmitting(false);
                return;
            }

            setSubmitted(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err: any) {
            console.error('Error submitting form:', err);
            setError(err.message || 'Erro ao enviar formulário');
        } finally {
            setSubmitting(false);
        }
    };

    const renderFieldInput = (field: FormField, value: string, onChange: (val: string) => void) => {
        switch (field.type) {
            case 'text':
            case 'email':
            case 'number':
                return (
                    <input
                        type={field.type}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className={styles.input}
                        placeholder={field.label}
                    />
                );
            case 'tel':
                return (
                    <input
                        type="tel"
                        value={value}
                        onChange={(e) => onChange(formatPhone(e.target.value))}
                        className={styles.input}
                        placeholder="(00) 00000-0000"
                        maxLength={15}
                    />
                );
            case 'date':
                return (
                    <input
                        type="date"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className={styles.input}
                    />
                );
            case 'textarea':
                return (
                    <textarea
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className={styles.textarea}
                        placeholder={field.label}
                        rows={isCouple ? 3 : 4}
                    />
                );
            case 'select': {
                const opts = (field.options as any) || [];
                return (
                    <select
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className={styles.select}
                    >
                        <option value="">Selecione</option>
                        {opts.map((opt: string, i: number) => (
                            <option key={i} value={opt}>{opt}</option>
                        ))}
                    </select>
                );
            }
            case 'radio': {
                const radioOpts = (field.options as any) || [];
                return (
                    <div className={styles.radioGroup}>
                        {radioOpts.map((opt: string, i: number) => (
                            <label key={i} className={styles.radioOption}>
                                <input
                                    type="radio"
                                    name={`field-${field.id}-${value.slice(0, 3)}`}
                                    value={opt}
                                    checked={value === opt}
                                    onChange={(e) => onChange(e.target.value)}
                                />
                                <span>{opt}</span>
                            </label>
                        ))}
                    </div>
                );
            }
            case 'checkbox':
                return (
                    <label className={styles.checkboxOption}>
                        <input
                            type="checkbox"
                            checked={value === 'true' || value === 'sim' || value === 'yes'}
                            onChange={(e) => onChange(e.target.checked ? 'sim' : 'não')}
                        />
                        <span>{field.label}</span>
                    </label>
                );
            default:
                return (
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className={styles.input}
                        placeholder={field.label}
                    />
                );
        }
    };

    const renderField = (field: FormField) => {
        return renderFieldInput(field, answers[field.id] || '', (val) => handleFieldChange(field.id, val));
    };

    const renderCoupleField = (field: FormField) => {
        const coupleVal = coupleAnswers[field.id] || { ele: '', ela: '' };
        return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>Ele</div>
                    {renderFieldInput(field, coupleVal.ele, (val) => handleCoupleFieldChange(field.id, 'ele', val))}
                </div>
                <div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>Ela</div>
                    {renderFieldInput(field, coupleVal.ela, (val) => handleCoupleFieldChange(field.id, 'ela', val))}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <main className={styles.main}>
                <Header />
                <div className={styles.loadingContainer}>
                    <div className={styles.spinner}></div>
                    <p>Carregando formulário...</p>
                </div>
                <Footer />
            </main>
        );
    }

    if (error && !formData) {
        return (
            <main className={styles.main}>
                <Header />
                <div className={styles.errorContainer}>
                    <h2>Erro</h2>
                    <p>{error}</p>
                    <button onClick={() => router.push('/')} className={styles.backButton}>
                        Voltar ao início
                    </button>
                </div>
                <Footer />
            </main>
        );
    }

    if (submitted) {
        return (
            <main className={styles.main}>
                <Header />
                <div className={styles.container}>
                    <div className={styles.formCard} style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" style={{ margin: '0 auto 1.5rem' }}>
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                            <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '0.5rem' }}>
                            Formulário enviado!
                        </h1>
                        <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '2rem' }}>
                            Suas respostas foram salvas com sucesso.
                        </p>
                        <button onClick={() => router.push('/')} className={styles.submitButton}>
                            Voltar ao início
                        </button>
                    </div>
                </div>
                <Footer />
            </main>
        );
    }

    return (
        <main className={styles.main}>
            <Header />

            <div className={styles.container}>
                <div className={styles.formCard}>
                    {formData && (
                        <>
                            <h1 className={styles.title}>{formData.name}</h1>
                            {formData.description && (
                                <p className={styles.description}>{formData.description}</p>
                            )}
                        </>
                    )}

                    {ticket && (
                        <div className={styles.ticketInfo}>
                            <p><strong>Ticket:</strong> {ticket.ticket_code}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className={styles.form}>
                        {error && (
                            <div className={styles.errorAlert}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <line x1="12" y1="8" x2="12" y2="12"/>
                                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                                </svg>
                                {error}
                            </div>
                        )}

                        {isCouple && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', textAlign: 'center', padding: '6px', background: '#f3f4f6', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                                    Ele
                                </div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', textAlign: 'center', padding: '6px', background: '#f3f4f6', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                                    Ela
                                </div>
                            </div>
                        )}
                        {formFields.map((field) => (
                            <div key={field.id} className={styles.formGroup}>
                                <label className={styles.label}>
                                    {field.label}
                                    {field.required && <span className={styles.required}>*</span>}
                                </label>
                                {isCouple ? renderCoupleField(field) : renderField(field)}
                            </div>
                        ))}

                        <div className={styles.formActions}>
                            <button
                                type="submit"
                                className={styles.submitButton}
                                disabled={submitting}
                            >
                                {submitting ? 'Enviando...' : 'Enviar Formulário'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <Footer />
        </main>
    );
}


