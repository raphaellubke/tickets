'use client';

import { useState, useEffect, use, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import styles from './page.module.css';

interface CheckoutTicket {
    ticketTypeId: string;
    quantity: number;
    ticketTypeName: string;
    ticketGroupName: string;
    price: number;
}

interface CheckoutData {
    eventId: string;
    tickets: Array<{
        ticketTypeId: string;
        quantity: number;
    }>;
    total: number;
}

function CheckoutPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();
    const supabase = createClient();
    
    const eventId = searchParams.get('event');
    const orderId = searchParams.get('order_id');
    
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [event, setEvent] = useState<any>(null);
    const [checkoutTickets, setCheckoutTickets] = useState<CheckoutTicket[]>([]);
    const [total, setTotal] = useState(0);
    const [currentOrder, setCurrentOrder] = useState<any>(null);
    const [customerData, setCustomerData] = useState({
        name: '',
        email: '',
        phone: ''
    });
    const [paymentMethod, setPaymentMethod] = useState<string>('');

    useEffect(() => {
        async function loadCheckoutData() {
            try {
                // If order_id exists, load existing order
                if (orderId) {
                    await loadOrder(orderId);
                    return;
                }

                // Otherwise, create new order from checkout data
                if (!eventId) {
                    setError('Evento não especificado');
                    setLoading(false);
                    return;
                }

                // Load checkout data from sessionStorage
                const checkoutDataStr = sessionStorage.getItem('checkoutData');
                if (!checkoutDataStr) {
                    setError('Dados do checkout não encontrados');
                    setLoading(false);
                    return;
                }

                const checkoutData: CheckoutData = JSON.parse(checkoutDataStr);
                
                // Load event data
                const { data: eventData, error: eventError } = await supabase
                    .from('events')
                    .select('*')
                    .eq('id', checkoutData.eventId)
                    .single();

                if (eventError || !eventData) {
                    setError('Evento não encontrado');
                    setLoading(false);
                    return;
                }

                setEvent(eventData);

                // Load ticket types details
                const ticketsWithDetails = await Promise.all(
                    checkoutData.tickets.map(async (ticket) => {
                        const { data: ticketType, error: ticketTypeError } = await supabase
                            .from('event_ticket_types')
                            .select('*')
                            .eq('id', ticket.ticketTypeId)
                            .single();

                        if (ticketTypeError || !ticketType) {
                            console.error('Error fetching ticket type:', ticketTypeError);
                            return null;
                        }

                        // Fetch group name separately if group_id exists
                        let groupName = '';
                        if (ticketType.group_id) {
                            const { data: group } = await supabase
                                .from('event_ticket_groups')
                                .select('name')
                                .eq('id', ticketType.group_id)
                                .single();
                            groupName = group?.name || '';
                        }

                        return {
                            ticketTypeId: ticket.ticketTypeId,
                            quantity: ticket.quantity,
                            ticketTypeName: ticketType.name,
                            ticketGroupName: groupName,
                            price: parseFloat(ticketType.price?.toString() || '0')
                        };
                    })
                );

                const validTickets = ticketsWithDetails.filter(t => t !== null) as CheckoutTicket[];
                setCheckoutTickets(validTickets);
                setTotal(checkoutData.total);

                // Pre-fill customer data if user is logged in
                if (user) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('full_name, email')
                        .eq('id', user.id)
                        .single();

                    if (profile) {
                        setCustomerData({
                            name: profile.full_name || '',
                            email: profile.email || user.email || '',
                            phone: ''
                        });
                    }
                }
            } catch (err: any) {
                console.error('Error loading checkout data:', err);
                setError(err.message || 'Erro ao carregar checkout');
            } finally {
                setLoading(false);
            }
        }

        loadCheckoutData();
    }, [eventId, orderId, user]);

    async function loadOrder(orderId: string) {
        try {
            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .select(`
                    *,
                    events(*)
                `)
                .eq('id', orderId)
                .single();

            if (orderError || !orderData) {
                setError('Pedido não encontrado');
                setLoading(false);
                return;
            }

            setCurrentOrder(orderData);
            setEvent(orderData.events);
            setTotal(parseFloat(orderData.total_amount?.toString() || '0'));

            // Load order items
            const { data: orderItems, error: orderItemsError } = await supabase
                .from('order_items')
                .select('*')
                .eq('order_id', orderId);

            if (orderItemsError) {
                console.error('Error fetching order items:', orderItemsError);
            }

            if (orderItems && orderItems.length > 0) {
                // Fetch ticket types and groups separately
                const ticketsWithDetails = await Promise.all(
                    orderItems.map(async (item) => {
                        const { data: ticketType } = await supabase
                            .from('event_ticket_types')
                            .select('name, group_id')
                            .eq('id', item.ticket_type_id)
                            .single();

                        let groupName = '';
                        if (ticketType?.group_id) {
                            const { data: group } = await supabase
                                .from('event_ticket_groups')
                                .select('name')
                                .eq('id', ticketType.group_id)
                                .single();
                            groupName = group?.name || '';
                        }

                        return {
                            ticketTypeId: item.ticket_type_id,
                            quantity: item.quantity,
                            ticketTypeName: ticketType?.name || '',
                            ticketGroupName: groupName,
                            price: parseFloat(item.unit_price?.toString() || '0')
                        };
                    })
                );

                setCheckoutTickets(ticketsWithDetails);
            }

            // Load customer data from order
            setCustomerData({
                name: orderData.participant_name || '',
                email: orderData.participant_email || '',
                phone: orderData.participant_phone || ''
            });

            setPaymentMethod(orderData.payment_method || '');
        } catch (err: any) {
            console.error('Error loading order:', err);
            setError(err.message || 'Erro ao carregar pedido');
        } finally {
            setLoading(false);
        }
    }

    async function createOrder() {
        if (!event) {
            setError('Evento não encontrado');
            return null;
        }

        if (!customerData.name || !customerData.email) {
            setError('Preencha nome e e-mail');
            return null;
        }

        if (checkoutTickets.length === 0) {
            setError('Nenhum ingresso selecionado');
            return null;
        }

        try {
            // Get organization_id from event
            const { data: eventData } = await supabase
                .from('events')
                .select('organization_id')
                .eq('id', event.id)
                .single();

            // Generate order number
            const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

            // Create order with event_id and user_id
            const orderInsert: any = {
                event_id: event.id, // Always link to event
                user_id: user?.id || null, // Link to user if authenticated
                organization_id: eventData?.organization_id || null,
                participant_name: customerData.name,
                participant_email: customerData.email,
                participant_phone: customerData.phone || null,
                payment_status: 'pending',
                total_amount: total,
                quantity: checkoutTickets.reduce((sum, t) => sum + t.quantity, 0),
                order_number: orderNumber
            };

            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .insert(orderInsert)
                .select()
                .single();

            if (orderError) {
                console.error('Error creating order:', orderError);
                setError('Erro ao criar pedido: ' + orderError.message);
                return null;
            }

            // Create order items
            // Note: subtotal is a generated column, so we don't include it in the insert
            const orderItems = checkoutTickets.map(ticket => ({
                order_id: orderData.id,
                ticket_type_id: ticket.ticketTypeId,
                quantity: ticket.quantity,
                unit_price: ticket.price
            }));

            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(orderItems);

            if (itemsError) {
                console.error('Error creating order items:', itemsError);
                setError('Erro ao criar itens do pedido');
                return null;
            }

            // Update order total (recalculate from items)
            // Since subtotal is a generated column, we calculate it manually
            const calculatedTotal = orderItems.reduce((sum, item) => {
                return sum + (item.quantity * parseFloat(item.unit_price.toString()));
            }, 0);
            await supabase
                .from('orders')
                .update({ total_amount: calculatedTotal })
                .eq('id', orderData.id);

            setCurrentOrder(orderData);
            return orderData;
        } catch (err: any) {
            console.error('Error creating order:', err);
            setError(err.message || 'Erro ao criar pedido');
            return null;
        }
    }

    async function processApprovedPayment(orderId: string) {
        try {
            // 1. Update order status
            await supabase
                .from('orders')
                .update({
                    payment_status: 'paid',
                    paid_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', orderId);

            // 2. Get order items
            const { data: orderItems, error: orderItemsError } = await supabase
                .from('order_items')
                .select('*')
                .eq('order_id', orderId);

            if (orderItemsError) {
                console.error('Error fetching order items:', orderItemsError);
                throw orderItemsError;
            }

            if (!orderItems || orderItems.length === 0) {
                console.error('No order items found for order:', orderId);
                return;
            }

            console.log(`Found ${orderItems.length} order items for order ${orderId}`);

            // 3. Get order details
            const { data: order } = await supabase
                .from('orders')
                .select('*')
                .eq('id', orderId)
                .single();

            if (!order) {
                console.error('Order not found');
                return;
            }

            // 4. Generate tickets for each order item
            const tickets = [];
            for (const item of orderItems) {
                // Validate required fields
                if (!order.event_id) {
                    console.error('Order missing event_id:', order);
                    continue;
                }
                if (!item.ticket_type_id) {
                    console.error('Order item missing ticket_type_id:', item);
                    continue;
                }

                for (let i = 0; i < item.quantity; i++) {
                    // Generate unique ticket code
                    const ticketCode = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
                    
                    const ticketData = {
                        order_id: orderId,
                        event_id: order.event_id,
                        ticket_type_id: item.ticket_type_id,
                        ticket_code: ticketCode,
                        price: parseFloat(item.unit_price?.toString() || '0'),
                        status: 'active',
                        organization_id: order.organization_id || null
                    };

                    console.log('Creating ticket with data:', ticketData);

                    const { data: ticket, error: ticketError } = await supabase
                        .from('tickets')
                        .insert(ticketData)
                        .select()
                        .single();

                    if (ticketError) {
                        console.error('Error creating ticket:', ticketError);
                        console.error('Ticket data:', ticketData);
                        console.error('Order data:', order);
                        console.error('Item data:', item);
                        // Don't continue silently - log the error but still try to create other tickets
                        continue;
                    }

                    if (!ticket) {
                        console.error('Ticket created but no data returned');
                        continue;
                    }

                    tickets.push(ticket);

                    // 5. Create form response if event has form
                    if (order.event_id) {
                        const { data: eventData } = await supabase
                            .from('events')
                            .select('form_id, require_form')
                            .eq('id', order.event_id)
                            .single();

                        if (eventData?.form_id) {
                            // Create form_response
                            const { data: formResponse, error: responseError } = await supabase
                                .from('form_responses')
                                .insert({
                                    form_id: eventData.form_id,
                                    ticket_id: ticket.id,
                                    user_id: order.user_id,
                                    status: 'pending'
                                })
                                .select()
                                .single();

                            if (!responseError && formResponse) {
                                // Get form fields
                                const { data: formFields } = await supabase
                                    .from('form_fields')
                                    .select('id')
                                    .eq('form_id', eventData.form_id)
                                    .order('order_index', { ascending: true });

                                if (formFields && formFields.length > 0) {
                                    // Create empty answers for each field
                                    const answers = formFields.map(field => ({
                                        response_id: formResponse.id,
                                        field_id: field.id,
                                        value: null
                                    }));

                                    await supabase
                                        .from('form_response_answers')
                                        .insert(answers);
                                }
                            }
                        }
                    }

                    // 6. Update ticket type stock (increment quantity_sold)
                    const { data: ticketType } = await supabase
                        .from('event_ticket_types')
                        .select('quantity_sold')
                        .eq('id', item.ticket_type_id)
                        .single();

                    if (ticketType) {
                        await supabase
                            .from('event_ticket_types')
                            .update({
                                quantity_sold: (ticketType.quantity_sold || 0) + 1
                            })
                            .eq('id', item.ticket_type_id);
                    }
                }
            }

            console.log(`Processed payment for order ${orderId}: ${tickets.length} tickets created`);
            return tickets;
        } catch (error: any) {
            console.error('Error processing approved payment:', error);
            throw error;
        }
    }

    async function handlePayment(method: string) {
        if (!currentOrder) {
            const order = await createOrder();
            if (!order) return;
        }

        setProcessing(true);
        setError(null);

        try {
            const order = currentOrder || await createOrder();
            if (!order) return;

            // Create payment record with event_id and user_id
            const { data: paymentData, error: paymentError } = await supabase
                .from('payments')
                .insert({
                    order_id: order.id,
                    event_id: order.event_id,
                    user_id: order.user_id,
                    amount: total,
                    payment_method: method,
                    payment_provider: method === 'pix' ? 'efi' : method === 'card' ? 'stripe' : method,
                    status: 'processing'
                })
                .select()
                .single();

            if (paymentError) {
                console.error('Error creating payment:', paymentError);
                setError('Erro ao processar pagamento');
                setProcessing(false);
                return;
            }

            // Update order with payment method
            await supabase
                .from('orders')
                .update({ payment_method: method })
                .eq('id', order.id);

            // Simulate payment approval (wait 1 second to show processing)
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Update payment to paid
            await supabase
                .from('payments')
                .update({
                    status: 'paid',
                    paid_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', paymentData.id);

            // Process approved payment (generate tickets, forms, etc.)
            await processApprovedPayment(order.id);

            // Clear checkout data from sessionStorage
            sessionStorage.removeItem('checkoutData');

            // Redirect to success page
            router.push(`/checkout/success?order_id=${order.id}`);
        } catch (err: any) {
            console.error('Error processing payment:', err);
            setError(err.message || 'Erro ao processar pagamento');
        } finally {
            setProcessing(false);
        }
    }

    const formatPrice = (price: number) => {
        if (price === 0) return 'Gratuito';
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(price);
    };

    const formatPhone = (value: string) => {
        // Remove tudo que não é dígito
        const numbers = value.replace(/\D/g, '');
        
        // Aplica a máscara
        if (numbers.length <= 10) {
            // Telefone fixo: (00) 0000-0000
            return numbers
                .replace(/(\d{2})(\d)/, '($1) $2')
                .replace(/(\d{4})(\d)/, '$1-$2');
        } else {
            // Celular: (00) 00000-0000
            return numbers
                .replace(/(\d{2})(\d)/, '($1) $2')
                .replace(/(\d{5})(\d)/, '$1-$2')
                .substring(0, 15); // Limita a 15 caracteres
        }
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatPhone(e.target.value);
        setCustomerData({ ...customerData, phone: formatted });
    };

    if (loading) {
        return (
            <main className={styles.main}>
                <Header />
                <div className={styles.loadingContainer}>
                    <div className={styles.spinner}></div>
                    <p>Carregando checkout...</p>
                </div>
                <Footer />
            </main>
        );
    }

    if (error && !event) {
        return (
            <main className={styles.main}>
                <Header />
                <div className={styles.errorContainer}>
                    <h2>Erro</h2>
                    <p>{error}</p>
                    <button onClick={() => router.back()} className={styles.backButton}>
                        Voltar
                    </button>
                </div>
                <Footer />
            </main>
        );
    }

    return (
        <main className={styles.main}>
            <Header />

            <div className={styles.container}>
                <div className={styles.content}>
                    {/* Left Column - Order Summary */}
                    <div className={styles.summarySection}>
                        <h2 className={styles.sectionTitle}>Resumo do Pedido</h2>
                        
                        {event && (
                            <div className={styles.eventCard}>
                                <h3 className={styles.eventName}>{event.name}</h3>
                                <div className={styles.eventMeta}>
                                    {event.event_date && (
                                        <span>📅 {new Date(event.event_date).toLocaleDateString('pt-BR')}</span>
                                    )}
                                    {event.location && (
                                        <span>📍 {event.location}</span>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className={styles.ticketsList}>
                            <h4 className={styles.ticketsTitle}>Ingressos</h4>
                            {checkoutTickets.map((ticket, index) => (
                                <div key={index} className={styles.ticketItem}>
                                    <div className={styles.ticketInfo}>
                                        {ticket.ticketGroupName && (
                                            <span className={styles.ticketGroup}>{ticket.ticketGroupName}</span>
                                        )}
                                        <span className={styles.ticketName}>{ticket.ticketTypeName}</span>
                                        <span className={styles.ticketQuantity}>x{ticket.quantity}</span>
                                    </div>
                                    <span className={styles.ticketPrice}>
                                        {formatPrice(ticket.price * ticket.quantity)}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className={styles.totalSection}>
                            <div className={styles.totalRow}>
                                <span className={styles.totalLabel}>Total</span>
                                <span className={styles.totalPrice}>{formatPrice(total)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Customer Info & Payment */}
                    <div className={styles.formSection}>
                        <h2 className={styles.sectionTitle}>Dados do Comprador</h2>
                        
                        <div className={styles.formGroup}>
                            <label htmlFor="name" className={styles.label}>
                                Nome Completo *
                            </label>
                            <input
                                type="text"
                                id="name"
                                value={customerData.name}
                                onChange={(e) => setCustomerData({ ...customerData, name: e.target.value })}
                                className={styles.input}
                                placeholder="Seu nome completo"
                                required
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="email" className={styles.label}>
                                E-mail *
                            </label>
                            <input
                                type="email"
                                id="email"
                                value={customerData.email}
                                onChange={(e) => setCustomerData({ ...customerData, email: e.target.value })}
                                className={styles.input}
                                placeholder="seu@email.com"
                                required
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="phone" className={styles.label}>
                                Telefone
                            </label>
                            <input
                                type="tel"
                                id="phone"
                                value={customerData.phone}
                                onChange={handlePhoneChange}
                                className={styles.input}
                                placeholder="(00) 00000-0000"
                                maxLength={15}
                            />
                        </div>

                        <div className={styles.paymentSection}>
                            <h3 className={styles.paymentTitle}>Método de Pagamento</h3>
                            
                            <div className={styles.paymentMethods}>
                                <button
                                    type="button"
                                    className={`${styles.paymentMethod} ${paymentMethod === 'pix' ? styles.selected : ''}`}
                                    onClick={() => setPaymentMethod('pix')}
                                >
                                    <div className={styles.paymentIcon}>💳</div>
                                    <div>
                                        <div className={styles.paymentName}>PIX</div>
                                        <div className={styles.paymentDesc}>Aprovação imediata</div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    className={`${styles.paymentMethod} ${paymentMethod === 'card' ? styles.selected : ''}`}
                                    onClick={() => setPaymentMethod('card')}
                                >
                                    <div className={styles.paymentIcon}>💳</div>
                                    <div>
                                        <div className={styles.paymentName}>Cartão de Crédito</div>
                                        <div className={styles.paymentDesc}>Parcelamento disponível</div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    className={`${styles.paymentMethod} ${paymentMethod === 'boleto' ? styles.selected : ''}`}
                                    onClick={() => setPaymentMethod('boleto')}
                                >
                                    <div className={styles.paymentIcon}>📄</div>
                                    <div>
                                        <div className={styles.paymentName}>Boleto</div>
                                        <div className={styles.paymentDesc}>Vencimento em 3 dias</div>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className={styles.errorAlert}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <line x1="12" y1="8" x2="12" y2="12"/>
                                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                                </svg>
                                {error}
                            </div>
                        )}

                        <button
                            className={styles.checkoutButton}
                            onClick={() => handlePayment(paymentMethod)}
                            disabled={!paymentMethod || processing || !customerData.name || !customerData.email}
                        >
                            {processing ? 'Processando...' : `Finalizar Compra - ${formatPrice(total)}`}
                        </button>

                        <p className={styles.disclaimer}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                            Seus dados estão seguros e protegidos
                        </p>
                    </div>
                </div>
            </div>

            <Footer />
        </main>
    );
}

export default function CheckoutPage() {
    return (
        <Suspense fallback={
            <main className={styles.main}>
                <Header />
                <div className={styles.loadingContainer}>
                    <div className={styles.spinner}></div>
                    <p>Carregando checkout...</p>
                </div>
                <Footer />
            </main>
        }>
            <CheckoutPageContent />
        </Suspense>
    );
}

