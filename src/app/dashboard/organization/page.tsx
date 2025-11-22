'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { uploadImage, deleteImage } from '@/lib/uploadImage';
import styles from './page.module.css';

interface Organization {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    logo_url: string | null;
    settings: any;
}

export default function OrganizationPage() {
    const { user } = useAuth();
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [logoError, setLogoError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        description: '',
        logo_url: '',
        email: '',
        phone: '',
        website: '',
    });
    const supabase = createClient();

    useEffect(() => {
        async function fetchOrganization() {
            if (!user) return;

            try {
                // Get user's organization
                const { data: memberData } = await supabase
                    .from('organization_members')
                    .select('organization_id')
                    .eq('user_id', user.id)
                    .single();

                if (!memberData) {
                    setLoading(false);
                    return;
                }

                // Fetch organization details
                const { data: orgData, error } = await supabase
                    .from('organizations')
                    .select('*')
                    .eq('id', memberData.organization_id)
                    .single();

                if (error) throw error;

                setOrganization(orgData);
                setFormData({
                    name: orgData.name || '',
                    slug: orgData.slug || '',
                    description: orgData.description || '',
                    logo_url: orgData.logo_url || '',
                    email: orgData.email || '',
                    phone: orgData.phone || '',
                    website: orgData.website || '',
                });
                setLogoPreview(orgData.logo_url || null);
            } catch (error) {
                console.error('Error fetching organization:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchOrganization();
    }, [user]);

    const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLogoError(null);

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setLogoError('Por favor, selecione uma imagem válida (JPG, GIF ou PNG)');
            return;
        }

        // Validate file size (1MB max)
        const maxSizeBytes = 1 * 1024 * 1024;
        if (file.size > maxSizeBytes) {
            setLogoError('A imagem deve ter no máximo 1MB');
            return;
        }

        setLogoFile(file);

        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setLogoPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleLogoRemove = () => {
        setLogoFile(null);
        setLogoPreview(null);
        setLogoError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        // Keep existing logo_url in formData until save
    };

    const handleLogoChange = () => {
        fileInputRef.current?.click();
    };

    const handleSave = async () => {
        if (!organization) return;

        setSaving(true);
        setLogoError(null);

        try {
            let finalLogoUrl: string | null = formData.logo_url;

            // Handle logo upload/removal
            if (logoFile) {
                // New logo uploaded
                setUploadingLogo(true);
                const uploadResult = await uploadImage(logoFile, {
                    bucket: 'event-images', // Using same bucket, but in 'logos' folder
                    folder: 'logos',
                    maxSizeMB: 1
                });

                if (uploadResult.error) {
                    setLogoError(uploadResult.error);
                    setSaving(false);
                    setUploadingLogo(false);
                    return;
                }

                // Delete old logo if exists
                if (formData.logo_url) {
                    // Extract path from URL (format: .../public/event-images/logos/filename)
                    const urlParts = formData.logo_url.split('/logos/');
                    if (urlParts.length > 1) {
                        const filename = urlParts[1].split('?')[0]; // Remove query params if any
                        await deleteImage(`logos/${filename}`, 'event-images');
                    }
                }

                finalLogoUrl = uploadResult.url;
            } else if (!logoPreview && formData.logo_url) {
                // Logo was removed
                // Delete old logo from storage
                if (formData.logo_url) {
                    // Extract path from URL (format: .../public/event-images/logos/filename)
                    const urlParts = formData.logo_url.split('/logos/');
                    if (urlParts.length > 1) {
                        const filename = urlParts[1].split('?')[0]; // Remove query params if any
                        await deleteImage(`logos/${filename}`, 'event-images');
                    }
                }
                finalLogoUrl = null;
            } else if (logoPreview === formData.logo_url) {
                // Logo unchanged
                finalLogoUrl = formData.logo_url;
            }

            const { error } = await supabase
                .from('organizations')
                .update({
                    name: formData.name,
                    slug: formData.slug,
                    description: formData.description,
                    logo_url: finalLogoUrl,
                    email: formData.email,
                    phone: formData.phone,
                    website: formData.website,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', organization.id);

            if (error) throw error;

            // Update local state
            setFormData(prev => ({ ...prev, logo_url: finalLogoUrl || '' }));
            setLogoPreview(finalLogoUrl);
            setLogoFile(null);
            setUploadingLogo(false);

            alert('Alterações salvas com sucesso!');
        } catch (error: any) {
            console.error('Error saving organization:', error);
            alert('Erro ao salvar: ' + error.message);
            setUploadingLogo(false);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <p>Carregando...</p>
            </div>
        );
    }

    if (!organization) {
        return (
            <div className={styles.container}>
                <p>Organização não encontrada.</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Configurações da Organização</h1>
                    <p className={styles.pageSubtitle}>Gerencie as informações e preferências da sua organização</p>
                </div>
                <button
                    className={styles.primaryBtn}
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
            </div>

            <div className={styles.tabs}>
                <button className={`${styles.tab} ${styles.activeTab}`}>Perfil</button>
                <button className={styles.tab}>Cobrança</button>
                <button className={styles.tab}>Notificações</button>
                <button className={styles.tab}>Integrações</button>
            </div>

            <div className={styles.contentGrid}>
                {/* Main Settings Column */}
                <div className={styles.mainColumn}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2 className={styles.cardTitle}>Perfil da Organização</h2>
                            <p className={styles.cardDescription}>Informações visíveis publicamente sobre sua organização.</p>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Logo</label>
                            <div className={styles.logoUpload}>
                                <div className={styles.logoPreview}>
                                    {logoPreview ? (
                                        <img src={logoPreview} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }} />
                                    ) : (
                                        <span>{formData.name[0]?.toUpperCase() || 'D'}</span>
                                    )}
                                </div>
                                <div className={styles.uploadActions}>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/jpeg,image/jpg,image/png,image/gif"
                                        onChange={handleLogoSelect}
                                        className={styles.fileInput}
                                        style={{ display: 'none' }}
                                    />
                                    <button
                                        type="button"
                                        className={styles.secondaryBtn}
                                        onClick={handleLogoChange}
                                        disabled={uploadingLogo || saving}
                                    >
                                        {uploadingLogo ? 'Enviando...' : 'Alterar logo'}
                                    </button>
                                    {(logoPreview || formData.logo_url) && (
                                        <button
                                            type="button"
                                            className={styles.textBtn}
                                            onClick={handleLogoRemove}
                                            disabled={uploadingLogo || saving}
                                        >
                                            Remover
                                        </button>
                                    )}
                                    <p className={styles.uploadHint}>JPG, GIF ou PNG. Max 1MB.</p>
                                    {logoError && <p className={styles.errorText}>{logoError}</p>}
                                </div>
                            </div>
                        </div>

                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Nome da Organização</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Slug (URL)</label>
                                <div className={styles.inputGroup}>
                                    <span className={styles.inputPrefix}>eventos.com/</span>
                                    <input
                                        type="text"
                                        className={styles.input}
                                        value={formData.slug}
                                        onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Descrição</label>
                            <textarea
                                className={styles.textarea}
                                rows={4}
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                            <p className={styles.hint}>Breve descrição que aparecerá na sua página pública.</p>
                        </div>
                    </div>

                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2 className={styles.cardTitle}>Informações de Contato</h2>
                            <p className={styles.cardDescription}>Como os participantes podem entrar em contato com você.</p>
                        </div>

                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Email de Suporte</label>
                                <input
                                    type="email"
                                    className={styles.input}
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="suporte@exemplo.com"
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Telefone / WhatsApp</label>
                                <input
                                    type="tel"
                                    className={styles.input}
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="(11) 99999-9999"
                                />
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Website</label>
                            <input
                                type="url"
                                className={styles.input}
                                value={formData.website}
                                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                                placeholder="https://exemplo.com"
                            />
                        </div>
                    </div>
                </div>

                {/* Sidebar Settings Column */}
                <div className={styles.sideColumn}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2 className={styles.cardTitle}>Visibilidade</h2>
                        </div>
                        <div className={styles.toggleGroup}>
                            <div className={styles.toggleRow}>
                                <div className={styles.toggleInfo}>
                                    <span className={styles.toggleLabel}>Página Pública</span>
                                    <span className={styles.toggleDesc}>Tornar a página da organização visível para todos</span>
                                </div>
                                <label className={styles.switch}>
                                    <input type="checkbox" defaultChecked />
                                    <span className={styles.slider}></span>
                                </label>
                            </div>
                            <div className={styles.toggleRow}>
                                <div className={styles.toggleInfo}>
                                    <span className={styles.toggleLabel}>Listar em Buscas</span>
                                    <span className={styles.toggleDesc}>Permitir que motores de busca indexem sua página</span>
                                </div>
                                <label className={styles.switch}>
                                    <input type="checkbox" defaultChecked />
                                    <span className={styles.slider}></span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2 className={styles.cardTitle}>Zona de Perigo</h2>
                        </div>
                        <div className={styles.dangerZone}>
                            <p className={styles.dangerText}>Ações irreversíveis para sua organização.</p>
                            <button className={styles.dangerBtn}>Deletar Organização</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
