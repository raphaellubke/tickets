'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import styles from './InviteMemberModal.module.css';

interface InviteMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function InviteMemberModal({ isOpen, onClose, onSuccess }: InviteMemberModalProps) {
    const { user } = useAuth();
    const supabase = createClient();
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('member');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [linkCopied, setLinkCopied] = useState(false);

    const roles = [
        { value: 'owner', label: 'Proprietário', description: 'Acesso total a todas as configurações e faturamento' },
        { value: 'admin', label: 'Administrador', description: 'Pode gerenciar eventos, membros e integrações' },
        { value: 'organizer', label: 'Organizador', description: 'Pode criar e editar eventos e formulários' },
        { value: 'member', label: 'Membro', description: 'Apenas visualização de dados e relatórios' },
    ];

    const generateInviteToken = () => {
        return crypto.randomUUID();
    };

    const handleGenerateLink = async () => {
        if (!user) {
            setError('Você precisa estar autenticado');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Get user's organization
            const { data: members } = await supabase
                .from('organization_members')
                .select('organization_id')
                .eq('user_id', user.id)
                .limit(1);
            const memberData = members?.[0];

            if (!memberData) {
                throw new Error('Organização não encontrada');
            }

            // Generate invite token
            const token = generateInviteToken();

            // Create pending member record if email is provided
            if (email) {
                // Check if member already exists
                const { data: existingMember } = await supabase
                    .from('organization_members')
                    .select('id')
                    .eq('organization_id', memberData.organization_id)
                    .eq('email', email)
                    .maybeSingle();

                if (existingMember) {
                    throw new Error('Este email já está na organização');
                }

                // Create pending member
                const { error: insertError } = await supabase
                    .from('organization_members')
                    .insert([{
                        organization_id: memberData.organization_id,
                        email: email,
                        role: role,
                        status: 'pending',
                        invited_by: user.id,
                        invited_at: new Date().toISOString(),
                        name: email.split('@')[0],
                    }]);

                if (insertError) {
                    throw insertError;
                }
            }

            const inviteUrl = `${window.location.origin}/invite/${token}?org=${memberData.organization_id}&role=${role}${email ? `&email=${encodeURIComponent(email)}` : ''}`;

            setInviteLink(inviteUrl);
        } catch (err: any) {
            console.error('Error generating invite link:', err);
            setError(err.message || 'Erro ao gerar link de convite');
        } finally {
            setLoading(false);
        }
    };

    const handleCopyLink = async () => {
        if (!inviteLink) return;

        try {
            await navigator.clipboard.writeText(inviteLink);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        } catch (err) {
            console.error('Error copying link:', err);
            setError('Erro ao copiar link');
        }
    };

    const handleSendInvite = async () => {
        if (!email || !user) {
            setError('Email é obrigatório para enviar convite');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Get user's organization
            const { data: members2 } = await supabase
                .from('organization_members')
                .select('organization_id')
                .eq('user_id', user.id)
                .limit(1);
            const memberData = members2?.[0];

            if (!memberData) {
                throw new Error('Organização não encontrada');
            }

            // Check if member already exists
            const { data: existingMember } = await supabase
                .from('organization_members')
                .select('id')
                .eq('organization_id', memberData.organization_id)
                .eq('email', email)
                .maybeSingle();

            if (existingMember) {
                throw new Error('Este email já está na organização');
            }

            // Generate invite token
            const token = generateInviteToken();
            const inviteUrl = `${window.location.origin}/invite/${token}?org=${memberData.organization_id}&role=${role}&email=${encodeURIComponent(email)}`;

            // Create pending member
            const { error: insertError } = await supabase
                .from('organization_members')
                .insert([{
                    organization_id: memberData.organization_id,
                    email: email,
                    role: role,
                    status: 'pending',
                    invited_by: user.id,
                    invited_at: new Date().toISOString(),
                    name: email.split('@')[0], // Temporary name
                }]);

            if (insertError) {
                throw insertError;
            }

            // TODO: Send email with invite link
            // For now, just show success message

            if (onSuccess) {
                onSuccess();
            }
            handleClose();
        } catch (err: any) {
            console.error('Error sending invite:', err);
            setError(err.message || 'Erro ao enviar convite');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setEmail('');
        setRole('member');
        setError(null);
        setInviteLink(null);
        setLinkCopied(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={handleClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Convidar Membro</h2>
                    <button className={styles.closeBtn} onClick={handleClose}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div className={styles.content}>
                    {error && (
                        <div className={styles.errorAlert}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            {error}
                        </div>
                    )}

                    <div className={styles.formGroup}>
                        <label htmlFor="email" className={styles.label}>
                            Email (Opcional)
                        </label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={styles.input}
                            placeholder="exemplo@email.com"
                        />
                        <p className={styles.hint}>
                            Deixe em branco para apenas gerar o link de convite
                        </p>
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="role" className={styles.label}>
                            Função
                        </label>
                        <select
                            id="role"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className={styles.select}
                        >
                            {roles.map((r) => (
                                <option key={r.value} value={r.value}>
                                    {r.label}
                                </option>
                            ))}
                        </select>
                        <p className={styles.roleDescription}>
                            {roles.find(r => r.value === role)?.description}
                        </p>
                    </div>

                    {inviteLink && (
                        <div className={styles.linkSection}>
                            <label className={styles.label}>Link de Convite</label>
                            <div className={styles.linkBox}>
                                <input
                                    type="text"
                                    value={inviteLink}
                                    readOnly
                                    className={styles.linkInput}
                                />
                                <button
                                    onClick={handleCopyLink}
                                    className={styles.copyBtn}
                                >
                                    {linkCopied ? (
                                        <>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                            Copiado!
                                        </>
                                    ) : (
                                        <>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                            </svg>
                                            Copiar
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className={styles.actions}>
                        <button
                            type="button"
                            onClick={handleGenerateLink}
                            className={styles.secondaryBtn}
                            disabled={loading}
                        >
                            Gerar Link de Convite
                        </button>
                        {email && (
                            <button
                                type="button"
                                onClick={handleSendInvite}
                                className={styles.primaryBtn}
                                disabled={loading || !email}
                            >
                                {loading ? 'Enviando...' : 'Enviar Convite'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

