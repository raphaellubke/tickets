'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './ParticipantModal.module.css';

interface FormAnswerDetail {
    value: string | null;
    form_fields: {
        label: string;
        type: string;
        order_index: number;
        is_couple_field?: boolean | null;
    } | null;
}

interface TicketFormDetail {
    responseId: string;
    status: string; // 'pending' | 'completed'
    answers: FormAnswerDetail[];
}

interface ParticipantModalProps {
    order: any;
    eventName: string;
    onClose: () => void;
    onPrintPDF: (order: any, formDetails: Record<string, TicketFormDetail>) => void;
}

const paymentMethodLabel: Record<string, string> = {
    pix: 'PIX',
    card: 'Cartão de Crédito',
    boleto: 'Boleto',
    credit_card: 'Cartão de Crédito',
    debit_card: 'Cartão de Débito',
};

export default function ParticipantModal({ order, eventName, onClose, onPrintPDF }: ParticipantModalProps) {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [formDetails, setFormDetails] = useState<Record<string, TicketFormDetail>>({});
    const [copiedTicket, setCopiedTicket] = useState<string | null>(null);
    const [emailSent, setEmailSent] = useState<Record<string, boolean>>({});
    const [sendingEmail, setSendingEmail] = useState<Record<string, boolean>>({});

    useEffect(() => {
        loadFormDetails();
    }, [order.id]);

    async function loadFormDetails() {
        setLoading(true);
        try {
            const tickets = order.tickets || [];
            if (tickets.length === 0) { setLoading(false); return; }

            const ticketIds = tickets.map((t: any) => t.id);

            const { data: responses } = await supabase
                .from('form_responses')
                .select('id, ticket_id, status')
                .in('ticket_id', ticketIds);

            const details: Record<string, TicketFormDetail> = {};

            if (responses && responses.length > 0) {
                await Promise.all(responses.map(async (response) => {
                    let answers: FormAnswerDetail[] = [];

                    if (response.status === 'completed') {
                        const { data: rawAnswers } = await supabase
                            .from('form_response_answers')
                            .select('value, field_id')
                            .eq('response_id', response.id);

                        if (rawAnswers && rawAnswers.length > 0) {
                            const fieldIds = rawAnswers.map((a: any) => a.field_id).filter(Boolean);
                            const { data: fields } = await supabase
                                .from('form_fields')
                                .select('id, label, type, order_index, is_couple_field')
                                .in('id', fieldIds);

                            const fieldMap = Object.fromEntries((fields || []).map((f: any) => [f.id, f]));

                            answers = rawAnswers.map((a: any) => ({
                                value: a.value,
                                form_fields: fieldMap[a.field_id] || null,
                            })).sort((a, b) =>
                                (a.form_fields?.order_index || 0) - (b.form_fields?.order_index || 0)
                            );
                        }
                    }

                    details[response.ticket_id] = {
                        responseId: response.id,
                        status: response.status,
                        answers,
                    };
                }));
            }

            setFormDetails(details);
        } catch (err) {
            console.error('Error loading form details:', err);
        } finally {
            setLoading(false);
        }
    }

    async function copyFormLink(ticketId: string) {
        const url = `${window.location.origin}/form/${ticketId}`;
        await navigator.clipboard.writeText(url);
        setCopiedTicket(ticketId);
        setTimeout(() => setCopiedTicket(null), 3000);
    }

    async function resendFormEmail(ticketId: string) {
        setSendingEmail(prev => ({ ...prev, [ticketId]: true }));
        try {
            const res = await fetch('/api/send-form-reminder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticketId,
                    email: order.participant_email,
                    name: order.participant_name,
                    eventName,
                }),
            });
            const data = await res.json();
            if (data.success && data.emailSent) {
                setEmailSent(prev => ({ ...prev, [ticketId]: true }));
            } else if (data.success && !data.emailSent) {
                // OTP failed but link is available — show copy button instead
                alert(`Não foi possível enviar o e-mail automaticamente.\n\nLink do formulário:\n${data.formUrl}`);
            }
        } catch (err) {
            console.error('Error sending form reminder:', err);
        } finally {
            setSendingEmail(prev => ({ ...prev, [ticketId]: false }));
        }
    }

    const hasAnyForm = order.tickets?.some((t: any) => formDetails[t.id]);
    const paidDate = order.paid_at
        ? new Date(order.paid_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
        : '—';

    return (
        <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className={styles.modal}>
                <div className={styles.modalHeader}>
                    <div>
                        <h2 className={styles.modalTitle}>{order.participant_name}</h2>
                        <p className={styles.modalSubtitle}>{order.participant_email}</p>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div className={styles.modalBody}>
                    {/* Participant Info */}
                    <div className={styles.section}>
                        <p className={styles.sectionTitle}>Dados Pessoais</p>
                        <div className={styles.infoGrid}>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>Nome Completo</span>
                                <span className={styles.infoValue}>{order.participant_name || '—'}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>E-mail</span>
                                <span className={styles.infoValue}>{order.participant_email || '—'}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>Telefone</span>
                                <span className={styles.infoValue}>{order.participant_phone || '—'}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>Nº do Pedido</span>
                                <span className={styles.infoValue} style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                                    {order.order_number}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Payment Info */}
                    <div className={styles.section}>
                        <p className={styles.sectionTitle}>Pagamento</p>
                        <div className={styles.infoGrid}>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>Método</span>
                                <span className={styles.paymentBadge}>
                                    {paymentMethodLabel[order.payment_method] || order.payment_method || '—'}
                                </span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>Valor Pago</span>
                                <span className={styles.infoValue} style={{ color: '#16a34a', fontWeight: 700 }}>
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
                                        .format(parseFloat(order.total_amount || '0'))}
                                </span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>Data do Pagamento</span>
                                <span className={styles.infoValue}>{paidDate}</span>
                            </div>
                        </div>
                    </div>

                    {/* Tickets */}
                    {order.tickets && order.tickets.length > 0 && (
                        <div className={styles.section}>
                            <p className={styles.sectionTitle}>Ingressos ({order.tickets.length})</p>
                            {order.tickets.map((ticket: any) => (
                                <div key={ticket.id} className={styles.ticketRow}>
                                    <div>
                                        <div className={styles.ticketTypeName}>
                                            {ticket.event_ticket_types?.name || 'Ingresso'}
                                        </div>
                                        <div className={styles.ticketCode}>{ticket.ticket_code}</div>
                                    </div>
                                    <span style={{
                                        fontSize: '11px', fontWeight: 600,
                                        padding: '2px 8px', borderRadius: '20px',
                                        background: ticket.status === 'used' ? '#dbeafe' : '#dcfce7',
                                        color: ticket.status === 'used' ? '#1e40af' : '#166534'
                                    }}>
                                        {ticket.status === 'used' ? 'Usado' : 'Ativo'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Form Responses */}
                    {loading ? (
                        <div className={styles.loadingRow}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                                <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
                                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
                                <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
                                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
                            </svg>
                            Carregando formulário...
                        </div>
                    ) : hasAnyForm ? (
                        <div className={styles.section}>
                            <p className={styles.sectionTitle}>Formulário</p>
                            {order.tickets?.map((ticket: any) => {
                                const detail = formDetails[ticket.id];
                                if (!detail) return null;
                                const isCompleted = detail.status === 'completed';
                                const isCopied = copiedTicket === ticket.id;
                                const isEmailSent = emailSent[ticket.id];
                                const isSending = sendingEmail[ticket.id];

                                return (
                                    <div key={ticket.id}>
                                        <div className={styles.formStatusRow}>
                                            <div className={styles.formStatusLeft}>
                                                <span className={styles.formTicketName}>
                                                    {ticket.event_ticket_types?.name || 'Ingresso'} — {ticket.ticket_code}
                                                </span>
                                                <span className={`${styles.formStatusBadge} ${isCompleted ? styles.formCompleted : styles.formPending}`}>
                                                    {isCompleted ? (
                                                        <>
                                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                                <polyline points="20 6 9 17 4 12"/>
                                                            </svg>
                                                            Preenchido
                                                        </>
                                                    ) : (
                                                        <>
                                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                                                            </svg>
                                                            Pendente
                                                        </>
                                                    )}
                                                </span>
                                            </div>
                                            {!isCompleted && (
                                                <div className={styles.formActions}>
                                                    {isCopied ? (
                                                        <span className={styles.linkCopiedMsg}>✓ Link copiado!</span>
                                                    ) : (
                                                        <button className={styles.copyLinkBtn} onClick={() => copyFormLink(ticket.id)}>
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                                            </svg>
                                                            Copiar link
                                                        </button>
                                                    )}
                                                    {isEmailSent ? (
                                                        <span className={styles.emailSentMsg}>✓ E-mail enviado!</span>
                                                    ) : (
                                                        <button
                                                            className={styles.resendEmailBtn}
                                                            onClick={() => resendFormEmail(ticket.id)}
                                                            disabled={isSending}
                                                        >
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                                                            </svg>
                                                            {isSending ? 'Enviando...' : 'Reenviar e-mail'}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {isCompleted && detail.answers.length > 0 && (
                                            <div className={styles.answersGrid}>
                                                {detail.answers.map((answer, idx) => {
                                                    let displayValue: React.ReactNode = answer.value || <em className={styles.noAnswerMsg}>Não respondido</em>;
                                                    if (answer.value) {
                                                        try {
                                                            const parsed = JSON.parse(answer.value);
                                                            if (parsed && typeof parsed === 'object' && 'ele' in parsed && 'ela' in parsed) {
                                                                displayValue = (
                                                                    <span style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                                                                        <span><strong>Ele:</strong> {parsed.ele || '—'}</span>
                                                                        <span><strong>Ela:</strong> {parsed.ela || '—'}</span>
                                                                    </span>
                                                                );
                                                            }
                                                        } catch {}
                                                    }
                                                    return (
                                                        <div key={idx} className={styles.answerItem}>
                                                            <span className={styles.answerQuestion}>
                                                                {answer.form_fields?.label || `Pergunta ${idx + 1}`}
                                                            </span>
                                                            <span className={styles.answerValue}>
                                                                {displayValue}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {isCompleted && detail.answers.length === 0 && (
                                            <div className={styles.answersGrid}>
                                                <span className={styles.noAnswerMsg}>Formulário preenchido, mas sem respostas registradas.</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className={styles.section}>
                            <p className={styles.sectionTitle}>Formulário</p>
                            <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>
                                Este evento não possui formulário associado.
                            </p>
                        </div>
                    )}
                </div>

                <div className={styles.modalFooter}>
                    <button className={styles.secondaryBtn} onClick={onClose}>Fechar</button>
                    <button className={styles.pdfBtn} onClick={() => onPrintPDF(order, formDetails)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                            <rect x="6" y="14" width="12" height="8"/>
                        </svg>
                        Baixar PDF
                    </button>
                </div>
            </div>
        </div>
    );
}
