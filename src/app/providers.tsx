'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider } from '@/context/AuthContext';

function RecoveryRedirect() {
    const router = useRouter();
    useEffect(() => {
        const hash = window.location.hash.substring(1);
        if (!hash) return;
        const params = new URLSearchParams(hash);
        if (params.get('type') === 'recovery' && params.get('access_token')) {
            // Token landed on the wrong page — forward to /nova-senha with same hash
            router.replace('/nova-senha' + window.location.hash);
        }
    }, []);
    return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <RecoveryRedirect />
            {children}
        </AuthProvider>
    );
}
