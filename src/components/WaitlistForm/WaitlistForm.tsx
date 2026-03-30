'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './WaitlistForm.module.css';

interface WaitlistFormProps {
    eventId: string;
    organizationId: string;
    eventName: string;
}

export default function WaitlistForm({ eventId, organizationId, eventName }: WaitlistFormProps) {
    const supabase = createClient();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [position, setPosition] = useState<number | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (!name.trim() || !email.trim()) {
            setError('Nome e e-mail são obrigatórios');
            return;
        }

        setLoading(true);
        try {
            const { data, error: rpcError } = await supabase.rpc('add_to_waitlist', {
                p_event_id: eventId,
                p_organization_id: organizationId,
                p_name: name.trim(),
                p_email: email.trim().toLowerCase(),
                p_phone: phone.trim() || null,
            });

            if (rpcError) throw rpcError;

            setPosition(data?.position || 1);
        } catch (err: any) {
            setError(err.message || 'Erro ao entrar na lista de espera');
        } finally {
            setLoading(false);
        }
    }

    if (position !== null) {
        return (
            <div className={styles.waitlistCard}>
                <div className={styles.successCard}>
                    <svg className={styles.successIcon} width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    <h3 className={styles.successTitle}>Você está na lista!</h3>
                    <p className={styles.successText}>
                        Te avisaremos por e-mail quando ingressos ficarem disponíveis para <strong>{eventName}</strong>.
                    </p>
                    <span className={styles.positionBadge}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                        Posição {position} na fila
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.waitlistCard}>
            <div className={styles.waitlistHeader}>
                <h3 className={styles.waitlistTitle}>
                    <svg className={styles.waitlistIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    Ingressos Esgotados
                </h3>
                <p className={styles.waitlistSubtitle}>
                    Entre na lista de espera e seja notificado quando ingressos ficarem disponíveis.
                </p>
            </div>

            <form className={styles.form} onSubmit={handleSubmit}>
                <div className={styles.formGroup}>
                    <label className={styles.label}>Nome Completo *</label>
                    <input
                        type="text"
                        className={styles.input}
                        placeholder="Seu nome completo"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.label}>E-mail *</label>
                    <input
                        type="email"
                        className={styles.input}
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.label}>Telefone (opcional)</label>
                    <input
                        type="tel"
                        className={styles.input}
                        placeholder="(00) 00000-0000"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                    />
                </div>

                {error && (
                    <div className={styles.errorMsg}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: '1px' }}>
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="8" x2="12" y2="12"/>
                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        {error}
                    </div>
                )}

                <button type="submit" className={styles.submitBtn} disabled={loading}>
                    {loading ? 'Entrando na lista...' : 'Entrar na Lista de Espera'}
                </button>
            </form>
        </div>
    );
}
