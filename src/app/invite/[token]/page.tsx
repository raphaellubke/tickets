'use client';

import { useEffect, useState, use, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import styles from './page.module.css';

function InvitePageContent({ params }: { params: Promise<{ token: string }> }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, loading: authLoading } = useAuth();
    const supabase = createClient();
    const [processing, setProcessing] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Unwrap params Promise
    const { token } = use(params);
    
    // Get invite data from URL params or sessionStorage
    const [inviteData, setInviteData] = useState<{
        orgId: string | null;
        role: string;
        email: string | null;
    }>({
        orgId: searchParams.get('org'),
        role: searchParams.get('role') || 'member',
        email: searchParams.get('email'),
    });

    // Load invite data from sessionStorage if URL params are missing
    useEffect(() => {
        if (!inviteData.orgId) {
            const stored = sessionStorage.getItem('pendingInvite');
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    setInviteData({
                        orgId: parsed.orgId || searchParams.get('org'),
                        role: parsed.role || searchParams.get('role') || 'member',
                        email: parsed.email || searchParams.get('email'),
                    });
                } catch (e) {
                    console.error('Error parsing stored invite:', e);
                }
            }
        }
    }, [searchParams]);

    useEffect(() => {
        async function processInvite() {
            if (authLoading) return;

            // Validate required parameters
            if (!inviteData.orgId) {
                setError('Link de convite inválido: organização não especificada');
                setProcessing(false);
                return;
            }

            // If user is already logged in, process the invite immediately
            if (user) {
                await acceptInvite();
            } else {
                // Store invite data in sessionStorage and redirect to login
                const dataToStore = {
                    token: token,
                    orgId: inviteData.orgId,
                    role: inviteData.role,
                    email: inviteData.email,
                };
                sessionStorage.setItem('pendingInvite', JSON.stringify(dataToStore));
                
                // Redirect to login with return URL
                const loginUrl = `/login?redirect=/invite/${token}${inviteData.orgId ? `&org=${inviteData.orgId}` : ''}${inviteData.role ? `&role=${inviteData.role}` : ''}${inviteData.email ? `&email=${encodeURIComponent(inviteData.email)}` : ''}`;
                router.push(loginUrl);
            }
        }

        processInvite();
    }, [user, authLoading, token, inviteData]);

    const acceptInvite = async () => {
        if (!user) {
            setError('Você precisa estar autenticado para aceitar o convite');
            setProcessing(false);
            return;
        }

        if (!inviteData.orgId) {
            setError('Link de convite inválido: organização não especificada');
            setProcessing(false);
            return;
        }

        try {
            // Check if user is already a member
            const { data: existingMember } = await supabase
                .from('organization_members')
                .select('id, status')
                .eq('organization_id', inviteData.orgId)
                .eq('user_id', user.id)
                .single();

            if (existingMember) {
                if (existingMember.status === 'active') {
                    // Already a member, just redirect to dashboard
                    router.push('/dashboard');
                    return;
                } else {
                    // Update status to active
                    await supabase
                        .from('organization_members')
                        .update({
                            status: 'active',
                            joined_at: new Date().toISOString(),
                            user_id: user.id,
                        })
                        .eq('id', existingMember.id);
                    
                    router.push('/dashboard');
                    return;
                }
            }

            // Check if there's a pending invite with this email
            const { data: pendingInvite } = await supabase
                .from('organization_members')
                .select('id')
                .eq('organization_id', inviteData.orgId)
                .eq('email', user.email || inviteData.email || '')
                .eq('status', 'pending')
                .maybeSingle();

            if (pendingInvite) {
                // Update existing pending invite
                const { error: updateError } = await supabase
                    .from('organization_members')
                    .update({
                        user_id: user.id,
                        status: 'active',
                        joined_at: new Date().toISOString(),
                        role: inviteData.role,
                    })
                    .eq('id', pendingInvite.id);

                if (updateError) throw updateError;
            } else {
                // Create new member
                const { error: insertError } = await supabase
                    .from('organization_members')
                    .insert([{
                        organization_id: inviteData.orgId,
                        user_id: user.id,
                        email: user.email || inviteData.email || '',
                        name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário',
                        role: inviteData.role,
                        status: 'active',
                        joined_at: new Date().toISOString(),
                    }]);

                if (insertError) throw insertError;
            }

            // Clear pending invite from sessionStorage
            sessionStorage.removeItem('pendingInvite');
            
            // Redirect to dashboard
            router.push('/dashboard');
        } catch (err: any) {
            console.error('Error accepting invite:', err);
            setError(err.message || 'Erro ao processar convite');
            setProcessing(false);
        }
    };

    if (processing && !error) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>
                    <div className={styles.spinner}></div>
                    <p>Processando convite...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.container}>
                <div className={styles.error}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <h2>Erro ao processar convite</h2>
                    <p>{error}</p>
                    <button onClick={() => router.push('/login')} className={styles.button}>
                        Ir para Login
                    </button>
                </div>
            </div>
        );
    }

    return null;
}

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
    return (
        <Suspense fallback={
            <div className={styles.container}>
                <div className={styles.card}>
                    <p>Carregando...</p>
                </div>
            </div>
        }>
            <InvitePageContent params={params} />
        </Suspense>
    );
}

