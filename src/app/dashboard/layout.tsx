'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import InviteMemberModal from '@/components/InviteMemberModal/InviteMemberModal';
import styles from './layout.module.css';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, signOut } = useAuth();
    const [hasOrganization, setHasOrganization] = useState<boolean | null>(null);
    const [organization, setOrganization] = useState<{ name: string; logo_url?: string | null } | null>(null);
    const [userRole, setUserRole] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const sidebarRef = useRef<HTMLElement>(null);
    const supabase = createClient();

    // Check if user has an organization and load organization data
    useEffect(() => {
        async function checkOrganization() {
            if (!user) {
                setLoading(false);
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('organization_members')
                    .select('id, organization_id, role')
                    .eq('user_id', user.id)
                    .limit(1);

                if (error) {
                    console.error('Error checking organization:', error);
                    setHasOrganization(false);
                    return;
                }

                let member = data?.[0];

                // If not found by user_id, check for pending invite by email and auto-accept
                if (!member && user.email) {
                    const { data: pending } = await supabase
                        .from('organization_members')
                        .select('id, organization_id, role')
                        .eq('email', user.email)
                        .limit(1);

                    if (pending?.[0]) {
                        await supabase
                            .from('organization_members')
                            .update({ user_id: user.id, status: 'active', joined_at: new Date().toISOString() })
                            .eq('id', pending[0].id);
                        member = pending[0];
                    }
                }

                if (member) {
                    setHasOrganization(true);
                    setUserRole(member.role || 'member');

                    // Load organization details
                    const { data: orgData } = await supabase
                        .from('organizations')
                        .select('name, logo_url')
                        .eq('id', member.organization_id)
                        .single();

                    if (orgData) {
                        setOrganization({
                            name: orgData.name,
                            logo_url: orgData.logo_url
                        });
                    }
                } else {
                    // Not a member of any organization — redirect to personal tickets page
                    router.replace('/meus-ingressos');
                    return;
                }
            } catch (err) {
                console.error('Error in checkOrganization:', err);
                router.replace('/meus-ingressos');
                return;
            } finally {
                setLoading(false);
            }
        }

        checkOrganization();
    }, [user]);

    // Close sidebar on route change (mobile)
    useEffect(() => {
        setSidebarOpen(false);
    }, [pathname]);

    // Close sidebar when clicking outside (mobile)
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (sidebarOpen && sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
                setSidebarOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [sidebarOpen]);

    // Show loading state
    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
                <p>Carregando...</p>
            </div>
        );
    }

    const mainNavItems = [
        { label: 'Visão Geral', href: '/dashboard', icon: 'grid' },
        { label: 'Eventos', href: '/dashboard/events', icon: 'calendar' },
        { label: 'Formulário', href: '/dashboard/form', icon: 'file-text' },
        { label: 'Tickets', href: '/dashboard/tickets', icon: 'ticket' },
        { label: 'Cupons', href: '/dashboard/coupons', icon: 'coupon' },
        { label: 'Organização', href: '/dashboard/organization', icon: 'building' },
        { label: 'Membros', href: '/dashboard/members', icon: 'users' },
    ];

    const bottomNavItems = [
        { label: 'Convidar Membros', href: '/dashboard/invite', icon: 'user-plus' },
        { label: 'Configurações', href: '/dashboard/settings', icon: 'settings' },
        { label: 'Suporte', href: '/dashboard/support', icon: 'help-circle' },
    ];

    const isActive = (href: string) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

    const renderIcon = (icon: string) => {
        switch (icon) {
            case 'grid': return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></svg>;
            case 'calendar': return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
            case 'file-text': return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>;
            case 'ticket': return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 11v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V11a2 2 0 0 0-2-2 2 2 0 0 1 0-4 2 2 0 0 0 2-2V3a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2a2 2 0 0 1 0 4 2 2 0 0 0-2 2z" /></svg>;
            case 'building': return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2" /><line x1="9" y1="22" x2="9" y2="22.01" /><line x1="15" y1="22" x2="15" y2="22.01" /><line x1="9" y1="18" x2="9" y2="18.01" /><line x1="15" y1="18" x2="15" y2="18.01" /><line x1="9" y1="14" x2="9" y2="14.01" /><line x1="15" y1="14" x2="15" y2="14.01" /><line x1="9" y1="10" x2="9" y2="10.01" /><line x1="15" y1="10" x2="15" y2="10.01" /><line x1="9" y1="6" x2="9" y2="6.01" /><line x1="15" y1="6" x2="15" y2="6.01" /></svg>;
            case 'users': return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
            case 'coupon': return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 11v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V11a2 2 0 0 0-2-2 2 2 0 0 1 0-4 2 2 0 0 0 2-2V3a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2a2 2 0 0 1 0 4 2 2 0 0 0-2 2z" /><line x1="9" y1="12" x2="15" y2="12" /></svg>;
            case 'waitlist': return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>;
            case 'user-plus': return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>;
            case 'settings': return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>;
            case 'help-circle': return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
            default: return null;
        }
    };

    return (
        <div className={styles.layout}>
            {sidebarOpen && <div className={styles.backdrop} onClick={() => setSidebarOpen(false)} />}
            <aside ref={sidebarRef} className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
                <div className={styles.sidebarHeader}>
                    <div className={styles.orgSwitcher}>
                        {organization?.logo_url ? (
                            <img 
                                src={organization.logo_url} 
                                alt={organization.name}
                                className={styles.orgLogo}
                            />
                        ) : (
                            <div className={styles.orgIcon}>
                                {organization?.name?.[0]?.toUpperCase() || 'D'}
                            </div>
                        )}
                        <div className={styles.orgInfo}>
                            <span className={styles.orgName}>
                                {organization?.name || 'Missão Guadalupe'}
                            </span>
                            <span className={styles.orgRole}>
                                {userRole === 'owner' ? 'Proprietário' : 
                                 userRole === 'admin' ? 'Administrador' : 
                                 userRole === 'member' ? 'Membro' : 
                                 userRole === 'viewer' ? 'Visualizador' : 'Organização'}
                            </span>
                        </div>
                        <svg className={styles.chevron} width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                </div>

                <nav className={styles.nav}>
                    <div className={styles.navSection}>
                        <span className={styles.navTitle}>Menu Principal</span>
                        {mainNavItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`${styles.navItem} ${isActive(item.href) ? styles.active : ''}`}
                            >
                                {renderIcon(item.icon)}
                                {item.label}
                            </Link>
                        ))}
                    </div>

                    <div className={styles.navSpacer} />

                    <div className={styles.navSection}>
                        {bottomNavItems.map((item) => {
                            // Special handling for "Convidar Membros" - open modal instead of navigating
                            if (item.label === 'Convidar Membros') {
                                return (
                                    <button
                                        key={item.href}
                                        onClick={() => setIsInviteModalOpen(true)}
                                        className={styles.navItem}
                                    >
                                        {renderIcon(item.icon)}
                                        {item.label}
                                    </button>
                                );
                            }
                            
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`${styles.navItem} ${isActive(item.href) ? styles.active : ''}`}
                                >
                                    {renderIcon(item.icon)}
                                    {item.label}
                                </Link>
                            );
                        })}
                    </div>
                </nav>

                <div className={styles.sidebarFooter}>
                    <div className={styles.userProfile}>
                        <div className={styles.avatar}>
                            {user?.user_metadata?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className={styles.userInfo}>
                            <span className={styles.userName}>
                                {user?.user_metadata?.full_name || 'Usuário'}
                            </span>
                            <span className={styles.userEmail}>{user?.email}</span>
                        </div>
                        <button
                            onClick={() => signOut()}
                            className={styles.signOutBtn}
                            title="Sair"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                        </button>
                    </div>
                </div>
            </aside>

            <main className={styles.main}>
                <header className={styles.header}>
                    <div className={styles.breadcrumbs}>
                        <span className={styles.breadcrumbItem}>Dashboard</span>
                        {pathname !== '/dashboard' && (
                            <>
                                <span className={styles.separator}>/</span>
                                <span className={styles.breadcrumbItemActive}>
                                    {mainNavItems.find(i => pathname.startsWith(i.href))?.label ||
                                        bottomNavItems.find(i => pathname.startsWith(i.href))?.label || 'Página'}
                                </span>
                            </>
                        )}
                    </div>
                    <div className={styles.headerActions}>
                        <Link href="/" className={styles.siteLink}>
                            Ver Site
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                        </Link>
                        <button
                            className={styles.hamburger}
                            onClick={() => setSidebarOpen(o => !o)}
                            aria-label="Abrir menu"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="3" y1="6" x2="21" y2="6" />
                                <line x1="3" y1="12" x2="21" y2="12" />
                                <line x1="3" y1="18" x2="21" y2="18" />
                            </svg>
                        </button>
                    </div>
                </header>
                <div className={styles.content}>
                    {children}
                </div>
            </main>

            {/* Invite Member Modal */}
            <InviteMemberModal
                isOpen={isInviteModalOpen}
                onClose={() => setIsInviteModalOpen(false)}
                onSuccess={() => {
                    setIsInviteModalOpen(false);
                    // Optionally refresh the page or update members list
                    if (pathname === '/dashboard/members') {
                        window.location.reload();
                    }
                }}
            />
        </div>
    );
}
