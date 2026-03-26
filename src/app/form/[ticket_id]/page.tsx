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
}

export default function FormResponsePage({ params }: { params: Promise<{ ticket_id: string }> }) {
    const { ticket_id } = use(params);
    const router = useRouter();
    const supabase = createClient();
    
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState<FormData | null>(null);
    const [formFields, setFormFields] = useState<FormField[]>([]);
    const [formResponse, setFormResponse] = useState<FormResponse | null>(null);
    const [answers, setAnswers] = useState<Record<string, string>>({});
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
                    .single();

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
                    .single();

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
                    .single();

                if (formError || !form) {
                    setError('Formulário não encontrado');
                    setLoading(false);
                    return;
                }

                setFormData({
                    id: form.id,
                    name: form.name,
                    description: form.description
                });

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
                    existingAnswers.forEach(answer => {
                        answersMap[answer.field_id] = answer.value || '';
                    });
                    setAnswers(answersMap);
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

    const validateForm = () => {
        for (const field of formFields) {
            if (field.required && !answers[field.id]?.trim()) {
                setError(`O campo "${field.label}" é obrigatório`);
                return false;
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
                value: answers[field.id] || null
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

            // Success - redirect or show success message
            alert('Formulário enviado com sucesso!');
            router.push('/checkout/success?order_id=' + ticket?.order_id);
        } catch (err: any) {
            console.error('Error submitting form:', err);
            setError(err.message || 'Erro ao enviar formulário');
        } finally {
            setSubmitting(false);
        }
    };

    const renderField = (field: FormField) => {
        const value = answers[field.id] || '';
        const fieldId = `field-${field.id}`;

        switch (field.type) {
            case 'text':
            case 'email':
            case 'number':
                return (
                    <input
                        type={field.type}
                        id={fieldId}
                        value={value}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        className={styles.input}
                        placeholder={field.label}
                        required={field.required}
                    />
                );

            case 'tel':
                return (
                    <input
                        type="tel"
                        id={fieldId}
                        value={value}
                        onChange={(e) => handlePhoneChange(field.id, e.target.value)}
                        className={styles.input}
                        placeholder="(00) 00000-0000"
                        maxLength={15}
                        required={field.required}
                    />
                );

            case 'date':
                return (
                    <input
                        type="date"
                        id={fieldId}
                        value={value}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        className={styles.input}
                        required={field.required}
                    />
                );

            case 'textarea':
                return (
                    <textarea
                        id={fieldId}
                        value={value}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        className={styles.textarea}
                        placeholder={field.label}
                        rows={4}
                        required={field.required}
                    />
                );

            case 'select':
                const options = (field.options as any) || [];
                return (
                    <select
                        id={fieldId}
                        value={value}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        className={styles.select}
                        required={field.required}
                    >
                        <option value="">Selecione uma opção</option>
                        {options.map((option: string, index: number) => (
                            <option key={index} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                );

            case 'radio':
                const radioOptions = (field.options as any) || [];
                return (
                    <div className={styles.radioGroup}>
                        {radioOptions.map((option: string, index: number) => (
                            <label key={index} className={styles.radioOption}>
                                <input
                                    type="radio"
                                    name={`field-${field.id}`}
                                    value={option}
                                    checked={value === option}
                                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                    required={field.required}
                                />
                                <span>{option}</span>
                            </label>
                        ))}
                    </div>
                );

            case 'checkbox':
                return (
                    <label className={styles.checkboxOption}>
                        <input
                            type="checkbox"
                            checked={value === 'true' || value === 'sim' || value === 'yes'}
                            onChange={(e) => handleFieldChange(field.id, e.target.checked ? 'sim' : 'não')}
                        />
                        <span>{field.label}</span>
                    </label>
                );

            default:
                return (
                    <input
                        type="text"
                        id={fieldId}
                        value={value}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        className={styles.input}
                        placeholder={field.label}
                        required={field.required}
                    />
                );
        }
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

                        {formFields.map((field) => (
                            <div key={field.id} className={styles.formGroup}>
                                <label htmlFor={`field-${field.id}`} className={styles.label}>
                                    {field.label}
                                    {field.required && <span className={styles.required}>*</span>}
                                </label>
                                {renderField(field)}
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


