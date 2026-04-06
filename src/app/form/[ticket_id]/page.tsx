'use client';

import { useState, useEffect, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './page.module.css';

interface FormField {
    id: string;
    label: string;
    type: string;
    required: boolean;
    options: string[];
    order_index: number;
    is_couple_field?: boolean | null;
}

interface FormResponse {
    id: string;
    form_id: string;
    ticket_id: string;
    status: string;
}

interface FormMeta {
    id: string;
    name: string;
    description: string | null;
    isCouple: boolean;
    hasTentNotice: boolean;
}

interface Step {
    title: string;
    fields: FormField[];
}


export default function FormResponsePage({ params }: { params: Promise<{ ticket_id: string }> }) {
    const { ticket_id } = use(params);
    const router = useRouter();
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formMeta, setFormMeta] = useState<FormMeta | null>(null);
    const [formFields, setFormFields] = useState<FormField[]>([]);
    const [formResponse, setFormResponse] = useState<FormResponse | null>(null);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [isCouple, setIsCouple] = useState(false);
    const [coupleAnswers, setCoupleAnswers] = useState<Record<string, { ele: string; ela: string }>>({});
    const [ticket, setTicket] = useState<any>(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [animDir, setAnimDir] = useState<'forward' | 'back'>('forward');
    const [animKey, setAnimKey] = useState(0);
    const [fieldErrors, setFieldErrors] = useState<Set<string>>(new Set());

    const DRAFT_KEY = `form_draft_${ticket_id}`;
    const MAX_FIELDS_PER_PAGE = 6;

    // Split fields into steps by section_header dividers, then auto-split large steps
    const steps = useMemo<Step[]>(() => {
        if (formFields.length === 0) return [];

        const sections: Step[] = [];
        let current: Step | null = null;

        for (const field of formFields) {
            if (field.type === 'section_header') {
                if (current && current.fields.length > 0) sections.push(current);
                current = { title: field.label, fields: [] };
            } else {
                if (!current) {
                    current = { title: formMeta?.name || 'Formulário', fields: [] };
                }
                current.fields.push(field);
            }
        }
        if (current && current.fields.length > 0) sections.push(current);

        const base = sections.length > 0 ? sections : [{ title: formMeta?.name || 'Formulário', fields: formFields }];

        // Auto-split sections with too many fields
        const result: Step[] = [];
        for (const section of base) {
            if (section.fields.length <= MAX_FIELDS_PER_PAGE) {
                result.push(section);
            } else {
                for (let i = 0; i < section.fields.length; i += MAX_FIELDS_PER_PAGE) {
                    result.push({ title: section.title, fields: section.fields.slice(i, i + MAX_FIELDS_PER_PAGE) });
                }
            }
        }
        return result;
    }, [formFields, formMeta]);

    // Persist answers to localStorage whenever they change
    useEffect(() => {
        if (Object.keys(answers).length === 0 && Object.keys(coupleAnswers).length === 0) return;
        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify({ answers, coupleAnswers }));
        } catch {}
    }, [answers, coupleAnswers]);

    useEffect(() => {
        async function load() {
            if (!ticket_id) { setError('ID do ticket inválido'); setLoading(false); return; }
            try {
                const { data: ticketData } = await supabase.from('tickets').select('*').eq('id', ticket_id).maybeSingle();
                if (!ticketData) { setError('Ticket não encontrado'); setLoading(false); return; }
                setTicket(ticketData);

                const { data: responseData } = await supabase.from('form_responses').select('*').eq('ticket_id', ticket_id).maybeSingle();
                if (!responseData) { setError('Formulário não encontrado para este ticket'); setLoading(false); return; }
                setFormResponse(responseData);

                const { data: form } = await supabase.from('forms').select('*').eq('id', responseData.form_id).maybeSingle();
                if (!form) { setError('Formulário não encontrado'); setLoading(false); return; }

                setFormMeta({ id: form.id, name: form.name, description: form.description, isCouple: form.is_couple || false, hasTentNotice: form.has_tent_notice || false });
                setIsCouple(form.is_couple || false);

                const { data: fields } = await supabase.from('form_fields').select('*').eq('form_id', form.id).order('order_index', { ascending: true });
                setFormFields(fields || []);

                const { data: existingAnswers } = await supabase.from('form_response_answers').select('*').eq('response_id', responseData.id);
                const aMap: Record<string, string> = {};
                const cMap: Record<string, { ele: string; ela: string }> = {};

                if (existingAnswers) {
                    existingAnswers.forEach(a => {
                        if (form.is_couple) {
                            try {
                                const p = JSON.parse(a.value || '');
                                if (p && typeof p === 'object' && 'ele' in p) { cMap[a.field_id] = p; return; }
                            } catch {}
                        }
                        aMap[a.field_id] = a.value || '';
                    });
                }

                // Restore draft from localStorage, giving priority to draft over empty DB values
                try {
                    const draft = localStorage.getItem(DRAFT_KEY);
                    if (draft) {
                        const { answers: draftA, coupleAnswers: draftC } = JSON.parse(draft);
                        // Merge: draft overrides only fields not yet saved in DB
                        if (draftA) Object.entries(draftA).forEach(([k, v]) => { if (!aMap[k]) aMap[k] = v as string; });
                        if (draftC && form.is_couple) Object.entries(draftC).forEach(([k, v]) => { if (!cMap[k]) cMap[k] = v as { ele: string; ela: string }; });
                    }
                } catch {}

                setAnswers(aMap);
                if (form.is_couple) setCoupleAnswers(cMap);
            } catch (err: any) {
                setError(err.message || 'Erro ao carregar formulário');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [ticket_id]);

    const clearFieldError = (fieldId: string) => {
        if (fieldErrors.has(fieldId)) setFieldErrors(prev => { const n = new Set(prev); n.delete(fieldId); return n; });
    };

    const handleFieldChange = (fieldId: string, value: string) => {
        setAnswers(prev => ({ ...prev, [fieldId]: value }));
        clearFieldError(fieldId);
    };

    const formatPhone = (value: string) => {
        const n = value.replace(/\D/g, '');
        if (n.length <= 10) return n.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
        return n.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 15);
    };

    const handleCoupleChange = (fieldId: string, person: 'ele' | 'ela', value: string) => {
        setCoupleAnswers(prev => ({ ...prev, [fieldId]: { ...(prev[fieldId] || { ele: '', ela: '' }), [person]: value } }));
        clearFieldError(fieldId);
    };

    const validateStep = (idx: number): boolean => {
        if (idx >= steps.length) return true;
        const errors = new Set<string>();
        for (const field of steps[idx].fields) {
            if (!field.required) continue;
            if (field.type === 'clause') {
                if (answers[field.id] !== 'sim') errors.add(field.id);
                continue;
            }
            if (isCouple && field.is_couple_field !== false) {
                const ca = coupleAnswers[field.id];
                if (!ca?.ele?.trim() || !ca?.ela?.trim()) errors.add(field.id);
            } else if (!answers[field.id]?.trim()) {
                errors.add(field.id);
            }
        }
        if (errors.size > 0) {
            setFieldErrors(errors);
            setError('Preencha os campos obrigatórios marcados em vermelho');
            return false;
        }
        setFieldErrors(new Set());
        setError(null);
        return true;
    };

    const navigate = (dir: 'forward' | 'back') => {
        setError(null);
        if (dir === 'forward' && !validateStep(currentStep)) return;
        setAnimDir(dir);
        setAnimKey(k => k + 1);
        setCurrentStep(s => dir === 'forward' ? Math.min(s + 1, steps.length - 1) : Math.max(s - 1, 0));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = async () => {
        setError(null);
        if (!validateStep(currentStep)) return;
        if (!formResponse) return;
        setSubmitting(true);
        try {
            const updatesWithLabel = formFields
                .filter(f => f.type !== 'section_header')
                .map(field => ({
                    response_id: formResponse.id,
                    field_id: field.id,
                    field_label: field.label,
                    value: (isCouple && field.is_couple_field !== false)
                        ? JSON.stringify(coupleAnswers[field.id] || { ele: '', ela: '' })
                        : (answers[field.id] || null),
                }));

            await supabase.from('form_response_answers').delete().eq('response_id', formResponse.id);

            // Try saving with field_label (requires SQL migration).
            // If column doesn't exist yet, fall back to saving without it.
            let { error: insertErr } = await supabase.from('form_response_answers').insert(updatesWithLabel);
            if (insertErr) {
                const updatesBasic = updatesWithLabel.map(({ field_label, ...rest }) => rest);
                const { error: fallbackErr } = await supabase.from('form_response_answers').insert(updatesBasic);
                insertErr = fallbackErr;
            }
            if (insertErr) { setError('Erro ao salvar respostas'); setSubmitting(false); return; }
            await supabase.from('form_responses').update({ status: 'completed' }).eq('id', formResponse.id);
            try { localStorage.removeItem(DRAFT_KEY); } catch {}
            setSubmitted(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err: any) {
            setError(err.message || 'Erro ao enviar formulário');
        } finally {
            setSubmitting(false);
        }
    };

    const renderInput = (field: FormField, value: string, onChange: (v: string) => void, nameSuffix = '', hasError = false) => {
        const errClass = hasError ? ` ${styles.inputError}` : '';
        switch (field.type) {
            case 'text':
            case 'email':
            case 'number':
                return <input type={field.type} value={value} onChange={e => onChange(e.target.value)} className={styles.input + errClass} placeholder={field.label} />;
            case 'tel':
                return <input type="tel" value={value} onChange={e => onChange(formatPhone(e.target.value))} className={styles.input + errClass} placeholder="(00) 00000-0000" maxLength={15} />;
            case 'date':
                return <input type="date" value={value} onChange={e => onChange(e.target.value)} className={styles.input + errClass} />;
            case 'textarea':
                return <textarea value={value} onChange={e => onChange(e.target.value)} className={styles.textarea + errClass} placeholder={field.label} rows={3} />;
            case 'select': {
                const opts = (field.options as any) || [];
                return (
                    <select value={value} onChange={e => onChange(e.target.value)} className={styles.select + errClass}>
                        <option value="">Selecione...</option>
                        {opts.map((o: string, i: number) => <option key={i} value={o}>{o}</option>)}
                    </select>
                );
            }
            case 'radio': {
                const opts = (field.options as any) || [];
                return (
                    <div className={styles.pillGroup + errClass}>
                        {opts.map((o: string, i: number) => (
                            <button
                                key={i}
                                type="button"
                                className={`${styles.pill} ${value === o ? styles.pillActive : ''}`}
                                onClick={() => onChange(o)}
                            >
                                {o}
                            </button>
                        ))}
                    </div>
                );
            }
            case 'checkbox': {
                const checked = value === 'sim' || value === 'true';
                return (
                    <div className={styles.pillGroup + errClass}>
                        <button type="button" className={`${styles.pill} ${checked ? styles.pillActive : ''}`} onClick={() => onChange('sim')}>Sim</button>
                        <button type="button" className={`${styles.pill} ${!checked && value ? styles.pillActive : ''}`} onClick={() => onChange('não')}>Não</button>
                    </div>
                );
            }
            case 'shirt_size': {
                const sizes: string[] = (field.options as any)?.length > 0 ? (field.options as any) : ['P', 'M', 'G', 'GG', 'EG', 'EGG', 'G1', 'G2', 'G3', 'G4'];
                return (
                    <div className={styles.sizeGrid + errClass}>
                        {sizes.map(s => (
                            <button
                                key={s}
                                type="button"
                                className={`${styles.sizeBtn} ${value === s ? styles.sizeBtnActive : ''}`}
                                onClick={() => onChange(s)}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                );
            }
            case 'clause': {
                const clauseText = (field.options as any)?.[0] || '';
                const accepted = value === 'sim';
                return (
                    <div className={styles.clauseBox}>
                        {clauseText && <p className={styles.clauseText}>{clauseText}</p>}
                        <label className={`${styles.clauseAccept} ${accepted ? styles.clauseAccepted : ''}`}>
                            <input
                                type="checkbox"
                                checked={accepted}
                                onChange={e => onChange(e.target.checked ? 'sim' : '')}
                            />
                            <span>Li e aceito os termos acima</span>
                        </label>
                    </div>
                );
            }
            default:
                return <input type="text" value={value} onChange={e => onChange(e.target.value)} className={styles.input} placeholder={field.label} />;
        }
    };

    const renderField = (field: FormField) => {
        const hasError = fieldErrors.has(field.id);
        return (
            <div key={field.id} className={`${styles.fieldGroup} ${hasError ? styles.fieldGroupError : ''}`}>
                <label className={styles.fieldLabel}>
                    {field.label}
                    {field.required && <span className={styles.required}>*</span>}
                </label>
                {renderInput(field, answers[field.id] || '', v => handleFieldChange(field.id, v), '', hasError)}
                {hasError && <span className={styles.fieldErrorMsg}>Campo obrigatório</span>}
            </div>
        );
    };

    const renderCoupleField = (field: FormField) => {
        const cv = coupleAnswers[field.id] || { ele: '', ela: '' };
        const hasError = fieldErrors.has(field.id);
        const elaEmpty = hasError && !cv.ela?.trim();
        const eleEmpty = hasError && !cv.ele?.trim();
        return (
            <div key={field.id} className={`${styles.fieldGroup} ${hasError ? styles.fieldGroupError : ''}`}>
                <label className={styles.fieldLabel}>
                    {field.label}
                    {field.required && <span className={styles.required}>*</span>}
                </label>
                <div className={styles.coupleRow}>
                    <div className={styles.coupleCol}>
                        <div className={styles.personBadge} data-person="ela">ELA</div>
                        {renderInput(field, cv.ela, v => handleCoupleChange(field.id, 'ela', v), '-ela', elaEmpty)}
                    </div>
                    <div className={styles.coupleCol}>
                        <div className={styles.personBadge} data-person="ele">ELE</div>
                        {renderInput(field, cv.ele, v => handleCoupleChange(field.id, 'ele', v), '-ele', eleEmpty)}
                    </div>
                </div>
                {hasError && <span className={styles.fieldErrorMsg}>Campo obrigatório</span>}
            </div>
        );
    };

    // ─── Loading ───
    if (loading) {
        return (
            <div className={styles.fullScreen}>
                <div className={styles.loadingBox}>
                    <div className={styles.spinner} />
                    <p>Carregando...</p>
                </div>
            </div>
        );
    }

    // ─── Error without form ───
    if (error && !formMeta) {
        return (
            <div className={styles.fullScreen}>
                <div className={styles.errorBox}>
                    <div className={styles.errorIconSvg}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="8" x2="12" y2="12"/>
                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                    </div>
                    <h2>Ops!</h2>
                    <p>{error}</p>
                    <button onClick={() => router.push('/')} className={styles.primaryBtn}>Voltar ao início</button>
                </div>
            </div>
        );
    }

    // ─── Success ───
    if (submitted) {
        return (
            <div className={styles.fullScreen}>
                <div className={styles.successBox}>
                    <div className={styles.successIconSvg}>
                        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.5">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="9 12 11 14 15 10"/>
                        </svg>
                    </div>
                    <h1>Tudo certo!</h1>
                    <p>Sua ficha foi enviada com sucesso. Você receberá as informações por e-mail.</p>
                    <button onClick={() => router.push('/')} className={styles.primaryBtn}>Voltar ao início</button>
                    <div style={{
                        marginTop: 24, padding: '14px 18px',
                        background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10,
                        fontSize: 13, color: '#6b7280', textAlign: 'left',
                    }}>
                        <strong style={{ color: '#111827', display: 'block', marginBottom: 4 }}>📞 Dúvidas ou problemas?</strong>
                        Entre em contato com <strong>Patrícia Ferraz</strong>:{' '}
                        <a href="tel:+5517991665571" style={{ color: '#111827', fontWeight: 600 }}>(17) 99166-5571</a>
                    </div>
                </div>
            </div>
        );
    }

    const step = steps[currentStep];
    const isLastStep = currentStep === steps.length - 1;
    const progress = steps.length > 1 ? ((currentStep + 1) / steps.length) * 100 : 100;

    return (
        <div className={styles.page}>
            {/* ─── Top Bar ─── */}
            <header className={styles.topBar}>
                <button
                    className={styles.backArrow}
                    onClick={() => currentStep === 0 ? router.back() : navigate('back')}
                    aria-label="Voltar"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
                <div className={styles.topTitle}>{formMeta?.name}</div>
                {steps.length > 1 && (
                    <div className={styles.stepCount}>{currentStep + 1}/{steps.length}</div>
                )}
            </header>

            {/* ─── Progress Bar ─── */}
            {steps.length > 1 && (
                <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                </div>
            )}

            {/* ─── Step Dots ─── */}
            {steps.length > 1 && steps.length <= 12 && (
                <div className={styles.stepDots}>
                    {steps.map((_, i) => (
                        <div
                            key={i}
                            className={`${styles.dot} ${i < currentStep ? styles.dotDone : ''} ${i === currentStep ? styles.dotActive : ''}`}
                        />
                    ))}
                </div>
            )}

            {/* ─── Step Content ─── */}
            <main className={styles.main}>
                <div
                    key={animKey}
                    className={`${styles.stepCard} ${animDir === 'forward' ? styles.slideIn : styles.slideInBack}`}
                >
                    {/* Step Header */}
                    <div className={styles.stepHeader}>
                        <h2 className={styles.stepTitle}>{step?.title}</h2>
                    </div>

                    {/* Inline validation error — top of card */}
                    {error && (
                        <div className={styles.errorAlert}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <path d="M12 2L2 19h20L12 2z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                            {error}
                        </div>
                    )}

                    {/* Tent notice — shown only on first step */}
                    {formMeta?.hasTentNotice && currentStep === 0 && (
                        <div className={styles.tentNotice}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <path d="M12 2L2 19h20L12 2z"/>
                                <line x1="12" y1="9" x2="12" y2="13"/>
                                <line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                            <span>Trazer sua própria barraca</span>
                        </div>
                    )}

                    {/* Couple column labels */}
                    {isCouple && (
                        <div className={styles.coupleHeaders}>
                            <div className={styles.coupleHeaderEla}>Ela</div>
                            <div className={styles.coupleHeaderEle}>Ele</div>
                        </div>
                    )}

                    {/* Fields */}
                    <div className={styles.fields}>
                        {step?.fields.map(field =>
                            isCouple && field.is_couple_field !== false
                                ? renderCoupleField(field)
                                : renderField(field)
                        )}
                    </div>

                </div>
            </main>

            {/* ─── Bottom Nav ─── */}
            <footer className={styles.bottomNav}>
                {currentStep > 0 ? (
                    <button className={styles.backBtn} onClick={() => navigate('back')}>
                        Voltar
                    </button>
                ) : (
                    <div />
                )}

                {isLastStep ? (
                    <button
                        className={styles.primaryBtn}
                        onClick={handleSubmit}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <span className={styles.btnSpinner} />
                        ) : (
                            'Enviar Ficha'
                        )}
                    </button>
                ) : (
                    <button className={styles.primaryBtn} onClick={() => navigate('forward')}>
                        Continuar
                    </button>
                )}
            </footer>

            {/* Contact info */}
            <div style={{
                textAlign: 'center', padding: '12px 20px 24px',
                fontSize: 12, color: '#9ca3af',
            }}>
                Dúvidas? Fale com <strong style={{ color: '#6b7280' }}>Patrícia Ferraz</strong>{' '}
                <a href="tel:+5517991665571" style={{ color: '#6b7280', fontWeight: 600 }}>(17) 99166-5571</a>
            </div>
        </div>
    );
}
