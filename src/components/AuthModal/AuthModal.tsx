'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import styles from './AuthModal.module.css';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
    const [isLogin, setIsLogin] = useState(true);
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const supabase = createClient();
    const { user } = useAuth();

    // Se o usuário já estiver logado, fechar o modal
    useEffect(() => {
        if (user && isOpen) {
            onClose();
        }
    }, [user, isOpen, onClose]);

    if (!isOpen) return null;

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                setError(error.message);
            } else {
                onClose();
                router.push('/profile');
                router.refresh();
            }
        } catch (err) {
            setError('Ocorreu um erro ao tentar fazer login.');
        } finally {
            setLoading(false);
        }
    };

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
                if (data.user.identities?.length === 0) {
                    setError('Esta conta já existe. Tente fazer login.');
                } else {
                    onClose();
                    router.push('/profile');
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
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <button className={styles.closeButton} onClick={onClose}>
                    ×
                </button>

                <div className={styles.header}>
                    <div className={styles.logo}>⛪</div>
                    <h2 className={styles.title}>
                        {isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}
                    </h2>
                    <p className={styles.subtitle}>
                        {isLogin ? 'Entre na sua conta para continuar' : 'Comece a comprar ingressos hoje'}
                    </p>
                </div>

                <form onSubmit={isLogin ? handleLogin : handleSignUp} className={styles.form}>
                    {error && <div className={styles.error}>{error}</div>}

                    {!isLogin && (
                        <div className={styles.formGroup}>
                            <label htmlFor="fullName" className={styles.label}>Nome Completo</label>
                            <input
                                id="fullName"
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className={styles.input}
                                placeholder="Seu Nome"
                                required={!isLogin}
                            />
                        </div>
                    )}

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
                        {loading 
                            ? (isLogin ? 'Entrando...' : 'Criando conta...')
                            : (isLogin ? 'Entrar' : 'Criar conta')
                        }
                    </button>
                </form>

                <div className={styles.footer}>
                    <p>
                        {isLogin ? (
                            <>Não tem uma conta?{' '}
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setIsLogin(false);
                                        setError(null);
                                    }}
                                    className={styles.link}
                                >
                                    Cadastre-se
                                </button>
                            </>
                        ) : (
                            <>Já tem uma conta?{' '}
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setIsLogin(true);
                                        setError(null);
                                    }}
                                    className={styles.link}
                                >
                                    Entrar
                                </button>
                            </>
                        )}
                    </p>
                </div>
            </div>
        </div>
    );
}

