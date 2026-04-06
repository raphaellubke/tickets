'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import ParticipantModal from './ParticipantModal';
import styles from './page.module.css';
import JSZip from 'jszip';

interface WaitlistEntry {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    position: number;
    status: string;
    created_at: string;
}

interface Participant {
    id: string;
    participant_name: string;
    participant_email: string;
    participant_phone: string | null;
    payment_method: string | null;
    payment_status: string;
    total_amount: number;
    paid_at: string | null;
    created_at: string;
    order_number: string;
    tickets: Array<{
        id: string;
        ticket_code: string;
        status: string;
        event_ticket_types: { name: string } | null;
    }>;
    formStatus?: 'all_completed' | 'all_pending' | 'mixed' | 'no_form';
}

// ─── PDF Generation ────────────────────────────────────────────────────────────

function sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9À-ÿ\s\-_]/g, '').trim().replace(/\s+/g, '_');
}

async function fetchImageAsBase64(url: string): Promise<string | null> {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

/** Calls the server-side API to generate a PDF and returns { pdf (data URI), filename } */
async function generatePdfViaApi(
    order: Participant,
    eventName: string,
    formDetails: Record<string, any>,
    orgLogoBase64?: string | null,
): Promise<{ pdf: string; filename: string }> {
    const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            participantName: order.participant_name || '',
            participantEmail: order.participant_email || '',
            participantPhone: order.participant_phone || '',
            orderNumber: order.order_number || '',
            paymentMethod: order.payment_method || '',
            totalAmount: order.total_amount || 0,
            paidAt: order.paid_at || null,
            eventName: eventName || '',
            tickets: order.tickets || [],
            formDetails: formDetails || {},
            orgLogoBase64: orgLogoBase64 || null,
        }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Falha ao gerar PDF');
    }
    return await res.json();
}

function buildParticipantHtml(order: Participant, eventName: string, formDetails: Record<string, any>): string {
    const paymentLabel: Record<string, string> = {
        pix: 'PIX', card: 'Cartão de Crédito', boleto: 'Boleto',
        credit_card: 'Cartão de Crédito', debit_card: 'Cartão de Débito',
    };
    const formattedTotal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
        .format(order.total_amount || 0);
    const paidDate = order.paid_at
        ? new Date(order.paid_at).toLocaleDateString('pt-BR')
        : '—';

    let formHtml = '';
    if (order.tickets && order.tickets.length > 0) {
        for (const ticket of order.tickets) {
            const detail = formDetails[ticket.id];
            if (!detail) continue;
            if (detail.answers?.length > 0) {
                formHtml += `<div class="form-section"><h4>${ticket.event_ticket_types?.name || 'Ingresso'} — Respostas do Formulário</h4>`;
                for (const answer of detail.answers) {
                    const label = answer.form_fields?.label || answer.field_label || '(campo removido)';
                    formHtml += `<div class="qa"><div class="q">${label}</div><div class="a">${answer.value || '(sem resposta)'}</div></div>`;
                }
                formHtml += '</div>';
            } else if (detail.status === 'pending') {
                formHtml += `<div class="form-section"><h4>${ticket.event_ticket_types?.name || 'Ingresso'} — Formulário</h4><p class="pending-note">⚠ Formulário ainda não preenchido</p></div>`;
            }
        }
    }

    return `
        <div class="participant">
            <div class="participant-header">
                <h2>${order.participant_name}</h2>
                <span class="event-name">${eventName}</span>
            </div>
            <div class="info-grid">
                <div class="info-item"><span class="label">E-mail</span><span class="value">${order.participant_email}</span></div>
                <div class="info-item"><span class="label">Telefone</span><span class="value">${order.participant_phone || '—'}</span></div>
                <div class="info-item"><span class="label">Pagamento</span><span class="value">${paymentLabel[order.payment_method || ''] || order.payment_method || '—'}</span></div>
                <div class="info-item"><span class="label">Valor Pago</span><span class="value">${formattedTotal}</span></div>
                <div class="info-item"><span class="label">Data</span><span class="value">${paidDate}</span></div>
                <div class="info-item"><span class="label">Pedido</span><span class="value">${order.order_number}</span></div>
            </div>
            ${formHtml}
        </div>
    `;
}

/** Convert a base64 data URI to a Uint8Array for ZIP packaging */
function dataUriToBytes(dataUri: string): Uint8Array {
    const base64 = dataUri.split(',')[1];
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
}

