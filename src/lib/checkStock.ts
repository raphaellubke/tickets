import { createClient } from '@supabase/supabase-js';

/**
 * Checks if all items in an order have sufficient stock.
 * Returns null if OK, or an error message string if stock is insufficient.
 */
export async function checkOrderStock(orderId: string): Promise<string | null> {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn('checkOrderStock: missing env vars, skipping stock check');
        return null;
    }
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: items, error } = await supabase
        .from('order_items')
        .select('quantity, ticket_type_id, event_ticket_types(name, quantity_available, quantity_sold)')
        .eq('order_id', orderId);

    if (error || !items) return 'Erro ao verificar disponibilidade de ingressos.';

    for (const item of items) {
        const type = item.event_ticket_types as any;
        if (!type) continue;

        const maxQty = type.quantity_available ?? null;
        const sold = type.quantity_sold ?? 0;

        if (maxQty !== null && sold + item.quantity > maxQty) {
            const remaining = Math.max(0, maxQty - sold);
            return `Ingresso "${type.name}" esgotado ou sem quantidade suficiente. Disponível: ${remaining}.`;
        }
    }

    return null;
}
