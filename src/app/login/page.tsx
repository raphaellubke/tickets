'use client';

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

function LoginPageContent() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [mode, setMode] = useState<'password' | 'magic'>('magic');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = createClient();

    useEffect(() => {
        const inviteEmail = searchParams.get('email');
        if (inviteEmail) setEmail(decodeURIComponent(inviteEmail));

        const linkError = searchParams.get('error');
        if (linkError === 'link_invalido') setError('Link inválido ou expirado. Solicite um novo.');
    }, [searchParams]);

    const handleMagicLink = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const redirectTo = `${window.location.origin}/auth/callback?next=${searchParams.get('redirect') || '/dashboard'}`;

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: redirectTo },
        });

        setLoading(false);

        if (error) {
            setError(error.message);
        } else {
            setSent(true);
        }
    };

    const handlePasswordLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });

            if (error) {
                setError(error.message);
            } else {
                const pendingInvite = sessionStorage.getItem('pendingInvite');
                const redirectUrl = searchParams.get('redirect');

                if (redirectUrl) {
                    router.push(redirectUrl);
                } else if (pendingInvite) {
                    const inviteData = JSON.parse(pendingInvite);
                    router.push(`/invite/${inviteData.token}?org=${inviteData.orgId}&role=${inviteData.role}${inviteData.email ? `&email=${encodeURIComponent(inviteData.email)}` : ''}`);
                } else {
                    router.push('/dashboard');
                }
                router.refresh();
            }
        } catch {
            setError('Ocorreu um erro ao tentar fazer login.');
        } finally {
            setLoading(false);
        }
    };

    if (sent) {
        return (
            <div className={styles.container}>
                <div className={styles.card}>
                    <div className={styles.header}>
                        <div className={styles.logo}>✉️</div>
                        <h1 className={styles.title}>Verifique seu e-mail</h1>
                        <p className={styles.subtitle}>
                            Enviamos um link de acesso para<br />
                            <strong>{email}</strong>
                        </p>
                    </div>
                    <p style={{ textAlign: 'center', fontSize: 14, color: '#6b7280', marginTop: 16 }}>
                        Clique no link do e-mail para entrar. Não precisa de senha.
                    </p>
                    <button
                        onClick={() => setSent(false)}
                        className={styles.submitBtn}
                        style={{ marginTop: 24, background: '#6b7280' }}
                    >
                        Usar outro e-mail
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.header}>
                    <div className={styles.logo}>D</div>
                    <h1 className={styles.title}>Bem-vindo de volta</h1>
                    <p className={styles.subtitle}>Entre na sua conta para continuar</p>
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                    <button
                        type="button"
                        onClick={() => setMode('magic')}
                        style={{
                            flex: 1, padding: '8px', borderRadius: 8, border: '2px solid',
                            borderColor: mode === 'magic' ? '#111827' : '#e5e7eb',
                            background: mode === 'magic' ? '#111827' : 'white',
                            color: mode === 'magic' ? 'white' : '#374151',
                            fontWeight: 600, cursor: 'pointer', fontSize: 13
                        }}
                    >
                        Link por e-mail
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('password')}
                        style={{
                            flex: 1, padding: '8px', borderRadius: 8, border: '2px solid',
                            borderColor: mode === 'password' ? '#111827' : '#e5e7eb',
                            background: mode === 'password' ? '#111827' : 'white',
                            color: mode === 'password' ? 'white' : '#374151',
                            fontWeight: 600, cursor: 'pointer', fontSize: 13
                        }}
                    >
                        Senha
                    </button>
                </div>

                {mode === 'magic' ? (
                    <form onSubmit={handleMagicLink} className={styles.form}>
                        {error && <div className={styles.error}>{error}</div>}
                        <div className={styles.formGroup}>
                            <label htmlFor="email" className={styles.label}>E-mail</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={styles.input}
                                placeholder="seu@email.com"
                                required
                            />
                        </div>
                        <button type="submit" className={styles.submitBtn} disabled={loading}>
                            {loading ? 'Enviando...' : 'Enviar link de acesso'}
                        </button>
                        <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
                            Você receberá um link por e-mail. Sem senha.
                        </p>
                    </form>
                ) : (
                    <form onSubmit={handlePasswordLogin} className={styles.form}>
                        {error && <div className={styles.error}>{error}</div>}
                        <div className={styles.formGroup}>
                            <label htmlFor="email" className={styles.label}>E-mail</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={styles.input}
                                placeholder="seu@email.com"
                                required
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label htmlFor="password" className={styles.label}>Senha</label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={styles.input}
                                placeholder="••••••••"
                                required
                            />
                        </div>
                        <button type="submit" className={styles.submitBtn} disabled={loading}>
                            {loading ? 'Entrando...' : 'Entrar'}
                        </button>
                    </form>
                )}

                <div className={styles.footer}>
                    <p>Não tem uma conta? <Link href={`/signup${searchParams.toString() ? `?${searchParams.toString()}` : ''}`} className={styles.link}>Cadastre-se</Link></p>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className={styles.container}>
                <div className={styles.card}>
                    <p>Carregando...</p>
                </div>
            </div>
        }>
            <LoginPageContent />
        </Suspense>
    );
}
