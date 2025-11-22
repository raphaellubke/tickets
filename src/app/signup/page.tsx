'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../login/page.module.css'; // Reusing login styles for consistency

export default function SignUpPage() {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const supabase = createClient();

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`,
                    },
                },
            });

            if (error) {
                setError(error.message);
            } else if (data.user) {
                // Check if email confirmation is required
                if (data.user.identities?.length === 0) {
                    setError('Esta conta já existe. Tente fazer login.');
                } else {
                    // Redirect to dashboard or show success message
                    // For now, assuming auto-login or redirect
                    router.push('/dashboard');
                    router.refresh();
                }
            }
        } catch (err) {
            setError('Ocorreu um erro ao tentar criar a conta.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.header}>
                    <div className={styles.logo}>D</div>
                    <h1 className={styles.title}>Crie sua conta</h1>
                    <p className={styles.subtitle}>Comece a gerenciar seus eventos hoje</p>
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
                        <label htmlFor="email" className={styles.label}>Email</label>
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
                            minLength={6}
                            required
                        />
                    </div>

                    <button type="submit" className={styles.submitBtn} disabled={loading}>
                        {loading ? 'Criando conta...' : 'Criar conta'}
                    </button>
                </form>

                <div className={styles.footer}>
                    <p>Já tem uma conta? <Link href="/login" className={styles.link}>Entrar</Link></p>
                </div>
            </div>
        </div>
    );
}
