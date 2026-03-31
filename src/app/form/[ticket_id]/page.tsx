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

    // Split fields into steps by section_header dividers
    const steps = useMemo<Step[]>(() => {
        if (formFields.length === 0) return [];

        const result: Step[] = [];
        let current: Step | null = null;

        for (const field of formFields) {
            if (field.type === 'section_header') {
                if (current && current.fields.length > 0) result.push(current);
                current = { title: field.label, fields: [] };
            } else {
                if (!current) {
                    current = { title: formMeta?.name || 'Formulário', fields: [] };
                }
                current.fields.push(field);
            }
        }
        if (current && current.fields.length > 0) result.push(current);

        return result.length > 0 ? result : [{ title: formMeta?.name || 'Formulário', fields: formFields }];
    }, [formFields, formMeta]);

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
                if (existingAnswers) {
                    const aMap: Record<string, string> = {};
                    const cMap: Record<string, { ele: string; ela: string }> = {};
                    existingAnswers.forEach(a => {
                        if (form.is_couple) {
                            try {
                                const p = JSON.parse(a.value || '');
                                if (p && typeof p === 'object' && 'ele' in p) { cMap[a.field_id] = p; return; }
                            } catch {}
                        }
                        aMap[a.field_id] = a.value || '';
                    });
                    setAnswers(aMap);
                    if (form.is_couple) setCoupleAnswers(cMap);
                }
            } catch (err: any) {
                setError(err.message || 'Erro ao carregar formulário');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [ticket_id]);

    const handleFieldChange = (fieldId: string, value: string) =>
        setAnswers(prev => ({ ...prev, [fieldId]: value }));

    const formatPhone = (value: string) => {
        const n = value.replace(/\D/g, '');
        if (n.length <= 10) return n.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
        return n.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 15);
    };

    const handleCoupleChange = (fieldId: string, person: 'ele' | 'ela', value: string) =>
        setCoupleAnswers(prev => ({ ...prev, [fieldId]: { ...(prev[fieldId] || { ele: '', ela: '' }), [person]: value } }));

    const validateStep = (idx: number): boolean => {
        if (idx >= steps.length) return true;
        for (const field of steps[idx].fields) {
            if (!field.required) continue;
            if (field.type === 'clause') {
                if (answers[field.id] !== 'sim') {
                    setError(`Você precisa aceitar: "${field.label}"`);
                    return false;
                }
                continue;
            }
            if (isCouple) {
                const ca = coupleAnswers[field.id];
                if (!ca?.ele?.trim() || !ca?.ela?.trim()) {
                    setError(`"${field.label}" é obrigatório para Ele e Ela`);
                    return false;
                }
            } else if (!answers[field.id]?.trim()) {
                setError(`"${field.label}" é obrigatório`);
                return false;
            }
        }
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
            const updates = formFields
                .filter(f => f.type !== 'section_header')
                .map(field => ({
                    response_id: formResponse.id,
                    field_id: field.id,
                    value: isCouple
                        ? JSON.stringify(coupleAnswers[field.id] || { ele: '', ela: '' })
                        : (answers[field.id] || null),
                }));

            await supabase.from('form_response_answers').delete().eq('response_id', formResponse.id);
            const { error: insertErr } = await supabase.from('form_response_answers').insert(updates);
            if (insertErr) { setError('Erro ao salvar respostas'); setSubmitting(false); return; }
            await supabase.from('form_responses').update({ status: 'completed' }).eq('id', formResponse.id);
            setSubmitted(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err: any) {
            setError(err.message || 'Erro ao enviar formulário');
        } finally {
            setSubmitting(false);
        }
    };

    const renderInput = (field: FormField, value: string, onChange: (v: string) => void, nameSuffix = '') => {
        switch (field.type) {
            case 'text':
            case 'email':
            case 'number':
                return <input type={field.type} value={value} onChange={e => onChange(e.target.value)} className={styles.input} placeholder={field.label} />;
            case 'tel':
                return <input type="tel" value={value} onChange={e => onChange(formatPhone(e.target.value))} className={styles.input} placeholder="(00) 00000-0000" maxLength={15} />;
            case 'date':
                return <input type="date" value={value} onChange={e => onChange(e.target.value)} className={styles.input} />;
            case 'textarea':
                return <textarea value={value} onChange={e => onChange(e.target.value)} className={styles.textarea} placeholder={field.label} rows={3} />;
            case 'select': {
                const opts = (field.options as any) || [];
                return (
                    <select value={value} onChange={e => onChange(e.target.value)} className={styles.select}>
                        <option value="">Selecione...</option>
                        {opts.map((o: string, i: number) => <option key={i} value={o}>{o}</option>)}
                    </select>
                );
            }
            case 'radio': {
                const opts = (field.options as any) || [];
                return (
                    <div className={styles.pillGroup}>
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
                    <div className={styles.pillGroup}>
                        <button type="button" className={`${styles.pill} ${checked ? styles.pillActive : ''}`} onClick={() => onChange('sim')}>Sim</button>
                        <button type="button" className={`${styles.pill} ${!checked && value ? styles.pillActive : ''}`} onClick={() => onChange('não')}>Não</button>
                    </div>
                );
            }
            case 'shirt_size': {
                const sizes = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'];
                return (
                    <div className={styles.sizeGrid}>
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

    const renderField = (field: FormField) => (
        <div key={field.id} className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>
                {field.label}
                {field.required && <span className={styles.required}>*</span>}
            </label>
            {renderInput(field, answers[field.id] || '', v => handleFieldChange(field.id, v))}
        </div>
    );

    const renderCoupleField = (field: FormField) => {
        const cv = coupleAnswers[field.id] || { ele: '', ela: '' };
        return (
            <div key={field.id} className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>
                    {field.label}
                    {field.required && <span className={styles.required}>*</span>}
                </label>
                <div className={styles.coupleRow}>
                    <div className={styles.coupleCol}>
                        <div className={styles.personBadge} data-person="ela">ELA</div>
                        {renderInput(field, cv.ela, v => handleCoupleChange(field.id, 'ela', v), '-ela')}
                    </div>
                    <div className={styles.coupleCol}>
                        <div className={styles.personBadge} data-person="ele">ELE</div>
                        {renderInput(field, cv.ele, v => handleCoupleChange(field.id, 'ele', v), '-ele')}
                    </div>
                </div>
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
                            isCouple ? renderCoupleField(field) : renderField(field)
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <div className={styles.errorAlert}>
                            <span>⚠️</span> {error}
                        </div>
                    )}
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
        </div>
    );
}
