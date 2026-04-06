'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { uploadImage } from '@/lib/uploadImage';
import ImageUpload from '@/components/ImageUpload/ImageUpload';
import { useDraft } from '@/hooks/useDraft';
import styles from './page.module.css';

interface EventFormData {
    title: string;
    description: string;
    date: string;
    endDate: string;
    location: string;
    address: string;
    addressNotes: string;
    category: string;
    tags: string;
    status: string;
    formId: string;
    requireForm: boolean;
    allowWaitlist: boolean;
    sendReminder: boolean;
}

interface TicketGroup {
    id: string;
    name: string;
    description: string;
    orderIndex: number;
    isActive: boolean;
    ticketTypes: TicketType[];
}

interface TicketType {
    id: string;
    name: string;
    description: string;
    price: string;
    priceCard: string;
    quantityAvailable: string;
    startSale: string;
    endSale: string;
    isActive: boolean;
    isCouple: boolean;
}

export default function NewEventPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();
    const supabase = createClient();

    const eventId = searchParams.get('id');
    const isEditMode = !!eventId;

    const [formData, setFormData] = useState<EventFormData>({
        title: '',
        description: '',
        date: '',
        endDate: '',
        location: '',
        address: '',
        addressNotes: '',
        category: '',
        tags: '',
        status: 'draft',
        formId: '',
        requireForm: false,
        allowWaitlist: false,
        sendReminder: true
    });

    const [coverImage, setCoverImage] = useState<File | null>(null);
    const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingData, setLoadingData] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ticketGroups, setTicketGroups] = useState<TicketGroup[]>([]);
    const [availableForms, setAvailableForms] = useState<Array<{ id: string; name: string }>>([]);
    const [draftRestored, setDraftRestored] = useState(false);

    const draftKey = isEditMode ? `draft_event_${eventId}` : 'draft_event_new';
    const { hasDraft, draftSavedAt, restoreDraft, clearDraft, saveStatus } = useDraft(
        draftKey,
        { formData, ticketGroups },
        !loadingData,
    );

    // Restore draft on mount (new mode only, before any data is loaded)
    useEffect(() => {
        if (isEditMode || draftRestored || loadingData) return;
        if (!hasDraft) return;
        const draft = restoreDraft();
        if (draft?.formData) {
            setFormData(draft.formData);
            if (draft.ticketGroups?.length) setTicketGroups(draft.ticketGroups);
            setDraftRestored(true);
        }
    }, [hasDraft, isEditMode, loadingData]);

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;

        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleImageSelect = (file: File) => {
        setCoverImage(file);
        setExistingImageUrl(null); // Clear existing image when new one is selected
    };

    const handleImageRemove = () => {
        setCoverImage(null);
        setExistingImageUrl(null);
    };

    const loadForms = async () => {
        if (!user) return;

        try {
            // Get user's organization
            const { data: members0 } = await supabase
                .from('organization_members')
                .select('organization_id')
                .eq('user_id', user.id)
                .limit(1);
            const memberData = members0?.[0];

            if (!memberData) return;

            // Fetch forms from organization
            const { data: formsData, error: formsError } = await supabase
                .from('forms')
                .select('id, name')
                .eq('organization_id', memberData.organization_id)
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            if (!formsError && formsData) {
                setAvailableForms(formsData);
            }
        } catch (err) {
            console.error('Error loading forms:', err);
        }
    };

    // Função para formatar valor em BRL
    const formatBRL = (value: string | number): string => {
        if (!value || value === '' || value === '0' || value === 0) return 'R$ 0,00';
        
        // Converte para número se for string
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        
        if (isNaN(numValue) || numValue === 0) return 'R$ 0,00';
        
        // Formata como BRL
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(numValue);
    };

    // Função para converter BRL formatado para número
    const parseBRL = (value: string): string => {
        // Remove tudo que não é número
        const numbers = value.replace(/\D/g, '');
        
        if (!numbers) return '0';
        
        // Converte para número decimal
        const cents = parseInt(numbers);
        const reais = cents / 100;
        
        return reais.toString();
    };

    // Handler para mudança de preço com máscara
    const handlePriceChange = (groupId: string, typeId: string, value: string) => {
        const numeric = parseBRL(value);
        updateTicketType(groupId, typeId, 'price', numeric);
    };

    const handlePriceCardChange = (groupId: string, typeId: string, value: string) => {
        const numeric = parseBRL(value);
        updateTicketType(groupId, typeId, 'priceCard', numeric);
    };

    // Load event data when in edit mode
    useEffect(() => {
        if (isEditMode && eventId && user) {
            loadEventData();
        }
    }, [isEditMode, eventId, user]);

    // Load available forms
    useEffect(() => {
        if (user) {
            loadForms();
        }
    }, [user]);

    const loadEventData = async () => {
        if (!eventId || !user) return;

        setLoadingData(true);
        try {
            // Get user's organization
            const { data: members1 } = await supabase
                .from('organization_members')
                .select('organization_id')
                .eq('user_id', user.id)
                .limit(1);
            const memberData = members1?.[0];

            if (!memberData) {
                setError('Organização não encontrada');
                setLoadingData(false);
                return;
            }

            // Load event
            const { data: event, error: eventError } = await supabase
                .from('events')
                .select('*')
                .eq('id', eventId)
                .eq('organization_id', memberData.organization_id)
                .single();

            if (eventError || !event) {
                setError('Evento não encontrado');
                setLoadingData(false);
                return;
            }

            // Load associated form (stored directly on the event row)
            const associatedFormId = event.form_id || '';

            // Populate form data
            setFormData({
                title: event.name || '',
                description: event.description || '',
                date: event.event_date || '',
                endDate: event.end_date || '',
                location: event.location || '',
                address: event.address || '',
                addressNotes: event.address_notes || '',
                category: event.category || '',
                tags: event.tags?.join(', ') || '',
                status: event.status || 'draft',
                formId: associatedFormId,
                requireForm: event.require_form || false,
                allowWaitlist: event.allow_waitlist || false,
                sendReminder: event.send_reminder ?? true
            });

            if (event.image_url) {
                setExistingImageUrl(event.image_url);
            }

            // Load ticket groups and types
            const { data: groups, error: groupsError } = await supabase
                .from('event_ticket_groups')
                .select('*')
                .eq('event_id', eventId)
                .order('order_index', { ascending: true });

            if (!groupsError && groups) {
                const groupsWithTypes: TicketGroup[] = [];

                for (const group of groups) {
                    const { data: types, error: typesError } = await supabase
                        .from('event_ticket_types')
                        .select('*')
                        .eq('group_id', group.id)
                        .order('created_at', { ascending: true });

                    const ticketTypes: TicketType[] = (types || []).map(type => ({
                        id: type.id,
                        name: type.name,
                        description: type.description || '',
                        price: type.price?.toString() || '0',
                        priceCard: type.price_card?.toString() || '0',
                        quantityAvailable: type.quantity_available?.toString() || '0',
                        startSale: type.start_sale ? new Date(type.start_sale).toISOString().slice(0, 16) : '',
                        endSale: type.end_sale ? new Date(type.end_sale).toISOString().slice(0, 16) : '',
                        isActive: type.is_active ?? true,
                        isCouple: type.is_couple ?? false
                    }));

                    groupsWithTypes.push({
                        id: group.id,
                        name: group.name,
                        description: group.description || '',
                        orderIndex: group.order_index || 0,
                        isActive: group.is_active ?? true,
                        ticketTypes
                    });
                }

                setTicketGroups(groupsWithTypes);
            }
        } catch (err: any) {
            console.error('Error loading event:', err);
            setError('Erro ao carregar evento');
        } finally {
            setLoadingData(false);
        }
    };

    const addTicketGroup = () => {
        const newGroup: TicketGroup = {
            id: `temp-${Date.now()}`,
            name: '',
            description: '',
            orderIndex: ticketGroups.length,
            isActive: true,
            ticketTypes: []
        };
        setTicketGroups([...ticketGroups, newGroup]);
    };

    const removeTicketGroup = (groupId: string) => {
        setTicketGroups(ticketGroups.filter(g => g.id !== groupId));
    };

    const updateTicketGroup = (groupId: string, field: keyof TicketGroup, value: any) => {
        setTicketGroups(ticketGroups.map(group => 
            group.id === groupId ? { ...group, [field]: value } : group
        ));
    };

    const addTicketType = (groupId: string) => {
        setTicketGroups(ticketGroups.map(group => {
            if (group.id === groupId) {
                const newType: TicketType = {
                    id: `temp-${Date.now()}-${Math.random()}`,
                    name: '',
                    description: '',
                    price: '0',
                    priceCard: '0',
                    quantityAvailable: '0',
                    startSale: '',
                    endSale: '',
                    isActive: true,
                    isCouple: false
                };
                return { ...group, ticketTypes: [...group.ticketTypes, newType] };
            }
            return group;
        }));
    };

    const removeTicketType = (groupId: string, typeId: string) => {
        setTicketGroups(ticketGroups.map(group => {
            if (group.id === groupId) {
                return { ...group, ticketTypes: group.ticketTypes.filter(t => t.id !== typeId) };
            }
            return group;
        }));
    };

    const updateTicketType = (groupId: string, typeId: string, field: keyof TicketType, value: any) => {
        setTicketGroups(ticketGroups.map(group => {
            if (group.id === groupId) {
                return {
                    ...group,
                    ticketTypes: group.ticketTypes.map(type =>
                        type.id === typeId ? { ...type, [field]: value } : type
                    )
                };
            }
            return group;
        }));
    };

    const validateForm = (): boolean => {
        if (!formData.title.trim()) {
            setError('O título do evento é obrigatório');
            return false;
        }
        if (!formData.date) {
            setError('A data do evento é obrigatória');
            return false;
        }
        if (!formData.location.trim()) {
            setError('O local do evento é obrigatório');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!validateForm()) return;
        if (!user) {
            setError('Você precisa estar autenticado');
            return;
        }

        setLoading(true);

        try {
            // Get user's organization
            const { data: members2 } = await supabase
                .from('organization_members')
                .select('organization_id')
                .eq('user_id', user.id)
                .limit(1);
            const memberData = members2?.[0];

            if (!memberData) {
                throw new Error('Organização não encontrada');
            }

            // Handle image upload/removal
            let imageUrl: string | null = null;
            if (coverImage) {
                // New image uploaded
                const uploadResult = await uploadImage(coverImage);
                if (uploadResult.error) {
                    throw new Error(uploadResult.error);
                }
                imageUrl = uploadResult.url;
            } else if (existingImageUrl) {
                // Keep existing image
                imageUrl = existingImageUrl;
            }
            // If both are null, imageUrl stays null (image was removed)

            // Prepare event data
            const eventData: any = {
                name: formData.title,
                description: formData.description || null,
                category: formData.category || null,
                status: formData.status || 'draft',
                event_date: formData.date,
                end_date: formData.endDate || null,
                location: formData.location.trim() || '',
                address: formData.address || null,
                address_notes: formData.addressNotes || null,
                image_url: imageUrl,
                allow_waitlist: formData.allowWaitlist,
                tags: formData.tags ? formData.tags.split(',').map((tag: string) => tag.trim()) : null,
                send_reminder: formData.sendReminder,
                form_id: formData.formId || null,
                require_form: formData.requireForm,
            };

            let currentEventId = eventId;

            if (isEditMode && eventId) {
                // Update existing event
                const { data: updatedEvent, error: updateError } = await supabase
                    .from('events')
                    .update(eventData)
                    .eq('id', eventId)
                    .eq('organization_id', memberData.organization_id)
                    .select()
                    .single();

                if (updateError) {
                    console.error('Update error:', updateError);
                    throw new Error('Erro ao atualizar evento');
                }

                currentEventId = updatedEvent.id;
            } else {
                // Create new event
                eventData.organization_id = memberData.organization_id;
                eventData.user_id = user.id;
                eventData.created_by = user.id;

                const { data: newEvent, error: insertError } = await supabase
                    .from('events')
                    .insert([eventData])
                    .select()
                    .single();

                if (insertError) {
                    console.error('Insert error:', insertError);
                    throw new Error('Erro ao criar evento');
                }

                currentEventId = newEvent.id;
            }

            // Handle ticket groups and types
            if (isEditMode && eventId) {
                // Get existing groups to compare
                const { data: existingGroups } = await supabase
                    .from('event_ticket_groups')
                    .select('id')
                    .eq('event_id', eventId);

                const existingGroupIds = new Set((existingGroups || []).map(g => g.id));

                // Delete groups that were removed
                const currentGroupIds = ticketGroups
                    .filter(g => !g.id.startsWith('temp-'))
                    .map(g => g.id);
                
                const groupsToDelete = Array.from(existingGroupIds).filter(id => !currentGroupIds.includes(id));
                if (groupsToDelete.length > 0) {
                    await supabase
                        .from('event_ticket_groups')
                        .delete()
                        .in('id', groupsToDelete);
                }
            }

            // Process ticket groups
            for (const group of ticketGroups) {
                if (!group.name.trim()) continue; // Skip empty groups

                let groupId = group.id;

                if (group.id.startsWith('temp-')) {
                    // New group - create it
                    const { data: newGroup, error: groupError } = await supabase
                        .from('event_ticket_groups')
                        .insert([{
                            event_id: currentEventId,
                            organization_id: memberData.organization_id,
                            name: group.name,
                            description: group.description || null,
                            order_index: group.orderIndex,
                            is_active: group.isActive
                        }])
                        .select()
                        .single();

                    if (groupError) {
                        console.error('Error creating ticket group:', groupError);
                        continue;
                    }
                    groupId = newGroup.id;
                } else {
                    // Existing group - update it
                    const { error: updateError } = await supabase
                        .from('event_ticket_groups')
                        .update({
                            name: group.name,
                            description: group.description || null,
                            order_index: group.orderIndex,
                            is_active: group.isActive
                        })
                        .eq('id', group.id);

                    if (updateError) {
                        console.error('Error updating ticket group:', updateError);
                        continue;
                    }
                }

                // Handle ticket types for this group
                if (isEditMode && groupId && !group.id.startsWith('temp-')) {
                    // Get existing types
                    const { data: existingTypes } = await supabase
                        .from('event_ticket_types')
                        .select('id')
                        .eq('group_id', groupId);

                    const existingTypeIds = new Set((existingTypes || []).map(t => t.id));
                    const currentTypeIds = group.ticketTypes
                        .filter(t => !t.id.startsWith('temp-'))
                        .map(t => t.id);

                    // Delete removed types
                    const typesToDelete = Array.from(existingTypeIds).filter(id => !currentTypeIds.includes(id));
                    if (typesToDelete.length > 0) {
                        await supabase
                            .from('event_ticket_types')
                            .delete()
                            .in('id', typesToDelete);
                    }
                }

                // Process each ticket type
                for (const type of group.ticketTypes) {
                    if (!type.name.trim()) continue;

                    if (type.id.startsWith('temp-')) {
                        // New type - create it
                        const { error: typeError } = await supabase
                            .from('event_ticket_types')
                            .insert([{
                                event_id: currentEventId,
                                group_id: groupId,
                                organization_id: memberData.organization_id,
                                name: type.name,
                                description: type.description || null,
                                price: parseFloat(type.price) || 0,
                                price_card: parseFloat(type.priceCard) > 0 ? parseFloat(type.priceCard) : null,
                                quantity_available: parseInt(type.quantityAvailable) || 0,
                                start_sale: type.startSale ? new Date(type.startSale).toISOString() : null,
                                end_sale: type.endSale ? new Date(type.endSale).toISOString() : null,
                                is_active: type.isActive,
                                is_couple: type.isCouple
                            }]);

                        if (typeError) {
                            console.error('Error creating ticket type:', typeError);
                        }
                    } else {
                        // Existing type - update it
                        const { error: updateError } = await supabase
                            .from('event_ticket_types')
                            .update({
                                name: type.name,
                                description: type.description || null,
                                price: parseFloat(type.price) || 0,
                                price_card: parseFloat(type.priceCard) > 0 ? parseFloat(type.priceCard) : null,
                                quantity_available: parseInt(type.quantityAvailable) || 0,
                                start_sale: type.startSale ? new Date(type.startSale).toISOString() : null,
                                end_sale: type.endSale ? new Date(type.endSale).toISOString() : null,
                                is_active: type.isActive,
                                is_couple: type.isCouple
                            })
                            .eq('id', type.id);

                        if (updateError) {
                            console.error('Error updating ticket type:', updateError);
                        }
                    }
                }
            }

            // Clear draft and redirect
            clearDraft();
            router.push('/dashboard/events');
        } catch (err: any) {
            console.error(`Error ${isEditMode ? 'updating' : 'creating'} event:`, err);
            setError(err.message || `Erro ao ${isEditMode ? 'atualizar' : 'criar'} evento`);
        } finally {
            setLoading(false);
        }
    };

    if (loadingData) {
        return (
            <div className={styles.container}>
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <p>Carregando dados do evento...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <button
                    onClick={() => router.back()}
                    className={styles.backBtn}
                    type="button"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Voltar
                </button>
                <div>
                    <h1 className={styles.title}>
                        {isEditMode ? 'Editar Evento' : 'Criar Novo Evento'}
                    </h1>
                    <p className={styles.subtitle}>
                        {isEditMode ? 'Atualize as informações do seu evento' : 'Preencha as informações do seu evento'}
                    </p>
                </div>
            </div>

            {saveStatus === 'saved' && (
                <div style={{ fontSize: '13px', color: '#6b7280', padding: '6px 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
                    Rascunho salvo automaticamente
                </div>
            )}

            {error && (
                <div className={styles.errorAlert}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {error}
                </div>
            )}

            <form className={styles.form} onSubmit={handleSubmit}>
                <div className={styles.grid}>
                    {/* Left Column - Main Info */}
                    <div className={styles.column}>
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>Informações Básicas</h2>

                            <div className={styles.formGroup}>
                                <label htmlFor="title" className={styles.label}>
                                    Título do Evento *
                                </label>
                                <input
                                    type="text"
                                    id="title"
                                    name="title"
                                    value={formData.title}
                                    onChange={handleInputChange}
                                    className={styles.input}
                                    placeholder="Ex: Culto de Celebração"
                                    required
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="description" className={styles.label}>
                                    Descrição
                                </label>
                                <textarea
                                    id="description"
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    className={styles.textarea}
                                    rows={5}
                                    placeholder="Descreva os detalhes do evento..."
                                />
                            </div>

                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label htmlFor="date" className={styles.label}>
                                        Data *
                                    </label>
                                    <input
                                        type="date"
                                        id="date"
                                        name="date"
                                        value={formData.date}
                                        onChange={handleInputChange}
                                        className={styles.input}
                                        required
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label htmlFor="endDate" className={styles.label}>
                                        Data de Término
                                    </label>
                                    <input
                                        type="date"
                                        id="endDate"
                                        name="endDate"
                                        value={formData.endDate}
                                        onChange={handleInputChange}
                                        className={styles.input}
                                    />
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="location" className={styles.label}>
                                    Local *
                                </label>
                                <input
                                    type="text"
                                    id="location"
                                    name="location"
                                    value={formData.location}
                                    onChange={handleInputChange}
                                    className={styles.input}
                                    placeholder="Ex: Igreja Central"
                                    required
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="address" className={styles.label}>
                                    Endereço Completo
                                </label>
                                <input
                                    type="text"
                                    id="address"
                                    name="address"
                                    value={formData.address}
                                    onChange={handleInputChange}
                                    className={styles.input}
                                    placeholder="Ex: Rua das Flores, 123 - Centro"
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="addressNotes" className={styles.label}>
                                    Observações do Endereço
                                </label>
                                <textarea
                                    id="addressNotes"
                                    name="addressNotes"
                                    value={formData.addressNotes}
                                    onChange={handleInputChange}
                                    className={styles.textarea}
                                    rows={2}
                                    placeholder="Ex: Próximo ao supermercado, estacionamento disponível..."
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="tags" className={styles.label}>
                                    Tags
                                </label>
                                <input
                                    type="text"
                                    id="tags"
                                    name="tags"
                                    value={formData.tags}
                                    onChange={handleInputChange}
                                    className={styles.input}
                                    placeholder="Ex: louvor, jovens, família"
                                />
                                <p className={styles.hint}>Separe as tags por vírgula</p>
                            </div>

                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label htmlFor="category" className={styles.label}>
                                        Categoria
                                    </label>
                                    <select
                                        id="category"
                                        name="category"
                                        value={formData.category}
                                        onChange={handleInputChange}
                                        className={styles.select}
                                    >
                                        <option value="">Selecione uma categoria</option>
                                        <option value="culto">Culto</option>
                                        <option value="workshop">Workshop</option>
                                        <option value="show">Show/Concerto</option>
                                        <option value="retiro">Retiro/Acampamento</option>
                                        <option value="conferencia">Conferência</option>
                                        <option value="outro">Outro</option>
                                    </select>
                                </div>

                                <div className={styles.formGroup}>
                                    <label htmlFor="status" className={styles.label}>
                                        Status
                                    </label>
                                    <select
                                        id="status"
                                        name="status"
                                        value={formData.status}
                                        onChange={handleInputChange}
                                        className={styles.select}
                                    >
                                        <option value="draft">Rascunho</option>
                                        <option value="published">Publicado</option>
                                        <option value="ended">Finalizado</option>
                                        <option value="cancelled">Cancelado</option>
                                    </select>
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="formId" className={styles.label}>
                                    Formulário Associado
                                </label>
                                <select
                                    id="formId"
                                    name="formId"
                                    value={formData.formId}
                                    onChange={handleInputChange}
                                    className={styles.select}
                                >
                                    <option value="">Nenhum formulário</option>
                                    {availableForms.map((form) => (
                                        <option key={form.id} value={form.id}>
                                            {form.name}
                                        </option>
                                    ))}
                                </select>
                                <p className={styles.hint}>
                                    Selecione um formulário para coletar informações adicionais dos participantes
                                </p>
                            </div>

                            {formData.formId && (
                                <div className={styles.formGroup}>
                                    <label className={styles.checkboxLabel}>
                                        <input
                                            type="checkbox"
                                            name="requireForm"
                                            checked={formData.requireForm}
                                            onChange={handleInputChange}
                                            className={styles.checkbox}
                                        />
                                        <span>Obrigar preenchimento do formulário para participar</span>
                                    </label>
                                </div>
                            )}

                            <div className={styles.formGroup}>
                                <label className={styles.checkboxLabel}>
                                    <input
                                        type="checkbox"
                                        name="allowWaitlist"
                                        checked={formData.allowWaitlist}
                                        onChange={handleInputChange}
                                        className={styles.checkbox}
                                    />
                                    <span>Permitir lista de espera quando esgotado</span>
                                </label>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.checkboxLabel}>
                                    <input
                                        type="checkbox"
                                        name="sendReminder"
                                        checked={formData.sendReminder}
                                        onChange={handleInputChange}
                                        className={styles.checkbox}
                                    />
                                    <span>Enviar lembretes automáticos aos participantes</span>
                                </label>
                            </div>
                        </div>

                        {/* Ticket Configuration Section */}
                        <div className={styles.section}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h2 className={styles.sectionTitle}>Configuração de Ingressos</h2>
                                <button
                                    type="button"
                                    onClick={addTicketGroup}
                                    className={styles.addButton}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        background: 'linear-gradient(135deg, #4A90E2 0%, #357ABD 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '0.875rem',
                                        fontWeight: '500',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    + Adicionar Grupo
                                </button>
                            </div>

                            {ticketGroups.length === 0 ? (
                                <div style={{
                                    padding: '2rem',
                                    textAlign: 'center',
                                    background: '#f9fafb',
                                    borderRadius: '8px',
                                    color: '#6b7280'
                                }}>
                                    <p>Nenhum grupo de ingressos configurado</p>
                                    <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                                        Adicione grupos para organizar seus ingressos (ex: Masculino, Feminino, Mesas)
                                    </p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    {ticketGroups.map((group, groupIndex) => (
                                        <div
                                            key={group.id}
                                            style={{
                                                border: '1px solid #e5e7eb',
                                                borderRadius: '8px',
                                                padding: '1.5rem',
                                                background: '#ffffff'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                                <div style={{ flex: 1 }}>
                                                    <input
                                                        type="text"
                                                        placeholder="Nome do Grupo (ex: Ingresso Masculino)"
                                                        value={group.name}
                                                        onChange={(e) => updateTicketGroup(group.id, 'name', e.target.value)}
                                                        style={{
                                                            width: '100%',
                                                            padding: '0.75rem',
                                                            border: '1px solid #d1d5db',
                                                            borderRadius: '6px',
                                                            fontSize: '1rem',
                                                            marginBottom: '0.5rem',
                                                            color: '#111827'
                                                        }}
                                                    />
                                                    <textarea
                                                        placeholder="Descrição do grupo (opcional)"
                                                        value={group.description}
                                                        onChange={(e) => updateTicketGroup(group.id, 'description', e.target.value)}
                                                        rows={2}
                                                        style={{
                                                            width: '100%',
                                                            padding: '0.75rem',
                                                            border: '1px solid #d1d5db',
                                                            borderRadius: '6px',
                                                            fontSize: '0.875rem',
                                                            resize: 'vertical',
                                                            color: '#111827'
                                                        }}
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeTicketGroup(group.id)}
                                                    style={{
                                                        marginLeft: '1rem',
                                                        padding: '0.5rem',
                                                        background: '#ef4444',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.875rem',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                >
                                                    Remover
                                                </button>
                                            </div>

                                            <div style={{ marginBottom: '1rem' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => addTicketType(group.id)}
                                                    style={{
                                                        padding: '0.5rem 1rem',
                                                        background: '#4A90E2',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.875rem',
                                                        fontWeight: '500',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                >
                                                    + Adicionar Tipo de Ingresso
                                                </button>
                                            </div>

                                            {group.ticketTypes.length > 0 && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                                                    {group.ticketTypes.map((type) => (
                                                        <div
                                                            key={type.id}
                                                            style={{
                                                                border: '1px solid #e5e7eb',
                                                                borderRadius: '6px',
                                                                padding: '1rem',
                                                                background: '#f9fafb'
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                                                <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: '600', color: '#111827' }}>
                                                                    Tipo de Ingresso
                                                                </h4>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeTicketType(group.id, type.id)}
                                                                    style={{
                                                                        padding: '0.25rem 0.5rem',
                                                                        background: '#ef4444',
                                                                        color: 'white',
                                                                        border: 'none',
                                                                        borderRadius: '4px',
                                                                        cursor: 'pointer',
                                                                        fontSize: '0.75rem',
                                                                        transition: 'all 0.2s ease'
                                                                    }}
                                                                >
                                                                    Remover
                                                                </button>
                                                            </div>

                                                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                                                <div>
                                                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', color: '#374151' }}>
                                                                        Nome *
                                                                    </label>
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Ex: Vip Lote 2"
                                                                        value={type.name}
                                                                        onChange={(e) => updateTicketType(group.id, type.id, 'name', e.target.value)}
                                                                        style={{
                                                                            width: '100%',
                                                                            padding: '0.5rem',
                                                                            border: '1px solid #d1d5db',
                                                                            color: '#111827',
                                                                            borderRadius: '4px',
                                                                            fontSize: '0.875rem'
                                                                        }}
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', color: '#374151' }}>
                                                                        Preço PIX (R$)
                                                                    </label>
                                                                    <input
                                                                        type="text"
                                                                        placeholder="R$ 0,00"
                                                                        value={formatBRL(type.price)}
                                                                        onChange={(e) => handlePriceChange(group.id, type.id, e.target.value)}
                                                                        style={{
                                                                            width: '100%',
                                                                            padding: '0.5rem',
                                                                            border: '1px solid #d1d5db',
                                                                            color: '#111827',
                                                                            borderRadius: '4px',
                                                                            fontSize: '0.875rem'
                                                                        }}
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', color: '#374151' }}>
                                                                        Preço Cartão (R$)
                                                                    </label>
                                                                    <input
                                                                        type="text"
                                                                        placeholder="R$ 0,00"
                                                                        value={formatBRL(type.priceCard)}
                                                                        onChange={(e) => handlePriceCardChange(group.id, type.id, e.target.value)}
                                                                        style={{
                                                                            width: '100%',
                                                                            padding: '0.5rem',
                                                                            border: '1px solid #d1d5db',
                                                                            color: '#111827',
                                                                            borderRadius: '4px',
                                                                            fontSize: '0.875rem'
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>

                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                                                <div>
                                                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', color: '#374151' }}>
                                                                        Quantidade Disponível
                                                                    </label>
                                                                    <input
                                                                        type="number"
                                                                        placeholder="Ex: 200"
                                                                        value={type.quantityAvailable}
                                                                        onChange={(e) => updateTicketType(group.id, type.id, 'quantityAvailable', e.target.value)}
                                                                        min="0"
                                                                        style={{
                                                                            width: '100%',
                                                                            padding: '0.5rem',
                                                                            border: '1px solid #d1d5db',
                                                                            color: '#111827',
                                                                            borderRadius: '4px',
                                                                            fontSize: '0.875rem'
                                                                        }}
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', color: '#374151' }}>
                                                                        Ativo
                                                                    </label>
                                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={type.isActive}
                                                                            onChange={(e) => updateTicketType(group.id, type.id, 'isActive', e.target.checked)}
                                                                            style={{ cursor: 'pointer' }}
                                                                        />
                                                                        <span style={{ fontSize: '0.875rem' }}>Ativo para venda</span>
                                                                    </label>
                                                                </div>
                                                                <div>
                                                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', color: '#374151' }}>
                                                                        Tipo
                                                                    </label>
                                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={type.isCouple}
                                                                            onChange={(e) => updateTicketType(group.id, type.id, 'isCouple', e.target.checked)}
                                                                            style={{ cursor: 'pointer' }}
                                                                        />
                                                                        <span style={{ fontSize: '0.875rem' }}>Ingresso por casal</span>
                                                                    </label>
                                                                </div>
                                                            </div>

                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                                                <div>
                                                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', color: '#374151' }}>
                                                                        Início da Venda
                                                                    </label>
                                                                    <input
                                                                        type="date"
                                                                        value={type.startSale}
                                                                        onChange={(e) => updateTicketType(group.id, type.id, 'startSale', e.target.value)}
                                                                        style={{
                                                                            width: '100%',
                                                                            padding: '0.5rem',
                                                                            border: '1px solid #d1d5db',
                                                                            color: '#111827',
                                                                            borderRadius: '4px',
                                                                            fontSize: '0.875rem'
                                                                        }}
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', color: '#374151' }}>
                                                                        Fim da Venda
                                                                    </label>
                                                                    <input
                                                                        type="date"
                                                                        value={type.endSale}
                                                                        onChange={(e) => updateTicketType(group.id, type.id, 'endSale', e.target.value)}
                                                                        style={{
                                                                            width: '100%',
                                                                            padding: '0.5rem',
                                                                            border: '1px solid #d1d5db',
                                                                            color: '#111827',
                                                                            borderRadius: '4px',
                                                                            fontSize: '0.875rem'
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>

                                                            <div style={{ marginTop: '0.75rem' }}>
                                                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', color: '#555' }}>
                                                                    Descrição (opcional)
                                                                </label>
                                                                <textarea
                                                                    placeholder="Descrição do tipo de ingresso"
                                                                    value={type.description}
                                                                    onChange={(e) => updateTicketType(group.id, type.id, 'description', e.target.value)}
                                                                    rows={2}
                                                                    style={{
                                                                        width: '100%',
                                                                        padding: '0.5rem',
                                                                        border: '1px solid #ddd',
                                                                        borderRadius: '4px',
                                                                        fontSize: '0.875rem',
                                                                        resize: 'vertical'
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column - Image Upload */}
                    <div className={styles.column}>
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>Imagem de Capa</h2>
                            <ImageUpload
                                onImageSelect={handleImageSelect}
                                onImageRemove={handleImageRemove}
                                currentImage={existingImageUrl || undefined}
                                label=""
                                maxSizeMB={5}
                            />
                            <p className={styles.hint}>
                                Recomendamos uma imagem de 1200x630px para melhor visualização
                            </p>
                        </div>

                        {/* Preview Card */}
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>Preview</h2>
                            <div className={styles.previewCard}>
                                {(coverImage || existingImageUrl || formData.title) ? (
                                    <>
                                        {(coverImage || existingImageUrl) && (
                                            <div className={styles.previewImage}>
                                                <img
                                                    src={coverImage ? URL.createObjectURL(coverImage) : (existingImageUrl || '')}
                                                    alt="Preview"
                                                />
                                            </div>
                                        )}
                                        <div className={styles.previewContent}>
                                            <h3 className={styles.previewTitle}>
                                                {formData.title || 'Título do Evento'}
                                            </h3>
                                            {formData.date && (
                                                <p className={styles.previewMeta}>
                                                    📅 {new Date(formData.date).toLocaleDateString('pt-BR')}
                                                </p>
                                            )}
                                            {formData.location && (
                                                <p className={styles.previewMeta}>
                                                    📍 {formData.location}
                                                </p>
                                            )}
                                            {formData.description && (
                                                <p className={styles.previewDescription}>
                                                    {formData.description.substring(0, 100)}
                                                    {formData.description.length > 100 && '...'}
                                                </p>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <p className={styles.previewPlaceholder}>
                                        Preencha os campos para ver o preview
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className={styles.actions}>
                    <button
                        type="submit"
                        className={styles.publishBtn}
                        disabled={loading || loadingData}
                    >
                        {loading ? (isEditMode ? 'Atualizando...' : 'Salvando...') : (isEditMode ? 'Atualizar Evento' : 'Salvar Evento')}
                    </button>
                </div>
            </form>
        </div>
    );
}
