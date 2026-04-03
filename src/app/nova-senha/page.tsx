'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function NovaSenhaPage() {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirm) {
            setError('As senhas não coincidem.');
            return;
        }
        if (password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres.');
            return;
        }

        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.updateUser({ password });

        setLoading(false);

        if (error) {
            setError(error.message);
        } else {
            setDone(true);
            setTimeout(() => router.push('/dashboard'), 2000);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', padding: 20 }}>
            <div style={{ background: 'white', padding: 40, borderRadius: 16, boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: 400 }}>
                {done ? (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
                        <h2 style={{ margin: '0 0 8px', color: '#111827' }}>Senha definida!</h2>
                        <p style={{ color: '#6b7280', fontSize: 14 }}>Redirecionando...</p>
                    </div>
                ) : (
                    <>
                        <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, color: '#111827' }}>Definir nova senha</h1>
                        <p style={{ margin: '0 0 28px', fontSize: 14, color: '#6b7280' }}>Escolha uma senha segura para sua conta.</p>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {error && (
                                <div style={{ background: '#fef2f2', color: '#dc2626', padding: 10, borderRadius: 8, fontSize: 13 }}>
                                    {error}
                                </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>Nova senha</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, outline: 'none' }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>Confirmar senha</label>
                                <input
                                    type="password"
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, outline: 'none' }}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                style={{ background: '#111827', color: 'white', padding: '10px', borderRadius: 8, border: 'none', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 8, opacity: loading ? 0.7 : 1 }}
                            >
                                {loading ? 'Salvando...' : 'Salvar senha'}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
