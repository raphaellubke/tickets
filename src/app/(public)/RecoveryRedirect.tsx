'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Fallback: if Supabase sends the recovery token to the home page (because
// /nova-senha isn't whitelisted as a redirect URL in the Supabase dashboard),
// detect it here and forward the user to the correct page.
export default function RecoveryRedirect() {
    const router = useRouter();

    useEffect(() => {
        const hash = window.location.hash.substring(1);
        if (!hash) return;
        const params = new URLSearchParams(hash);
        if (params.get('type') === 'recovery' && params.get('access_token')) {
            router.replace('/nova-senha' + window.location.hash);
        }
    }, [router]);

    return null;
}
