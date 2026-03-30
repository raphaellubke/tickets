'use client';

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import styles from '../login/page.module.css';

function SignUpPageContent() {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const searchParams = useSearchParams();
    const supabase = createClient();

    useEffect(() => {
        const inviteEmail = searchParams.get('email');
        if (inviteEmail) setEmail(decodeURIComponent(inviteEmail));
    }, [searchParams]);

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const redirectTo = `${window.location.origin}/auth/callback?next=${searchParams.get('redirect') || '/dashboard'}`;

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: redirectTo,
                data: {
                    full_name: fullName,
                    avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`,
                },
            },
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
                            Enviamos um link de acesso para<br />
                            <strong>{email}</strong>
                        </p>
                    </div>
                    <p style={{ textAlign: 'center', fontSize: 14, color: '#6b7280', marginTop: 16 }}>
                        Clique no link do e-mail para criar sua conta e entrar. Não precisa de senha.
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
                    <h1 className={styles.title}>Crie sua conta</h1>
                    <p className={styles.subtitle}>Simples e sem senha — só seu e-mail</p>
                </div>

                <form onSubmit={handleSignUp} className={styles.form}>
                    {error && <div className={styles.error}>{error}</div>}

                    <div className={styles.formGroup}>
                        <label htmlFor="fullName" className={styles.label}>Nome Completo</label>
                        <input
                            id="fullName"
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className={styles.input}
                            placeholder="Seu Nome"
                            required
                        />
                    </div>

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
                        {loading ? 'Enviando...' : 'Criar conta'}
                    </button>

                    <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>
                        Enviaremos um link por e-mail. Sem senha necessária.
                    </p>
                </form>

                <div className={styles.footer}>
                    <p>Já tem uma conta? <Link href={`/login${searchParams.toString() ? `?${searchParams.toString()}` : ''}`} className={styles.link}>Entrar</Link></p>
                </div>
            </div>
        </div>
    );
}

export default function SignUpPage() {
    return (
        <Suspense fallback={
            <div className={styles.container}>
                <div className={styles.card}>
                    <p>Carregando...</p>
                </div>
            </div>
        }>
            <SignUpPageContent />
        </Suspense>
    );
}
