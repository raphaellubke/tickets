'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import AuthModal from '@/components/AuthModal/AuthModal';
import styles from './Header.module.css';

export default function Header() {
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const { user } = useAuth();

    return (
        <>
            <header className={styles.header}>
                <div className={styles.container}>
                    <Link href="/" className={styles.logo}>
                        <span className={styles.logoIcon}>✝️</span>
                        <span className={styles.logoText}>Missão Guadalupe</span>
                    </Link>


                    <div className={styles.searchContainer}>
                        <input
                            type="text"
                            placeholder="Busque um evento, igreja, local..."
                            className={styles.searchInput}
                        />
                        <button className={styles.searchButton}>
                            🔍
                        </button>
                    </div>

                    <div className={styles.actions}>
                        <Link href="/dashboard" className={styles.createEvent}>
                            <span className={styles.createIcon}>+</span>
                            Crie seu evento
                        </Link>
                        {user ? (
                            <Link href="/profile" className={styles.profileButton}>
                                <span className={styles.profileIcon}>👤</span>
                                Meu Perfil
                            </Link>
                        ) : (
                            <button 
                                onClick={() => setIsAuthModalOpen(true)}
                                className={styles.loginButton}
                            >
                                Entrar ou cadastrar
                            </button>
                        )}
                    </div>
                </div>
            </header>
            <AuthModal 
                isOpen={isAuthModalOpen} 
                onClose={() => setIsAuthModalOpen(false)} 
            />
        </>
    );
}
