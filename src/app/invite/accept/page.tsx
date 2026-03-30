'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function InviteAcceptPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const supabase = createClient();

    const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'already'>('loading');
    const [message, setMessage] = useState('Processando seu convite...');

    useEffect(() => {
        async function acceptInvite() {
            const orgId = searchParams.get('org');
            const role = searchParams.get('role') || 'member';
            const email = searchParams.get('email');

            if (!orgId) {
                setStatus('error');
                setMessage('Link de convite inválido.');
                return;
            }

            // Wait for session to be established after magic link redirect
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                setStatus('error');
                setMessage('Sessão não encontrada. Tente clicar no link novamente.');
                return;
            }

            const userId = session.user.id;
            const userEmail = session.user.email;

            // Check if already a member
            const { data: existing } = await supabase
                .from('organization_members')
                .select('id, status')
                .eq('organization_id', orgId)
                .eq('user_id', userId)
                .maybeSingle();

            if (existing) {
                setStatus('already');
                setMessage('Você já é membro desta organização.');
                setTimeout(() => router.push('/dashboard'), 2000);
                return;
            }

            // Check for a pending invite by email
            const { data: pendingInvite } = await supabase
                .from('organization_members')
                .select('id')
                .eq('organization_id', orgId)
                .eq('email', userEmail || email || '')
                .is('user_id', null)
                .maybeSingle();

            if (pendingInvite) {
                // Update pending invite with the real user_id
                const { error } = await supabase
                    .from('organization_members')
                    .update({ user_id: userId, status: 'active', joined_at: new Date().toISOString() })
                    .eq('id', pendingInvite.id);

                if (error) {
                    setStatus('error');
                    setMessage('Erro ao aceitar convite: ' + error.message);
                    return;
                }
            } else {
                // No pending invite found, insert new member directly
                const { error } = await supabase
                    .from('organization_members')
                    .insert({
                        organization_id: orgId,
                        user_id: userId,
                        email: userEmail || email || '',
                        role,
                        status: 'active',
                        joined_at: new Date().toISOString(),
                    });

                if (error) {
                    setStatus('error');
                    setMessage('Erro ao entrar na organização: ' + error.message);
                    return;
                }
            }

            setStatus('success');
            setMessage('Convite aceito! Redirecionando para o painel...');
            setTimeout(() => router.push('/dashboard'), 2000);
        }

        acceptInvite();
    }, []);

    const icons = {
        loading: (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
        ),
        success: (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="9 12 11 14 15 10" />
            </svg>
        ),
        already: (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="9 12 11 14 15 10" />
            </svg>
        ),
        error: (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
        ),
    };

    return (
        <>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            <div style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#f9fafb', fontFamily: 'Inter, sans-serif',
            }}>
                <div style={{
                    background: '#fff', borderRadius: 16, padding: '48px 40px', textAlign: 'center',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.08)', maxWidth: 380, width: '100%',
                }}>
                    <div style={{ marginBottom: 20 }}>{icons[status]}</div>
                    <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#111827' }}>
                        {status === 'loading' ? 'Aguarde' : status === 'success' || status === 'already' ? 'Tudo certo!' : 'Algo deu errado'}
                    </h2>
                    <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>{message}</p>
                    {status === 'error' && (
                        <button
                            onClick={() => router.push('/login')}
                            style={{
                                marginTop: 20, padding: '10px 24px', background: '#6366f1', color: '#fff',
                                border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600,
                            }}
                        >
                            Ir para o login
                        </button>
                    )}
                </div>
            </div>
        </>
    );
}
