'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import styles from './CreateOrganizationModal.module.css';

interface CreateOrganizationModalProps {
    onSuccess: () => void;
}

export default function CreateOrganizationModal({ onSuccess }: CreateOrganizationModalProps) {
    const { user } = useAuth();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [slug, setSlug] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const supabase = createClient();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setLoading(true);
        setError(null);

        try {
            // Call the RPC function to create organization and member
            const { data, error: rpcError } = await supabase.rpc('create_organization_with_member', {
                p_owner_id: user.id,
                p_org_name: name,
                p_org_description: description || null,
                p_org_slug: slug || null,
                p_user_name: user.user_metadata?.full_name || null,
                p_user_email: user.email || null,
            });

            if (rpcError) {
                throw rpcError;
            }

            // Success! Call the callback
            onSuccess();
        } catch (err: any) {
            console.error('Error creating organization:', err);
            setError(err.message || 'Erro ao criar organização');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Crie sua Organização</h2>
                    <p className={styles.subtitle}>
                        Para começar a usar o sistema, você precisa criar uma organização.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    {error && <div className={styles.error}>{error}</div>}

                    <div className={styles.formGroup}>
                        <label htmlFor="name" className={styles.label}>
                            Nome da Organização <span className={styles.required}>*</span>
                        </label>
                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className={styles.input}
                            placeholder="Ex: Igreja Batista Central"
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="slug" className={styles.label}>
                            URL Personalizada
                        </label>
                        <div className={styles.slugInput}>
                            <span className={styles.slugPrefix}>missaoguadalupe.com/</span>
                            <input
                                id="slug"
                                type="text"
                                value={slug}
                                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                                className={styles.input}
                                placeholder="igreja-batista"
                                disabled={loading}
                            />
                        </div>
                        <p className={styles.hint}>Deixe em branco para gerar automaticamente</p>
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="description" className={styles.label}>
                            Descrição
                        </label>
                        <textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className={styles.textarea}
                            placeholder="Descreva sua organização..."
                            rows={4}
                            disabled={loading}
                        />
                    </div>

                    <button type="submit" className={styles.submitBtn} disabled={loading}>
                        {loading ? 'Criando...' : 'Criar Organização'}
                    </button>
                </form>
            </div>
        </div>
    );
}
