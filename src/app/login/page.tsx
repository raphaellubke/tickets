'use client';

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import styles from './page.module.css';

function LoginPageContent() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [mode, setMode] = useState<'login' | 'forgot'>('login');
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
        if (linkError === 'link_invalido') setError('Link inválido ou expirado. Faça login com sua senha.');
    }, [searchParams]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.signInWithPassword({ email, password });

        setLoading(false);

        if (error) {
            setError('E-mail ou senha incorretos.');
        } else {
            const redirect = searchParams.get('redirect');
            router.push(redirect || '/dashboard');
            router.refresh();
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, '');
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${siteUrl}/auth/callback?next=/nova-senha`,
        });

        setLoading(false);

        if (error) {
            setError(error.message);
        } else {
            setSent(true);
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
                            Enviamos um link para redefinir sua senha para<br />
                            <strong>{email}</strong>
                        </p>
                    </div>
                    <button
                        onClick={() => { setSent(false); setMode('login'); }}
                        className={styles.submitBtn}
                        style={{ marginTop: 8 }}
                    >
                        Voltar ao login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.header}>
                    <Image
                        src="/logo.png"
                        alt="Missão Guadalupe"
                        width={160}
                        height={60}
                        style={{ objectFit: 'contain', marginBottom: 24 }}
                    />
                    <h1 className={styles.title}>
                        {mode === 'login' ? 'Bem-vindo de volta' : 'Redefinir senha'}
                    </h1>
                    <p className={styles.subtitle}>
                        {mode === 'login'
                            ? 'Entre na sua conta para continuar'
                            : 'Digite seu e-mail para receber o link de redefinição'}
                    </p>
                </div>

                {mode === 'login' ? (
                    <form onSubmit={handleLogin} className={styles.form}>
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
                        <button
                            type="button"
                            onClick={() => { setMode('forgot'); setError(null); }}
                            style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', textAlign: 'center' }}
                        >
                            Esqueci minha senha
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleForgotPassword} className={styles.form}>
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
                            {loading ? 'Enviando...' : 'Enviar link de redefinição'}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setMode('login'); setError(null); }}
                            style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', textAlign: 'center' }}
                        >
                            Voltar ao login
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <p>Carregando...</p>
            </div>
        }>
            <LoginPageContent />
        </Suspense>
    );
}
