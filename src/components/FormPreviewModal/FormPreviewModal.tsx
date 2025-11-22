'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './FormPreviewModal.module.css';

interface FormField {
    id: string;
    label: string;
    type: string;
    required: boolean;
    options: string[] | any;
    order_index: number;
}

interface FormPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    formId: string;
    formTitle: string;
}

export default function FormPreviewModal({ isOpen, onClose, formId, formTitle }: FormPreviewModalProps) {
    const [fields, setFields] = useState<FormField[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        if (isOpen && formId) {
            loadFormFields();
        }
    }, [isOpen, formId]);

    async function loadFormFields() {
        try {
            setLoading(true);
            const { data: formFields, error } = await supabase
                .from('form_fields')
                .select('*')
                .eq('form_id', formId)
                .order('order_index', { ascending: true });

            if (error) throw error;

            setFields(formFields || []);
        } catch (error) {
            console.error('Error loading form fields:', error);
        } finally {
            setLoading(false);
        }
    }

    if (!isOpen) return null;

    const renderField = (field: FormField) => {
        const fieldId = `preview-${field.id}`;

        switch (field.type) {
            case 'text':
            case 'email':
            case 'tel':
                return (
                    <div key={field.id} className={styles.field}>
                        <label htmlFor={fieldId} className={styles.label}>
                            {field.label}
                            {field.required && <span className={styles.required}>*</span>}
                        </label>
                        <input
                            id={fieldId}
                            type={field.type}
                            className={styles.input}
                            placeholder={`Digite ${field.label.toLowerCase()}`}
                            disabled
                        />
                    </div>
                );

            case 'textarea':
                return (
                    <div key={field.id} className={styles.field}>
                        <label htmlFor={fieldId} className={styles.label}>
                            {field.label}
                            {field.required && <span className={styles.required}>*</span>}
                        </label>
                        <textarea
                            id={fieldId}
                            className={styles.textarea}
                            placeholder={`Digite ${field.label.toLowerCase()}`}
                            rows={4}
                            disabled
                        />
                    </div>
                );

            case 'number':
                return (
                    <div key={field.id} className={styles.field}>
                        <label htmlFor={fieldId} className={styles.label}>
                            {field.label}
                            {field.required && <span className={styles.required}>*</span>}
                        </label>
                        <input
                            id={fieldId}
                            type="number"
                            className={styles.input}
                            placeholder="0"
                            disabled
                        />
                    </div>
                );

            case 'date':
                return (
                    <div key={field.id} className={styles.field}>
                        <label htmlFor={fieldId} className={styles.label}>
                            {field.label}
                            {field.required && <span className={styles.required}>*</span>}
                        </label>
                        <input
                            id={fieldId}
                            type="date"
                            className={styles.input}
                            disabled
                        />
                    </div>
                );

            case 'select':
                let selectOptions: string[] = [];
                try {
                    if (Array.isArray(field.options)) {
                        selectOptions = field.options;
                    } else if (typeof field.options === 'string') {
                        selectOptions = JSON.parse(field.options || '[]');
                    }
                } catch (e) {
                    console.error('Error parsing select options:', e);
                    selectOptions = [];
                }
                return (
                    <div key={field.id} className={styles.field}>
                        <label htmlFor={fieldId} className={styles.label}>
                            {field.label}
                            {field.required && <span className={styles.required}>*</span>}
                        </label>
                        <select id={fieldId} className={styles.select} disabled>
                            <option value="">Selecione uma opção</option>
                            {selectOptions.map((option: string, index: number) => (
                                <option key={index} value={option}>{option}</option>
                            ))}
                        </select>
                    </div>
                );

            case 'radio':
                let radioOptions: string[] = [];
                try {
                    if (Array.isArray(field.options)) {
                        radioOptions = field.options;
                    } else if (typeof field.options === 'string') {
                        radioOptions = JSON.parse(field.options || '[]');
                    }
                } catch (e) {
                    console.error('Error parsing radio options:', e);
                    radioOptions = [];
                }
                return (
                    <div key={field.id} className={styles.field}>
                        <label className={styles.label}>
                            {field.label}
                            {field.required && <span className={styles.required}>*</span>}
                        </label>
                        <div className={styles.radioGroup}>
                            {radioOptions.map((option: string, index: number) => (
                                <label key={index} className={styles.radioOption}>
                                    <input
                                        type="radio"
                                        name={`preview-${field.id}`}
                                        value={option}
                                        disabled
                                    />
                                    <span>{option}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                );

            case 'checkbox':
                return (
                    <div key={field.id} className={styles.field}>
                        <label className={styles.checkboxOption}>
                            <input
                                type="checkbox"
                                disabled
                            />
                            <span>{field.label}</span>
                            {field.required && <span className={styles.required}>*</span>}
                        </label>
                    </div>
                );

            default:
                return (
                    <div key={field.id} className={styles.field}>
                        <label htmlFor={fieldId} className={styles.label}>
                            {field.label}
                            {field.required && <span className={styles.required}>*</span>}
                        </label>
                        <input
                            id={fieldId}
                            type="text"
                            className={styles.input}
                            disabled
                        />
                    </div>
                );
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <div>
                        <h2 className={styles.title}>Preview do Formulário</h2>
                        <p className={styles.subtitle}>{formTitle}</p>
                    </div>
                    <button className={styles.closeButton} onClick={onClose}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div className={styles.content}>
                    {loading ? (
                        <div className={styles.loading}>
                            <p>Carregando campos...</p>
                        </div>
                    ) : fields.length === 0 ? (
                        <div className={styles.empty}>
                            <p>Este formulário ainda não possui campos.</p>
                        </div>
                    ) : (
                        <form className={styles.form}>
                            {fields.map(field => renderField(field))}
                            <div className={styles.footer}>
                                <button type="button" className={styles.submitButton} disabled>
                                    Enviar (Preview)
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