/** Opens the PDF in a new browser tab for viewing/downloading */
async function printParticipantPDF(
    order: Participant,
    eventName: string,
    formDetails: Record<string, any>,
    orgLogoBase64?: string | null,
) {
    try {
        const { pdf } = await generatePdfViaApi(order, eventName, formDetails, orgLogoBase64);
        
        // Converter Base64 para Blob para evitar bloqueios de navegador com Data URIs
        const bytes = dataUriToBytes(pdf);
        const blob = new Blob([bytes as any], { type: 'application/pdf' });
        const objectUrl = URL.createObjectURL(blob);

        // Open PDF in a new tab — the browser's native PDF viewer handles saving
        const win = window.open(objectUrl, '_blank');
        if (!win) {
            // Fallback: se os pop-ups estiverem bloqueados, força o download diretamente
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = sanitizeFilename(order.participant_name || 'participante') + '.pdf';
            document.body.appendChild(link);
            link.click();
            setTimeout(() => document.body.removeChild(link), 100);
        }
        
        // Limpar a memória associada à URL criada
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (err) {
        console.error('Erro ao gerar PDF:', err);
        alert('Erro ao gerar PDF: ' + (err instanceof Error ? err.message : String(err)));
    }
}

function printPDF(participants: Participant[], eventName: string, allFormDetails: Record<string, Record<string, any>>) {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Permita pop-ups para gerar o PDF.'); return; }

    const css = `
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; background: #fff; padding: 20px; font-size: 16px; }
        h1 { font-size: 26px; font-weight: 700; color: #111; margin-bottom: 6px; }
        .meta { font-size: 15px; color: #666; margin-bottom: 24px; }
        .participant { margin-bottom: 32px; }
        .participant-header { display: flex; align-items: baseline; gap: 12px; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 2px solid #111; }
        .participant-header h2 { font-size: 20px; font-weight: 700; }
        .event-name { font-size: 15px; color: #666; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
        .info-item { display: flex; flex-direction: column; gap: 1px; }
        .label { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #888; }
        .value { font-size: 16px; color: #111; font-weight: 500; }
        .form-section { background: #f9f9f9; border: 1px solid #eee; border-radius: 6px; padding: 14px; margin-top: 10px; }
        .form-section h4 { font-size: 15px; font-weight: 700; color: #555; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #eee; }
        .qa { margin-bottom: 10px; }
        .q { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #888; margin-bottom: 3px; }
        .a { font-size: 16px; color: #111; }
        .pending-note { color: #b45309; font-size: 15px; font-weight: 500; }
        @media print { @page { margin: 15mm; } body { padding: 0; } .participant + .participant { page-break-before: always; } }
    `;

    const body = participants.map(p => buildParticipantHtml(p, eventName, allFormDetails[p.id] || {})).join('');
    const printedAt = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Participantes — ${eventName}</title><style>${css}</style></head><body><h1>Participantes</h1><p class="meta">${eventName} · Gerado em ${printedAt} · ${participants.length} participante(s)</p>${body}</body></html>`);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
}

// ─── Page Component ─────────────────────────────────────────────────────────────

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: eventId } = use(params);
    const { user } = useAuth();
    const supabase = createClient();

    const [event, setEvent] = useState<any>(null);
    const [stats, setStats] = useState({ sold: 0, capacity: 0, revenue: 0, waitlist: 0, pending_forms: 0 });
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
    const [loading, setLoading] = useState(true);

    // Participants section state
    const [participantSearch, setParticipantSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [modalOrder, setModalOrder] = useState<Participant | null>(null);
    // Store form details fetched in modal, keyed by order.id
    const [allFormDetails, setAllFormDetails] = useState<Record<string, Record<string, any>>>({});
    const [bulkEmailSending, setBulkEmailSending] = useState(false);
    const [bulkEmailResult, setBulkEmailResult] = useState<string | null>(null);
    const [orgLogoBase64, setOrgLogoBase64] = useState<string | null>(null);

    // In-cart & delete state
    const [inCart, setInCart] = useState<{ sessions: number; quantity: number } | null>(null);
    const [deleteConfirmOrder, setDeleteConfirmOrder] = useState<Participant | null>(null);
    const [deleting, setDeleting] = useState(false);

    // CSV export modal state
    const [csvModalOpen, setCsvModalOpen] = useState(false);
    const [csvFields, setCsvFields] = useState<Array<{ id: string; label: string; type: string }>>([]);
    const [csvSelectedFields, setCsvSelectedFields] = useState<Set<string>>(new Set());
    const [csvFieldsLoading, setCsvFieldsLoading] = useState(false);

    // Waitlist state
    const [filterStatus, setFilterStatus] = useState('');
    const [filterPaymentStatus, setFilterPaymentStatus] = useState('');
    const [filterPaymentMethod, setFilterPaymentMethod] = useState('');
    const [filterFormStatus, setFilterFormStatus] = useState('');

    useEffect(() => {
        if (user && eventId) fetchData();
    }, [user, eventId]);

    // Poll in-cart reservations every 30s
    useEffect(() => {
        if (!user || !eventId) return;
        async function fetchInCart() {
            try {
                const res = await fetch(`/api/event-reservations?eventId=${eventId}`);
                if (res.ok) setInCart(await res.json());
            } catch {}
        }
        fetchInCart();
        const interval = setInterval(fetchInCart, 30_000);
        return () => clearInterval(interval);
    }, [user, eventId]);

    async function fetchData() {
        // Cancel expired pending orders for this event before loading data
        fetch('/api/cancel-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId }),
        }).catch(() => {});

        try {
            const { data: eventData } = await supabase
                .from('events')
                .select('*')
                .eq('id', eventId)
                .maybeSingle();

            if (!eventData) { setLoading(false); return; }
            setEvent(eventData);

            // Fetch org logo for PDF
            if (eventData.organization_id) {
                const { data: orgData } = await supabase
                    .from('organizations')
                    .select('logo_url')
                    .eq('id', eventData.organization_id)
                    .maybeSingle();
                if (orgData?.logo_url) {
                    fetchImageAsBase64(orgData.logo_url).then(b64 => setOrgLogoBase64(b64));
                }
            }

            const [
                { data: ticketsData },
                { data: ordersData },
                { data: typesData },
                { data: waitlistData },
                { data: participantsData },
            ] = await Promise.all([
                supabase.from('tickets').select('id').eq('event_id', eventId).in('status', ['active', 'used']),
                supabase.from('orders').select('total_amount').eq('event_id', eventId).eq('payment_status', 'paid'),
                supabase.from('event_ticket_types').select('quantity_available').eq('event_id', eventId),
                supabase.from('waitlist_entries').select('*').eq('event_id', eventId).order('position', { ascending: true }),
                // Fetch participants (paid orders with tickets)
                supabase.from('orders').select(`
                    id, participant_name, participant_email, participant_phone,
                    payment_method, payment_status, total_amount, paid_at, created_at, order_number,
                    tickets (
                        id, ticket_code, status,
                        event_ticket_types ( name )
                    )
                `).eq('event_id', eventId).order('paid_at', { ascending: false }),
            ]);

            const sold = ticketsData?.length ?? 0;
            const cap = typesData?.reduce((s: number, t: any) => s + (t.quantity_available || 0), 0) ?? 0;
            const rev = ordersData?.reduce((s: number, o: any) => s + parseFloat(o.total_amount || '0'), 0) ?? 0;

            // Calculate form status per participant
            const allParticipants = (participantsData || []) as unknown as Participant[];

            // Fetch form_responses for all tickets in bulk
            const allTicketIds = allParticipants.flatMap((p: Participant) => p.tickets?.map((t: any) => t.id) || []);
            let formStatusMap: Record<string, string> = {};
            if (allTicketIds.length > 0) {
                const { data: formResponses } = await supabase
                    .from('form_responses')
                    .select('ticket_id, status')
                    .in('ticket_id', allTicketIds);
                if (formResponses) {
                    formResponses.forEach((fr: any) => {
                        formStatusMap[fr.ticket_id] = fr.status;
                    });
                }
            }

            // Enrich participants with form status
            const enrichedParticipants = allParticipants.map((p: Participant) => {
                const ticketStatuses = (p.tickets || []).map((t: any) => formStatusMap[t.id]);
                const hasForm = ticketStatuses.some(s => s !== undefined);
                if (!hasForm) return { ...p, formStatus: 'no_form' as const };
                const allCompleted = ticketStatuses.every(s => s === 'completed');
                const allPending = ticketStatuses.every(s => s === 'pending');
                if (allCompleted) return { ...p, formStatus: 'all_completed' as const };
                if (allPending) return { ...p, formStatus: 'all_pending' as const };
                return { ...p, formStatus: 'mixed' as const };
            });

            const pendingForms = enrichedParticipants.filter((p: Participant) =>
                p.formStatus === 'all_pending' || p.formStatus === 'mixed'
            ).length;

            setStats({ sold, capacity: cap, revenue: rev, waitlist: waitlistData?.length ?? 0, pending_forms: pendingForms });
            setParticipants(enrichedParticipants);
            setWaitlist(waitlistData || []);
        } catch (err) {
            console.error('Error loading event detail:', err);
        } finally {
            setLoading(false);
        }
    }

    // Delete participant
    async function handleDeleteParticipant() {
        if (!deleteConfirmOrder) return;
        setDeleting(true);
        try {
            const res = await fetch('/api/delete-participant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: deleteConfirmOrder.id }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao excluir');
            setParticipants(prev => prev.filter(p => p.id !== deleteConfirmOrder.id));
            setSelectedIds(prev => { const n = new Set(prev); n.delete(deleteConfirmOrder.id); return n; });
            setDeleteConfirmOrder(null);
        } catch (err: any) {
            alert('Erro ao excluir: ' + err.message);
        } finally {
            setDeleting(false);
        }
    }

    // CSV export modal
    async function openCsvModal() {
        setCsvModalOpen(true);
        setCsvFieldsLoading(true);
        try {
            // Find the form linked to this event's tickets
            const { data: tickets } = await supabase
                .from('tickets')
                .select('id')
                .eq('event_id', eventId)
                .in('status', ['active', 'used'])
                .limit(1);

            if (!tickets || tickets.length === 0) { setCsvFieldsLoading(false); return; }

            const { data: response } = await supabase
                .from('form_responses')
                .select('form_id')
                .eq('ticket_id', tickets[0].id)
                .limit(1)
                .maybeSingle();

            if (!response?.form_id) { setCsvFieldsLoading(false); return; }

            const { data: fields } = await supabase
                .from('form_fields')
                .select('id, label, type')
                .eq('form_id', response.form_id)
                .neq('type', 'section_header')
                .neq('type', 'clause')
                .order('order_index', { ascending: true });

            setCsvFields(fields || []);
            // Select all by default
            setCsvSelectedFields(new Set((fields || []).map((f: any) => f.id)));
        } finally {
            setCsvFieldsLoading(false);
        }
    }

    function downloadCsv() {
        const fieldParam = csvSelectedFields.size > 0
            ? Array.from(csvSelectedFields).join(',')
            : 'all';
        const url = `/api/responses-csv?eventId=${eventId}&fields=${fieldParam}`;
        const a = document.createElement('a');
        a.href = url;
        a.download = '';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setCsvModalOpen(false);
    }

    // Waitlist functions
    async function updateWaitlistStatus(id: string, status: string) {
        const { error } = await supabase
            .from('waitlist_entries')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (!error) setWaitlist(prev => prev.map(e => e.id === id ? { ...e, status } : e));
    }

    async function deleteWaitlistEntry(id: string) {
        if (!confirm('Remover esta entrada da lista de espera?')) return;
        const { error } = await supabase.from('waitlist_entries').delete().eq('id', id);
        if (!error) setWaitlist(prev => prev.filter(e => e.id !== id));
    }

    // Participant selection
    function toggleSelect(id: string) {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    function toggleSelectAll() {
        if (selectedIds.size === filteredParticipants.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredParticipants.map(p => p.id)));
        }
    }

    function handlePrintPDF(order: Participant, formDetails: Record<string, any>) {
        setAllFormDetails(prev => ({ ...prev, [order.id]: formDetails }));
        printParticipantPDF(order, event?.name || '', formDetails, orgLogoBase64);
    }

    async function handleBulkPDF() {
        const selected = participants.filter(p => selectedIds.has(p.id));
        if (selected.length === 0) return;

        if (selected.length === 1) {
            await printParticipantPDF(selected[0], event?.name || '', allFormDetails[selected[0].id] || {}, orgLogoBase64);
            return;
        }

        // Multiple → ZIP via API
        try {
            const zip = new JSZip();
            await Promise.all(selected.map(async p => {
                const { pdf } = await generatePdfViaApi(p, event?.name || '', allFormDetails[p.id] || {}, orgLogoBase64);
                const bytes = dataUriToBytes(pdf);
                zip.file(`${sanitizeFilename(p.participant_name || 'participante')}.pdf`, bytes);
            }));
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${sanitizeFilename(event?.name || 'participantes')}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (err) {
            console.error('Erro ao gerar ZIP:', err);
            alert('Erro ao gerar ZIP: ' + (err instanceof Error ? err.message : String(err)));
        }
    }

    async function handleBulkEmail() {
        const selected = participants.filter(p => selectedIds.has(p.id));
        const withPendingForms = selected.filter(p =>
            p.formStatus === 'all_pending' || p.formStatus === 'mixed'
        );
        if (withPendingForms.length === 0) {
            alert('Nenhum dos participantes selecionados tem formulários pendentes.');
            return;
        }
        if (!confirm(`Enviar e-mail de formulário para ${withPendingForms.length} participante(s)?`)) return;

        setBulkEmailSending(true);
        setBulkEmailResult(null);
        let sent = 0;
        let failed = 0;

        for (const p of withPendingForms) {
            const pendingTickets = (p.tickets || []).filter((t: any) => {
                // We don't have per-ticket formStatus here, send for all tickets of participants with pending
                return true;
            });
            for (const ticket of pendingTickets) {
                try {
                    const res = await fetch('/api/send-form-reminder', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            ticketId: ticket.id,
                            email: p.participant_email,
                            name: p.participant_name,
                            eventName: event?.name || '',
                        }),
                    });
                    const data = await res.json();
                    if (data.success) sent++; else failed++;
                } catch {
                    failed++;
                }
            }
        }

        setBulkEmailSending(false);
        setBulkEmailResult(`✓ ${sent} e-mail(s) enviado(s)${failed > 0 ? ` · ${failed} falhou` : ''}`);
        setTimeout(() => setBulkEmailResult(null), 5000);
    }

    const filteredParticipants = participants.filter(p => {
        if (filterPaymentStatus && p.payment_status !== filterPaymentStatus) return false;
        if (filterPaymentMethod && p.payment_method !== filterPaymentMethod) return false;
        if (filterFormStatus && p.formStatus !== filterFormStatus) return false;
        if (!participantSearch) return true;
        const q = participantSearch.toLowerCase();
        return (p.participant_name || '').toLowerCase().includes(q) ||
            (p.participant_email || '').toLowerCase().includes(q);
    });

    const filteredWaitlist = filterStatus
        ? waitlist.filter(e => e.status === filterStatus)
        : waitlist;

    const paymentLabel: Record<string, string> = {
        pix: 'PIX', card: 'Cartão', boleto: 'Boleto',
        credit_card: 'Cartão', debit_card: 'Débito',
    };

    const waitlistStatusLabel: Record<string, string> = {
        waiting: 'Aguardando', notified: 'Notificado',
        converted: 'Convertido', expired: 'Expirado',
    };
    const waitlistStatusClass: Record<string, string> = {
        waiting: styles.statusWaiting, notified: styles.statusNotified,
        converted: styles.statusConverted, expired: styles.statusExpired,
    };
    const statusMap: Record<string, string> = {
        published: 'Publicado', draft: 'Rascunho',
        ended: 'Encerrado', cancelled: 'Cancelado',
    };
    const statusCardClass: Record<string, string> = {
        published: styles.statusPublished, draft: styles.statusDraft,
        ended: styles.statusEnded, cancelled: styles.statusCancelled,
    };

    if (loading) {
        return <div className={styles.container}><p>Carregando evento...</p></div>;
    }

    if (!event) {
        return (
            <div className={styles.container}>
                <Link href="/dashboard/events" className={styles.backBtn}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                    Voltar
                </Link>
                <p>Evento não encontrado.</p>
            </div>
        );
    }

    return (
        <>
            <div className={styles.container}>
                <Link href="/dashboard/events" className={styles.backBtn}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                    Voltar para Eventos
                </Link>

                {/* Event Header */}
                <div className={styles.eventCard}>
                    <div className={styles.eventHeader}>
                        <div
                            className={styles.eventImage}
                            style={{
                                backgroundImage: event.image_url
                                    ? `url(${event.image_url})`
                                    : 'linear-gradient(135deg, #4A90E2 0%, #357ABD 100%)'
                            }}
                        />
                        <div className={styles.eventInfo}>
                            <h1 className={styles.eventName}>{event.name}</h1>
                            <div className={styles.eventMeta}>
                                {event.event_date && (
                                    <span className={styles.metaItem}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                        {new Date(event.event_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                    </span>
                                )}
                                {event.location && (
                                    <span className={styles.metaItem}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                        {event.location}
                                    </span>
                                )}
                                <span className={`${styles.statusBadge} ${statusCardClass[event.status] || styles.statusDraft}`}>
                                    {statusMap[event.status] || event.status}
                                </span>
                            </div>
                        </div>
                        <div className={styles.headerActions}>
                            <button
                                onClick={openCsvModal}
                                className={styles.editBtn}
                                style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', cursor: 'pointer' }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                                </svg>
                                CSV Respostas
                            </button>
                            <a
                                href={`/api/shirt-report?eventId=${event.id}`}
                                download
                                className={styles.editBtn}
                                style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                                </svg>
                                CSV Camisas
                            </a>
                            <Link href={`/dashboard/events/new?id=${event.id}`} className={styles.editBtn}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                Editar Evento
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className={styles.statsRow}>
                    <div className={styles.statCard}>
                        <p className={styles.statLabel}>Ingressos Vendidos</p>
                        <p className={styles.statValue}>{stats.sold}</p>
                        <p className={styles.statSub}>de {stats.capacity || '—'} disponíveis</p>
                    </div>
                    <div className={styles.statCard}>
                        <p className={styles.statLabel}>Receita</p>
                        <p className={styles.statValue}>
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.revenue)}
                        </p>
                        <p className={styles.statSub}>pedidos pagos</p>
                    </div>
                    <div className={styles.statCard}>
                        <p className={styles.statLabel}>Ocupação</p>
                        <p className={styles.statValue}>
                            {stats.capacity > 0 ? `${Math.min(Math.round((stats.sold / stats.capacity) * 100), 100)}%` : '—'}
                        </p>
                        <p className={styles.statSub}>da capacidade</p>
                    </div>
                    <div className={styles.statCard}>
                        <p className={styles.statLabel}>Formulários Pendentes</p>
                        <p className={styles.statValue} style={{ color: stats.pending_forms > 0 ? '#d97706' : 'inherit' }}>
                            {stats.pending_forms}
                        </p>
                        <p className={styles.statSub}>aguardando resposta</p>
                    </div>
                    <div className={styles.statCard} style={{ borderLeft: '3px solid #f59e0b' }}>
                        <p className={styles.statLabel} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: inCart && inCart.quantity > 0 ? '#f59e0b' : '#d1d5db', display: 'inline-block' }} />
                            No Carrinho
                        </p>
                        <p className={styles.statValue} style={{ color: inCart && inCart.quantity > 0 ? '#d97706' : 'inherit' }}>
                            {inCart === null ? '…' : inCart.quantity}
                        </p>
                        <p className={styles.statSub}>
                            {inCart === null ? 'carregando' : inCart.sessions === 0 ? 'nenhuma reserva ativa' : `${inCart.sessions} pessoa${inCart.sessions > 1 ? 's' : ''} no checkout`}
                        </p>
                    </div>
                </div>

                {/* ── Participants Section ── */}
                <div className={styles.sectionCard}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>
                            Participantes
                            {participants.length > 0 && (
                                <span className={styles.sectionBadge}>{participants.length}</span>
                            )}
                        </h2>
                        <div className={styles.filterRow}>
                            {selectedIds.size > 0 && (
                                <>
                                    <button
                                        className={styles.bulkPdfBtn}
                                        onClick={handleBulkEmail}
                                        disabled={bulkEmailSending}
                                        style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                                        </svg>
                                        {bulkEmailSending ? 'Enviando...' : `Enviar E-mail (${selectedIds.size})`}
                                    </button>
                                    <button className={styles.bulkPdfBtn} onClick={handleBulkPDF}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                                            <rect x="6" y="14" width="12" height="8"/>
                                        </svg>
                                        {selectedIds.size === 1 ? 'Baixar PDF' : `Baixar ZIP (${selectedIds.size})`}
                                    </button>
                                    {bulkEmailResult && (
                                        <span style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>
                                            {bulkEmailResult}
                                        </span>
                                    )}
                                </>
                            )}
                            <select
                                className={styles.filterSelect}
                                value={filterPaymentStatus}
                                onChange={e => setFilterPaymentStatus(e.target.value)}
                            >
                                <option value="">Todos os status</option>
                                <option value="paid">Pago</option>
                                <option value="pending">Pendente</option>
                                <option value="cancelled">Cancelado</option>
                            </select>
                            <select
                                className={styles.filterSelect}
                                value={filterPaymentMethod}
                                onChange={e => setFilterPaymentMethod(e.target.value)}
                            >
                                <option value="">Todos os métodos</option>
                                <option value="pix">PIX</option>
                                <option value="card">Cartão</option>
                                <option value="credit_card">Cartão</option>
                            </select>
                            <select
                                className={styles.filterSelect}
                                value={filterFormStatus}
                                onChange={e => setFilterFormStatus(e.target.value)}
                            >
                                <option value="">Todos os formulários</option>
                                <option value="all_completed">Preenchido</option>
                                <option value="all_pending">Pendente</option>
                                <option value="no_form">Sem formulário</option>
                            </select>
                            <div className={styles.searchBox}>
                                <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                                </svg>
                                <input
                                    type="text"
                                    className={styles.searchInput}
                                    placeholder="Buscar participante..."
                                    value={participantSearch}
                                    onChange={(e) => setParticipantSearch(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {participants.length === 0 ? (
                        <div className={styles.emptyState}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                <circle cx="9" cy="7" r="4"/>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                            </svg>
                            <p>Nenhum participante ainda.</p>
                            <p style={{ color: '#d1d5db' }}>Os compradores aparecerão aqui após o pagamento.</p>
                        </div>
                    ) : (
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th style={{ width: 40 }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.size === filteredParticipants.length && filteredParticipants.length > 0}
                                            onChange={toggleSelectAll}
                                        />
                                    </th>
                                    <th>Participante</th>
                                    <th>Telefone</th>
                                    <th>Data da Compra</th>
                                    <th>Pagamento</th>
                                    <th>Status</th>
                                    <th>Ingressos</th>
                                    <th>Formulário</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredParticipants.map((p) => (
                                    <tr key={p.id}>
                                        <td>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(p.id)}
                                                onChange={() => toggleSelect(p.id)}
                                            />
                                        </td>
                                        <td>
                                            {p.order_number && (
                                                <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', fontFamily: 'monospace', marginBottom: '2px' }}>
                                                    #{p.order_number}
                                                </div>
                                            )}
                                            <div className={styles.nameBold}>{p.participant_name}</div>
                                            <div className={styles.emailText}>{p.participant_email}</div>
                                        </td>
                                        <td style={{ color: '#6b7280', fontSize: '13px' }}>
                                            {p.participant_phone || '—'}
                                        </td>
                                        <td style={{ fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                                            {p.created_at ? (
                                                <>
                                                    <div>{new Date(p.created_at).toLocaleDateString('pt-BR')}</div>
                                                    <div style={{ fontSize: '11px' }}>{new Date(p.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                                                </>
                                            ) : '—'}
                                        </td>
                                        <td>
                                            <span style={{
                                                fontSize: '12px', fontWeight: 600,
                                                padding: '2px 8px', borderRadius: '6px',
                                                background: p.payment_method === 'pix' ? '#f0fdf4' : p.payment_method === 'boleto' ? '#fef3c7' : '#eff6ff',
                                                color: p.payment_method === 'pix' ? '#166534' : p.payment_method === 'boleto' ? '#92400e' : '#1e40af',
                                            }}>
                                                {paymentLabel[p.payment_method || ''] || p.payment_method || '—'}
                                            </span>
                                        </td>
                                        <td>
                                            {(() => {
                                                const s = p.payment_status;
                                                const cfg: Record<string, { label: string; bg: string; color: string }> = {
                                                    paid:      { label: 'Pago',      bg: '#dcfce7', color: '#166534' },
                                                    pending:   { label: 'Pendente',  bg: '#fef9c3', color: '#854d0e' },
                                                    cancelled: { label: 'Cancelado', bg: '#fee2e2', color: '#991b1b' },
                                                    refunded:  { label: 'Reembolso', bg: '#f3f4f6', color: '#374151' },
                                                };
                                                const c = cfg[s] || { label: s || '—', bg: '#f3f4f6', color: '#6b7280' };
                                                return (
                                                    <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: c.bg, color: c.color }}>
                                                        {c.label}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td style={{ fontSize: '13px', color: '#374151' }}>
                                            {p.tickets?.length || 0}x
                                        </td>
                                        <td>
                                            {p.formStatus === 'no_form' ? (
                                                <span style={{ fontSize: '12px', color: '#9ca3af' }}>—</span>
                                            ) : p.formStatus === 'all_completed' ? (
                                                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: '#dcfce7', color: '#166534' }}>
                                                    Preenchido
                                                </span>
                                            ) : (
                                                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: '#fef9c3', color: '#854d0e' }}>
                                                    Pendente
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                            <button
                                                className={styles.actionBtn}
                                                onClick={() => setModalOrder(p)}
                                            >
                                                Ver Detalhes
                                            </button>
                                            <button
                                                className={styles.deleteBtn}
                                                onClick={() => setDeleteConfirmOrder(p)}
                                                title="Excluir participante"
                                            >
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                                                </svg>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* ── Waitlist Section ── */}
                <div className={styles.sectionCard}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>
                            Lista de Espera
                            {waitlist.length > 0 && (
                                <span className={styles.sectionBadge}>{waitlist.length}</span>
                            )}
                        </h2>
                        {waitlist.length > 0 && (
                            <div className={styles.filterRow}>
                                <select
                                    className={styles.select}
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                >
                                    <option value="">Todos</option>
                                    <option value="waiting">Aguardando</option>
                                    <option value="notified">Notificados</option>
                                    <option value="converted">Convertidos</option>
                                    <option value="expired">Expirados</option>
                                </select>
                            </div>
                        )}
                    </div>

                    {!event.allow_waitlist && waitlist.length === 0 ? (
                        <div className={styles.noWaitlistPanel}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                                <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
                                <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                            </svg>
                            <p>Lista de espera desativada para este evento.</p>
                            <p style={{ color: '#d1d5db', marginTop: 4 }}>
                                Ative a opção "Permitir lista de espera" ao editar o evento.
                            </p>
                        </div>
                    ) : waitlist.length === 0 ? (
                        <div className={styles.emptyState}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                <circle cx="9" cy="7" r="4"/>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                            </svg>
                            <p>Nenhuma pessoa na lista de espera ainda.</p>
                        </div>
                    ) : filteredWaitlist.length === 0 ? (
                        <div className={styles.emptyState}><p>Nenhuma entrada com este status.</p></div>
                    ) : (
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Nome / E-mail</th>
                                    <th>Telefone</th>
                                    <th>Status</th>
                                    <th>Data</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredWaitlist.map((entry) => (
                                    <tr key={entry.id}>
                                        <td><span className={styles.positionBadge}>{entry.position}</span></td>
                                        <td>
                                            <div className={styles.nameBold}>{entry.name}</div>
                                            <div className={styles.emailText}>{entry.email}</div>
                                        </td>
                                        <td style={{ color: '#6b7280' }}>{entry.phone || '—'}</td>
                                        <td>
                                            <span className={`${styles.statusBadgeSm} ${waitlistStatusClass[entry.status] || styles.statusWaiting}`}>
                                                {waitlistStatusLabel[entry.status] || entry.status}
                                            </span>
                                        </td>
                                        <td style={{ color: '#6b7280', fontSize: '12px' }}>
                                            {new Date(entry.created_at).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td>
                                            {entry.status === 'waiting' && (
                                                <button className={styles.actionBtn} onClick={() => updateWaitlistStatus(entry.id, 'notified')}>
                                                    Marcar Notificado
                                                </button>
                                            )}
                                            {entry.status === 'notified' && (
                                                <button className={styles.actionBtn} onClick={() => updateWaitlistStatus(entry.id, 'converted')}>
                                                    Marcar Convertido
                                                </button>
                                            )}
                                            <button className={styles.deleteBtn} onClick={() => deleteWaitlistEntry(entry.id)}>
                                                Remover
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Participant Modal */}
            {modalOrder && (
                <ParticipantModal
                    order={modalOrder}
                    eventName={event?.name || ''}
                    onClose={() => setModalOrder(null)}
                    onPrintPDF={handlePrintPDF}
                />
            )}

            {/* Delete Participant Confirmation Modal */}
            {deleteConfirmOrder && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                    onClick={(e) => { if (!deleting && e.target === e.currentTarget) setDeleteConfirmOrder(null); }}
                >
                    <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/>
                                </svg>
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Excluir Participante</h3>
                                <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Esta ação não pode ser desfeita</p>
                            </div>
                        </div>

                        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px' }}>
                            <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: '#111827' }}>{deleteConfirmOrder.participant_name}</p>
                            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>{deleteConfirmOrder.participant_email}</p>
                            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>Pedido #{deleteConfirmOrder.order_number}</p>
                        </div>

                        <p style={{ margin: 0, fontSize: 13, color: '#374151' }}>
                            Isso irá excluir permanentemente o pedido, ingressos, respostas de formulário e todos os dados relacionados.
                            {deleteConfirmOrder.payment_status === 'paid' && (
                                <span style={{ display: 'block', marginTop: 6, color: '#d97706', fontWeight: 600 }}>
                                    ⚠ Este pedido foi pago — o estoque será restaurado automaticamente.
                                </span>
                            )}
                        </p>

                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setDeleteConfirmOrder(null)}
                                disabled={deleting}
                                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 14 }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDeleteParticipant}
                                disabled={deleting}
                                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: deleting ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600, opacity: deleting ? 0.7 : 1 }}
                            >
                                {deleting ? 'Excluindo...' : 'Excluir Permanentemente'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CSV Export Modal */}
            {csvModalOpen && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                    onClick={(e) => { if (e.target === e.currentTarget) setCsvModalOpen(false); }}
                >
                    <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Exportar CSV de Respostas</h3>
                            <button onClick={() => setCsvModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#6b7280', lineHeight: 1 }}>×</button>
                        </div>

                        <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
                            O CSV sempre inclui: nome, e-mail, telefone, tipo de ingresso, código, pagamento e status do formulário.
                            Selecione abaixo quais campos do formulário adicionar:
                        </p>

                        {csvFieldsLoading ? (
                            <div style={{ textAlign: 'center', padding: '24px 0', color: '#6b7280', fontSize: 14 }}>Carregando campos...</div>
                        ) : csvFields.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '24px 0', color: '#6b7280', fontSize: 14 }}>
                                Nenhum campo de formulário encontrado para este evento.
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'flex', gap: 8, marginBottom: -8 }}>
                                    <button
                                        onClick={() => setCsvSelectedFields(new Set(csvFields.map(f => f.id)))}
                                        style={{ fontSize: 12, color: '#1d4ed8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                    >
                                        Selecionar todos
                                    </button>
                                    <span style={{ color: '#d1d5db' }}>|</span>
                                    <button
                                        onClick={() => setCsvSelectedFields(new Set())}
                                        style={{ fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                    >
                                        Limpar seleção
                                    </button>
                                </div>
                                <div style={{ overflowY: 'auto', maxHeight: 300, display: 'flex', flexDirection: 'column', gap: 6, border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                                    {csvFields.map(field => (
                                        <label key={field.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: '#111827', padding: '4px 0' }}>
                                            <input
                                                type="checkbox"
                                                checked={csvSelectedFields.has(field.id)}
                                                onChange={(e) => {
                                                    setCsvSelectedFields(prev => {
                                                        const next = new Set(prev);
                                                        e.target.checked ? next.add(field.id) : next.delete(field.id);
                                                        return next;
                                                    });
                                                }}
                                                style={{ width: 16, height: 16, accentColor: '#1d4ed8', flexShrink: 0 }}
                                            />
                                            <span>{field.label}</span>
                                            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9ca3af', background: '#f3f4f6', borderRadius: 4, padding: '1px 6px' }}>
                                                {field.type}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </>
                        )}

                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                            <button
                                onClick={() => setCsvModalOpen(false)}
                                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 14 }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={downloadCsv}
                                disabled={csvFieldsLoading}
                                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#1d4ed8', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                                </svg>
                                Baixar CSV
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
