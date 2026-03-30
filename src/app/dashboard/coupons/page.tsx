'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

interface Coupon {
    id: string;
    code: string;
    description: string | null;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    max_uses: number | null;
    uses_count: number;
    min_order_amount: number | null;
    valid_from: string | null;
    valid_until: string | null;
    event_id: string | null;
    is_active: boolean;
    created_at: string;
    events?: { name: string };
}

interface EventOption {
    id: string;
    name: string;
}

const emptyForm = {
    code: '',
    description: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: '',
    max_uses: '',
    min_order_amount: '',
    valid_from: '',
    valid_until: '',
    event_id: '',
    is_active: true,
};

export default function CouponsPage() {
    const { user } = useAuth();
    const supabase = createClient();
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [events, setEvents] = useState<EventOption[]>([]);
    const [orgId, setOrgId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [formData, setFormData] = useState(emptyForm);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);

    useEffect(() => {
        if (user) fetchData();
    }, [user]);

    async function fetchData() {
        try {
            const { data: memberData } = await supabase
                .from('organization_members')
                .select('organization_id')
                .eq('user_id', user!.id)
                .limit(1);

            const id = memberData?.[0]?.organization_id;
            if (!id) { setLoading(false); return; }
            setOrgId(id);

            const [{ data: couponsData }, { data: eventsData }] = await Promise.all([
                supabase
                    .from('coupons')
                    .select('*, events(name)')
                    .eq('organization_id', id)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('events')
                    .select('id, name')
                    .eq('organization_id', id)
                    .in('status', ['published', 'draft'])
                    .order('event_date', { ascending: false }),
            ]);

            setCoupons(couponsData || []);
            setEvents(eventsData || []);
        } catch (err) {
            console.error('Error fetching coupons:', err);
        } finally {
            setLoading(false);
        }
    }

    function startCreate() {
        setFormData(emptyForm);
        setEditingId(null);
        setError(null);
        setSuccess(null);
        setShowForm(true);
    }

    function startEdit(coupon: Coupon) {
        setFormData({
            code: coupon.code,
            description: coupon.description || '',
            discount_type: coupon.discount_type,
            discount_value: coupon.discount_value.toString(),
            max_uses: coupon.max_uses?.toString() || '',
            min_order_amount: coupon.min_order_amount?.toString() || '',
            valid_from: coupon.valid_from ? coupon.valid_from.slice(0, 16) : '',
            valid_until: coupon.valid_until ? coupon.valid_until.slice(0, 16) : '',
            event_id: coupon.event_id || '',
            is_active: coupon.is_active,
        });
        setEditingId(coupon.id);
        setError(null);
        setSuccess(null);
        setShowForm(true);
    }

    async function handleSave() {
        if (!formData.code.trim()) { setError('Código do cupom é obrigatório'); return; }
        if (!formData.discount_value || parseFloat(formData.discount_value) <= 0) {
            setError('Valor do desconto deve ser maior que 0');
            return;
        }
        if (!orgId) return;

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const payload: any = {
                organization_id: orgId,
                code: formData.code.trim().toUpperCase(),
                description: formData.description.trim() || null,
                discount_type: formData.discount_type,
                discount_value: parseFloat(formData.discount_value),
                max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
                min_order_amount: formData.min_order_amount ? parseFloat(formData.min_order_amount) : null,
                valid_from: formData.valid_from ? new Date(formData.valid_from).toISOString() : null,
                valid_until: formData.valid_until ? new Date(formData.valid_until).toISOString() : null,
                event_id: formData.event_id || null,
                is_active: formData.is_active,
            };

            if (editingId) {
                const { error: updateError } = await supabase
                    .from('coupons')
                    .update({ ...payload, updated_at: new Date().toISOString() })
                    .eq('id', editingId);
                if (updateError) throw updateError;
                setSuccess('Cupom atualizado com sucesso!');
            } else {
                const { error: insertError } = await supabase
                    .from('coupons')
                    .insert(payload);
                if (insertError) throw insertError;
                setSuccess('Cupom criado com sucesso!');
            }

            await fetchData();
            setShowForm(false);
            setEditingId(null);
        } catch (err: any) {
            if (err.code === '23505') {
                setError('Já existe um cupom com este código. Use outro.');
            } else {
                setError(err.message || 'Erro ao salvar cupom');
            }
        } finally {
            setSaving(false);
        }
    }

    async function toggleActive(coupon: Coupon) {
        const { error } = await supabase
            .from('coupons')
            .update({ is_active: !coupon.is_active, updated_at: new Date().toISOString() })
            .eq('id', coupon.id);

        if (!error) {
            setCoupons(prev => prev.map(c =>
                c.id === coupon.id ? { ...c, is_active: !c.is_active } : c
            ));
        }
    }

    async function deleteCoupon(id: string) {
        if (!confirm('Excluir este cupom?')) return;
        const { error } = await supabase.from('coupons').delete().eq('id', id);
        if (!error) setCoupons(prev => prev.filter(c => c.id !== id));
    }

    const formatDiscount = (c: Coupon) =>
        c.discount_type === 'percentage'
            ? `${c.discount_value}%`
            : `R$ ${c.discount_value.toFixed(2).replace('.', ',')}`;

    if (loading) {
        return <div className={styles.container}><p>Carregando cupons...</p></div>;
    }

    return (
        <div className={styles.container}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Cupons</h1>
                    <p className={styles.pageSubtitle}>Crie e gerencie cupons de desconto para seus eventos</p>
                </div>
                <button className={styles.primaryBtn} onClick={startCreate}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Novo Cupom
                </button>
            </div>

            <div className={styles.contentGrid}>
                {/* Coupons Table */}
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h2 className={styles.cardTitle}>Cupons ({coupons.length})</h2>
                    </div>

                    {coupons.length === 0 ? (
                        <div className={styles.emptyState}>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M3 11v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V11a2 2 0 0 0-2-2 2 2 0 0 1 0-4 2 2 0 0 0 2-2V3a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2a2 2 0 0 1 0 4 2 2 0 0 0-2 2z"/>
                            </svg>
                            <p>Nenhum cupom criado ainda</p>
                            <p style={{ color: '#d1d5db' }}>Clique em "Novo Cupom" para começar</p>
                        </div>
                    ) : (
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Código</th>
                                    <th>Desconto</th>
                                    <th>Evento</th>
                                    <th>Usos</th>
                                    <th>Validade</th>
                                    <th>Status</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {coupons.map((coupon) => (
                                    <tr key={coupon.id}>
                                        <td>
                                            <span className={styles.codeBadge}>{coupon.code}</span>
                                            {coupon.description && (
                                                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                                                    {coupon.description}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <span className={styles.discountText}>{formatDiscount(coupon)}</span>
                                        </td>
                                        <td style={{ fontSize: '12px', color: '#6b7280' }}>
                                            {coupon.events?.name || 'Todos os eventos'}
                                        </td>
                                        <td>
                                            <span className={styles.usagePill}>
                                                {coupon.uses_count}
                                                {coupon.max_uses ? ` / ${coupon.max_uses}` : ''}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '12px', color: '#6b7280' }}>
                                            {coupon.valid_until
                                                ? new Date(coupon.valid_until).toLocaleDateString('pt-BR')
                                                : 'Sem expiração'}
                                        </td>
                                        <td>
                                            <span className={coupon.is_active ? styles.activeBadge : styles.inactiveBadge}>
                                                {coupon.is_active ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>
                                        <td>
                                            <button className={styles.actionBtn} onClick={() => startEdit(coupon)}>
                                                Editar
                                            </button>
                                            <button className={styles.actionBtn} onClick={() => toggleActive(coupon)}>
                                                {coupon.is_active ? 'Desativar' : 'Ativar'}
                                            </button>
                                            <button className={styles.deleteBtn} onClick={() => deleteCoupon(coupon.id)}>
                                                Excluir
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Form Panel */}
                {showForm && (
                    <div className={styles.formPanel}>
                        <h3 className={styles.formTitle}>
                            {editingId ? 'Editar Cupom' : 'Novo Cupom'}
                        </h3>

                        {error && (
                            <div className={styles.errorAlert}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                                </svg>
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className={styles.successAlert}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                                </svg>
                                {success}
                            </div>
                        )}

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Código *</label>
                            <input
                                className={styles.input}
                                placeholder="Ex: DESCONTO10"
                                value={formData.code}
                                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                            />
                            <p className={styles.hint}>Será convertido para maiúsculas automaticamente</p>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Descrição</label>
                            <input
                                className={styles.input}
                                placeholder="Ex: 10% para membros da igreja"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>

                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Tipo *</label>
                                <select
                                    className={styles.select}
                                    value={formData.discount_type}
                                    onChange={(e) => setFormData({ ...formData, discount_type: e.target.value as 'percentage' | 'fixed' })}
                                >
                                    <option value="percentage">Porcentagem (%)</option>
                                    <option value="fixed">Valor fixo (R$)</option>
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>
                                    {formData.discount_type === 'percentage' ? 'Valor (%) *' : 'Valor (R$) *'}
                                </label>
                                <input
                                    type="number"
                                    className={styles.input}
                                    placeholder={formData.discount_type === 'percentage' ? '10' : '20.00'}
                                    min="0.01"
                                    step="0.01"
                                    value={formData.discount_value}
                                    onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Máx. de usos</label>
                                <input
                                    type="number"
                                    className={styles.input}
                                    placeholder="Ilimitado"
                                    min="1"
                                    value={formData.max_uses}
                                    onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Pedido mínimo (R$)</label>
                                <input
                                    type="number"
                                    className={styles.input}
                                    placeholder="Sem mínimo"
                                    min="0"
                                    step="0.01"
                                    value={formData.min_order_amount}
                                    onChange={(e) => setFormData({ ...formData, min_order_amount: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Válido a partir de</label>
                                <input
                                    type="datetime-local"
                                    className={styles.input}
                                    value={formData.valid_from}
                                    onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Válido até</label>
                                <input
                                    type="datetime-local"
                                    className={styles.input}
                                    value={formData.valid_until}
                                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Restringir a evento</label>
                            <select
                                className={styles.select}
                                value={formData.event_id}
                                onChange={(e) => setFormData({ ...formData, event_id: e.target.value })}
                            >
                                <option value="">Válido para todos os eventos</option>
                                {events.map(ev => (
                                    <option key={ev.id} value={ev.id}>{ev.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.checkboxLabel}>
                                <input
                                    type="checkbox"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                />
                                Ativo (disponível para uso)
                            </label>
                        </div>

                        <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                            {saving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Criar Cupom'}
                        </button>
                        <button
                            className={styles.cancelBtn}
                            onClick={() => { setShowForm(false); setEditingId(null); }}
                        >
                            Cancelar
                        </button>
                    </div>
                )}

                {!showForm && (
                    <div className={styles.formPanel} style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '1rem' }}>
                            <path d="M3 11v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V11a2 2 0 0 0-2-2 2 2 0 0 1 0-4 2 2 0 0 0 2-2V3a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2a2 2 0 0 1 0 4 2 2 0 0 0-2 2z"/>
                        </svg>
                        <p style={{ margin: '0 0 1rem 0', fontSize: '14px' }}>Selecione um cupom para editar ou clique em "Novo Cupom"</p>
                    </div>
                )}
            </div>
        </div>
    );
}
