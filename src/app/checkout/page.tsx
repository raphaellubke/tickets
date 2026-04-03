'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
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
    priceCard: number | null;
}

interface CheckoutData {
    eventId: string;
    tickets: Array<{ ticketTypeId: string; quantity: number }>;
    total: number;
}

type CheckoutStep = 'details' | 'pix' | 'card';

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
    const [customerData, setCustomerData] = useState({ name: '', email: '', phone: '' });
    const [cpf, setCpf] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<string>('');
    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState<{
        id: string; code: string; description: string | null;
        discount_type: string; discount_value: number; discount_amount: number;
    } | null>(null);
    const [couponLoading, setCouponLoading] = useState(false);
    const [couponError, setCouponError] = useState<string | null>(null);

    // Reservation state
    const [reservationSessionId] = useState<string>(() => {
        if (typeof window === 'undefined') return '';
        const existing = sessionStorage.getItem('reservationSessionId');
        if (existing) return existing;
        const newId = crypto.randomUUID();
        sessionStorage.setItem('reservationSessionId', newId);
        return newId;
    });
    const [reservationExpiresAt, setReservationExpiresAt] = useState<Date | null>(null);
    const [reservationExpired, setReservationExpired]     = useState(false);
    const [timeRemaining, setTimeRemaining]               = useState(0);
    const [reservationError, setReservationError]         = useState<string | null>(null);

    // Multi-step state
    const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('details');
    const [pixInfo, setPixInfo] = useState<{
        qrCode: string; qrCodeBase64: string; paymentId: string; dbPaymentId: string;
    } | null>(null);
    const [pixCopied, setPixCopied] = useState(false);
    const pixPollingRef   = useRef<ReturnType<typeof setInterval> | null>(null);
    const expiryRef       = useRef<HTMLInputElement>(null);
    const cvvRef          = useRef<HTMLInputElement>(null);
    const cardNameRef     = useRef<HTMLInputElement>(null);

    // Card form state (no MP SDK iframes)
    const [cardData, setCardData] = useState({ number: '', expiry: '', cvv: '', name: '' });
    const [installmentOptions, setInstallmentOptions] = useState<Array<{ installments: number; recommended_message: string }>>([]);
    const [selectedInstallments, setSelectedInstallments] = useState(1);
    const [cardPaymentMethodId, setCardPaymentMethodId] = useState('');
    const [cardIssuerId, setCardIssuerId] = useState('');
    const [fetchingInstallments, setFetchingInstallments] = useState(false);

    // Terms modal
    const [showTermsModal, setShowTermsModal] = useState(false);
    const [termsScrolled, setTermsScrolled]   = useState(false);
    const [termsAccepted, setTermsAccepted]   = useState(false);
    const termsShownRef = useRef(false);
    const termsBodyRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        async function loadCheckoutData() {
            try {
                if (orderId) { await loadOrder(orderId); return; }
                if (!eventId) { setError('Evento não especificado'); setLoading(false); return; }

                const checkoutDataStr = sessionStorage.getItem('checkoutData');
                if (!checkoutDataStr) { setError('Dados do checkout não encontrados'); setLoading(false); return; }

                const checkoutData: CheckoutData = JSON.parse(checkoutDataStr);

                const { data: eventData, error: eventError } = await supabase
                    .from('events').select('*').eq('id', checkoutData.eventId).single();
                if (eventError || !eventData) { setError('Evento não encontrado'); setLoading(false); return; }
                setEvent(eventData);

                const ticketsWithDetails = await Promise.all(
                    checkoutData.tickets.map(async (ticket) => {
                        const { data: ticketType } = await supabase
                            .from('event_ticket_types').select('*').eq('id', ticket.ticketTypeId).single();
                        if (!ticketType) return null;
                        let groupName = '';
                        if (ticketType.group_id) {
                            const { data: group } = await supabase
                                .from('event_ticket_groups').select('name').eq('id', ticketType.group_id).single();
                            groupName = group?.name || '';
                        }
                        return {
                            ticketTypeId: ticket.ticketTypeId,
                            quantity: ticket.quantity,
                            ticketTypeName: ticketType.name,
                            ticketGroupName: groupName,
                            price: parseFloat(ticketType.price?.toString() || '0'),
                            priceCard: ticketType.price_card ? parseFloat(ticketType.price_card.toString()) : null,
                        };
                    })
                );

                const validTickets = ticketsWithDetails.filter(Boolean) as CheckoutTicket[];
                setCheckoutTickets(validTickets);
                setTotal(checkoutData.total);

                // Create reservation immediately — holds tickets for 10 minutes
                const sessionId = sessionStorage.getItem('reservationSessionId') || reservationSessionId;
                const reserveItems = checkoutData.tickets.map(t => ({
                    ticket_type_id: t.ticketTypeId,
                    quantity: t.quantity,
                }));
                const { data: resResult, error: resError } = await supabase.rpc('reserve_tickets', {
                    p_items: reserveItems,
                    p_session_id: sessionId,
                });
                if (resError || !resResult?.success) {
                    setReservationError(
                        resResult?.error || resError?.message || 'Não foi possível reservar os ingressos'
                    );
                    setLoading(false);
                    return;
                }
                setReservationExpiresAt(new Date(resResult.expires_at));

                if (user) {
                    const { data: profile } = await supabase
                        .from('profiles').select('full_name, email').eq('id', user.id).maybeSingle();
                    if (profile) {
                        setCustomerData({ name: profile.full_name || '', email: profile.email || user.email || '', phone: '' });
                    }
                }
            } catch (err: any) {
                setError(err.message || 'Erro ao carregar checkout');
            } finally {
                setLoading(false);
            }
        }
        loadCheckoutData();
    }, [eventId, orderId, user]);

    async function loadOrder(oid: string) {
        try {
            const { data: orderData, error: orderError } = await supabase
                .from('orders').select('*, events(*)').eq('id', oid).single();
            if (orderError || !orderData) { setError('Pedido não encontrado'); setLoading(false); return; }

            setCurrentOrder(orderData);
            setEvent(orderData.events);
            setTotal(parseFloat(orderData.total_amount?.toString() || '0'));

            const { data: orderItems } = await supabase.from('order_items').select('*').eq('order_id', oid);
            if (orderItems?.length) {
                const ticketsWithDetails = await Promise.all(
                    orderItems.map(async (item) => {
                        const { data: ticketType } = await supabase
                            .from('event_ticket_types').select('name, group_id').eq('id', item.ticket_type_id).single();
                        let groupName = '';
                        if (ticketType?.group_id) {
                            const { data: group } = await supabase
                                .from('event_ticket_groups').select('name').eq('id', ticketType.group_id).single();
                            groupName = group?.name || '';
                        }
                        return {
                            ticketTypeId: item.ticket_type_id,
                            quantity: item.quantity,
                            ticketTypeName: ticketType?.name || '',
                            ticketGroupName: groupName,
                            price: parseFloat(item.unit_price?.toString() || '0'),
                            priceCard: null,
                        };
                    })
                );
                setCheckoutTickets(ticketsWithDetails);
            }

            setCustomerData({
                name: orderData.participant_name || '',
                email: orderData.participant_email || '',
                phone: orderData.participant_phone || '',
            });
            setPaymentMethod(orderData.payment_method || '');
        } catch (err: any) {
            setError(err.message || 'Erro ao carregar pedido');
        } finally {
            setLoading(false);
        }
    }

    async function applyCoupon() {
        if (!couponCode.trim() || !event) return;
        setCouponLoading(true);
        setCouponError(null);
        setAppliedCoupon(null);
        try {
            const { data, error: rpcError } = await supabase.rpc('validate_coupon', {
                p_code: couponCode.trim(),
                p_organization_id: event.organization_id,
                p_event_id: event.id,
                p_order_amount: total,
            });
            if (rpcError) throw rpcError;
            const result = data?.[0];
            if (!result?.is_valid) { setCouponError(result?.error_message || 'Cupom inválido'); return; }
            setAppliedCoupon({
                id: result.id, code: result.code, description: result.description,
                discount_type: result.discount_type, discount_value: result.discount_value,
                discount_amount: result.discount_amount,
            });
        } catch (err: any) {
            setCouponError(err.message || 'Erro ao validar cupom');
        } finally {
            setCouponLoading(false);
        }
    }

    async function createOrder() {
        if (!event) { setError('Evento não encontrado'); return null; }
        if (!customerData.name || !customerData.email) { setError('Preencha nome e e-mail'); return null; }
        if (checkoutTickets.length === 0) { setError('Nenhum ingresso selecionado'); return null; }

        try {
            for (const ticket of checkoutTickets) {
                const { data: ticketType } = await supabase
                    .from('event_ticket_types')
                    .select('quantity_available, quantity_sold, name')
                    .eq('id', ticket.ticketTypeId).single();
                if (!ticketType) { setError('Ingresso não encontrado'); return null; }
                const available = (ticketType.quantity_available || 0) - (ticketType.quantity_sold || 0);
                if (ticket.quantity > available) {
                    setError(available <= 0
                        ? `"${ticketType.name}" está esgotado`
                        : `"${ticketType.name}": apenas ${available} disponível(is)`);
                    return null;
                }
            }

            const { data: eventData } = await supabase.from('events').select('organization_id').eq('id', event.id).single();
            const discountAmount = appliedCoupon?.discount_amount || 0;
            const finalTotal = Math.max(0, total - discountAmount);
            const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .insert({
                    event_id: event.id,
                    user_id: user?.id || null,
                    organization_id: eventData?.organization_id || null,
                    participant_name: customerData.name,
                    participant_email: customerData.email,
                    participant_phone: customerData.phone || null,
                    payment_status: 'pending',
                    total_amount: finalTotal,
                    discount_amount: discountAmount,
                    coupon_id: appliedCoupon?.id || null,
                    quantity: checkoutTickets.reduce((s, t) => s + t.quantity, 0),
                    order_number: orderNumber,
                })
                .select().single();

            if (orderError) { setError('Erro ao criar pedido: ' + orderError.message); return null; }

            const orderItems = checkoutTickets.map(ticket => {
                const effectivePrice = paymentMethod === 'card' && ticket.priceCard && ticket.priceCard > 0
                    ? ticket.priceCard
                    : ticket.price;
                return {
                    order_id: orderData.id,
                    ticket_type_id: ticket.ticketTypeId,
                    quantity: ticket.quantity,
                    unit_price: effectivePrice,
                    total_price: ticket.quantity * effectivePrice,
                };
            });

            const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
            if (itemsError) { setError('Erro ao criar itens do pedido'); return null; }

            const itemsSubtotal = orderItems.reduce((s, i) => s + i.total_price, 0);
            const finalOrderTotal = Math.max(0, itemsSubtotal - discountAmount);
            await supabase.from('orders').update({ total_amount: finalOrderTotal }).eq('id', orderData.id);

            if (appliedCoupon?.id) {
                await supabase.rpc('increment_coupon_uses', { p_coupon_id: appliedCoupon.id });
            }

            setCurrentOrder(orderData);
            return orderData;
        } catch (err: any) {
            setError(err.message || 'Erro ao criar pedido');
            return null;
        }
    }

    async function processApprovedPayment(orderId: string) {
        try {
            const { data: updatedOrders } = await supabase
                .from('orders')
                .update({ payment_status: 'paid', paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                .eq('id', orderId).eq('payment_status', 'pending').select('id');

            if (!updatedOrders || updatedOrders.length === 0) return [];

            const { data: orderItems } = await supabase.from('order_items').select('*').eq('order_id', orderId);
            if (!orderItems?.length) return;

            const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
            if (!order) return;

            const tickets = [];
            for (const item of orderItems) {
                if (!order.event_id || !item.ticket_type_id) continue;
                for (let i = 0; i < item.quantity; i++) {
                    const ticketCode = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
                    const { data: ticket, error: ticketError } = await supabase
                        .from('tickets')
                        .insert({
                            order_id: orderId,
                            event_id: order.event_id,
                            ticket_type_id: item.ticket_type_id,
                            ticket_code: ticketCode,
                            status: 'active',
                            organization_id: order.organization_id || null,
                        })
                        .select().single();

                    if (ticketError || !ticket) continue;

                    // Atomic capacity check — if at capacity, remove the ticket just created
                    const { data: incremented } = await supabase.rpc('increment_quantity_sold', { p_ticket_type_id: item.ticket_type_id });
                    if (!incremented) {
                        await supabase.from('tickets').delete().eq('id', ticket.id);
                        console.warn('Ticket oversell prevented for type:', item.ticket_type_id);
                        continue;
                    }

                    tickets.push(ticket);

                    const { data: eventData } = await supabase
                        .from('events').select('form_id, require_form').eq('id', order.event_id).maybeSingle();

                    if (eventData?.form_id) {
                        const { data: formResponse } = await supabase
                            .from('form_responses')
                            .insert({ form_id: eventData.form_id, ticket_id: ticket.id, user_id: order.user_id, status: 'pending' })
                            .select().single();

                        if (formResponse) {
                            const { data: formFields } = await supabase
                                .from('form_fields').select('id').eq('form_id', eventData.form_id).order('order_index', { ascending: true });
                            if (formFields?.length) {
                                await supabase.from('form_response_answers').insert(
                                    formFields.map(f => ({ response_id: formResponse.id, field_id: f.id, value: null }))
                                );
                            }
                        }
                    }
                }
            }
            return tickets;
        } catch (error: any) {
            console.error('Error processing approved payment:', error);
            throw error;
        }
    }

    // Cleanup polling on unmount
    useEffect(() => {
        return () => { if (pixPollingRef.current) clearInterval(pixPollingRef.current); };
    }, []);

    // Countdown timer for reservation
    useEffect(() => {
        if (!reservationExpiresAt) return;
        const tick = () => {
            const remaining = Math.max(0, Math.floor((reservationExpiresAt.getTime() - Date.now()) / 1000));
            setTimeRemaining(remaining);
            if (remaining === 0) setReservationExpired(true);
        };
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [reservationExpiresAt]);

    async function releaseReservation() {
        try {
            const sessionId = sessionStorage.getItem('reservationSessionId') || reservationSessionId;
            if (sessionId) {
                await supabase.rpc('release_reservation', { p_session_id: sessionId });
                sessionStorage.removeItem('reservationSessionId');
            }
        } catch {
            // Non-critical — reservation will expire automatically in 10 min
        }
    }

    // Fetch installments when BIN (first 6 digits) is available
    useEffect(() => {
        const bin = cardData.number.replace(/\s/g, '').substring(0, 6);
        if (bin.length < 6) { setInstallmentOptions([]); return; }
        const amount = Math.max(1, total - (appliedCoupon?.discount_amount || 0));
        setFetchingInstallments(true);
        fetch(`/api/mercadopago/get-installments?bin=${bin}&amount=${amount}`)
            .then(r => r.json())
            .then(data => {
                setInstallmentOptions(data.installments || []);
                setCardPaymentMethodId(data.paymentMethodId || '');
                setCardIssuerId(data.issuerId || '');
                if ((data.installments || []).length > 0) setSelectedInstallments(1);
            })
            .catch(() => {})
            .finally(() => setFetchingInstallments(false));
    }, [cardData.number, total, appliedCoupon]);

    // Recompute total when payment method changes (PIX vs card pricing)
    useEffect(() => {
        if (checkoutTickets.length === 0) return;
        const newTotal = checkoutTickets.reduce((sum, t) => {
            const price = paymentMethod === 'card' && t.priceCard && t.priceCard > 0 ? t.priceCard : t.price;
            return sum + price * t.quantity;
        }, 0);
        setTotal(newTotal);
        setAppliedCoupon(null); // reset coupon when price changes
    }, [paymentMethod, checkoutTickets]);

    // Show terms modal once after checkout data loads (paid events only)
    useEffect(() => {
        if (!loading && checkoutTickets.length > 0 && !termsShownRef.current) {
            const hasPaidTicket = checkoutTickets.some(t => t.price > 0);
            if (hasPaidTicket) { setShowTermsModal(true); termsShownRef.current = true; }
        }
    }, [loading, checkoutTickets]);

    // Auto-mark as scrolled if content fits without scrolling
    useEffect(() => {
        if (!showTermsModal) return;
        const timeout = setTimeout(() => {
            const el = termsBodyRef.current;
            if (el && el.scrollHeight <= el.clientHeight) {
                setTermsScrolled(true);
            }
        }, 100);
        return () => clearTimeout(timeout);
    }, [showTermsModal]);

    async function handleContinue() {
        if (!customerData.name || !customerData.email) { setError('Preencha nome e e-mail'); return; }
        if (!customerData.phone || customerData.phone.replace(/\D/g, '').length < 10) { setError('Informe um telefone válido'); return; }
        if (!cpf || cpf.replace(/\D/g, '').length < 11) { setError('Informe um CPF válido'); return; }

        const finalTotal = Math.max(0, total - (appliedCoupon?.discount_amount || 0));

        // Free event — no payment needed
        if (finalTotal === 0) {
            setProcessing(true);
            setError(null);
            try {
                const order = currentOrder || await createOrder();
                if (!order) { setProcessing(false); return; }
                await handleFreePayment(order);
            } finally {
                setProcessing(false);
            }
            return;
        }

        if (!paymentMethod) { setError('Selecione um método de pagamento'); return; }

        setProcessing(true);
        setError(null);
        try {
            const order = currentOrder || await createOrder();
            if (!order) { setProcessing(false); return; }

            if (paymentMethod === 'pix') {
                await handlePixPayment(order, finalTotal);
            } else if (paymentMethod === 'card') {
                setCheckoutStep('card');
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao processar');
        } finally {
            setProcessing(false);
        }
    }

    async function handleFreePayment(order: any) {
        // Free events — no payment record needed, just process tickets directly
        await processApprovedPayment(order.id);
        await releaseReservation();
        sessionStorage.removeItem('checkoutData');
        router.push(`/checkout/success?order_id=${order.id}`);
    }

    async function handlePixPayment(order: any, finalTotal: number) {
        const { data: paymentData, error: paymentError } = await supabase
            .from('payments')
            .insert({
                order_id: order.id,
                event_id: order.event_id,
                user_id: order.user_id,
                amount: finalTotal,
                payment_method: 'pix',
                payment_provider: 'mercadopago',
                status: 'pending',
            })
            .select().single();

        if (paymentError) { setError('Erro ao iniciar pagamento PIX'); return; }

        const res = await fetch('/api/mercadopago/create-pix', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderId: order.id,
                orderNumber: order.order_number,
                amount: finalTotal,
                payerEmail: customerData.email,
                payerName: customerData.name,
                payerCpf: cpf.replace(/\D/g, ''),
            }),
        });

        const pixResult = await res.json();
        if (!res.ok || pixResult.error) {
            setError(pixResult.error || 'Erro ao gerar QR Code PIX');
            await supabase.from('payments').update({ status: 'failed' }).eq('id', paymentData.id);
            return;
        }

        await supabase.from('payments').update({ payment_provider_id: pixResult.paymentId }).eq('id', paymentData.id);
        await supabase.from('orders').update({ payment_method: 'pix' }).eq('id', order.id);

        setPixInfo({
            qrCode: pixResult.qrCode,
            qrCodeBase64: pixResult.qrCodeBase64,
            paymentId: pixResult.paymentId,
            dbPaymentId: paymentData.id,
        });
        setCurrentOrder(order);
        setCheckoutStep('pix');
        startPixPolling(pixResult.paymentId, order.id, paymentData.id);
    }

    function startPixPolling(mpPaymentId: string, orderId: string, dbPaymentId: string) {
        pixPollingRef.current = setInterval(async () => {
            try {
                const res = await fetch(`/api/mercadopago/check-payment?payment_id=${mpPaymentId}`);
                const data = await res.json();
                if (data.status === 'approved') {
                    clearInterval(pixPollingRef.current!);
                    await supabase.from('payments').update({
                        status: 'paid',
                        paid_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    }).eq('id', dbPaymentId);
                    await processApprovedPayment(orderId);
                    await releaseReservation();
                    sessionStorage.removeItem('checkoutData');
                    router.push(`/checkout/success?order_id=${orderId}`);
                } else if (data.status === 'rejected' || data.status === 'cancelled') {
                    clearInterval(pixPollingRef.current!);
                    setError('Pagamento PIX não identificado. Tente novamente.');
                    setCheckoutStep('details');
                }
            } catch {}
        }, 3000);
    }

    async function handleCardSubmit(e: React.FormEvent) {
        e.preventDefault();
        setProcessing(true);
        setError(null);
        const order = currentOrder;
        if (!order) { setError('Erro ao processar. Tente novamente.'); setProcessing(false); return; }
        const [expMonth, expYear] = cardData.expiry.split('/');
        if (!expMonth || !expYear || cardData.number.replace(/\s/g, '').length < 13 || cardData.cvv.length < 3) {
            setError('Preencha todos os dados do cartão corretamente.');
            setProcessing(false);
            return;
        }

        const finalTotal = Math.max(0, total - (appliedCoupon?.discount_amount || 0));

        const { data: paymentData, error: paymentError } = await supabase
            .from('payments')
            .insert({
                order_id: order.id,
                event_id: order.event_id,
                user_id: order.user_id,
                amount: finalTotal,
                payment_method: 'card',
                payment_provider: 'mercadopago',
                status: 'processing',
            })
            .select().single();

        if (paymentError) { setError('Erro ao registrar pagamento'); setProcessing(false); return; }

        const res = await fetch('/api/mercadopago/create-card', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderId:          order.id,
                orderNumber:      order.order_number,
                amount:           finalTotal,
                cardNumber:       cardData.number.replace(/\s/g, ''),
                expirationMonth:  expMonth.padStart(2, '0'),
                expirationYear:   expYear.length === 2 ? `20${expYear}` : expYear,
                securityCode:     cardData.cvv,
                cardholderName:   cardData.name || customerData.name,
                installments:     selectedInstallments,
                paymentMethodId:  cardPaymentMethodId,
                issuerId:         cardIssuerId,
                payerEmail:       customerData.email,
                payerCpf:         cpf.replace(/\D/g, ''),
                payerName:        customerData.name,
            }),
        });

        const result = await res.json();

        if (!res.ok || result.error) {
            await supabase.from('payments').update({ status: 'rejected' }).eq('id', paymentData.id);
            setError(result.error || 'Pagamento recusado. Verifique os dados e tente novamente.');
            setProcessing(false);
            return;
        }

        if (result.status === 'approved') {
            await supabase.from('payments').update({
                status: 'paid',
                payment_provider_id: result.paymentId,
                paid_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }).eq('id', paymentData.id);
            await supabase.from('orders').update({ payment_method: 'card' }).eq('id', order.id);
            await processApprovedPayment(order.id);
            await releaseReservation();
            sessionStorage.removeItem('checkoutData');
            router.push(`/checkout/success?order_id=${order.id}`);
        } else {
            await supabase.from('payments').update({ status: result.status, payment_provider_id: result.paymentId }).eq('id', paymentData.id);
            setError('Pagamento em análise. Tente outro cartão ou use PIX.');
            setProcessing(false);
        }
    }

    const detectBrand = useCallback((num: string): string => {
        const n = num.replace(/\s/g, '');
        if (/^4/.test(n)) return 'Visa';
        if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard';
        if (/^3[47]/.test(n)) return 'Amex';
        if (/^(636368|438935|504175|451416|636297|5067|4576|4011)/.test(n)) return 'Elo';
        if (/^606282/.test(n)) return 'Hipercard';
        return '';
    }, []);

    const cardBrand = detectBrand(cardData.number);
    const displayNumber = cardData.number || '•••• •••• •••• ••••';
    const displayExpiry = cardData.expiry || '••/••';
    const displayName   = (cardData.name || customerData.name || 'NOME NO CARTÃO').toUpperCase();

    const formatPrice = (price: number) => {
        if (price === 0) return 'Gratuito';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
    };

    const formatPhone = (value: string) => {
        const n = value.replace(/\D/g, '');
        if (n.length <= 10) return n.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
        return n.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 15);
    };

    const formatCpf = (value: string) => {
        const n = value.replace(/\D/g, '');
        return n.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2').substring(0, 14);
    };

    const finalTotal = Math.max(0, total - (appliedCoupon?.discount_amount || 0));

    if (loading) {
        return (
            <main className={styles.main}>
                <Header />
                <div className={styles.loadingContainer}>
                    <div className={styles.spinner}></div>
                    <p>Carregando...</p>
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
                    <button onClick={() => router.back()} className={styles.backButton}>Voltar</button>
                </div>
                <Footer />
            </main>
        );
    }

    // Reservation failed — tickets grabbed by someone else
    if (reservationError) {
        return (
            <main className={styles.main}>
                <Header />
                <div className={styles.errorContainer}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="1.5">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <h2>Ingressos Indisponíveis</h2>
                    <p>{reservationError}</p>
                    <button
                        onClick={() => { sessionStorage.removeItem('checkoutData'); router.push(`/event/${eventId}`); }}
                        className={styles.backButton}
                    >
                        Voltar para o evento
                    </button>
                </div>
                <Footer />
            </main>
        );
    }

    // Reservation expired — 10 minutes ran out
    if (reservationExpired) {
        return (
            <main className={styles.main}>
                <Header />
                <div className={styles.errorContainer}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.5">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <h2>Reserva Expirada</h2>
                    <p>Seu tempo de 10 minutos expirou e os ingressos foram liberados.</p>
                    <button
                        onClick={() => {
                            sessionStorage.removeItem('checkoutData');
                            sessionStorage.removeItem('reservationSessionId');
                            router.push(`/event/${eventId}`);
                        }}
                        className={styles.backButton}
                    >
                        Voltar para o evento
                    </button>
                </div>
                <Footer />
            </main>
        );
    }

    const pixTotal  = checkoutTickets.reduce((s, t) => s + t.price * t.quantity, 0);
    const cardTotal = checkoutTickets.reduce((s, t) => s + (t.priceCard != null && t.priceCard > 0 ? t.priceCard : t.price) * t.quantity, 0);

    return (
        <main className={styles.main}>
            <Header />

            {/* ── Terms & Conditions Modal ── */}
            {showTermsModal && (
                <div className={styles.termsOverlay}>
                    <div className={styles.termsModal}>
                        <div className={styles.termsModalHeader}>
                            <h2 className={styles.termsModalTitle}>ATENÇÃO SOBRE DESISTÊNCIA E REEMBOLSO</h2>
                        </div>

                        <div
                            ref={termsBodyRef}
                            className={styles.termsModalBody}
                            onScroll={(e) => {
                                const el = e.currentTarget;
                                if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) setTermsScrolled(true);
                            }}
                        >
                            <p className={styles.termsClause}>
                                CLÁUSULA SOBRE DESISTÊNCIA, NÃO COMPARECIMENTO E USO DA TAXA DE INSCRIÇÃO
                            </p>

                            <p>
                                Declaro estar ciente de que a taxa de inscrição no valor de{' '}
                                <strong>{formatPrice(pixTotal)} à vista</strong>{' '}
                                ou{' '}
                                <strong>{formatPrice(cardTotal)} a prazo</strong>{' '}
                                refere-se aos custos necessários para a realização do acampamento, incluindo, mas não se
                                limitando a: alimentação, materiais individuais do campista, materiais de secretaria,
                                dinâmicas, logística e demais despesas organizacionais.
                            </p>

                            <p>
                                Tenho ciência de que tais materiais e serviços são{' '}
                                <strong>adquiridos e contratados antecipadamente</strong>, a partir da confirmação da
                                minha inscrição e do pagamento da taxa, considerando minha participação efetiva no
                                acampamento.
                            </p>

                            <p>
                                Dessa forma, em caso de{' '}
                                <strong>
                                    desistência, cancelamento, ausência no dia do acampamento ou não comparecimento por
                                    qualquer motivo, não haverá devolução do valor pago
                                </strong>
                                , nem transferência automática da vaga ou do valor para edições futuras do acampamento.
                            </p>

                            <p>
                                Declaro ainda que compreendo que as{' '}
                                <strong>
                                    vagas do acampamento são limitadas, organizadas por critérios específicos e, quando
                                    necessário, definidas por sorteio
                                </strong>
                                , não sendo possível reservar vagas para edições futuras com base em inscrições
                                anteriores não aproveitadas.
                            </p>

                            <p>
                                Ao prosseguir com a inscrição, afirmo que li, compreendi e estou de pleno acordo com
                                todas as informações acima.
                            </p>

                            <div className={styles.termsScrollHint}>
                                {!termsScrolled && '↓ Role até o final para continuar'}
                            </div>
                        </div>

                        <div className={styles.termsModalFooter}>
                            <label className={`${styles.termsCheckboxLabel} ${!termsScrolled ? styles.termsCheckboxDisabled : ''}`}>
                                <input
                                    type="checkbox"
                                    disabled={!termsScrolled}
                                    checked={termsAccepted}
                                    onChange={(e) => setTermsAccepted(e.target.checked)}
                                    className={styles.termsCheckbox}
                                />
                                Li e concordo com os termos acima
                            </label>

                            <button
                                className={styles.termsAcceptBtn}
                                disabled={!termsAccepted}
                                onClick={() => setShowTermsModal(false)}
                            >
                                Aceitar e Continuar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className={styles.container}>
                {/* Reservation countdown banner */}
                {reservationExpiresAt && !reservationExpired && (
                    <div className={styles.reservationTimer}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                        <span>
                            Ingressos reservados por{' '}
                            <strong>
                                {String(Math.floor(timeRemaining / 60)).padStart(2, '0')}:{String(timeRemaining % 60).padStart(2, '0')}
                            </strong>
                        </span>
                    </div>
                )}

                {/* ─── STEP: DETAILS ─── */}
                {checkoutStep === 'details' && (
                    <div className={styles.content}>
                        {/* Left — Order Summary */}
                        <div className={styles.summarySection}>
                            <h2 className={styles.sectionTitle}>Resumo do Pedido</h2>

                            {event && (
                                <div className={styles.eventCard}>
                                    <h3 className={styles.eventName}>{event.name}</h3>
                                    <div className={styles.eventMeta}>
                                        {event.event_date && (
                                            <span>{new Date(event.event_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                                        )}
                                        {event.location && <span>{event.location}</span>}
                                    </div>
                                </div>
                            )}

                            <div className={styles.ticketsList}>
                                <h4 className={styles.ticketsTitle}>Ingressos</h4>
                                {checkoutTickets.map((ticket, i) => (
                                    <div key={i} className={styles.ticketItem}>
                                        <div className={styles.ticketInfo}>
                                            {ticket.ticketGroupName && <span className={styles.ticketGroup}>{ticket.ticketGroupName}</span>}
                                            <span className={styles.ticketName}>{ticket.ticketTypeName}</span>
                                            <span className={styles.ticketQuantity}>x{ticket.quantity}</span>
                                        </div>
                                        <span className={styles.ticketPrice}>{formatPrice(
                                            (paymentMethod === 'card' && ticket.priceCard && ticket.priceCard > 0 ? ticket.priceCard : ticket.price) * ticket.quantity
                                        )}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Coupon */}
                            <div className={styles.couponSection}>
                                <div className={styles.couponRow}>
                                    <input
                                        type="text"
                                        className={styles.couponInput}
                                        placeholder="Código do cupom"
                                        value={couponCode}
                                        onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); if (appliedCoupon) setAppliedCoupon(null); setCouponError(null); }}
                                        disabled={!!appliedCoupon}
                                    />
                                    {appliedCoupon ? (
                                        <button type="button" className={styles.couponRemoveBtn} onClick={() => { setAppliedCoupon(null); setCouponCode(''); }}>Remover</button>
                                    ) : (
                                        <button type="button" className={styles.couponApplyBtn} onClick={applyCoupon} disabled={!couponCode.trim() || couponLoading}>
                                            {couponLoading ? '...' : 'Aplicar'}
                                        </button>
                                    )}
                                </div>
                                {couponError && <p className={styles.couponError}>{couponError}</p>}
                                {appliedCoupon && (
                                    <div className={styles.couponApplied}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                        <span>Cupom <strong>{appliedCoupon.code}</strong> aplicado</span>
                                        <span className={styles.couponDiscount}>-{formatPrice(appliedCoupon.discount_amount)}</span>
                                    </div>
                                )}
                            </div>

                            <div className={styles.totalSection}>
                                {appliedCoupon && (
                                    <>
                                        <div className={styles.totalRow} style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                                            <span>Subtotal</span><span>{formatPrice(total)}</span>
                                        </div>
                                        <div className={styles.totalRow} style={{ color: '#16a34a', fontSize: '0.875rem' }}>
                                            <span>Desconto</span><span>-{formatPrice(appliedCoupon.discount_amount)}</span>
                                        </div>
                                    </>
                                )}
                                <div className={styles.totalRow}>
                                    <span className={styles.totalLabel}>Total</span>
                                    <span className={styles.totalPrice}>{formatPrice(finalTotal)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Right — Customer Info + Payment */}
                        <div className={styles.formSection}>
                            <h2 className={styles.sectionTitle}>Dados do Comprador</h2>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Nome Completo *</label>
                                <input type="text" value={customerData.name} onChange={(e) => setCustomerData({ ...customerData, name: e.target.value })} className={styles.input} placeholder="Seu nome completo" />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>E-mail *</label>
                                <input type="email" value={customerData.email} onChange={(e) => setCustomerData({ ...customerData, email: e.target.value })} className={styles.input} placeholder="seu@email.com" />
                            </div>
                            <div className={styles.formRow2}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Telefone *</label>
                                    <input type="tel" value={customerData.phone} onChange={(e) => setCustomerData({ ...customerData, phone: formatPhone(e.target.value) })} className={styles.input} placeholder="(00) 00000-0000" maxLength={15} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>CPF *</label>
                                    <input type="text" value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} className={styles.input} placeholder="000.000.000-00" maxLength={14} />
                                </div>
                            </div>

                            {finalTotal > 0 && (
                                <div className={styles.paymentSection}>
                                    <h3 className={styles.paymentTitle}>Forma de Pagamento</h3>
                                    <div className={styles.paymentMethods}>
                                        <button
                                            type="button"
                                            className={`${styles.paymentMethod} ${paymentMethod === 'pix' ? styles.selected : ''}`}
                                            onClick={() => setPaymentMethod('pix')}
                                        >
                                            <div className={styles.paymentIconWrap}>
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                                                    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                                                </svg>
                                            </div>
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
                                            <div className={styles.paymentIconWrap}>
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                                                    <line x1="1" y1="10" x2="23" y2="10"/>
                                                </svg>
                                            </div>
                                            <div>
                                                <div className={styles.paymentName}>Cartão de Crédito</div>
                                                <div className={styles.paymentDesc}>Parcelamento disponível</div>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className={styles.errorAlert}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                    {error}
                                </div>
                            )}

                            <button
                                className={styles.checkoutButton}
                                onClick={handleContinue}
                                disabled={!customerData.name || !customerData.email || !customerData.phone || !cpf || processing || (finalTotal > 0 && !paymentMethod)}
                            >
                                {processing ? 'Processando...' : finalTotal === 0 ? `Confirmar Inscrição` : `Continuar — ${formatPrice(finalTotal)}`}
                            </button>

                            <p className={styles.disclaimer}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                Seus dados estão seguros e protegidos
                            </p>
                        </div>
                    </div>
                )}

                {/* ─── STEP: PIX ─── */}
                {checkoutStep === 'pix' && (
                    <div className={styles.pixWrapper}>
                        <div className={styles.pixCard}>
                            <h2 className={styles.pixTitle}>Pague com PIX</h2>
                            <p className={styles.pixSubtitle}>Escaneie o QR Code ou copie o código abaixo</p>

                            {pixInfo?.qrCodeBase64 ? (
                                <div className={styles.qrCodeWrapper}>
                                    <img
                                        src={`data:image/png;base64,${pixInfo.qrCodeBase64}`}
                                        alt="QR Code PIX"
                                        className={styles.qrCodeImage}
                                    />
                                </div>
                            ) : (
                                <div className={styles.qrCodeWrapper}>
                                    <div className={styles.qrCodePlaceholder}>Gerando QR Code...</div>
                                </div>
                            )}

                            <div className={styles.pixTotal}>
                                <span>Valor a pagar</span>
                                <strong>{formatPrice(finalTotal)}</strong>
                            </div>

                            {pixInfo?.qrCode && (
                                <div className={styles.pixCopyArea}>
                                    <input type="text" readOnly value={pixInfo.qrCode} className={styles.pixCodeInput} />
                                    <button
                                        className={styles.pixCopyBtn}
                                        onClick={() => {
                                            navigator.clipboard.writeText(pixInfo.qrCode);
                                            setPixCopied(true);
                                            setTimeout(() => setPixCopied(false), 2000);
                                        }}
                                    >
                                        {pixCopied ? 'Copiado!' : 'Copiar'}
                                    </button>
                                </div>
                            )}

                            <div className={styles.pixStatus}>
                                <div className={styles.pixPulse}></div>
                                <span>Aguardando confirmação do pagamento...</span>
                            </div>

                            <div className={styles.pixInstructions}>
                                <p>1. Abra o app do seu banco</p>
                                <p>2. Escolha pagar via PIX</p>
                                <p>3. Escaneie o QR Code ou cole o código</p>
                                <p>4. Confirme e aguarde a aprovação</p>
                            </div>

                            <button
                                className={styles.backLinkBtn}
                                onClick={() => {
                                    if (pixPollingRef.current) clearInterval(pixPollingRef.current);
                                    setCheckoutStep('details');
                                    setPixInfo(null);
                                }}
                            >
                                Voltar e escolher outro método
                            </button>
                        </div>
                    </div>
                )}

                {/* ─── STEP: CARD ─── */}
                {checkoutStep === 'card' && (
                    <div className={styles.content}>
                        {/* Left — Order Summary (compact) */}
                        <div className={styles.summarySection}>
                            <h2 className={styles.sectionTitle}>Resumo</h2>
                            {event && <div className={styles.eventCard}><h3 className={styles.eventName}>{event.name}</h3></div>}
                            <div className={styles.totalSection} style={{ paddingTop: '1rem', borderTop: '2px solid #e2e8f0' }}>
                                <div className={styles.totalRow}>
                                    <span className={styles.totalLabel}>Total</span>
                                    <span className={styles.totalPrice}>{formatPrice(finalTotal)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Right — Card Form */}
                        <div className={styles.formSection}>
                            <h2 className={styles.sectionTitle}>Dados do Cartão</h2>

                            <form onSubmit={handleCardSubmit} className={styles.cardForm}>

                                {/* Card preview */}
                                <div className={styles.cardPreview}>
                                    {cardBrand && <span className={styles.cardBrandBadge}>{cardBrand}</span>}
                                    <div className={styles.cardPreviewNumber}>{displayNumber}</div>
                                    <div className={styles.cardPreviewBottom}>
                                        <div>
                                            <div className={styles.cardPreviewLabel}>Nome</div>
                                            <div className={styles.cardPreviewValue}>{displayName}</div>
                                        </div>
                                        <div>
                                            <div className={styles.cardPreviewLabel}>Validade</div>
                                            <div className={styles.cardPreviewValue}>{displayExpiry}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Número do cartão</label>
                                    <div className={styles.cardNumberWrapper}>
                                        <input
                                            type="text" inputMode="numeric" className={styles.input}
                                            placeholder="0000 0000 0000 0000" maxLength={19}
                                            value={cardData.number}
                                            onChange={e => {
                                                const v = e.target.value.replace(/\D/g, '').substring(0, 16);
                                                const formatted = v.replace(/(.{4})/g, '$1 ').trim();
                                                setCardData(p => ({ ...p, number: formatted }));
                                                if (v.length === 16) expiryRef.current?.focus();
                                            }}
                                        />
                                        {cardBrand && <span className={styles.cardBrandIcon}>{cardBrand}</span>}
                                    </div>
                                </div>

                                <div className={styles.formRow2}>
                                    <div className={styles.formGroup}>
                                        <label className={styles.label}>Validade</label>
                                        <input
                                            ref={expiryRef}
                                            type="text" inputMode="numeric" className={styles.input}
                                            placeholder="MM/AA" maxLength={5}
                                            value={cardData.expiry}
                                            onChange={e => {
                                                let v = e.target.value.replace(/\D/g, '').substring(0, 4);
                                                if (v.length > 2) v = v.substring(0, 2) + '/' + v.substring(2);
                                                setCardData(p => ({ ...p, expiry: v }));
                                                if (v.length === 5) cvvRef.current?.focus();
                                            }}
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label className={styles.label}>CVV</label>
                                        <input
                                            ref={cvvRef}
                                            type="text" inputMode="numeric" className={styles.input}
                                            placeholder="CVV" maxLength={4}
                                            value={cardData.cvv}
                                            onChange={e => {
                                                const v = e.target.value.replace(/\D/g, '').substring(0, 4);
                                                setCardData(p => ({ ...p, cvv: v }));
                                                if (v.length >= 3) cardNameRef.current?.focus();
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Nome no cartão</label>
                                    <input
                                        ref={cardNameRef}
                                        type="text" className={styles.input}
                                        placeholder="Como está no cartão"
                                        value={cardData.name}
                                        onChange={e => setCardData(p => ({ ...p, name: e.target.value.toUpperCase() }))}
                                    />
                                </div>

                                <div className={styles.formRow2}>
                                    <div className={styles.formGroup}>
                                        <label className={styles.label}>CPF do titular</label>
                                        <input
                                            type="text" className={styles.input}
                                            placeholder="000.000.000-00"
                                            value={cpf}
                                            onChange={e => setCpf(formatCpf(e.target.value))}
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label className={styles.label}>Parcelas</label>
                                        <select
                                            className={styles.input}
                                            value={selectedInstallments}
                                            onChange={e => setSelectedInstallments(Number(e.target.value))}
                                            disabled={installmentOptions.length === 0}
                                        >
                                            {installmentOptions.length === 0 ? (
                                                <option value={1}>{fetchingInstallments ? 'Carregando...' : 'Digite o número do cartão'}</option>
                                            ) : (
                                                installmentOptions.map(opt => (
                                                    <option key={opt.installments} value={opt.installments}>
                                                        {opt.recommended_message}
                                                    </option>
                                                ))
                                            )}
                                        </select>
                                    </div>
                                </div>

                                {error && (
                                    <div className={styles.errorAlert}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                        {error}
                                    </div>
                                )}

                                <button type="submit" className={styles.checkoutButton} disabled={processing}>
                                    {processing ? 'Processando...' : `Pagar ${formatPrice(finalTotal)}`}
                                </button>
                            </form>

                            <button
                                className={styles.backLinkBtn}
                                onClick={() => { setCheckoutStep('details'); setError(null); setCardData({ number: '', expiry: '', cvv: '', name: '' }); }}
                            >
                                Voltar
                            </button>

                            <p className={styles.disclaimer}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                Pagamento seguro via Mercado Pago
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <Footer />
        </main>
    );
}

export default function CheckoutPage() {
    return (
        <Suspense fallback={
            <main style={{ minHeight: '100vh' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                    <p>Carregando...</p>
                </div>
            </main>
        }>
            <CheckoutPageContent />
        </Suspense>
    );
}
