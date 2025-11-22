'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { uploadImage } from '@/lib/uploadImage';
import ImageUpload from '@/components/ImageUpload/ImageUpload';
import styles from './page.module.css';

interface EventFormData {
    title: string;
    description: string;
    date: string;
    time: string;
    endDate: string;
    endTime: string;
    location: string;
    address: string;
    addressNotes: string;
    category: string;
    maxAttendees: string;
    ticketPrice: string;
    eventUrl: string;
    tags: string;
    allowWaitlist: boolean;
    sendReminder: boolean;
}

export default function NewEventPage() {
    const router = useRouter();
    const { user } = useAuth();
    const supabase = createClient();

    const [formData, setFormData] = useState<EventFormData>({
        title: '',
        description: '',
        date: '',
        time: '',
        endDate: '',
        endTime: '',
        location: '',
        address: '',
        addressNotes: '',
        category: '',
        maxAttendees: '',
        ticketPrice: '',
        eventUrl: '',
        tags: '',
        allowWaitlist: false,
        sendReminder: true
    });

    const [coverImage, setCoverImage] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
        if (!formData.time) {
            setError('O horário do evento é obrigatório');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e: FormEvent, status: 'draft' | 'published') => {
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
            const { data: memberData, error: memberError } = await supabase
                .from('organization_members')
                .select('organization_id')
                .eq('user_id', user.id)
                .single();

            if (memberError || !memberData) {
                throw new Error('Organização não encontrada');
            }

            // Upload image if selected
            let imageUrl = null;
            if (coverImage) {
                const uploadResult = await uploadImage(coverImage);
                if (uploadResult.error) {
                    throw new Error(uploadResult.error);
                }
                imageUrl = uploadResult.url;
            }

            // Combine date and time
            const eventDateTime = new Date(`${formData.date}T${formData.time}`);

            // Prepare event data
            const eventData: any = {
                organization_id: memberData.organization_id,
                user_id: user.id,
                name: formData.title,
                description: formData.description || null,
                category: formData.category || null,
                status: status === 'draft' ? 'rascunho' : 'publicado',
                event_date: formData.date,
                event_time: formData.time,
                end_date: formData.endDate || null,
                end_time: formData.endTime || null,
                duration: formData.duration ? parseInt(formData.duration) : null,
                location: formData.location || null,
                address: formData.address || null,
                address_notes: formData.addressNotes || null,
                image_url: imageUrl,
                price: formData.ticketPrice ? parseFloat(formData.ticketPrice) : null,
                capacity: formData.maxAttendees ? parseInt(formData.maxAttendees) : null,
                allow_waitlist: formData.allowWaitlist,
                tags: formData.tags ? formData.tags.split(',').map((tag: string) => tag.trim()) : null,
                event_url: formData.eventUrl || null,
                send_reminder: formData.sendReminder,
                created_by: user.id
            };

            // Insert event
            const { data: newEvent, error: insertError } = await supabase
                .from('events')
                .insert([eventData])
                .select()
                .single();

            if (insertError) {
                console.error('Insert error:', insertError);
                throw new Error('Erro ao criar evento');
            }

            // Redirect to events list
            router.push('/dashboard/events');
        } catch (err: any) {
            console.error('Error creating event:', err);
            setError(err.message || 'Erro ao criar evento');
        } finally {
            setLoading(false);
        }
    };

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
                    <h1 className={styles.title}>Criar Novo Evento</h1>
                    <p className={styles.subtitle}>Preencha as informações do seu evento</p>
                </div>
            </div>

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

            <form className={styles.form}>
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
                                    <label htmlFor="time" className={styles.label}>
                                        Horário *
                                    </label>
                                    <input
                                        type="time"
                                        id="time"
                                        name="time"
                                        value={formData.time}
                                        onChange={handleInputChange}
                                        className={styles.input}
                                        required
                                    />
                                </div>
                            </div>

                            <div className={styles.formRow}>
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

                                <div className={styles.formGroup}>
                                    <label htmlFor="endTime" className={styles.label}>
                                        Horário de Término
                                    </label>
                                    <input
                                        type="time"
                                        id="endTime"
                                        name="endTime"
                                        value={formData.endTime}
                                        onChange={handleInputChange}
                                        className={styles.input}
                                    />
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="duration" className={styles.label}>
                                    Duração (em minutos)
                                </label>
                                <input
                                    type="number"
                                    id="duration"
                                    name="duration"
                                    value={formData.duration}
                                    onChange={handleInputChange}
                                    className={styles.input}
                                    placeholder="Ex: 120"
                                    min="1"
                                />
                                <p className={styles.hint}>Duração estimada do evento em minutos</p>
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="location" className={styles.label}>
                                    Local
                                </label>
                                <input
                                    type="text"
                                    id="location"
                                    name="location"
                                    value={formData.location}
                                    onChange={handleInputChange}
                                    className={styles.input}
                                    placeholder="Ex: Igreja Central"
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
                                <label htmlFor="eventUrl" className={styles.label}>
                                    URL do Evento
                                </label>
                                <input
                                    type="url"
                                    id="eventUrl"
                                    name="eventUrl"
                                    value={formData.eventUrl}
                                    onChange={handleInputChange}
                                    className={styles.input}
                                    placeholder="https://exemplo.com/meu-evento"
                                />
                                <p className={styles.hint}>Link externo para mais informações (opcional)</p>
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
                                    <label htmlFor="maxAttendees" className={styles.label}>
                                        Capacidade Máxima
                                    </label>
                                    <input
                                        type="number"
                                        id="maxAttendees"
                                        name="maxAttendees"
                                        value={formData.maxAttendees}
                                        onChange={handleInputChange}
                                        className={styles.input}
                                        placeholder="Ex: 100"
                                        min="1"
                                    />
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="ticketPrice" className={styles.label}>
                                    Preço do Ingresso (R$)
                                </label>
                                <input
                                    type="number"
                                    id="ticketPrice"
                                    name="ticketPrice"
                                    value={formData.ticketPrice}
                                    onChange={handleInputChange}
                                    className={styles.input}
                                    placeholder="0.00"
                                    min="0"
                                    step="0.01"
                                />
                                <p className={styles.hint}>Deixe em branco para eventos gratuitos</p>
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="totalTickets" className={styles.label}>
                                    Total de Ingressos Disponíveis
                                </label>
                                <input
                                    type="number"
                                    id="totalTickets"
                                    name="totalTickets"
                                    value={formData.totalTickets}
                                    onChange={handleInputChange}
                                    className={styles.input}
                                    placeholder="Ex: 200"
                                    min="1"
                                />
                                <p className={styles.hint}>Quantidade total de ingressos para venda</p>
                            </div>

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
                    </div>

                    {/* Right Column - Image Upload */}
                    <div className={styles.column}>
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>Imagem de Capa</h2>
                            <ImageUpload
                                onImageSelect={handleImageSelect}
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
                                {coverImage || formData.title ? (
                                    <>
                                        {coverImage && (
                                            <div className={styles.previewImage}>
                                                <img
                                                    src={URL.createObjectURL(coverImage)}
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
                                                    {formData.time && ` às ${formData.time}`}
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
                        type="button"
                        onClick={(e) => handleSubmit(e, 'draft')}
                        className={styles.draftBtn}
                        disabled={loading}
                    >
                        {loading ? 'Salvando...' : 'Salvar como Rascunho'}
                    </button>
                    <button
                        type="button"
                        onClick={(e) => handleSubmit(e, 'published')}
                        className={styles.publishBtn}
                        disabled={loading}
                    >
                        {loading ? 'Publicando...' : 'Publicar Evento'}
                    </button>
                </div>
            </form>
        </div>
    );
}
