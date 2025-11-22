'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import styles from './page.module.css';

function PaymentPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const supabase = createClient();
    
    const paymentId = searchParams.get('payment_id');
    const method = searchParams.get('method');
    
    const [payment, setPayment] = useState<any>(null);
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadPayment() {
            if (!paymentId) {
                setError('ID do pagamento não encontrado');
                setLoading(false);
                return;
            }

            try {
                const { data: paymentData, error: paymentError } = await supabase
                    .from('payments')
                    .select(`
                        *,
                        orders!inner(*)
                    `)
                    .eq('id', paymentId)
                    .single();

                if (paymentError || !paymentData) {
                    setError('Pagamento não encontrado');
                    setLoading(false);
                    return;
                }

                setPayment(paymentData);
                setOrder(paymentData.orders);
            } catch (err: any) {
                console.error('Error loading payment:', err);
                setError(err.message || 'Erro ao carregar pagamento');
            } finally {
                setLoading(false);
            }
        }

        loadPayment();
    }, [paymentId]);

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(price);
    };

    if (loading) {
        return (
            <main className={styles.main}>
                <Header />
                <div className={styles.loadingContainer}>
                    <div className={styles.spinner}></div>
                    <p>Carregando pagamento...</p>
                </div>
                <Footer />
            </main>
        );
    }

    if (error || !payment) {
        return (
            <main className={styles.main}>
                <Header />
                <div className={styles.errorContainer}>
                    <h2>Erro</h2>
                    <p>{error || 'Pagamento não encontrado'}</p>
                    <button onClick={() => router.push('/')} className={styles.backButton}>
                        Voltar ao início
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
                <div className={styles.paymentCard}>
                    <h1 className={styles.title}>Processando Pagamento</h1>
                    
                    {method === 'pix' && (
                        <div className={styles.pixSection}>
                            <div className={styles.qrCodePlaceholder}>
                                <p>QR Code PIX</p>
                                <p className={styles.amount}>{formatPrice(parseFloat(payment.amount?.toString() || '0'))}</p>
                            </div>
                            <p className={styles.pixInstructions}>
                                Escaneie o QR Code com o app do seu banco ou copie o código PIX abaixo
                            </p>
                            <div className={styles.pixCode}>
                                <code>00020126580014BR.GOV.BCB.PIX...</code>
                                <button className={styles.copyButton}>Copiar</button>
                            </div>
                        </div>
                    )}

                    {method === 'card' && (
                        <div className={styles.cardSection}>
                            <p>Integração com gateway de pagamento em desenvolvimento</p>
                        </div>
                    )}

                    {method === 'boleto' && (
                        <div className={styles.boletoSection}>
                            <p>Boleto gerado com sucesso!</p>
                            <p>Vencimento: {new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')}</p>
                            <button className={styles.downloadButton}>Baixar Boleto</button>
                        </div>
                    )}

                    <div className={styles.orderInfo}>
                        <p>Pedido: <strong>{order?.order_number}</strong></p>
                        <p>Valor: <strong>{formatPrice(parseFloat(payment.amount?.toString() || '0'))}</strong></p>
                    </div>
                </div>
            </div>

            <Footer />
        </main>
    );
}

export default function PaymentPage() {
    return (
        <Suspense fallback={
            <main className={styles.main}>
                <Header />
                <div className={styles.loadingContainer}>
                    <div className={styles.spinner}></div>
                    <p>Carregando...</p>
                </div>
                <Footer />
            </main>
        }>
            <PaymentPageContent />
        </Suspense>
    );
}

