'use client';

import { useState, useEffect, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import styles from './page.module.css';

interface TicketGroup {
    id: string;
    name: string;
    description: string | null;
    ticketTypes: TicketType[];
}

interface TicketType {
    id: string;
    name: string;
    price: number;
    quantityAvailable: number;
    quantitySold: number;
    isActive: boolean;
    startSale: string | null;
    endSale: string | null;
}

export default function EventDetails({ params }: { params: Promise<{ id: string }> }) {
    const { id: eventId } = use(params);
    const supabase = createClient();
    const [event, setEvent] = useState<any>(null);
    const [ticketGroups, setTicketGroups] = useState<TicketGroup[]>([]);
    const [ticketQuantities, setTicketQuantities] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchEventData() {
            if (!eventId) {
                setError('ID do evento inválido');
                setLoading(false);
                return;
            }

            try {
                // Fetch event
                const { data: eventData, error: eventError } = await supabase
                    .from('events')
                    .select('*')
                    .eq('id', eventId)
                    .single();

                if (eventError) {
                    console.error('Error fetching event:', eventError);
                    setError(eventError.message || 'Evento não encontrado');
                    setLoading(false);
                    return;
                }

                if (!eventData) {
                    setError('Evento não encontrado');
                    setLoading(false);
                    return;
                }

                setEvent(eventData);

                // Increment views (don't wait for this to complete)
                supabase
                    .from('events')
                    .update({ views: (eventData.views || 0) + 1 })
                    .eq('id', eventId)
                    .then(({ error }) => {
                        if (error) {
                            console.error('Error incrementing views:', error);
                        }
                    });

                // Fetch ticket groups
                const { data: groupsData, error: groupsError } = await supabase
                    .from('event_ticket_groups')
                    .select('*')
                    .eq('event_id', eventId)
                    .eq('is_active', true)
                    .order('order_index', { ascending: true });

                if (groupsError) {
                    console.error('Error fetching ticket groups:', groupsError);
                    // Don't set error, just log it - ticket groups are optional
                }

                // Fetch ticket types for each group
                if (groupsData && groupsData.length > 0) {
                    const groupsWithTypes = await Promise.all(
                        groupsData.map(async (group) => {
                            const { data: typesData, error: typesError } = await supabase
                                .from('event_ticket_types')
                                .select('*')
                                .eq('group_id', group.id)
                                .eq('is_active', true)
                                .order('price', { ascending: true });

                            if (typesError) {
                                console.error('Error fetching ticket types:', typesError);
                            }

                            return {
                                id: group.id,
                                name: group.name,
                                description: group.description,
                                ticketTypes: (typesData || []).map(type => ({
                                    id: type.id,
                                    name: type.name,
                                    price: parseFloat(type.price?.toString() || '0'),
                                    quantityAvailable: type.quantity_available || 0,
                                    quantitySold: type.quantity_sold || 0,
                                    isActive: type.is_active || false,
                                    startSale: type.start_sale,
                                    endSale: type.end_sale,
                                })),
                            };
                        })
                    );

                    setTicketGroups(groupsWithTypes);
                }
            } catch (err: any) {
                console.error('Error fetching event data:', err);
                setError(err.message || 'Erro ao carregar evento');
            } finally {
                setLoading(false);
            }
        }

        fetchEventData();
    }, [eventId]);

    const formatPrice = (price: number) => {
        if (price === 0) return 'Gratuito';
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(price);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        
        return {
            dayName: days[date.getDay()],
            day: date.getDate(),
            month: months[date.getMonth()],
            year: date.getFullYear(),
            full: date.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
            }),
        };
    };

    const formatTime = (timeString: string) => {
        if (!timeString) return '';
        const [hours, minutes] = timeString.split(':');
        return `${hours}:${minutes}`;
    };

    const getCategoryLabel = (category: string | null) => {
        const categoryMap: Record<string, string> = {
            'culto': 'Culto',
            'workshop': 'Workshop',
            'show': 'Show',
            'retiro': 'Retiro',
            'conferencia': 'Conferência',
            'outro': 'Evento'
        };
        return categoryMap[category?.toLowerCase() || ''] || category || 'Evento';
    };

    const handleQuantityChange = (ticketTypeId: string, delta: number, maxAvailable: number) => {
        setTicketQuantities(prev => {
            const current = prev[ticketTypeId] || 0;
            const newQuantity = Math.max(0, Math.min(maxAvailable, current + delta));
            
            if (newQuantity === 0) {
                const { [ticketTypeId]: _, ...rest } = prev;
                return rest;
            }
            
            return {
                ...prev,
                [ticketTypeId]: newQuantity,
            };
        });
    };

    const getTotalPrice = () => {
        let total = 0;
        ticketGroups.forEach(group => {
            group.ticketTypes.forEach(type => {
                const quantity = ticketQuantities[type.id] || 0;
                total += type.price * quantity;
            });
        });
        return total;
    };

    const getTotalTickets = () => {
        return Object.values(ticketQuantities).reduce((sum, qty) => sum + qty, 0);
    };

    const handleBuyTicket = () => {
        const totalTickets = getTotalTickets();
        if (totalTickets === 0) {
            alert('Selecione pelo menos um ingresso');
            return;
        }
        
        // Prepare checkout data
        const checkoutData = {
            eventId: eventId,
            tickets: Object.entries(ticketQuantities).map(([ticketTypeId, quantity]) => ({
                ticketTypeId,
                quantity
            })),
            total: getTotalPrice()
        };
        
        // Store in sessionStorage and redirect to checkout
        sessionStorage.setItem('checkoutData', JSON.stringify(checkoutData));
        window.location.href = `/checkout?event=${eventId}`;
    };

    if (loading) {
        return (
            <main className={styles.main}>
                <Header />
                <div className={styles.loadingContainer}>
                    <div className={styles.spinner}></div>
                    <p>Carregando evento...</p>
                </div>
            </main>
        );
    }

    if (error || !event) {
        return (
            <main className={styles.main}>
                <Header />
                <div className={styles.errorContainer}>
                    <h2>Evento não encontrado</h2>
                    <p>{error || 'O evento que você está procurando não existe ou foi removido.'}</p>
                </div>
            </main>
        );
    }

    const dateInfo = event.event_date ? formatDate(event.event_date) : null;
    const eventTime = formatTime(event.event_time || '');

    return (
        <main className={styles.main}>
            <Header />

            {/* Hero Section */}
            <section className={styles.heroSection}>
                <div 
                    className={styles.heroImage}
                    style={{ 
                        backgroundImage: event.image_url 
                            ? `url(${event.image_url})` 
                            : 'url(https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=2070&auto=format&fit=crop)' 
                    }}
                />
                <div className={styles.heroOverlay} />
                
                <div className={styles.heroContent}>
                    <div className={styles.heroContainer}>
                        <div className={styles.categoryBadge}>
                            {getCategoryLabel(event.category)}
                        </div>
                        
                        <h1 className={styles.eventTitle}>{event.name}</h1>
                        
                        <div className={styles.eventMeta}>
                            {dateInfo && (
                                <div className={styles.metaCard}>
                                    <svg className={styles.metaIcon} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                        <line x1="16" y1="2" x2="16" y2="6"/>
                                        <line x1="8" y1="2" x2="8" y2="6"/>
                                        <line x1="3" y1="10" x2="21" y2="10"/>
                                    </svg>
                                    <div>
                                        <span className={styles.metaLabel}>Data e Hora</span>
                                        <span className={styles.metaValue}>
                                            {dateInfo.dayName}, {dateInfo.day} {dateInfo.month} {dateInfo.year}
                                            {eventTime && ` às ${eventTime}`}
                                        </span>
                                    </div>
                                </div>
                            )}
                            
                            {event.location && (
                                <div className={styles.metaCard}>
                                    <svg className={styles.metaIcon} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                        <circle cx="12" cy="10" r="3"/>
                                    </svg>
                                    <div>
                                        <span className={styles.metaLabel}>Local</span>
                                        <span className={styles.metaValue}>{event.location}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Main Content */}
            <div className={styles.contentWrapper}>
                <div className={styles.container}>
                    {/* Left Column - Event Info */}
                    <div className={styles.mainContent}>
                        {/* About Section */}
                        {event.description && (
                            <section className={styles.section}>
                                <h2 className={styles.sectionTitle}>Sobre o Evento</h2>
                                <div className={styles.description}>
                                    {event.description.split('\n').map((paragraph: string, index: number) => (
                                        <p key={index}>{paragraph || '\u00A0'}</p>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Location Details */}
                        {(event.location || event.address) && (
                            <section className={styles.section}>
                                <h2 className={styles.sectionTitle}>Localização</h2>
                                <div className={styles.locationCard}>
                                    <div className={styles.locationHeader}>
                                        <svg className={styles.locationIcon} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                            <circle cx="12" cy="10" r="3"/>
                                        </svg>
                                        <div>
                                            <h3 className={styles.locationName}>{event.location}</h3>
                                            {event.address && (
                                                <p className={styles.locationAddress}>{event.address}</p>
                                            )}
                                        </div>
                                    </div>
                                    {event.address_notes && (
                                        <p className={styles.locationNotes}>{event.address_notes}</p>
                                    )}
                                </div>
                            </section>
                        )}

                        {/* Additional Info */}
                        {(event.duration || (event.tags && event.tags.length > 0)) && (
                            <section className={styles.section}>
                                <h2 className={styles.sectionTitle}>Informações Adicionais</h2>
                                <div className={styles.infoGrid}>
                                    {event.duration && (
                                        <div className={styles.infoCard}>
                                            <svg className={styles.infoIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <circle cx="12" cy="12" r="10"/>
                                                <polyline points="12 6 12 12 16 14"/>
                                            </svg>
                                            <div>
                                                <span className={styles.infoLabel}>Duração</span>
                                                <span className={styles.infoValue}>{event.duration} minutos</span>
                                            </div>
                                        </div>
                                    )}
                                    {event.tags && event.tags.length > 0 && (
                                        <div className={styles.infoCard}>
                                            <svg className={styles.infoIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                                                <line x1="7" y1="7" x2="7.01" y2="7"/>
                                            </svg>
                                            <div>
                                                <span className={styles.infoLabel}>Tags</span>
                                                <div className={styles.tagsContainer}>
                                                    {event.tags.map((tag: string, index: number) => (
                                                        <span key={index} className={styles.tag}>{tag}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}
                    </div>

                    {/* Right Column - Tickets */}
                    <aside className={styles.sidebar}>
                        <div className={styles.ticketCard}>
                            <div className={styles.ticketHeader}>
                                <h3 className={styles.ticketTitle}>Ingressos</h3>
                                <p className={styles.ticketSubtitle}>Selecione os ingressos desejados</p>
                            </div>

                            {ticketGroups.length > 0 ? (
                                <>
                                    <div className={styles.ticketGroups}>
                                        {ticketGroups.map((group) => (
                                            <div key={group.id} className={styles.ticketGroup}>
                                                {group.name && (
                                                    <h4 className={styles.groupName}>{group.name}</h4>
                                                )}
                                                {group.description && (
                                                    <p className={styles.groupDescription}>{group.description}</p>
                                                )}
                                                
                                                <div className={styles.ticketTypesList}>
                                                    {group.ticketTypes.map((type) => {
                                                        const isAvailable = type.isActive && 
                                                            type.quantityAvailable > type.quantitySold &&
                                                            (!type.startSale || new Date(type.startSale) <= new Date()) &&
                                                            (!type.endSale || new Date(type.endSale) >= new Date());
                                                        
                                                        const maxAvailable = type.quantityAvailable - type.quantitySold;
                                                        const currentQuantity = ticketQuantities[type.id] || 0;
                                                        
                                                        return (
                                                            <div
                                                                key={type.id}
                                                                className={`${styles.ticketTypeCard} ${currentQuantity > 0 ? styles.selected : ''} ${!isAvailable ? styles.disabled : ''}`}
                                                            >
                                                                <div className={styles.ticketTypeContent}>
                                                                    <div className={styles.ticketTypeInfo}>
                                                                        <span className={styles.ticketTypeName}>{type.name}</span>
                                                                        {maxAvailable > 0 ? (
                                                                            <span className={styles.ticketAvailability}>
                                                                                {maxAvailable} disponíveis
                                                                            </span>
                                                                        ) : (
                                                                            <span className={styles.ticketSoldOut}>Esgotado</span>
                                                                        )}
                                                                    </div>
                                                                    <div className={styles.ticketTypePrice}>
                                                                        {formatPrice(type.price)}
                                                                    </div>
                                                                </div>
                                                                
                                                                {isAvailable && (
                                                                    <div className={styles.quantitySection}>
                                                                        <div className={styles.quantityControls}>
                                                                            <button
                                                                                type="button"
                                                                                className={styles.quantityBtn}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleQuantityChange(type.id, -1, maxAvailable);
                                                                                }}
                                                                                disabled={currentQuantity === 0}
                                                                                aria-label="Diminuir quantidade"
                                                                            >
                                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                                                    <line x1="5" y1="12" x2="19" y2="12"/>
                                                                                </svg>
                                                                            </button>
                                                                            <span className={styles.quantityValue}>
                                                                                {currentQuantity}
                                                                            </span>
                                                                            <button
                                                                                type="button"
                                                                                className={styles.quantityBtn}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleQuantityChange(type.id, 1, maxAvailable);
                                                                                }}
                                                                                disabled={currentQuantity >= maxAvailable}
                                                                                aria-label="Aumentar quantidade"
                                                                            >
                                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                                                    <line x1="12" y1="5" x2="12" y2="19"/>
                                                                                    <line x1="5" y1="12" x2="19" y2="12"/>
                                                                                </svg>
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {getTotalTickets() > 0 && (
                                        <div className={styles.totalSection}>
                                            <div className={styles.totalInfo}>
                                                <span className={styles.totalLabel}>
                                                    Total ({getTotalTickets()} {getTotalTickets() === 1 ? 'ingresso' : 'ingressos'})
                                                </span>
                                                <span className={styles.totalPrice}>
                                                    {formatPrice(getTotalPrice())}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    <button 
                                        className={`${styles.buyButton} ${getTotalTickets() === 0 ? styles.disabled : ''}`}
                                        onClick={handleBuyTicket}
                                        disabled={getTotalTickets() === 0}
                                    >
                                        {getTotalTickets() === 0 ? (
                                            'Selecione um ingresso'
                                        ) : (
                                            <>
                                                Continuar para pagamento
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M5 12h14M12 5l7 7-7 7"/>
                                                </svg>
                                            </>
                                        )}
                                    </button>
                                    
                                    <p className={styles.disclaimer}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                        </svg>
                                        Taxas podem ser aplicadas no checkout
                                    </p>
                                </>
                            ) : (
                                <div className={styles.noTickets}>
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <path d="M9 11l3 3L22 4"/>
                                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                                    </svg>
                                    <p>Ingressos não disponíveis no momento</p>
                                </div>
                            )}
                        </div>
                    </aside>
                </div>
            </div>
            <Footer />
        </main>
    );
}
